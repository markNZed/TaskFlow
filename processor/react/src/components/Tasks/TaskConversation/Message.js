import React from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import Icon from "./Icon";
import "highlight.js/styles/xcode.css";
import copy from 'clipboard-copy';

// Show me a few code blocks with different languages

const extractTextFromNodes = (nodes) => {
  let textContent = "";
  nodes.forEach((node) => {
    if (node.type === 'text') {
      textContent += node.value;
    } else if (node.children) {
      textContent += extractTextFromNodes(node.children);
    }
  });
  return textContent;
};

const renderChildrenRecursively = (nodes) => {
  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return node.value;
    } else if (node.type === 'element') {
      const TagName = node.tagName;
      return (
        <TagName key={index} className={node.properties.className && node.properties.className.join(' ')}>
          {node.children && renderChildrenRecursively(node.children)}
        </TagName>
      );
    }
  });
};

const CodeBlockWithCopy = ({ node }) => {
  const textContent = extractTextFromNodes(node.children);
  const handleCopyClick = () => {
    copy(textContent);
  };
  return (
    <div style={{ position: 'relative' }}>
      <button
        style={{ position: 'absolute', right: 0, top: 0 }}
        onClick={handleCopyClick}
      >
        Copy
      </button>
      <pre style={{ backgroundColor: 'gray' }}>
        {renderChildrenRecursively(node.children)}
      </pre>
    </div>
  );
};

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
              components={{
                code({ node, inline, className, children, ...props }) {
                  if (!inline) {
                    return <CodeBlockWithCopy node={node} />;
                  }
                  return <code className={className}>{children}</code>;
                },
              }}
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
