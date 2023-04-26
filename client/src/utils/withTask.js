import React, { useState, useEffect } from 'react'
import { delta } from './utils'
import useTaskUpdate from '../hooks/useTaskUpdate';
import useTaskStart from '../hooks/useTaskStart';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import useFilteredWebSocket from '../hooks/useFilteredWebSocket';

// When a task is shared then changes are detected at each wrapper


function withTask(Component) {

  const componentName = Component.name

  function TaskComponent(props) {

    const [prevTask, setPrevTask] = useState();
    const local_component_depth = props.component_depth + 1
    // By passing the depth we know whihc layer is sending the task
    // Updates to the task might be visible in other layers
    // Could allow for things like changing condif from an earlier component
    const { updateTaskLoading, updateTaskError } = useTaskUpdate(props.task, props.setTask, local_component_depth);
    const { webSocketEventEmitter } = useWebSocketContext();
    //const { startTaskLoading, startTaskError } = useTaskStart(props.task, props.setTask); // setTask, startId, threadId

    function updateStep(step) {
      props.setTask(p => ({ ...p, step: step, last_step: p.step}))
      // Allow detection of new step
      delta(() => {
        props.setTask(p => ({ ...p, last_step: p.step }))
      })
    }

    useEffect(() => {
      const { task } = props;
      setPrevTask(task);
    }, []);

    useEffect(() => {
      const { task } = props;
      if (prevTask !== task) {
        setPrevTask(props.task);
      }
    }, [props.task]);


    function updateTask(update) {
      props.setTask(prevState => ({ ...prevState, ...update }));
    }

    const setTaskWithPrev = (newTask) => {
      props.setTask(newTask);
    };

    function useTaskWebSocket(callback) {
      useFilteredWebSocket(webSocketEventEmitter, props.task, callback)
    }

    // The order of component mounting in React is not gauranteed
    // So a lower component_depth could override the task if it is passed down
    // Should we pass down a copy of the task ?
    // But conversation is communicating through a shared task - maybe that is a problem
    // For now we pass the depth to useTaskUpdate
    useEffect(() => {
      //console.log("local_component_depth " + local_component_depth)
      //props.setTask(p => ({ ...p, component_depth : local_component_depth }))
    }, []);
    

    const componentProps = {
        ...props,
        setTask: setTaskWithPrev,
        updateTaskLoading, 
        updateTaskError,
        //startTaskLoading,
        //startTaskError,
        prevTask,
        updateTask,
        updateStep, // add log as a prop
        webSocketEventEmitter,
        useTaskWebSocket,
        component_depth: local_component_depth,
    };

    return <Component {...componentProps} />;
  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask