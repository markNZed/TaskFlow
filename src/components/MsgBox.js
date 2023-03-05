// libs
import React, { useCallback, useState } from 'react';
import {useQuery} from 'react-query';

// assets
import send from '../assets/send.svg';

// contexts
import { useModel } from '../contexts/ModelContext';

// utils
import {fetchGptRes} from '../utils/utils'

import useWebSocket from 'react-use-websocket'
import { socketUrl, sessionId } from '../App';

const MsgBox = ({ msgs, setMsgs}) => {
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const model = useModel();
  //console.log(model);

  // An examples of receiving a message;
  const { sendJsonMessage } = useWebSocket(socketUrl, {
    share: true,
    filter: () => false,
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
      }
      if (j?.message) {
        console.log(j.message)
      }
    }
  });

  const onSuccess = useCallback((data) => {
    console.log("fetching successful");

    // update the last msg with the fetched data
    const newMsgs = [...msgs.slice(0,- 1), { 
      sender: model.impersonation 
              ? model.impersonation : 'bot', 
      text: data, 
      isLoading: false,  
    }]
    setMsgs(newMsgs)
  },[model.impersonation, msgs, setMsgs]);


  const onError = useCallback((err) => {
    console.log("fetching failed", err);

    // update the last msg with the error msg
    const newMsgs = [...msgs.slice(0,- 1), { 
      sender: model.impersonation ? 
              model.impersonation : 'bot', 
      text: "err!: " + err, 
      isLoading: false,  
    }]
    setMsgs(newMsgs)
  },[model.impersonation, msgs, setMsgs])


  const { data } = useQuery(
    ['newMsg', 
      newMsg, 
      model, 
      window.location.protocol + "//" + window.location.hostname + ":5000", // "http://localhost:5000/", //https://chatgpt-clone-yl1.onrender.com/, //"http://chatbotbeanstalk-env.eba-xn42mmzq.us-west-2.elasticbeanstalk.com/", //
    ], 
    fetchGptRes,
    {
      onSuccess,
      onError,
      enabled: false,
    });

    const handleSubmit = useCallback(async (e) => {
      
      if (e){
        e.preventDefault();
      }
      
      if (!newMsg){
        return
      }
  
      setPending(true);
  
      // check if the data is already in cache
      if (data){
        console.log("data found in cache, no need to fetch.")
        const cachedMsgs = [
          { sender: 'user', text: newMsg,  isLoading: false,}, 
          { sender: model.impersonation ? 
                    model.impersonation : 'bot', 
            text: data, 
            isLoading: false, }]
        setNewMsg("");    
        setMsgs([...msgs, ...cachedMsgs]);
        setPending(false);
        return 
      }
  
      // not found in cache
      const newMsgs = [
        { sender: 'user', text: newMsg,  isLoading: false,}, 
        { sender: model.impersonation ? 
                  model.impersonation : 'bot', 
          text: "", 
          isLoading: true, }]
  
      setMsgs([...msgs, ...newMsgs]);
      sendJsonMessage({
        sessionId: sessionId,
        prompt: newMsg,
        ...model,
      });
      // Clear the textbox for our next prompt
      setNewMsg("");
      setPending(true);
    },[data, msgs, newMsg, setNewMsg, setMsgs, sendJsonMessage, model]);


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
      <button type="submit" disabled={pending}  className={pending ? "send-button not-ready" : "send-button ready"}>
        <img src={send} alt="Send" className={pending ? "send-not-ready" : "send-ready"}/>
      </button>
    </form>
  );
}

export default React.memo(MsgBox);




