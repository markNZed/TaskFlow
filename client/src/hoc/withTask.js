import React, { useState, useEffect } from 'react'
import { delta, logWithComponent, getObjectDifference, hasOnlyResponseKey, setNestedProperties, deepMerge} from '../utils/utils'
import useUpdateTask from '../hooks/useUpdateTask';
import useStartTask from '../hooks/useStartTask';
import useNextTask from '../hooks/useNextTask';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import useFilteredWebSocket from '../hooks/useFilteredWebSocket';
import withDebug from './withDebug'
import _ from 'lodash';
import { log } from '../utils/utils'

// When a task is shared then changes are detected at each wrapper

function withTask(Component) {

  const WithDebugComponent = withDebug(Component);

  const componentName = WithDebugComponent.displayName // So we get the Component that was wrapped by withDebug

  function TaskComponent(props) {

    let local_component_depth
    if (typeof props.component_depth === "number") {
      local_component_depth = props.component_depth + 1
    } else {
      //console.log("Defaulting to component_depth 0")
      local_component_depth = 0
    }

    const [prevTask, setPrevTask] = useState();
    const [doneTask, setDoneTask] = useState();
    const [startTaskId, setStartTaskId] = useState();
    const [startTaskThreadId, setStartTaskThreadId] = useState();
    const [startTaskDepth, setStartTaskDepth] = useState(local_component_depth);
    // By passing the component_depth we know which layer is sending the task
    // Updates to the task might be visible in other layers
    // Could allow for things like changing condif from an earlier component
    const { updateTaskLoading, updateTaskError } = useUpdateTask(props.task, props.setTask, local_component_depth);
    const { nextTask, nextTaskLoading, nextTaskError } = useNextTask(doneTask);
    const { webSocketEventEmitter } = useWebSocketContext();
    const { startTaskReturned, startTaskLoading, startTaskError } = useStartTask(startTaskId, startTaskThreadId, startTaskDepth);

    function startTaskFn(startId, threadId = null, depth = local_component_depth ) {
      setStartTaskId(startId)
      setStartTaskThreadId(threadId)
      setStartTaskDepth(depth)
    }
    
    function updateStep(step) { // change to updateState
      props.setTask(p => (deepMerge(p, setNestedProperties( {'state.current': step, 'state.deltaState': p?.state?.current}))))
      // Allow detection of new step
      delta(() => {
        props.setTask(p => (deepMerge(p, setNestedProperties( {'state.deltaState': p?.state?.current}))))
      })
    }

    useEffect(() => {
      if (startTaskError) {
        log("startTaskError", startTaskError)
      }
      if (nextTaskError) {
        log("nextTaskError", nextTaskError)
      }      
      if (updateTaskError) {
        log("updateTaskError", updateTaskError)
      }
    }, [startTaskError, nextTaskError, updateTaskError]);
    

    useEffect(() => {
      const { task } = props;
      if (task && task.meta.stackPtr === local_component_depth) {
        setPrevTask(task);
      }
    }, []);

    useEffect(() => {
      const { task } = props;
      if (task && task.meta.stackPtr === local_component_depth) {
        if (prevTask !== task) {
            setPrevTask(props.task);
        } 
      }
    }, [props.task]);

    function updateTask(update) {
      setNestedProperties(update)
      props.setTask(prevState => {const res = deepMerge(prevState, update); return res})
    }

    function useTaskWebSocket(callback) {
      useFilteredWebSocket(webSocketEventEmitter, props.task, callback)
    }

    // The order of component mounting in React is not gauranteed
    // So a lower component_depth could override the task if it is passed down
    // Should we pass down a copy of the task ?
    // But conversation is communicating through a shared task - maybe that is a problem
    // For now we pass the depth to useUpdateTask
    useEffect(() => {
      //console.log("local_component_depth " + local_component_depth)
      //props.setTask(p => ({ ...p, component_depth : local_component_depth }))
    }, []);

    function useTaskState(initialValue, name = "task") {
      const [state, setState] = useState(initialValue);
      const [prevTaskState, setPrevTaskState] = useState({});
    
      useEffect(() => {
        if (!state) {return}
        let diff
        if (prevTaskState) {
          diff = getObjectDifference(state, prevTaskState)
        } else {
          diff = state
        }
        let show_diff = true
        if (hasOnlyResponseKey(diff)) {
          if (!prevTaskState.response?.text) {
            diff.response['text'] = "..."
          } else {
            show_diff = false
          }
        }
        if (!state.meta.id) {
          console.log("Unexpected: Task without id ", state)
        }
        if (show_diff && Object.keys(diff).length > 0) {
          if ( state.meta.stackPtr === local_component_depth ) {
            logWithComponent(componentName, name + " " + state.meta.id + " changes:", diff)
          }
        }
        setPrevTaskState(state);
      }, [state, prevTaskState]);
    
      const setTaskState = (newState) => {
        if (typeof newState === 'function') {
          setState((prevState) => {
            const updatedState = newState(prevState);
            return updatedState;
          });
        } else {
          setState(newState);
        }
      }
    
      return [state, setTaskState]
    }

    function useTasksState(initialValue, name = "tasks") {
      const [states, setStates] = useState(initialValue);
      const [prevTasksState, setPrevTasksState] = useState({});
    
      useEffect(() => {
        if (!states) {return}
        for (let i = 0; i < states.length; i++) {
          const state = states[i];
          const prevTaskState = prevTasksState[i]
          let diff
          if (prevTaskState) {
            diff = getObjectDifference(state, prevTaskState)
          } else {
            diff = state
          }
          let show_diff = true
          if (hasOnlyResponseKey(diff)) {
            if (!prevTaskState.response?.text) {
              diff.response['text'] = "..."
            } else {
              show_diff = false
            }
          }
          if (!state.meta?.id) {
            console.log("Unexpected: Task without id ", state)
          }
          if (show_diff && Object.keys(diff).length > 0) {
            if ( state.meta.stackPtr === local_component_depth ) {
              logWithComponent(componentName, name + " " + state.meta.id + " changes:", diff)
            }
          }
        }
        setPrevTasksState(states);
      }, [states, prevTasksState]);

      const setTasksState = (newStates) => {
        if (typeof newStates === 'function') {
          setStates((prevStates) => {
            const updatedStates = newStates(prevStates);
            return updatedStates;
          });
        } else {
          setStates(newStates);
        }
      }
    
      return [states, setTasksState]
    }
    
    // Tracing
    useEffect(() => {
      //console.log("Tracing prevTask ", prevTask)
    }, [prevTask]); 
  
    const componentProps = {
        ...props,
        updateTaskLoading, 
        updateTaskError,
        startTaskLoading,
        startTaskError,
        startTask : startTaskReturned,
        startTaskFn,
        nextTaskLoading,
        nextTaskError,
        nextTask,
        setDoneTask,
        prevTask,
        updateTask,
        updateTask,
        updateStep, // add log as a prop
        webSocketEventEmitter,
        useTaskWebSocket,
        component_depth: local_component_depth,
        useTaskState,
        useTasksState,
    };

    return <WithDebugComponent {...componentProps} />;
  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask