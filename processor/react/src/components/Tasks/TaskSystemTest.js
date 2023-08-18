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

inspect({
  //url: "https://statecharts.io/inspect",
  iframe: false
});

// PLACEHOLDER - under development and not working

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
    fsm,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  // without this we will not setup the hooks for the websocket
  props.onDidMount();

  // We pass a ref to the task so we do not lose the task state when React sets it
  const TaskRef = useRef();
  const [state, send, service] = useMachine(fsm, {
    context: { taskRef: TaskRef },
    actions: {
      taskAction: taskAction,
      queryAction: queryAction,
      queryExpect: queryExpect,
    },
    devTools: true,
  });
  const queryExpectRefs = useRef({
    findTextarea: {
      query: 'textarea[name="prompt"]',
      field: "value",
      event: "TEXTAREA",
      active: false,
      debug: true,
    },
    findPrompt: {
      query: 'textarea[name="prompt"]',
      expect: "Hello World!",
      field: "value",
      event: "PROMPT_SEEN",
    },
    findResponse: {
      query: '#chat-container > div:nth-last-child(2)',
      expect: "test text",
      field: "innerText",
      eventTrue: "PASS",
    },
  });
  const taskActionRefs = useRef({
    enterPrompt: {
      type: "TaskChat",
      input: "promptText",
      value: "Hello World!",
      event: "PROMPTED",
    },
    submitPrompt: {
      type: "TaskChat",
      input: "submitPrompt",
      value: true,
      event: "PROMPT_SUBMITTED",
    },
});
  const queryActionRefs = useRef({
    enterPrompt: {
      query: 'textarea[name="prompt"]',
      value: "Hello World!",
      field: "value",
      event: "PROMPTED",
    },
    submitPrompt: {
      query: 'button.send-button',
      functionName: "click",
      event: "PROMPT_SUBMITTED",
    },
});

  // For debug messages
  service.subscribe((state) => {
    //console.log(state);
  });

  useEffect(() => {
    TaskRef.current = task;
  }, [task]);

  function taskAction(context, event, actionMeta) {
    const action = actionMeta.action.action;
    const msg = "taskAction " + action;
    console.log(msg);
    const taskActionData = taskActionRefs.current[action];
    if (!taskActionData) {
      console.log("taskActionRefs.current", taskActionRefs.current);
      throw new Error("Action " + action + " not implemented");
    }
    // Create a function that will be called every 250ms
    const pollForTask = () => {
      const task = context.taskRef.current;
      console.log(msg, "pollForTask", task.state.familyTree);
      if (task.state.familyTree) {
        const root = new TreeModel().parse(task.state.familyTree);
        const node = root.first(node => node.model.type === taskActionData.type);
        if (node) {
          clearInterval(intervalId); // Clear the interval when the node is found
          let diff = {
            id: node.model.taskId,
            instanceId: node.model.taskInstanceId,
          };
          diff["input"] = {[taskActionData.input]: taskActionData.value};
          console.log(msg, diff);
          syncTask(diff);
        }
      }
    };
    // Call the pollForTask function every 250ms
    const intervalId = setInterval(pollForTask, 250);
    // Optionally, you can clear the interval after a certain time if the node is not found
    setTimeout(() => {
      clearInterval(intervalId);
      console.log('Stopped polling after a certain time');
    }, 10000); // Stop polling after 10 seconds
  }
  

  function queryExpect(context, event, actionMeta) {
    const action = actionMeta.action.action;
    console.log('queryExpect', action);
    const queryExpectData = queryExpectRefs.current[action];
    if (queryExpectData) {
      queryExpectData.active = true;
    }
  }

  // React does not allow us to simply update the value
  // We probably need to use something like https://testing-library.com/docs/react-testing-library/intro/
  // But it may be better to allow tasks to drive tasks through the input anyway
  function queryAction(context, event, actionMeta) {
    const action = actionMeta.action.action;
    const msg = "queryAction " + action;
    console.log(msg);
    const queryActionData = queryActionRefs.current[action];
    if (queryActionData) {
      const element = document.querySelector(queryActionData.query)
      if (element) {
        const functionName = queryActionData.functionName;
        if (functionName) {
          if (functionName === "click") {
            console.log("click", element);
            element.click();
          }
        } else {
          console.log(msg, queryActionData.field,"of", element, "set to", queryActionData.value);
          element[queryActionData.field] = queryActionData.value;
        }
        console.log(msg, "event", queryActionData.event, "for", action, "with delay", queryActionData.delay, Date());
        if (queryActionData.delay) {
          setTimeout(() => {
            send({
              type: queryActionData.event,
            });
          }, queryActionData.delay);
        } else {
          send(queryActionData.event);
        }
      } else {
        console.log(msg, "no element", queryActionRefs.current[action]);
      }
    } else {
      console.log(msg, "no queryActionData");
    }
  }

  function queryUI(key, value) {
    let { query, element, field, event, expect, eventTrue, eventFalse, debug, oldValue, delay } = value;
    let newValue;
    if (debug) {console.log("queryUI", query);}
    if (!document.contains(element)) {
      if (debug) {console.log("!document.contains(element)", query);}
      queryExpectRefs.current[key].element = document.querySelector(query);
    }
    element = queryExpectRefs.current[key].element;
    if (element) {
      newValue = element[field];
      queryExpectRefs.current[key].oldValue = newValue;
      if (debug) {console.log("newValue", query, newValue);}
    }
    if (newValue !== oldValue) {
      if (debug) {console.log("newValue !== oldValue", query, newValue, oldValue);}
      if ((newValue !== null && newValue !== undefined) && (!expect || expect === newValue)) {
        if (debug) {console.log("send", query, eventTrue ? eventTrue : event, "delay", delay);}
        if (delay) {
          setTimeout(() => {
            send({
              type: eventTrue ? eventTrue : event,
              data: newValue,
            });
          }, delay);          
        } else {
          send({
            type: eventTrue ? eventTrue : event,
            data: newValue,
          });
        }
        return true; // Will stop this query
      } else if (eventFalse) {
        if (debug) {console.log("send", query, eventFalse, "delay", delay);}
        if (delay) {
          send({
            type: eventFalse,
            data: newValue,
          }, {delay: delay});
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

  // We can't always see events when React is updating the DOM
  // So we do not rely on events
  useEffect(() => {
    const intervalId = setInterval(() => {
      // for each queryExpectRefs
      let toRemove = [];
      const queryExpectKeys = Object.keys(queryExpectRefs.current);
      queryExpectKeys.forEach((key) => {
        if (!queryExpectRefs.current[key]) {
          console.log("queryExpectRefs.current[key] is null", key);
        }
        if (queryExpectRefs.current[key].active) {
          if (queryUI(key, queryExpectRefs.current[key])) {
            toRemove.push(key);
          }
        }
      });
      toRemove.forEach((key) => {
        delete queryExpectRefs.current[key]
      })
    }, 250); // Poll every 200ms
    return () => {
        console.log("Observers disconnect");
        clearInterval(intervalId);
    };
  }, []);
  
  // The div SystemTest has display set to "contents" so it does not disrupt flex layout
  // That is not supported in the Edge browser
  return (
    <>
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
    </>
  );

};

export default withTask(TaskSystemTest);


