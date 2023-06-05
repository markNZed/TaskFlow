import React, { useState, useEffect } from "react";
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
import { useGlobalStateContext } from "../contexts/GlobalStateContext";

// When a task is shared then changes are detected at each wrapper

function withTask(Component) {
  const WithDebugComponent = withDebug(Component);

  const componentName = WithDebugComponent.displayName; // So we get the Component that was wrapped by withDebug

  function TaskComponent(props) {
    let local_stackPtr;
    if (typeof props.stackPtr === "number") {
      local_stackPtr = props.stackPtr + 1;
    } else {
      //console.log("Defaulting to stackPtr 0")
      local_stackPtr = 0;
    }

    const { globalState } = useGlobalStateContext();
    const [prevTask, setPrevTask] = useState();
    const [doneTask, setDoneTask] = useState();
    const [startTaskId, setStartTaskId] = useState();
    const [startTaskThreadId, setStartTaskThreadId] = useState();
    const [startTaskDepth, setStartTaskDepth] = useState(local_stackPtr);
    // By passing the stackPtr we know which layer is sending the task
    // Updates to the task might be visible in other layers
    // Could allow for things like changing config from an earlier component
    const { updateTaskError } = useUpdateTask(
      props.task,
      props.setTask,
      local_stackPtr
    );
    const [nextTask, setNextTask] = useState();
    const { nextTaskError } = useNextTask(doneTask);
    const [startTaskReturned, setStartTaskReturned] = useState();
    const { startTaskError } = useStartTask(startTaskId, startTaskThreadId, startTaskDepth);

    useUpdateWSFilter(props.task,
      async (updateDiff) => {
        if (updateDiff.stackPtr === local_stackPtr) {
          const lastTask = await globalState.storageRef.current.get(props.task.instanceId);
          const currentTaskDiff = getObjectDifference(lastTask, props.task);
          //console.log("currentTaskDiff", currentTaskDiff, lastTask);
          // ignore differences in source
          delete currentTaskDiff.source
          // Need to think more about how we manage (or not) delta
          delete currentTaskDiff.state?.deltaState
          // partial updates to response can cause conflicts
          // Needs further thought
          delete currentTaskDiff.response
          if (checkConflicts(currentTaskDiff, updateDiff)) {
            console.error("CONFLICT currentTaskDiff, updateDiff ", currentTaskDiff, updateDiff);
            //throw new Error("CONFLICT");
          }
          const mergedTask = deepMerge(props.task, updateDiff);
          //console.log("MERGED output.msgs", mergedTask.output?.msgs, updateDiff.output?.msgs, props.task.output?.msgs)
          modifyTask(mergedTask)
          globalState.storageRef.current.set(props.task.instanceId, mergedTask);
          console.log("Storage updated ", props.task.id, props.task.instanceId, updateDiff);
        }
      }
    )

    useStartWSFilter(startTaskId,
      (newTask) => {
        console.log("useStartWSFilter", newTask);
        setStartTaskId(null);
        setStartTaskReturned(newTask)
      }
    )

    useNextWSFilter(props.task?.instanceId, doneTask,
      (updatedTask) => {
        //console.log("useNextWSFilter before setNextTask local_stackPtr", local_stackPtr, updatedTask);
        //if (doneTask !== null && doneTask !== undefined) {
          //console.log("useNextWSFilter setNextTask local_stackPtr", local_stackPtr);
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
      setStartTaskThreadId(threadId);
      setStartTaskDepth(depth);
    }

    function updateState(state) {
      // change to updateState
      props.setTask((p) =>
        deepMerge(
          p,
          setNestedProperties({
            "state.current": state,
            "state.deltaState": state,
          })
        )
      );
    }
  
    // Allow detection of new state
    useEffect(() => {
      if (props.task && props.task.state?.current && props.task.state.current === props.task.state.deltaState) {
        props.setTask(p => ({...p, state: {...p.state, deltaState: ''}}))
      }
    }, [props.task]);

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
      if (task && task.stackPtr === local_stackPtr) {
        setPrevTask(task);
      }
    }, []);

    useEffect(() => {
      const { task } = props;
      if (task && task.stackPtr === local_stackPtr) {
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
          if (state.stackPtr === local_stackPtr) {
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
            if (state.stackPtr === local_stackPtr) {
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
      updateState,
      stackPtr: local_stackPtr,
      useTaskState,
      useTasksState,
      processorId: globalState.processorId,
    };

    return <WithDebugComponent {...componentProps} />;
  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask;
