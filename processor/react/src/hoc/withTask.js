import React, { useState, useEffect, useRef, useContext } from "react";
import { utils } from "../utils/utils.mjs";
import useUpdateTask from "../hooks/useUpdateTask";
import useStartTask from "../hooks/useStartTask";
import withDebug from "./withDebug";
import _ from "lodash";
import useUpdateWSFilter from "../hooks/useUpdateWSFilter";
import useInitWSFilter from "../hooks/useInitWSFilter";
import useErrorWSFilter from "../hooks/useErrorWSFilter";
import useGlobalStateContext from "../contexts/GlobalStateContext";
import useWebSocketContext from "../contexts/WebSocketContext";
import { useEventSource } from '../contexts/EventSourceContext';
import { createMachine } from 'xstate';
import { xutils } from '../shared/fsm/xutils.mjs';

// When a task is shared then changes are detected at each wrapper

// Context must be defined at module scope not within the function (would be re-rendered)
const FsmContext = React.createContext();

function withTask(Component) {
  const WithDebugComponent = withDebug(Component);

  const componentName = WithDebugComponent.displayName; // So we get the Component that was wrapped by withDebug

  function TaskComponent(props) {

    const { globalState, mergeGlobalState, replaceGlobalState } = useGlobalStateContext();
    const isMountedRef = useRef();
    const [prevTask, setPrevTask] = useState();
    const [initTask, setInitTask] = useState();
    const [childTask, setChildTask] = useState();
    // Updates to the task might be visible in other layers
    // Could allow for things like changing config from an earlier component
    const { updateTaskError } = useUpdateTask(
      props.task,
      props.setTask,
    );
    const [startTaskReturned, setStartTaskReturned] = useState();
    const { startTaskError } = useStartTask(
      props.task, 
      props.setTask,
    );
    const lastStateRef = useRef();
    const stateRef = useRef();
    const { subscribe, unsubscribe, publish, initialized } = useEventSource();
    const [familyId, setFamilyId] = useState();
    const publishedRef = useRef("");
    const [familyTaskDiff, setFamilyTaskDiff] = useState();
    const handleModifyChildStateRef = useRef(null);
    const handleModifyChildTaskRef = useRef(null);
    const taskRef = useRef();
    const [fsm, setFsm] = useState();
    const [fsmMachine, setFsmMachine] = useState();
    const [fsmState, setFsmState] = useState(); 
    const [fsmService, setFsmService] = useState();
    const [fsmSend, setFsmSend] = useState(); 
    const useShareFsm = () => {
      const context = useContext(FsmContext);
      if (!context) {
        throw new Error('useShared must be used within a SharedProvider');
      }
      return context;
    };

    useEffect(() => {
      taskRef.current = props.task;
    }, [props.task]);

    // In HOC create a syncTask function
    function syncTask(syncTask) {
      modifyTask({ 
        "command": "update",
        "commandArgs": {
          sync: true,
          syncTask: syncTask,
        }
      });
    }

    useEffect(() => {
      if (props.task?.config?.fsm?.devTools && !globalState.xStateDevTools) {
        replaceGlobalState("xStateDevTools", true);
      }
    }, [props.task?.config?.fsm?.devTools]);  

    const loadFsmModule = async (importPath, name) => {
      console.log("loadFsmModule", '../shared/fsm/' + importPath);
      // To allow for the preprocessing to pick up the initial path we give the path as a string constant to import
      import('../shared/fsm/' + importPath)
        .then((module) => {
          console.log("module ", importPath);
          let fsm = module.getFsm(props.task);
          const fsmDefaults = {
            predictableActionArguments: true, // opt into some fixed behaviors that will be the default in v5
            preserveActionOrder: true, // will be the default in v5
            id: props.task.id + "-" + name,
            // This is a hack to get around rehydrating. interpeter.start(stateName) ignores entry actions.
            initial: props.task.state.current || 'init',
          };
          fsm = utils.deepMerge(fsmDefaults, fsm);
          if (props.task?.config?.fsm?.merge) {
            console.log("props.task.fsm.merge", props.task.config.fsm.merge);
            fsm = utils.deepMerge(fsm, props.task.config.fsm.merge);
          }
          if (fsm) {
            // Add events for transitions to all states
            console.log("Before addDefaultEvents", fsm);
            fsm = xutils.addDefaultEventsBasedOnStates(fsm);
            console.log("After addDefaultEvents", fsm);
            setFsm(fsm);
          }
        })
        .catch((error) => {
          if (error.message.includes("Cannot find module")) {
            //console.log(`Failed to load FSM at ${'../shared/fsm/' + importPath}`);
          } else {
            console.error(`Failed to load FSM at ${'../shared/fsm/' + importPath}`, error);
          }
        });  
    };

    useEffect(() => {
      if (props.task?.fsm) {
        setFsm(props.task.fsm);
      } else if (props.task?.config?.fsm?.name) {
        const importPath = `${props.task.type}/${props.task.config.fsm.name}.mjs`;
        // webpack needs to be able to resolve the context (the base directory)
        loadFsmModule(importPath, props.task.config.fsm.name);
      } else if (props.task?.type) {
        const importPath = `${props.task.type}/default.mjs`;
        loadFsmModule(importPath, 'default');
      } else {
        console.log("No FSM");
      }
    }, []);

    useEffect(() => {
      if (fsm && props.task?.config?.fsm?.useMachine) {
        console.log("Creating machine", fsm);
        setFsmMachine(createMachine(fsm));
      }
    }, [fsm]);

    // This is an ugly hack to make sure that the fsmSend command is available
    // So it can be used in an action while the FSM context may still be synchronising
    let resolveFsmSendReady; // Declare variable to hold the resolve function
    const fsmSendReady = new Promise((resolve) => {
      resolveFsmSendReady = resolve; // Assign the resolve function to the variable
    });
    useEffect(() => {
      //console.log("useEffect fsmSend", fsmSend);
      if (fsmSend) {
        resolveFsmSendReady(); // Resolve the promise when fsmSend is initialized
      }
    }, [fsmSend]);
    const safeFsmSend = async (event) => {
      //console.log("safeFsmSend await")
      if (!fsmSend) {
        await fsmSendReady;
      }
      //console.log("fsmSend.func", event)
      fsmSend.func(event);
    };

    // For debug/inspection from the browser console
    if (!window.tasks) {
      window.tasks = {};
    }
    useEffect(() => {
      window.tasks[props.task.id] = props.task;
    }, [props.task]);
    
    const checkLocked = () => {
      if (props.task?.meta?.locked) {
        if (props.task.meta.locked === globalState.processorId) {
          return false;
        } else {
          return true;
        }
      } else {
        return false;
      }
    }

    useEffect(() => {
      const useAddress = props.task?.config?.local?.useAddress;
      if (useAddress && useAddress !== globalState?.useAddress) {
        mergeGlobalState({useAddress});
      }
    }, [props.task]);

    useEffect(() => {
      const useAddress = props.task?.config?.local?.useAddress;
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
      if (familyId) {
        let diff;
        if (prevTask && publishedRef.current) {
          diff = utils.getObjectDifference(prevTask, props.task) || {};
        } else {
          diff = props.task;
        }
        publish('taskChange-' + familyId, {taskdiff: diff, id: props.task.id, instanceId: props.task.instanceId});
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
      // this is a HoC we get warnings for changing state during rendering
      // So adding this delay will update outside of the rendering of Task
      setTimeout(() => {
        // Using a ref as state may not get updated if the component is not rendered
        isMountedRef.current = true;
      }, 0);
    }
    useEffect(() => {
      const checkMount = () => {
        if (props.task.id && !isMountedRef.current) {
          throw new Error("handleChildDidMount was not called within 10 seconds " + props.task.id);
        }
      };
      const timeoutId = setTimeout(checkMount, 10000);
      // This return function will be called if the component is unmounted before the timeout triggers
      return () => {
        clearTimeout(timeoutId);
      };
    }, []);

    // React does not seem to gaurantee this is called in the parent before the child
    useEffect(() => {
      if (!props.task) {return}
      const spawnTask = props.task.config?.spawnTask === false ? false : true;
      //console.log("spawnTask", spawnTask, props.task?.meta?.childrenId)
      if (spawnTask && props.task?.meta?.childrenId) {
        props.task.meta.childrenId.forEach(childId => {
          console.log(childId);
          modifyTask({
            "command": "start",
            "commandArgs": {
              id: childId,
            }
          });
          console.log("Start from withTask", childId)
        });
      }
    }, []);

    useEffect(() => {
      if (!props.task) {return}
      const spawnTask = props.task.config?.spawnTask === false ? false : true;
      if (spawnTask && !childTask) {
        if (startTaskReturned) {
          setChildTask(startTaskReturned)
          console.log("setChildTask", startTaskReturned.id)
        }
      }
    }, [startTaskReturned]);

    useUpdateWSFilter(isMountedRef, props.task,
      async (updateDiff) => {
        //console.log("useUpdateWSFilter updateDiff", updateDiff);
        const lastTask = await globalState.storageRef.current.get(props.task.instanceId);
        //console.log("lastTask", JSON.parse(JSON.stringify(lastTask)));
        //console.log("useUpdateWSFilter globalState.storageRef.current.get", lastTask.meta.hash, lastTask);
        utils.checkHash(lastTask, updateDiff);
        let updatedTask = utils.deepMergeProcessor(lastTask, updateDiff, updateDiff.processor);
        //console.log("After deepMergeProcessor updatedTask", JSON.parse(JSON.stringify(updatedTask)));
        utils.removeNullKeys(updatedTask);
        //console.log("After removeNullKeys updatedTask", JSON.parse(JSON.stringify(updatedTask)));
        //let updatedTask = utils.deepMerge(lastTask, updateDiff)
        await utils.processorActiveTasksStoreSet_async(globalState.storageRef.current, updatedTask);
        //console.log("After processorActiveTasksStoreSet_async updatedTask", JSON.parse(JSON.stringify(updatedTask)));
        //console.log("useUpdateWSFilter globalState.storageRef.current.set", lastTask.meta.hash, updatedTask);
        // Keep the origTask up to date i th eactive task
        if (!updateDiff.processor) {
          updateDiff["processor"] = {};
        }
        updateDiff.processor["origTask"] = updatedTask.processor.origTask; 
        // If the resource has been locked by another processor then we ignore whatever was done locally
        // If this is the source processor then we want to keep any change made to the task since the update was sent
        // There may be meta data like task.meta.lock that we want updated on the source processor
        // The lock effectively makes a processor the master so even if changes are made by another processor
        // the values of the procesor with the lock will be favored.
        const thisProcessorIsSource = updateDiff.processor.sourceProcessorId === globalState.processorId;
        const thisProcessorHasLock = updateDiff.meta.locked === globalState.processorId;
        if (updateDiff?.processor?.commandArgs && updateDiff.processor.commandArgs.sync) {
          modifyTask(updateDiff);
          console.log("useUpdateWSFilter SYNC");
        } else if (thisProcessorIsSource) {
          // Just update task.meta & task.processor (for the processor.origTask)
          // But the CEP could modify this task
          const currentMeta = utils.deepMerge(props.task.meta, updateDiff.meta);
          const currentProcessor = utils.deepMerge(props.task.processor, updateDiff.processor);
          modifyTask({"meta": currentMeta, "processor": currentProcessor});
          console.log("useUpdateWSFilter from this processor");
        } else if (thisProcessorHasLock) {
          // We do not want to use lastTask.input because it may overwrite changes on the inputs coming from outside the Task.
          delete updateDiff.input
          modifyTask(updateDiff);
          console.log("useUpdateWSFilter has lock ", props.task.id);
        } else {
          props.setTask(updatedTask);
          console.log("useUpdateWSFilter ", props.task.id, updatedTask);
        }
        console.log("useUpdateWSFilter messageId:", props.task.meta.messageId);
        console.log("Storage update isSource:" + thisProcessorIsSource + " hasLock:" + thisProcessorHasLock, " id: " + props.task.id, "updateDiff, updatedTask", updateDiff, updatedTask);
      }
    )

    useInitWSFilter(useGlobalStateContext, props.task, 
      (newTask) => {
        console.log("useInitWSFilter withTask " + props.task.id + " started", newTask);
        setInitTask(null);
        newTask.processor["origTask"] = JSON.parse(JSON.stringify(newTask)); // deep copy to avoid self-reference
        setStartTaskReturned(newTask);
      }
    )
    
    useErrorWSFilter(useGlobalStateContext, props.task,
      (errorTask) => {
        console.log("useErrorWSFilter", errorTask.id, errorTask.error, errorTask);
        // We do not have a plan for dealing with errors here yet
        alert("Task error: " + errorTask.response.text);
        // Probably better to "remount" the component
        // This can be done by changing the Key where the component is instantiated
        // Going back to the start state can create an error loop
        //modifyState("start");
      }
    )

    // Manage the last state with a ref because we can't gaurantee when the task.state.last will be updated
    // This is specific to how React handles setState 
    const modifyState = (state) => {
      //console.log("modifyState", state, props.task.state.current, props.task.state.last, lastStateRef.current);
      lastStateRef.current = props.task.state.current;
      if (state && state !== props.task.state.current) {
        stateRef.current = state;
        props.setTask((p) =>
          utils.deepMerge(
            p,
            utils.setNestedProperties({
              "state.current": state,
              "state.last": p.state.current,
            })
          )
        );
      } else if (props.task.state.current !== props.task.state.last) {
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

    // If the parent wants to be able to modify the child state it passes this prop
    if (props.handleModifyChildState) {
      props.handleModifyChildState(modifyState)
    }

    // This is the prop that will be passed to the child and called just above to set modifyChildState
    const handleModifyChildState = (modifyStateFunction) => {
      handleModifyChildStateRef.current = modifyStateFunction;  
    }

    // This is what the parent calls to modify the state of the child
    // To us this we need to pass the handleModifyChildState to the child e.g.
    // handleModifyChildState={props.handleModifyChildState}
    const modifyChildState = (state) => {
      handleModifyChildStateRef.current(state);
    }

    // If the parent wants to be able to modify the child it passes this prop
    if (props.handleModifyChildTask) {
      props.handleModifyChildTask(modifyTask)
    }

    // This is the prop that will be passed to the child and called just above to set modifyChildTask
    const handleModifyChildTask = (modifyTaskFunction) => {
      handleModifyChildTaskRef.current = modifyTaskFunction;  
    }

    // This is what the parent calls to modify the state of the child
    // To us this we need to pass the handleChildModify to the child e.g.
    // handleChildModify={props.handleChildModify}
    const modifyChildTask = (update) => {
      handleModifyChildTaskRef.current(update);
    }

    useEffect(() => {
      if (startTaskError) {
        utils.log("startTaskError", startTaskError);
      }
      if (updateTaskError) {
        utils.log("updateTaskError", updateTaskError);
      }
    }, [startTaskError, updateTaskError]);

    useEffect(() => {
      const { task } = props;
      if (task) {
        setPrevTask(task);
      }
    }, []);

    useEffect(() => {
      const { task } = props;
      if (task) {
        if (!utils.deepEqual(prevTask,task)) {
          setPrevTask(props.task);
        }
      }
    }, [props.task]);

    function modifyTask(modification, debug = false) {
      //console.log("modifyTask before modification", JSON.stringify(modification));
      utils.setNestedProperties(modification);
      //console.log("modifyTask after modification", JSON.stringify(modification));
      props.setTask((prevState) => {
        const res = utils.deepMerge(prevState, modification, debug);
        //console.log("utils.deepMerge", res);
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
          diff = utils.getObjectDifference(prevTaskState, state) || {};
        } else {
          diff = state;
        }
        let show_diff = true;
        if (utils.hasOnlyResponseKey(diff)) {
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
          utils.logWithComponent(
            componentName,
            name + " " + state.id + " changes:",
            diff
          );
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
            diff = utils.getObjectDifference(prevTaskState, state) || {};
          } else {
            diff = state;
          }
          let show_diff = true;
          if (utils.hasOnlyResponseKey(diff)) {
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
            utils.logWithComponent(
              componentName,
              name + " " + state.id + " changes:",
              diff
            );
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
      if (!state) {
        throw new Error("state is undefined");
      }
      return (props.task.state.current === state && lastStateRef.current !== state)
    };
  
    const transitionFrom = (state) => {
      if (!state) {
        throw new Error("state is undefined");
      }
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
      prevTask,
      modifyTask,
      modifyState,
      useTaskState,
      useTasksState,
      processorId: globalState.processorId,
      transition,
      transitionTo,
      transitionFrom,
      user: globalState.user,
      onDidMount: handleChildDidMount,
      useWebSocketContext,
      componentName: props?.task?.type,
      childTask,
      setChildTask,
      handleTaskUpdate,
      familyTaskDiff,
      handleModifyChildState,
      modifyChildState,
      handleModifyChildTask,
      modifyChildTask,
      checkIfStateReady,
      checkLocked,
      syncTask,
      taskRef,
      fsmMachine,
      useShareFsm,
    };

    // This is a way of ensuring that the fsm is loaded before useMachine is called on it
    // If no FSM is configured then fsm will default to a string
    if (fsmMachine === undefined && props.task?.config?.fsm?.useMachine) {
      return (<div>Loading FSM...</div>)
    }

    /*
    if (fsm === undefined && props.task?.config?.fsm?.useFsm) {
      return (<div>Loading FSM...</div>)
    }
    */

    return (
      <FsmContext.Provider value={{fsmSend: safeFsmSend, fsmState, setFsmState, setFsmSend, setFsmService}}> 
        <WithDebugComponent {...componentProps} /> 
      </FsmContext.Provider>
    );

  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask;
