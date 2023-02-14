import React, { useRef, useState, useEffect } from 'react';

// components
import MsgBox from "./MsgBox"
import Icon from "./Icon"

const ChatArea = () => {
  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  const [msgs, setMsgs] = useState([
    { sender: 'bot', text: "Welcome! how may I help you today?",  isLoading: true}]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [msgs]);

  useEffect(()=>{
    setTimeout(()=>{
      setMsgs([
        { sender: 'bot', text: "Welcome! how may I help you today?",  isLoading: false}])
    }, 2000)
    
  },
  []);


  return (
    <section className='chatbox'>
      <div id="chat-container" ref={chatContainer}>
        <div id="chat-room-title"> 
          Chatbot Demo for Onlea
        </div>

        {msgs && msgs.map((msg, index) => {
          return (
            <div key={index} className={`wrapper ${msg.sender === 'bot' && 'ai'}`}>
              <div className="chat">
                <Icon sender={msg.sender}/>
                {msg.isLoading ? 
                  <div key={index} className="dot-typing"></div> : 
                  <div className="message">{msg.text}</div>
                }
              </div>
            </div>
          )
        })
      }

      <div ref={messagesEndRef} style={{height:"5px"}}/>
      
    </div>
    <MsgBox msgs={msgs} setMsgs={setMsgs} />
    </section> 
    )
  }

  export default React.memo(ChatArea);