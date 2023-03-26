// libs
import React, { useCallback, useState } from 'react';
import { ReadyState } from 'react-use-websocket';

// assets
import send from '../assets/send.svg';

// contexts
import { useModel } from '../contexts/ModelContext';

import useWebSocket from 'react-use-websocket'
import { socketUrl, sessionId } from '../App';

const MsgBox = ({ msgs, setMsgs}) => {
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const model = useModel();

  //console.log("MSGBox component")

  // An examples of receiving a message;
  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: (closeEvent) => {
      // custom reconnect logic here
      return true; // reconnect by default
    },
    filter: () => false,
    onError: (err) => {
      console.error('WebSocket error:', err); 
      // update the last msg with the error msg
      const newMsgs = [...msgs.slice(0,- 1), { 
        sender: model.impersonation ? 
                model.impersonation : 'bot', 
        text: "err!: " + err, 
        isLoading: false,  
      }]
      setMsgs(newMsgs)
      setPending(false);
      },
    onMessage: (e) => {
      //console.log('Stream from server:', e.data)
      const j = JSON.parse(e.data)
      if (j?.stream) {
        const lastElement = msgs[msgs.length - 1];
        lastElement.text += j.stream
        //console.log(j.stream)
        // This allows the text to be displayed
        lastElement.isLoading = false 
        const newMsgs = [...msgs.slice(0,-1), lastElement]
        setMsgs(newMsgs)
        setPending(false);
      }
      if (j?.message) {
        console.log(j.message)
      }
    }
  });

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting', 
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  const handleSubmit = useCallback(async (e) => {
    if (e){
      e.preventDefault();
    }
    if (!newMsg){
      return
    }
    setPending(true);
    const newMsgs = [
      { sender: 'user', text: newMsg,  isLoading: false,}, 
      { sender: model.impersonation ? 
                model.impersonation : 'bot', 
        text: "", 
        isLoading: true, }]
    setMsgs([...msgs, ...newMsgs]);
    console.log("Sending")
    setMessageHistory((prev) => [...prev, newMsg]);
    sendJsonMessage({
      sessionId: sessionId,
      prompt: newMsg,
      ...model,
    });
    // Clear the textbox for our next prompt
    setNewMsg("");
  },[msgs, newMsg, setNewMsg, setMsgs, sendJsonMessage, model]);


  return (
    <form onSubmit={handleSubmit} className="msg-form">
      <textarea 
      name="prompt" 
      value={newMsg}
      rows="1" 
      cols="1" 
      onChange = {(e) => {
        setNewMsg(e.target.value);
      }} 
      onKeyDown={(e) => {
        if(e.key === 'Enter' && e.shiftKey === false ) {
          e.preventDefault();
          //console.log(formRef.current.elements.prompt.value);
          handleSubmit();
        }
      }} />
      <button type="submit"disabled={pending}  className={pending ? "send-button not-ready" : "send-button ready"}>
        {/* The key stops React double loading the image when both img and message are updated */}
        <img key={send} src={send} alt="Send" className={pending ? "send-not-ready" : "send-ready"}/>
      </button>
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




