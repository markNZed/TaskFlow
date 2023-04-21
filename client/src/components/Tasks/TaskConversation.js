import React, { useRef, useState, useEffect } from 'react';
import useFetchStart from '../../hooks/useFetchStart';
import TaskChat from "./TaskChat"
import Icon from "./TaskConversation/Icon"

const TaskConversation = (props) => {
  const [fetchStart, setFetchStart] = useState();
  const { fetchResponse: fetchResponseStart, fetched: fetchedStart } = useFetchStart(fetchStart);
  const [myTask, setMyTask] = useState();
  const { startTask, setStartTask } = props
  const chatContainer = useRef(null);
  const messagesEndRef = useRef(null)
  let welcomeMessage_default = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"
  const hasScrolledRef = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isMountedRef = useRef(false);
  const [msgs, setMsgs] = useState({});

  //console.log("TaskConversation component")

  useEffect(() => {
    if (!myTask) {
      setFetchStart('root.ui.TaskConversation.start')
    }
  }, []);

  useEffect(() => {
    if (fetchResponseStart) {
      setMyTask(fetchResponseStart)
    }
  }, [fetchResponseStart]);

  // Intercept updates to the startTask
  // Can detect when input is being sent and update UI ?
  // COuld avoid Msgs passing ?
  function interceptSetStartTask(args) {
    setStartTask(args)
  }

  useEffect(() => {
    if (startTask) {
      let welcomeMessage = startTask?.welcome_message || welcomeMessage_default
      if (!isMountedRef.current) {
        setMsgs(
          {
            [startTask.threadId] : [
              { sender: 'bot', text: welcomeMessage,  isLoading: true}
            ]
          }
        );
        setTimeout(()=>{
            setMsgs(
              {
                [startTask.threadId] : [
                  { sender: 'bot', text: welcomeMessage,  isLoading: false}
                ]
              }
            );
        }, 1000);
        isMountedRef.current = true
      } else if ( !(startTask.threadId in msgs) ) {
        setMsgs({
          ...msgs,
          [startTask.threadId]: [
            { sender: 'bot', text: welcomeMessage, isLoading: false }
          ],
        });
      }
    }
  }, [msgs, startTask]);

  useEffect(() => {
    if (isMountedRef.current) {
      if (messagesEndRef.current && !hasScrolledRef.current && !hasScrolled) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        hasScrolledRef.current = true;
      } else {
        hasScrolledRef.current = false;
      }
    }
  }, [msgs, hasScrolled]);

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

        {startTask && msgs[startTask.threadId] && msgs[startTask.threadId].map((msg, index) => {
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

      <TaskChat msgs={msgs} setMsgs={setMsgs} task={startTask} setTask={interceptSetStartTask} parentTask={myTask} />
    </section> 
    )
  }

  export default React.memo(TaskConversation);