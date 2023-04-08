import React, { useRef, useState, useEffect } from 'react';

// components
import MsgBox from "./MsgBox"
import Icon from "./Icon"

const ChatArea = (props) => {
  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  // Should set this from server exercise
  const welcomeMessage = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"
  const hasScrolledRef = useRef(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState({});

  //console.log("ChatArea component")

  useEffect(() => {
    if (!isMountedRef.current) {
      // waiting for props.selectedExercise.id ?
      setMsgs(
        {
          [props.selectedExercise.id] : [
            { sender: 'bot', text: welcomeMessage,  isLoading: true}
          ]
        }
      );
      setTimeout(()=>{
          setMsgs(
            {
              [props.selectedExercise.id] : [
                { sender: 'bot', text: welcomeMessage,  isLoading: false}
              ]
            }
          );
      }, 1000);
      isMountedRef.current = true
    } else if ( !(props.selectedExercise.id in msgs) ) {
      let newMsgs =  JSON.parse(JSON.stringify(msgs)); // need deep copy for setMesgs to see change
      newMsgs[props.selectedExercise.id] = [{ sender: 'bot', text: welcomeMessage,  isLoading: false}]
      setMsgs(newMsgs)
   } else {
      if (messagesEndRef.current && !hasScrolledRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        hasScrolledRef.current = true;
      } else {
        hasScrolledRef.current = false;
      }
    }
   }, [msgs, props.selectedExercise]);

  return (
    <section className='chatbox'>
      <div id="chat-container" ref={chatContainer}>

        {msgs[props.selectedExercise.id] && msgs[props.selectedExercise.id].map((msg, index) => {
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
      <MsgBox msgs={msgs} setMsgs={setMsgs} user={props.user} selectedExercise={props.selectedExercise}/>
    </section> 
    )
  }

  export default React.memo(ChatArea);