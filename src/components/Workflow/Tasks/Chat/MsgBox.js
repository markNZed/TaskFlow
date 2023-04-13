// libs
import React, { useCallback, useState, useRef, useEffect } from 'react';
import PromptDropdown from './PromptDropdown';

// assets
import send from '../../../../assets/send.svg';

// contexts
import { useGlobalStateContext } from '../../../../contexts/GlobalStateContext';
import { useWebSocketContext } from '../../../../contexts/WebSocketContext';

import { sessionId } from '../../../../App';

const MsgBox = (props) => {
  const { connectionStatus, webSocketEventEmitter, sendJsonMessagePlus } = useWebSocketContext();
  const [lastMessage, setLastMessage] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const globalState = useGlobalStateContext();
  const [conversationId, setConversationId] = useState('initialize');
  const textareaRef = useRef(null);
  const [mySelectedworkflow, setMySelectedworkflow] = useState(null);

  //console.log("MSGBox component")

  useEffect(() => {
    setMySelectedworkflow(props.selectedworkflow)
  },[]);

  useEffect(() => {
    if (!webSocketEventEmitter) {return}
    if (mySelectedworkflow !== props.selectedworkflow) {return}

    const handleMessage = (e) => {
      const j = JSON.parse(e.data)
      // props.selectedworkflow
      if (j?.conversationId) {
        //setLastMessage(j);
        setConversationId(j.conversationId)
        if (j?.delta || j?.text || j?.final) {
          let newMsgs =  JSON.parse(JSON.stringify(props.msgs)); // deep copy
          const lastElement = newMsgs[props.selectedworkflow.id][newMsgs[props.selectedworkflow.id].length - 1];
          if (j?.delta) {
            lastElement.text += j.delta
          }
          if (j?.text) {
            lastElement.text = j.text
          }
          if (j?.final) {
            lastElement.text = j.final
          }
          // This allows the text to be displayed
          lastElement.isLoading = false 
          newMsgs[props.selectedworkflow.id] = [...newMsgs[props.selectedworkflow.id].slice(0,-1), lastElement]
          props.setMsgs(newMsgs);
          setPending(false);
        }
        if (j?.message) {
          console.log("Message: " + j.message)
        }
      }
    };

    webSocketEventEmitter.on('message', handleMessage);

    return () => {
      webSocketEventEmitter.removeListener('message', handleMessage);
    };
  }, [webSocketEventEmitter, props.msgs, props.selectedworkflow.id]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); 
    if (!newMsg){
      return
    }
    setPending(true);
    const newMsgArray = [
      { sender: 'user', text: newMsg,  isLoading: false,}, 
      { sender: 'bot', 
        text: "", 
        isLoading: true, 
      }];
    let newMsgs =  JSON.parse(JSON.stringify(props.msgs)); // deep copy
    newMsgs[props.selectedworkflow.id] = [...newMsgs[props.selectedworkflow.id], ...newMsgArray]
    props.setMsgs(newMsgs);
    setMessageHistory((prev) => [...prev, newMsg]);
    sendJsonMessagePlus({
      sessionId: sessionId,
      userId: props.user.userId,
      selectedworkflowId: props.selectedworkflow.id,
      conversationId: conversationId,
      prompt: newMsg,
      ...globalState,
    });
    console.log("conversationId sent " + conversationId)
    // Clear the textbox for our next prompt
    setNewMsg("");
  },[props.msgs, props.setMsgs, newMsg, setNewMsg, sendJsonMessagePlus, globalState, props.user, props.selectedworkflow.id]);

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

  return (
    <form onSubmit={handleSubmit} className="msg-form">
        {props?.selectedworkflow?.suggested_prompts ?
          <div style={{textAlign: 'left'}}>
            <PromptDropdown 
              prompts={props.selectedworkflow.suggested_prompts} 
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
        {/* <div>The WebSocket is currently {connectionStatus}</div> */}
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