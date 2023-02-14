// libs
import React, { useCallback, useState } from 'react';
import {useQuery} from 'react-query';

// assets
import send from '../assets/send.svg';

// contexts
import { useModel } from '../contexts/ModelContext';

// utils
import {fetchGptRes} from '../utils/utils'


const MsgBox = ({ msgs, setMsgs}) => {
  const [newMsg, setNewMsg] = useState("");
  const [pending, setPending] = useState(false);
  const model = useModel();
  console.log(model);

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


  const { data, refetch, } = useQuery(
    ['newMsg', 
      newMsg, 
      model, 
      "http://chatbotbeanstalk-env.eba-xn42mmzq.us-west-2.elasticbeanstalk.com/", //"http://localhost:5000/", //https://chatgpt-clone-yl1.onrender.com/
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
      await refetch();
      setPending(false);
    },[data, model.impersonation, msgs, newMsg, refetch, setMsgs]);


  return (
    <form onSubmit={handleSubmit} className="msg-form">
      <textarea 
      name="prompt" 
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




