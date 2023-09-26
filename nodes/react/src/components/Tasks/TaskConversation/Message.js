import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
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

function findJSONIndexes(str, startIdx) {
  let openBrackets = 0;
  let closeBrackets = 0;
  let openQuote = false;
  let openSingleQuote = false;
  let escapedOpenQuote = false;
  let escapedOpenSingleQuote = false;
  let startJSON = -1;
  let endJSON = -1;
  let lastChar;
  let opened = [];

  for (let i = startIdx; i < str.length; i++) {
      if (str[i] === '{') {
        if (!openQuote && !openSingleQuote) {
          if (startJSON === -1 ) {
            startJSON = i;
          }
          openBrackets++;
        } else if (startJSON !== -1 ) {
          opened.push('}')
        }
      }

      if (str[i] === '}') {
        if (!openQuote && !openSingleQuote) {
          closeBrackets++;
        } else if (startJSON !== -1 ) {
          opened.pop()
        }
      }

      if (startJSON > -1 && str[i] === '"') {
        if (lastChar === '\\') {
          if (escapedOpenQuote) {
            opened.pop();
          } else {
            opened.push('\\"');
          }
          escapedOpenQuote = !escapedOpenQuote;
        } else {
          if (openQuote) {
            opened.pop();
          } else {
            opened.push('"');
          }
          openQuote = !openQuote;
        }
      }

      if (startJSON > -1 && str[i] === "'") {
        if (lastChar === '\\') {
          if (escapedOpenSingleQuote) {
            opened.pop();
          } else {
            opened.push("\\'");
          }
          escapedOpenSingleQuote = !escapedOpenSingleQuote;
        } else {
          if (openSingleQuote) {
            opened.pop();
          } else {
            opened.push("'");
          }
          openSingleQuote = !openSingleQuote;
        }
      }

      lastChar = str[i];
      if (startJSON !== -1 && openBrackets === closeBrackets) {
          endJSON = i;
          break;
      }
  }

  if (startJSON !== -1 && endJSON === -1) {
    opened.reverse().forEach( el => {
      str += el;
    }) 
    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
      str += '}';
    }
    endJSON = str.length - 1;
  }


  if (startJSON !== -1 && endJSON !== -1) {
      //console.log("findJSONIndexes str", str);
      return [str, startJSON, endJSON];
  }

  return null;
}

const Message = ({ role, user, content, sending, id }) => {
  if (!role || !user || !id) {
    console.error("Message missing ", "role:", role, "user:", user, "content:", content, "sending:",sending, "id:", id);
  }
  //console.log("Message content", content);
  // match function_call result

  if (!content) {
    content = "";
  }

  //console.log("Message to display", content);

  const [newContent, startIdx, endIdx] = findJSONIndexes(content, 0) || [];

  if (typeof startIdx === 'number' && typeof endIdx === 'number') {
    content = newContent;
    const before = content.substring(0, startIdx);
    const functionCallStr = content.substring(startIdx, endIdx + 1);
    const after = content.substring(endIdx + 1);
    //console.log("before", before, "functionCallStr", functionCallStr, "after", after);
  
    try {
      // Parse the JSON and unescape the arguments
      const functionCallObj = JSON.parse(functionCallStr);
      try {
        functionCallObj.function_call.arguments = JSON.parse(functionCallObj.function_call.arguments);
      } catch (error) {}
    
      // Re-serialize to JSON
      const replacedFunctionCall = JSON.stringify(functionCallObj, null, 2);
    
      // Combine it all together
      content = `${before}\n\`\`\`json\n${replacedFunctionCall}\n\`\`\`\n${after}`;
      //console.log("Message after expanding JSN object", content);
    } catch (error) {
      //console.log('Failed to parse JSON:', error);
    }
  } else {
    //console.log('Could not find JSON object.');
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
              remarkGfm={[remarkGfm]}
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
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(Message);
