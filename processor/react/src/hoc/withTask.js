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
import withDebug from "./withDebug";
import _ from "lodash";
import useUpdateWSFilter from "../hooks/useUpdateWSFilter";
import useStartWSFilter from "../hooks/useStartWSFilter";
import useErrorWSFilter from "../hooks/useErrorWSFilter";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import useWebSocketContext from "../contexts/WebSocketContext";
import { useEventSource } from '../contexts/EventSourceContext';

// When a task is shared then changes are detected at each wrapper

function withTask(Component) {
  const WithDebugComponent = withDebug(Component);

  const componentName = WithDebugComponent.displayName; // So we get the Component that was wrapped by withDebug

  function TaskComponent(props) {

    const localStackPtrRef = useRef();
    if (typeof props.stackPtr === "number") {
      localStackPtrRef.current = props.stackPtr + 1;
    } else {
      //console.log("Defaulting to stackPtr 0")
      localStackPtrRef.current = 0;
    }

    const { globalState, mergeGlobalState } = useGlobalStateContext();
    const [isMounted, setIsMounted] = useState();
    const [prevTask, setPrevTask] = useState();
    const [startTaskId, setStartTaskId] = useState();
    const [lastStartTaskId, setLastStartTaskId] = useState();
    const [startTaskThreadId, setStartTaskThreadId] = useState();
    const [startTaskPrevInstanceId, setStartTaskPrevInstanceId] = useState();
    const [childTask, setChildTask] = useState();
    const [startTaskDepth, setStartTaskDepth] = useState(localStackPtrRef.current);
    // By passing the stackPtr we know which layer is sending the task
    // Updates to the task might be visible in other layers
    // Could allow for things like changing config from an earlier component
    const { updateTaskError } = useUpdateTask(
      props.task,
      props.setTask,
      localStackPtrRef.current
    );
    const [startTaskReturned, setStartTaskReturned] = useState();
    const { startTaskError } = useStartTask(startTaskId, setStartTaskId, startTaskThreadId, startTaskDepth, startTaskPrevInstanceId);
    const lastStateRef = useRef();
    const stateRef = useRef();
    const { subscribe, unsubscribe, publish, initialized } = useEventSource();
    const [familyId, setFamilyId] = useState();
    const publishedRef = useRef("");
    const [familyTaskDiff, setFamilyTaskDiff] = useState();
    const handleChildmodifyStateRef = useRef(null);

    useEffect(() => {
      const useAddress = props.task?.config?.useAddress;
      if (useAddress && useAddress !== globalState?.useAddress) {
        mergeGlobalState({useAddress});
      }
    }, [props.task]);

    useEffect(() => {
      const useAddress = props.task?.config?.useAddress;
      const address = props.task?.state?.address;
      if (useAddress && globalState?.address && address !== globalState.address) {
        modifyTask({"state.address": globalState.address, "state.lastAddress": address});
      }
    }, [globalState]);

    /*
    // Example of how to use the familyTaskDiff
    // The child should enable this by modifyTask({"processor.config.familyTaskDiff": true});
    useEffect(() => {
      if (!props?.task?.processor?.config?.familyTaskDiff && props.task) {
        modifyTask({"processor.config.familyTaskDiff": true});
      }
      if (familyTaskDiff) {
        console.log('Received a task change in ' + props.task.id, familyTaskDiff);
      }
    }, [familyTaskDiff]); 
    */ 

    const handleTaskUpdate = (event) => {
      //console.log('Received a task change', event.detail);
      // Intended to monitor other tasks not itself
      if (event.detail.instanceId !== props.task.instanceId) {
        setFamilyTaskDiff(event.detail);
      }
    };

    // We publish diffs of Task as events to a familyId
    useEffect(() => {
      if (!familyId) {return;}
      if (initialized) {
        subscribe('taskChange-' + familyId, handleTaskUpdate);
      }
      // Unsubscribe when the component unmounts
      return () => {
        if (initialized) {
          unsubscribe('taskChange-' + familyId, handleTaskUpdate);
        }
      };
    }, [subscribe, unsubscribe, familyId]);

    useEffect(() => {
      // Only need one watcher per task, use the active stackPtr level
      if (familyId && localStackPtrRef.current === props.task.stackPtr) {
        let diff;
        if (prevTask && publishedRef.current) {
          diff = getObjectDifference(prevTask, props.task);
        } else {
          diff = props.task;
        }
        publish('taskChange-' + familyId, {taskdiff: diff, id: props.task.id, instanceId: props.task.instanceId, stackPtr: props.task.stackPtr});
        publishedRef.current = true;
      }
    }, [props.task]);

    useEffect(() => {
      if (!familyId && props.task && props.task.processor?.config?.familyTaskDiff) {
        setFamilyId(props.task.familyId);
      }
    }, [props.task]);

    const handleChildDidMount = () => {
      // This is called during the rendering of the Task and even though
      // this is a HoC w get warnings for changing state during rendering
      // So adding this delay will update outside of the rendering of Task
      setTimeout(() => setIsMounted(true), 0);
    }

    // React does not seem to gaurantee this is called in the parent before the child
    useEffect(() => {
      // Don't do this when stackPtr is 0 e.g. from taskflows.js where there is no props.task
      if (localStackPtrRef.current > 0) {
        const spawnTask = props.task.config?.spawnTask === false ? false : true;
        console.log("localStackPtrRef.current < props.stackTaskId.length && spawnTask", localStackPtrRef.current, props.stackTaskId.length, spawnTask)
        if (localStackPtrRef.current < props.stackTaskId.length && spawnTask) {
          let startTaskId = props.stackTaskId[localStackPtrRef.current]
          const newPtr = localStackPtrRef.current + 1;
          const initTask = {
            id: startTaskId,
            familyId: props.task.familyId,
            stackPtr: newPtr
          }
          startTaskFn(initTask);
          console.log("startTaskFn from withTask", startTaskId, newPtr)
        }
        //modifyTask(() => { return {stackPtr: Math.max(props.task.stackPtr, localStackPtrRef.current)} });
        //modifyTask({stackPtr: localStackPtrRef.current});
      }
    }, []);

    useEffect(() => {
      // Don't do this when stackPtr is 0 e.g. from taskflows.js where there is no props.task
      if (localStackPtrRef.current > 0) {
        const spawnTask = props.task.config?.spawnTask === false ? false : true;
        if (localStackPtrRef.current < props.stackTaskId.length && spawnTask) {
          if (startTaskReturned) {
            setChildTask(startTaskReturned)
            console.log("setChildTask", startTaskReturned.id)
          }
        }
      }
    }, [startTaskReturned]);

    useUpdateWSFilter(isMounted, localStackPtrRef, props.task,
      async (updateDiff) => {
        //console.log("useUpdateWSFilter updateDiff.stackPtr === localStackPtrRef", updateDiff.stackPtr, localStackPtrRef.current);
        if (updateDiff.stackPtr === localStackPtrRef.current) {
          const lastTask = await globalState.storageRef.current.get(props.task.instanceId);
          //console.log("Storage get ", props.task.id, props.task.instanceId, lastTask);
          //console.log("lastTask", lastTask)
          // If the resource has been locked then ignore whatever was done locally
          let currentTaskDiff = {};
          if (lastTask.meta.locked === globalState.processorId) {
            currentTaskDiff = getObjectDifference(lastTask, props.task);
          }
          //console.log("currentTaskDiff", currentTaskDiff);
          //console.log("updateDiff", updateDiff);
          //const currentUpdateDiff = getObjectDifference(currentTaskDiff, updateDiff);
          //console.log("currentUpdateDiff", currentUpdateDiff);
          // ignore differences in source & updatedAt & lock
          // partial updates to response can cause conflicts
          // Needs further thought
          delete currentTaskDiff.response
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

    useStartWSFilter(useGlobalStateContext, lastStartTaskId, startTaskPrevInstanceId, 
      (newTask) => {
        console.log("useStartWSFilter", newTask);
        setLastStartTaskId(null);
        setStartTaskReturned(newTask)
      }
    )
    
    useErrorWSFilter(props.task?.familyId,
      (updatedTask) => {
        console.log("useErrorWSFilter", updatedTask.id, updatedTask.response.text);
        // We do not have a plan for dealing with errors here yet
      }
    )

    function startTaskFn(initTask) {
      setStartTaskReturned(null);
      setStartTaskId(initTask.id);
      setLastStartTaskId(initTask.id); // used by the useStartWSFilter
      setStartTaskPrevInstanceId(initTask.commandArgs?.prevInstanceId); // used by the useStartWSFilter
      setStartTaskThreadId(initTask.familyId);
      setStartTaskDepth(initTask.stackPtr);
    }

    // Manage the last state with a ref because we can't gaurantee when the task.state.last will be updated
    // This is specific to how React handles setState 
    const modifyState = (state) => {
      //console.log("modifyState", state, props.task.state.current, props.task.state.last, lastStateRef.current);
      lastStateRef.current = props.task.state.current;
      if (state && state !== props.task.state.current) {
        stateRef.current = state;
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

    // Detect changes to the task.state.current that are not caused by modifyState
    // Perhaps state machine would miss the change in this case
    useEffect(() => {
      const current = props?.task?.state?.current;
      if (current && current !== stateRef.current) {
        stateRef.current = current;
      }
    }, [props.task]);

    /**
     * Check if the task state is ready for processing.
     *
     * The purpose of this function is to handle a potential race condition in the state machine.
     * Specifically, there's a risk that modifyState is called at the end of the state machine but
     * the state is not yet updated when another event triggers the state machine again. This would
     * cause the "previous" state to be re-executed.
     *
     * By using a ref, we can check that pending state changes are applied before we process the current state.
     * We also consider a scenario where the state is directly modified by a parent Task, as we don't want to miss that event.
     */
    const checkIfStateReady = () => {
      const currentState = props?.task?.state?.current;
      if (!currentState) return false;

      // The currentState may be initialized and the stateRef.current and lastStateRef.current have not been initialized
      if (stateRef.current === undefined) {
        stateRef.current = currentState
      }
      if (lastStateRef.current === undefined) {
        lastStateRef.current = currentState
      }
      const isStateAlignedWithModifyState = currentState === stateRef.current;
      const isStateUpdatedDirectly = stateRef.current === lastStateRef.current;

      // Return true if the state is aligned with the last modifyState call OR if the state has been updated directly.
      return isStateAlignedWithModifyState || isStateUpdatedDirectly;
    };

    // If the parent wants to be able to modify the child state is passes this prop
    if (props.handleChildmodifyState) {
      props.handleChildmodifyState(modifyState)
    }

    // This is the implementation that is passd to the parent as a prop that will be passed to the child
    const handleChildmodifyState = (modifyStateFunction) => {
      handleChildmodifyStateRef.current = modifyStateFunction;  
    }

    // This is what the parent calls to modify the state of the child
    const modifyChildState = (state) => {
      handleChildmodifyStateRef.current(state);
    }

    useEffect(() => {
      if (startTaskError) {
        log("startTaskError", startTaskError);
      }
      if (updateTaskError) {
        log("updateTaskError", updateTaskError);
      }
    }, [startTaskError, updateTaskError]);

    useEffect(() => {
      const { task } = props;
      if (task && task.stackPtr === localStackPtrRef.current) {
        setPrevTask(task);
      }
    }, []);

    useEffect(() => {
      const { task } = props;
      if (task && task.stackPtr === localStackPtrRef.current) {
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

    useEffect(() => {
      const c = props?.task?.command;
      const pc = prevTask?.command;
      if (c && pc && c !== pc) {
        throw new Error("Unexpected command change " + c + " " + pc);
      }
    }, [props.task]);  

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
          if (state.stackPtr === localStackPtrRef.current) {
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
            if (state.stackPtr === localStackPtrRef.current) {
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
      task: props.task,
      setTask: props.setTask,
      updateTaskError,
      startTaskError,
      startTask: startTaskReturned,
      startTaskFn,
      prevTask,
      modifyTask,
      modifyState,
      stackPtr: localStackPtrRef.current,
      useTaskState,
      useTasksState,
      processorId: globalState.processorId,
      transition,
      transitionTo,
      transitionFrom,
      user: globalState.user,
      onDidMount: handleChildDidMount,
      useWebSocketContext,
      componentName: props?.task?.stack[localStackPtrRef.current - 1],
      childTask,
      setChildTask,
      handleTaskUpdate,
      familyTaskDiff,
      handleChildmodifyState,
      modifyChildState,
      checkIfStateReady,
    };

    return <WithDebugComponent {...componentProps} />;
  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask;
