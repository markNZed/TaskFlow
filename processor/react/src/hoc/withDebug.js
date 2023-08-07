import React, { useEffect } from "react";
import { utils } from "../utils/utils";
import _ from "lodash";

function withDebug(Component) {
  const componentName = Component.name;

  function DebugComponent(props) {
    function log(...message) {
      utils.logWithComponent(componentName, ...message);
    }

    useEffect(() => {
      log("mounted");
      return () => {
        log("unmounted");
      };
    }, []);

    function removeNullValues(obj) {
      Object.keys(obj).forEach(key => 
          (obj[key] && typeof obj[key] === 'object') && removeNullValues(obj[key]) ||
          (obj[key] === null) && delete obj[key]
      );
      return obj;
    }

    // Problem here with response have a lot of updates, will flood the console.
    useEffect(() => {
      if (props?.prevTask) {
        const diff = utils.getObjectDifference(props.prevTask, props.task) || {};
        delete diff.response;
        delete diff.output;
        removeNullValues(diff)
        let show_diff = true;
        if (utils.hasOnlyResponseKey(diff)) {
          if (!props.prevTask.response?.text) {
            diff.response.text = " ...";
          } else {
            show_diff = false;
          }
        }
        if (diff.response?.text && diff.response.text.length > 0) {
          diff.response.text = diff.response.text.slice(0, 20) + " ...";
        }
        if (show_diff && Object.keys(diff).length > 0) {
          log(
            "Task " + props.task.instanceId + " " + props.task.id + " changes:",
            diff
          );
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
      log,
    };

    return <Component {...componentProps} />;
  }

  DebugComponent.displayName = componentName;
  return DebugComponent;
}

export default withDebug;
