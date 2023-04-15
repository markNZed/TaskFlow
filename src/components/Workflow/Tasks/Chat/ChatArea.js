import React, { useRef, useState, useEffect } from 'react';

// components
import MsgBox from "./MsgBox"
import Icon from "./Icon"

import { useGlobalStateContext } from '../../../../contexts/GlobalStateContext';

const ChatArea = (props) => {

  const { globalState } = useGlobalStateContext();

  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  // Should set this from server workflow
  let welcomeMessage_default = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"
  const hasScrolledRef = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState({});

  //console.log("ChatArea component")

  useEffect(() => {
    let welcomeMessage = globalState.workflow?.welcome_message || welcomeMessage_default
    if (!isMountedRef.current) {
      setMsgs(
        {
          [globalState.workflow.id] : [
            { sender: 'bot', text: welcomeMessage,  isLoading: true}
          ]
        }
      );
      setTimeout(()=>{
          setMsgs(
            {
              [globalState.workflow.id] : [
                { sender: 'bot', text: welcomeMessage,  isLoading: false}
              ]
            }
          );
      }, 1000);
      isMountedRef.current = true
    } else if ( !(globalState.workflow.id in msgs) ) {
      setMsgs({
        ...msgs,
        [globalState.workflow.id]: [
          { sender: 'bot', text: welcomeMessage, isLoading: false }
        ],
      });
   } else {
      if (messagesEndRef.current && !hasScrolledRef.current && !hasScrolled) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        hasScrolledRef.current = true;
      } else {
        hasScrolledRef.current = false;
      }
    }
   }, [msgs, globalState, hasScrolled]);

   const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 20 ) {
      setHasScrolled(false);
    } else {
      setHasScrolled(true);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  },[]);

  return (
    <section className='chatbox'>
      <div id="chat-container" ref={chatContainer} >
        {msgs[globalState.workflow.id] && msgs[globalState.workflow.id].map((msg, index) => {
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