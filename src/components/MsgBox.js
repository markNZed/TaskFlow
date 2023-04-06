// libs
import React, { useCallback, useState, useRef, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import Dropdown from './Dropdown';

// assets
import send from '../assets/send.svg';

// contexts
import { useModel } from '../contexts/ModelContext';

import { socketUrl, sessionId } from '../App';

const MsgBox = (props) => {
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const model = useModel();
  const [conversationId, setConversationId] = useState('initialize');
  const textareaRef = useRef(null);

  //console.log("MSGBox component")

  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    reconnectAttempts: 10,
    reconnectInterval: 5000,
    //share: true,
    onOpen: () => {
      console.log('MsgBox webSocket connection established.');
    },
    shouldReconnect: (closeEvent) => {
      // custom reconnect logic here
      const currentDate = new Date();
      console.log('MsgBox shouldReconnect true.' + currentDate);
      return true; // reconnect by default
    },
    filter: () => false,
    onError: (err) => {
      console.error('WebSocket error:', err); 
    },
    onMessage: (e) => {
      //console.log(e.data)
      const j = JSON.parse(e.data)
      if (j?.conversationId) {
        if (conversationId === 'initialize') {
          setConversationId(j.conversationId)
          console.log("conversationId from server: " + j.conversationId)
        }
        if (j.conversationId === conversationId) {
          if (j?.stream) {
            let newMsgs =  JSON.parse(JSON.stringify(props.msgs)); // deep copy
            const lastElement = newMsgs[props.selectedExercise.id][newMsgs[props.selectedExercise.id].length - 1];
            lastElement.text += j.stream
            //console.log(j.stream)
            // This allows the text to be displayed
            lastElement.isLoading = false 
            newMsgs[props.selectedExercise.id] = [...newMsgs[props.selectedExercise.id].slice(0,-1), lastElement]
            props.setMsgs(newMsgs);
            setPending(false);
          }
          if (j?.final) {
            // This fixs any missing messages over the websocket in the incremental mode
            let newMsgs =  JSON.parse(JSON.stringify(props.msgs)); // deep copy
            const lastElement = newMsgs[props.selectedExercise.id][newMsgs[props.selectedExercise.id].length - 1];
            lastElement.text = j.final
            lastElement.isLoading = false 
            newMsgs[props.selectedExercise.id] = [...newMsgs[props.selectedExercise.id].slice(0,-1), lastElement]
            props.setMsgs(newMsgs);
            setPending(false);
          }
          if (j?.message) {
            console.log("Message: " + j.message)
          }
        }
      }
    },
    onClose: (event) => {
      console.log(`MsgBox webSocket closed with code ${event.code} and reason '${event.reason}'`);
    },
  });

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting', 
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); 
    if (!newMsg){
      return
    }
    setPending(true);
    const newMsgArray = [
      { sender: 'user', text: newMsg,  isLoading: false,}, 
      { sender: model.impersonation ? 
                model.impersonation : 'bot', 
        text: "", 
        isLoading: true, 
      }];
    let newMsgs =  JSON.parse(JSON.stringify(props.msgs)); // deep copy
    newMsgs[props.selectedExercise.id] = [...newMsgs[props.selectedExercise.id], ...newMsgArray]
    props.setMsgs(newMsgs);
    console.log("Sending " + props.user.userId + " " + props.selectedExercise.id)
    setMessageHistory((prev) => [...prev, newMsg]);
    sendJsonMessage({
      sessionId: sessionId,
      userId: props.user.userId,
      selectedExerciseId: props.selectedExercise.id,
      conversationId: conversationId,
      prompt: newMsg,
      ...model,
    });
    console.log("conversationId sent " + conversationId)
    // Clear the textbox for our next prompt
    setNewMsg("");
  },[props.msgs, props.setMsgs, newMsg, setNewMsg, sendJsonMessage, model, props.user]);

  useEffect(() => {
   // Access the form element using the ref
    const textarea = textareaRef.current;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    textarea.placeholder="Écrivez votre prompt ici.";
  }, [newMsg]);


  const handleDropdownSelect = (selectedPrompt) => {
    setNewMsg(newMsg + selectedPrompt)
  };

  useEffect(() => {
    // filter removes empty entry
    console.log("Loading with conversationID " + conversationId)
}, []);

  return (
    <form onSubmit={handleSubmit} className="msg-form">
        {props?.selectedExercise?.suggested_prompts ?
          <div style={{textAlign: 'left'}}>
            <Dropdown 
              prompts={props.selectedExercise.suggested_prompts} 
              onSelect={handleDropdownSelect} 
            />
          </div>
          : ''
        }
        <div className="msg-textarea-button">
          <textarea
            ref={textareaRef} 
            name="prompt"
            value={newMsg}
            rows="1"
            cols="1"
            onChange={(e) => {
              setNewMsg(e.target.value);
            } }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey === false) {
                e.preventDefault();
                //console.log(formRef.current.elements.prompt.value);
                handleSubmit(e);
              }
            } }
          />
          <button type="submit" disabled={pending} className={pending ? "send-button not-ready" : "send-button ready"}>
            {/* The key stops React double loading the image when both img and message are updated */}
            <img key={send} src={send} alt="Send" className={pending ? "send-not-ready" : "send-ready"} />
          </button>
        </div>
        {/* This can cause continuous reloading when it alternates opeņ/close ? */}
        <div>The WebSocket is currently {connectionStatus}</div>
        {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
        <ul>
          {messageHistory?.map((message, idx) => (
            <span key={idx}>{message ? message.data : null}</span>
          ))}
        </ul>
    </form>
  );
}

export default React.memo(MsgBox);




