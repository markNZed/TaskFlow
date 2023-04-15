// libs
import React, { useCallback, useState, useRef, useEffect } from 'react';
import PromptDropdown from './PromptDropdown';

// assets
import send from '../../../../assets/send.svg';

// contexts
import { useGlobalStateContext } from '../../../../contexts/GlobalStateContext';
import { useWebSocketContext } from '../../../../contexts/WebSocketContext';

const MsgBox = (props) => {
  const { globalState } = useGlobalStateContext();
  const { connectionStatus, webSocketEventEmitter, sendJsonMessagePlus } = useWebSocketContext();
  const [lastMessage, setLastMessage] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const [workflowId, setWorkflowId] = useState('initialize');
  const textareaRef = useRef(null);
  const [myWorkflow, setMyWorkflow] = useState(null);

  //console.log("MSGBox component")

  useEffect(() => {
    if (globalState.workflow !== myWorkflow) {
      setMyWorkflow(globalState.workflow)
    }
  });

  useEffect(() => {
    if (!webSocketEventEmitter) {return}

    const handleMessage = (e) => {
      const j = JSON.parse(e.data)
      if (j?.workflowId === myWorkflow.id) {
        //setLastMessage(j);
        if (j?.delta || j?.text || j?.final) {
          let newMsgs =  JSON.parse(JSON.stringify(props.msgs)); // deep copy
          const lastElement = newMsgs[globalState.workflow.id][newMsgs[globalState.workflow.id].length - 1];
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
          newMsgs[globalState.workflow.id] = [...newMsgs[globalState.workflow.id].slice(0,-1), lastElement]
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
  }, [webSocketEventEmitter, props.msgs, globalState.workflow.id]);

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
    newMsgs[globalState.workflow.id] = [...newMsgs[globalState.workflow.id], ...newMsgArray]
    props.setMsgs(newMsgs);
    setMessageHistory((prev) => [...prev, newMsg]);
    sendJsonMessagePlus({
      sessionId: globalState.sessionId,
      userId: globalState.user.userId,
      workflowId: myWorkflow.id,
      prompt: newMsg,
      ...globalState,
    });
    // Clear the textbox for our next prompt
    setNewMsg("");
  },[props.msgs, props.setMsgs, newMsg, setNewMsg, sendJsonMessagePlus, globalState, globalState.workflow.id]);

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
        {myWorkflow?.suggested_prompts ?
          <div style={{textAlign: 'left'}}>
            <PromptDropdown 
              prompts={myWorkflow?.suggested_prompts} 
              onSelect={handleDropdownSelect} 
            />
          </div>
          : 
          ''
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