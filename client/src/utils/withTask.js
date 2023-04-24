import React, { useState, useEffect } from 'react'
import { delta } from './utils'
import useTaskUpdate from '../hooks/useTaskUpdate';
import { useWebSocketContext } from '../contexts/WebSocketContext';

function withTask(Component) {

  const componentName = Component.name

  function TaskComponent(props) {
    const [prevTask, setPrevTask] = useState();
    const { taskLoading, taskError } = useTaskUpdate(props.task, props.setTask);
    const { webSocketEventEmitter } = useWebSocketContext();

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

    //replace props.setTask with a function that also copies task to prevTask

    const componentProps = {
        ...props,
        setTask: setTaskWithPrev,
        taskLoading,
        taskError,
        prevTask,
        updateTask,
        updateStep, // add log as a prop
        webSocketEventEmitter,
    };

    return <Component {...componentProps} />;
  }

  TaskComponent.displayName = componentName;
  return TaskComponent;
}

export default withTask