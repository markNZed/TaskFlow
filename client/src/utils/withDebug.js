import React, { useEffect } from 'react'
import debug from 'debug';
import { appAbbrev } from './../config';
import _ from 'lodash';

function withDebug(Component) {
  const componentName = Component.name

  function DebugComponent(props) {

    useEffect(() => {
      log('Component mounted');
      return () => {
        log('Component unmounted');
      };
    }, []);

    const getObjectDifference = (obj1, obj2) => {
      return _.pickBy(obj1, (value, key) => !_.isEqual(value, obj2[key]));
    };  

    function hasOnlyResponseKey(obj) {
      const keys = Object.keys(obj);
      return keys.length === 1 && keys[0] === 'response';
    }

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
          log("Task " + props.task.id + " changes:", diff)
        }
        if (!props.task.id) {
          console.log("Weird ", props.task)
        }
      }
    }, [props.task]);

    const log = (...message) => {
      const stackTrace = new Error().stack.split('\n');
      const match = stackTrace[1].match(/^(.*)@/);
      let callerName = ':' + match ? match[1] : ':unknown';
      if (callerName.indexOf('/')) { callerName = ':unknown' } // File path probably 
      const log = debug(`${appAbbrev}:${componentName}${callerName}`);
      log(...message);
    };

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