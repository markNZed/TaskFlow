import React, { useEffect } from 'react'
import { logWithComponent, getObjectDifference, hasOnlyResponseKey } from '../utils/utils'
import _ from 'lodash';

function withDebug(Component) {

  const componentName = Component.name

  function DebugComponent(props) {

    function log(...message) {
      logWithComponent(componentName, ...message)
    }

    useEffect(() => {
      log('mounted');
      return () => {
        log('unmounted');
      };
    }, []);

    // Problem here with response have a lot of updates, will flood the console.
    useEffect(() => {
      if (props?.prevTask) {
        const diff = getObjectDifference(props.task, props.prevTask);
        let show_diff = true
        if (hasOnlyResponseKey(diff)) {
          if (!props.prevTask.response) {
            diff.response = "..."
          } else {
            show_diff = false
          }
        }
        if (show_diff && Object.keys(diff).length > 0) {
          if ( props.task.component_depth === props.component_depth) {
            log("Task " + props.task.id + " changes:", diff)
          }
        }
        if (!props.task.id) {
          console.log("Weird ", props.task)
        }
      }
    }, [props.task]);

    function useTrace(variableName, variableValue) {
      useEffect(() => {
        console.log(`Tracing ${variableName}:`, variableValue);
      }, [variableName, variableValue]);
    }

    const componentProps = {
        ...props,
        log, // add log as a prop
    };

    return <Component {...componentProps} />;
  }

  DebugComponent.displayName = componentName;
  return DebugComponent;
}

export default withDebug