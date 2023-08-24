/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import DynamicComponent from "../Generic/DynamicComponent";
import { useMachine } from '@xstate/react';
import TreeModel from 'tree-model';
import { inspect } from '@xstate/inspect';
import useGlobalStateContext from "../../contexts/GlobalStateContext";
import { library } from "../../shared/fsm/TaskSystemTest/library.mjs"
import { xutils } from "../../shared/fsm/xutils.mjs"

inspect({
  //iframe: false,
  iframe: () => document.querySelector('iframe.xstate'),
  url: "https://stately.ai/viz?inspect"
});

/*
Task Process

Task States
  
ToDo:
  
*/

function TaskSystemTest(props) {

  const {
    log,
    task,
    modifyTask,
    syncTask,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  // without this we will not setup the hooks for the websocket
  props.onDidMount();

  const { replaceGlobalState } =  useGlobalStateContext();

  // We pass a ref to the task so we do not lose the task state when React sets it
  const [state, send, service] = useMachine(props.fsm, {
    context: { taskRef: props.taskRef },
    actions: {
      taskAction: taskAction,
      taskQuery: taskQuery,
      pass: pass,
      fail: fail,
      logMsg: (context, event, { action }) => {
        console.log(action.message, context.data);
      },
    },
    devTools: task.config.fsm.devTools ? true : false,
  });
  const queriesRef = useRef();
  const actionsRef = useRef();
  const startedRef = useRef(false);
  const [result, setResult] = useState();
  const timeoutId = useRef();

  function pass(context, event, actionMeta) {
    setResult(true);
  }

  function fail(context, event, actionMeta) {
    setResult(false);
  }

  useEffect(() => {
    if (result === undefined) {
      const delay = task.config.local.timeout || 30000;
      timeoutId.current = setTimeout(() => {
        console.log(`Stopped polling after ${delay / 1000} seconds`);
        send('TIMEOUT');
      }, delay); // Stop polling after 30 seconds
    } else if (result) {
      clearInterval(timeoutId.current);
      console.log("PASSED");
    } else {
      clearInterval(timeoutId.current);
      console.log("FAILED");
    }
  }, [result]);

  useEffect(() => {
    if (task?.config?.fsm && !startedRef.current) {
      // Using queriesRef to store information so we make a copy to avoif changing the task
      if (task.config.fsm.queries && !queriesRef.current) {
        console.log("Setting queriesRef.current", task.config.fsm.queries);
        queriesRef.current = JSON.parse(JSON.stringify(task.config.fsm.queries));
        // Deep merge with the library

      }
      // Using actionsRef to store information so we make a copy to avoif changing the task
      if (task.config.fsm.actions && !actionsRef.current) {
        console.log("Setting actionsRef.current", task.config.fsm.actions);
        actionsRef.current = JSON.parse(JSON.stringify(task.config.fsm.actions));
      }
      // Merge the library of queries/actions
      if (library?.queries) {
        queriesRef.current = {...queriesRef.current, ...library.queries};
        console.log("Merged queriesRef.current", queriesRef.current);
      }
      if (library?.actions) {
        actionsRef.current = {...actionsRef.current, ...library.actions};
        console.log("Merged actionsRef.current", actionsRef.current);
      }
      // Send start event once after we have used task.config?fsm
      send('START');
      startedRef.current = true;
    }
  }, [task?.config?.fsm]);

  // For debug messages
  useEffect(() => {
    const subscription = service.subscribe((state) => {
      // simple state logging
      log(`${props.componentName} FSM State ${state.value} Event ${state.event.type}`)
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [service]); // note: service should never change

  function activate(msg, ref, context, event, actionMeta) {
    const id = actionMeta.action.id;
    console.log(msg, id);
    let taskData = ref.current[id];
    if (!taskData) {
      if (actionMeta.action.args) {
        // We are creating a task action
        ref.current[id] = {};
        console.error(msg, "Did not find id creating", id);
      } else {
        console.error(msg, "missing id", id);
      }
    }
    taskData.taskRef = context.taskRef;
    if (actionMeta.action.args) {
      taskData = { ...taskData, ...actionMeta.action.args };
    }
    taskData.active = true;
    console.log("Merged taskData", taskData);
    ref.current[id] = taskData;
  }
  
  function taskQuery(context, event, actionMeta) {
    activate("taskQuery", queriesRef, context, event, actionMeta);
  }

  function taskAction(context, event, actionMeta) {
    activate("taskAction", actionsRef, context, event, actionMeta);
  }

  function queryUI(id, data) {
    let { query, element, field, event, expect, eventTrue, eventFalse, debug, oldValue, delay } = data;
    let newValue;
    const msg = "queryUI id:" + id;
    if (debug) {console.log(msg, "queryUI", query);}
    if (!document.contains(element)) {
      if (debug) {console.log(msg, "!document.contains(element)", query);}
      queriesRef.current[id].element = document.querySelector(query);
    }
    element = queriesRef.current[id].element;
    if (element) {
      newValue = element[field];
      queriesRef.current[id].oldValue = newValue;
      if (debug) {console.log(msg, "newValue", newValue);}
    }
    if (newValue !== oldValue) {
      let eventType = event;
      if (!eventType) {
        eventType = id;
        eventType = xutils.convertToSnakeCase(id);
        eventType = xutils.query2event(eventType);
      }
      if (debug) {console.log(msg, "newValue !== oldValue", query, newValue, oldValue);}
      if ((newValue !== null && newValue !== undefined) && (!expect || expect === newValue)) {
        if (debug) {console.log(msg, "send", query, eventTrue ? eventTrue : event, "delay", delay);}
        if (delay) {
          setTimeout(() => {
            send({
              type: eventTrue ? eventTrue : eventType,
              data: newValue,
            });
          }, delay);          
        } else {
          send({
            type: eventTrue ? eventTrue : eventType,
            data: newValue,
          });
        }
        return true; // Will stop this query
      } else if (eventFalse) {
        if (debug) {console.log(msg, "send", query, eventFalse, "delay", delay);}
        if (delay) {
          setTimeout(() => {
            send({
              type: eventFalse,
              data: newValue,
            });
          }, delay);          
        } else {
          send({
            type: eventFalse,
            data: newValue,
          });
        }
      }
    }
    return false;
  }

  function actionUI(id, data) {
    let { event, debug, delay, input, value, taskRef, type } = data;
    const msg = "actionUI " + type + " input " + input;
    const task = taskRef.current;
    if (debug) {console.log(msg, "pollForTask", task.state)};
    if (task.state.familyTree) {
      if (debug) {console.log(msg, "task.state.familyTree", task.state.familyTree)};
      const root = new TreeModel().parse(task.state.familyTree);
      const node = root.first(node => node.model.type === type);
      if (node) {
        if (debug) {console.log(msg, "node", node)};
        let eventType = event;
        if (!eventType) {
          eventType = id;
          eventType = xutils.convertToSnakeCase(id);
          eventType = xutils.action2event(eventType);
        }
        let diff = {
          id: node.model.taskId,
          instanceId: node.model.taskInstanceId,
        };
        diff["input"] = {[input]: value};
        if (debug) {console.log(msg, diff)};
        syncTask(diff);
        if (debug) {console.log(msg, "sending", eventType)};
        if (delay) {
          setTimeout(() => {
            send({
              type: eventType,
            });
          }, delay);
        } else {
          send({type: eventType});
        }
        return true;
      }
    }
    return false;
  }

  useEffect(() => {
    const polling = () => {
      const taskActionKeys = Object.keys(actionsRef.current);
      taskActionKeys.forEach((key) => {
        //console.log("taskActionKeys ", key, actionsRef.current[key].active);
        if (actionsRef.current[key].active) {
          if (actionsRef.current[key].debug) {
            console.log("Action " + key + " active.");
          }
          if (actionUI(key, actionsRef.current[key])) {
            console.log("Action " + key + " inactive.");
            actionsRef.current[key].active = false;
          }
        }
      });
      const taskQueryKeys = Object.keys(queriesRef.current);
      taskQueryKeys.forEach((key) => {
        //console.log("taskQueryKeys ", key, queriesRef.current[key].active);
        if (queriesRef.current[key].active) {
          if (queriesRef.current[key].debug) {
            console.log("Query " + key + " active.");
          }
          if (queryUI(key, queriesRef.current[key])) {
            console.log("Query " + key + " inactive.");
            queriesRef.current[key].active = false;
          }
        }
      });
    }
    let intervalId;
    if (result === undefined) {
      intervalId = setInterval(polling, 300);
    }
    return () => {
        console.log("taskAction and taskQuery polling disconnect");
        clearInterval(intervalId);
    };
  }, [result]);
  
  // The div SystemTest has display set to "contents" so it does not disrupt flex layout
  // That is not supported in the Edge browser
  return (
    <>
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div id="SystemTest"  style={{display: "contents"}}>
      {/*<div>sent:{sent ? 'true' : 'false'}</div>*/}
      {props.childTask && (
        <DynamicComponent
          key={props.childTask.id}
          is={props.childTask.type}
          task={props.childTask}
          setTask={props.setChildTask}
          parentTask={task}
          handleModifyChildTask={props.handleModifyChildTask}
        />
      )}
      </div>
    </div>
    </>
  );

};

export default withTask(TaskSystemTest);


