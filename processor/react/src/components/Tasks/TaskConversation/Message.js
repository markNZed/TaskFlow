import React from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import Icon from "./Icon";
import "highlight.js/styles/xcode.css";

const Message = ({ role, user, text, sending, id }) => {
  if (!role || !user || !id) {
    console.error("Message missing ", role, user, text, sending, id);
  }

  return (
    <div className={`wrapper ${role === "assistant" && "ai"}`}>
      <div className="chat">
        <Icon role={role} user={user} />
        {sending ? (
          <div className="dot-typing"></div>
        ) : (
          <div className="message">
            <ReactMarkdown 
              remarkPlugins={[gfm]}
              rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(Message);
