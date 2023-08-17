/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useRef, useEffect } from "react";
import withTask from "../../hoc/withTask";
import DynamicComponent from "../Generic/DynamicComponent";
import { useMachine } from '@xstate/react';
import { inspect } from '@xstate/inspect';

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
    fsm,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  // without this we will not setup the hooks for the websocket
  props.onDidMount();

  //task.familyIds is an object with structure instanceId: {id: }

  // We pass a ref to the task so we do not lose the task state when React sets it
  const TaskRef = useRef();
  const [state, send] = useMachine(fsm, {
    context: { taskRef: TaskRef },
    actions: {
      updateTask: updateTask,
      submitPrompt: submitPrompt,
      checkResponse: checkResponse,
    }
  });
  const [sent, setSent] = useState();
  const [sentPrompt, setSentPrompt] = useState();
  const [inputPrompt, setInputPrompt] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    TaskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (task.state.familyTree) {
      //console.log("Send FAMILY");
      send({
        type: 'FAMILY',
      });
    }
  }, [task.state.familyTree]);

  function checkResponse(context, event) {
    console.log('Context:', context);
    console.log('Event:', event);
    console.log("checkResponse");
    if (context.data === "test text") {
      send('PASS');
    } else {
      send('FAIL');
    }
  }

  function submitPrompt(context, event) {
    console.log('Context:', context);
    console.log('Event:', event);
    console.log("submitPrompt");
    const chat = context.familyTreeNode;
    // In HOC create a syncTask function
    const syncTask = {
      id: chat.model.taskId,
      instanceId: chat.model.taskInstanceId,
      input: {
        submitPrompt: true
      },
    }
    modifyTask({ 
      "command": "update",
      "commandArgs": {
        sync: true,
        syncTask: syncTask,
      }
    });
    setSentPrompt(true);
  }

  function updateTask(context, event) {
    console.log('Context:', context);
    console.log('Event:', event);
    console.log("updateTask");
    const chat = context.familyTreeNode;
    // In HOC create a syncTask function
    const syncTask = {
      id: chat.model.taskId,
      instanceId: chat.model.taskInstanceId,
      input: {
        promptText: "Hello World!"
      },
    }
    modifyTask({ 
      "command": "update",
      "commandArgs": {
        sync: true,
        syncTask: syncTask,
      }
    });
    setSent(true);
  }

  // We can't see events when React is updating the textarea
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Check textarea for input changes
      const textarea = document.querySelector('textarea[name="prompt"]');
      if (textarea && textarea.value !== inputPrompt) {
          setInputPrompt(textarea.value);
      }
      // Check chat container for response changes
      const chatDiv = document.querySelector('#chat-container');
      if (chatDiv) {
        const wrapperDivs = chatDiv.querySelectorAll('div.wrapper');
        if (wrapperDivs.length > 0) {
          const lastWrapperDiv = wrapperDivs[wrapperDivs.length - 1];
          if (lastWrapperDiv && lastWrapperDiv.innerText !== response) {
            setResponse(lastWrapperDiv.innerText);
          }
        }
      }
    }, 200); // Poll every 200ms
    return () => {
        console.log("Observers disconnect");
        clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
   console.log("inputPrompt", inputPrompt);
   send({
    type: 'PROMPT',
    data: inputPrompt,
  });
  }, [inputPrompt]);

  useEffect(() => {
    console.log("response", response);
    send({
     type: 'RESPONSE',
     data: response,
   });
   }, [response]);
  
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
