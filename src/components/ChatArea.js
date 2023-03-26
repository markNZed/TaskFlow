import React, { useRef, useState, useEffect } from 'react';

// components
import MsgBox from "./MsgBox"
import Icon from "./Icon"

const ChatArea = () => {
  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  const welcomeMessage = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"
  //const welcomeMessage = "Welcome! how may I help you today?"
  const hasScrolledRef = useRef(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState([
    { sender: 'bot', text: welcomeMessage,  isLoading: true}
  ]);

  //console.log("ChatArea component")

  useEffect(() => {
    if (!isMountedRef.current) {
      setTimeout(()=>{
        setMsgs([
          { sender: 'bot', text: welcomeMessage,  isLoading: false}
        ])
      }, 2000);
      isMountedRef.current = true
    } else {
      if (messagesEndRef.current && !hasScrolledRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        hasScrolledRef.current = true;
      } else {
        hasScrolledRef.current = false;
      }
    }
  }, [msgs]);

  return (
    <section className='chatbox'>
      <div id="chat-container" ref={chatContainer}>

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
        })}

      <div ref={messagesEndRef} style={{height:"5px"}}/>
      
      </div>
      <MsgBox msgs={msgs} setMsgs={setMsgs} />
    </section> 
    )
  }

  export default React.memo(ChatArea);