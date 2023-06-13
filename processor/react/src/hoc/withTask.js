import React, { useState, useEffect, useRef } from "react";
import {
  log,
  logWithComponent,
  getObjectDifference,
  hasOnlyResponseKey,
  setNestedProperties,
  deepMerge,
  checkConflicts,
} from "../utils/utils";
import useUpdateTask from "../hooks/useUpdateTask";
import useStartTask from "../hooks/useStartTask";
import useNextTask from "../hooks/useNextTask";
import withDebug from "./withDebug";
import _ from "lodash";
import useUpdateWSFilter from "../hooks/useUpdateWSFilter";
import useStartWSFilter from "../hooks/useStartWSFilter";
import useNextWSFilter from "../hooks/useNextWSFilter";
import useErrorWSFilter from "../hooks/useErrorWSFilter";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import useWebSocketContext from "../contexts/WebSocketContext";

// When a task is shared then changes are detected at each wrapper

function withTask(Component) {
  const WithDebugComponent = withDebug(Component);

  const componentName = WithDebugComponent.displayName; // So we get the Component that was wrapped by withDebug

  function TaskComponent(props) {

    const local_stackPtr = useRef();
    if (typeof props.stackPtr === "number") {
      local_stackPtr.current = props.stackPtr + 1;
    } else {
      //console.log("Defaulting to stackPtr 0")
      local_stackPtr.current = 0;
    }

    const { globalState } = useGlobalStateContext();
    const [isMounted, setIsMounted] = useState();
    const [prevTask, setPrevTask] = useState();
    const [doneTask, setDoneTask] = useState();
    const [startTaskId, setStartTaskId] = useState();
    const [lastStartTaskId, setLastStartTaskId] = useState();
    const [startTaskThreadId, setStartTaskThreadId] = useState();
    const [startTaskDepth, setStartTaskDepth] = useState(local_stackPtr.current);
    // By passing the stackPtr we know which layer is sending the task
    // Updates to the task might be visible in other layers
    // Could allow for things like changing config from an earlier component
    const { updateTaskError } = useUpdateTask(
      props.task,
      props.setTask,
      local_stackPtr.current
    );
    const [nextTask, setNextTask] = useState();
    const { nextTaskError } = useNextTask(doneTask);
    const [startTaskReturned, setStartTaskReturned] = useState();
    const { startTaskError } = useStartTask(startTaskId, setStartTaskId, startTaskThreadId, startTaskDepth);
    const lastStateRef = useRef("");

    const handleChildDidMount = () => {
      // This is called during the rendering of the Task and even though
      // this is a HoC w get warnings for changing state during rendering
      // So adding this delay will update outside of the rendering of Task
      setTimeout(() => setIsMounted(true), 0);
    }

    useUpdateWSFilter(isMounted, local_stackPtr, props.task,
      async (updateDiff) => {
        console.log("useUpdateWSFilter updateDiff.stackPtr === local_stackPtr", updateDiff.stackPtr, local_stackPtr.current);
        if (updateDiff.stackPtr === local_stackPtr.current) {
          const lastTask = await globalState.storageRef.current.get(props.task.instanceId);
          //console.log("Storage get ", props.task.id, props.task.instanceId, lastTask);
          //console.log("lastTask", lastTask)
          // If the resource has been locked then ignore whatever was done locally
          let currentTaskDiff = {};
          if (lastTask.locked === globalState.processorId) {
            currentTaskDiff = getObjectDifference(lastTask, props.task);
          }
          //console.log("currentTaskDiff", currentTaskDiff);
          //console.log("updateDiff", updateDiff);
          //const currentUpdateDiff = getObjectDifference(currentTaskDiff, updateDiff);
          //console.log("currentUpdateDiff", currentUpdateDiff);
          // ignore differences in source & updatedAt & lock
          delete currentTaskDiff.source
          delete currentTaskDiff.updatedAt
          delete currentTaskDiff.lock
          // partial updates to response can cause conflicts
          // Needs further thought
          delete currentTaskDiff.response
          if (lastTask.locked === globalState.processorId) {
            // Priority to local changes
            delete updateDiff.update;
          }
          if (checkConflicts(currentTaskDiff, updateDiff)) {
            console.error("CONFLICT currentTaskDiff, updateDiff ", currentTaskDiff, updateDiff);
            //throw new Error("CONFLICT");
          }
          modifyTask(updateDiff);
          // Important we record updateDiff as it was sent to keep in sync with Hub
          await globalState.storageRef.current.set(props.task.instanceId, deepMerge(lastTask, updateDiff));
          const newTask = await globalState.storageRef.current.get(props.task.instanceId);
          console.log("Storage update ", props.task.id, props.task.instanceId, updateDiff);
          //console.log("Storage task ", props.task.id, props.task.instanceId, mergedTask);
        }
      }
    )

    useStartWSFilter(useGlobalStateContext, lastStartTaskId,
      (newTask) => {
        console.log("useStartWSFilter", newTask);
        setLastStartTaskId(null);
        setStartTaskReturned(newTask)
      }
    )

    useNextWSFilter(useGlobalStateContext, props.task?.instanceId, doneTask,
      (updatedTask) => {
        console.log("useNextWSFilter before setNextTask local_stackPtr.current", local_stackPtr.current, updatedTask);
        //if (doneTask !== null && doneTask !== undefined) {
          //console.log("useNextWSFilter setNextTask local_stackPtr.current", local_stackPtr.current);
          setDoneTask(null)
          setNextTask(updatedTask)
        //}
      }
    )
    
    useErrorWSFilter(props.task?.threadId,
      (updatedTask) => {
        console.log("useErrorWSFilter", updatedTask.id, updatedTask.response.text);
        // We do not have a plan for dealing with errors here yet
        // Currently an error task is returned so it can work if 
        // we are waiting on useStartWSFilter or useNextWSFilter
        // update will not see the error Task because the instanceId is different
      }
    )

    function startTaskFn(
      startId,
      threadId = null,
      depth = null
    ) {
      setStartTaskId(startId);
      setLastStartTaskId(startId); // used by the useStartWSFilter
      setStartTaskThreadId(threadId);
      setStartTaskDepth(depth);
    }

    // Manage the last state with a ref because we can't gaurantee when the task.state.last will be updated
    // This issp ecific to how React handles setState 
    function modifyState(state) {
      //console.log("modifyState", state, props.task.state.current, props.task.state.last, lastStateRef.current);
      lastStateRef.current = props.task.state.current;
      if (state) {
        props.setTask((p) =>
          deepMerge(
            p,
            setNestedProperties({
              "state.current": state,
              "state.last": p.state.current,
            })
          )
        );
      } else if (props.task.state.current != props.task.state.last) {
        props.setTask(p => ({...p, state: {...p.state, last: p.state.current}}))
      }
    }

    useEffect(() => {
      if (startTaskError) {
        log("startTaskError", startTaskError);
      }
      if (nextTaskError) {
        log("nextTaskError", nextTaskError);
      }
      if (updateTaskError) {
        log("updateTaskError", updateTaskError);
      }
    }, [startTaskError, nextTaskError, updateTaskError]);

    useEffect(() => {
      const { task } = props;
      if (task && task.stackPtr === local_stackPtr.current) {
        setPrevTask(task);
      }
    }, []);

    useEffect(() => {
      const { task } = props;
      if (task && task.stackPtr === local_stackPtr.current) {
        if (prevTask !== task) {
          setPrevTask(props.task);
        }
      }
    }, [props.task]);

    function modifyTask(update) {
      setNestedProperties(update);
      //console.log("modifyTask", props.task)
      props.setTask((prevState) => {
        const res = deepMerge(prevState, update);
        return res;
      });
    }

    function useTaskState(initialValue, name = "task") {
      const [state, setState] = useState(initialValue);
      const [prevTaskState, setPrevTaskState] = useState({});

      useEffect(() => {
        if (!state) {
          return;
        }
        let diff;
        if (prevTaskState) {
          diff = getObjectDifference(prevTaskState, state);
        } else {
          diff = state;
        }
        let show_diff = true;
        if (hasOnlyResponseKey(diff)) {
          if (!prevTaskState.response?.text) {
            diff.response["text"] = "...";
          } else {
            show_diff = false;
          }
        }
        if (!state.id) {
          console.log("Unexpected: Task without id ", state);
        }
        if (show_diff && Object.keys(diff).length > 0) {
          if (state.stackPtr === local_stackPtr.current) {
            logWithComponent(
              componentName,
              name + " " + state.id + " changes:",
              diff
            );
          }
        }
        setPrevTaskState(state);
      }, [state, prevTaskState]);

      const setTaskState = (newState) => {
        if (typeof newState === "function") {
          setState((prevState) => {
            const updatedState = newState(prevState);
            return updatedState;
          });
        } else {
          setState(newState);
        }
      };

      return [state, setTaskState];
    }

    // This is not working for debug
    function useTasksState(initialValue, name = "tasks") {
      const [states, setStates] = useState(initialValue);
      const [prevTasksState, setPrevTasksState] = useState([]);

      useEffect(() => {
        if (!states) {
          return;
        }
        for (let i = 0; i < states.length; i++) {
          const state = states[i];
          const prevTaskState = prevTasksState[i];
          let diff;
          if (prevTaskState) {
            diff = getObjectDifference(prevTaskState, state);
          } else {
            diff = state;
          }
          let show_diff = true;
          if (hasOnlyResponseKey(diff)) {
            if (!prevTaskState.response?.text) {
              diff.response["text"] = "...";
            } else {
              show_diff = false;
            }
          }
          if (!state?.id) {
            console.log("Unexpected: Task without id ", state);
          }
          if (show_diff && Object.keys(diff).length > 0) {
            if (state.stackPtr === local_stackPtr.current) {
              logWithComponent(
                componentName,
                name + " " + state.id + " changes:",
                diff
              );
            }
          }
        }
        setPrevTasksState(states);
      }, [states, prevTasksState]);

      const setTasksState = (newStates) => {
        if (typeof newStates === "function") {
          setStates((prevStates) => {
            const updatedStates = newStates(prevStates);
            return updatedStates;
          });
        } else {
          setStates(newStates);
        }
      };

      return [states, setTasksState];
    }

    const transitionTo = (state) => {
      return (props.task.state.current === state && lastStateRef.current !== state)
    };
  
    const transitionFrom = (state) => {
      return (props.task.state.current !== state && lastStateRef.current === state)
    };
  
    const transition = () => {
      //console.log("transition", props.task.state.current, lastStateRef.current)
      return (props.task.state.current !== lastStateRef.current)
    };

    // Tracing
    useEffect(() => {
      //console.log("Tracing prevTask ", prevTask)
    }, [prevTask]);

    const componentProps = {
      ...props,
      updateTaskError,
      startTaskError,
      startTask: startTaskReturned,
      startTaskFn,
      nextTaskError,
      nextTask,
      setDoneTask,
      prevTask,
      modifyTask,
      modifyState,
      stackPtr: local_stackPtr.current,
      useTaskState,
      useTasksState,
      processorId: globalState.processorId,
      transition,
      transitionTo,
      transitionFrom,
      user: globalState.user,
      onDidMount: handleChildDidMount,
      useWebSocketContext,
    };

    return <WithDebugComponent {...componentProps} />;
  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask;
