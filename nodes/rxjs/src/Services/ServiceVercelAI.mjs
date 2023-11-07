/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

//import { encode as tokenCount} from "gpt-3-encoder";
import OpenAI from 'openai';
// eslint-disable-next-line no-unused-vars
import { OpenAIStream } from 'ai';
import { utils } from "#src/utils";
import { cacheStore_async } from "#src/storage";
import * as dotenv from "dotenv";
dotenv.config(); // For process.env.OPENAI_API_KEY
import { promptTokensEstimate } from "openai-chat-tokens";

// https://pierce-lamb.medium.com/improving-gpt-4-function-calling-with-an-explanation-parameter-4fba06a4c6bb

const wsDelta = {}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function SendIncrementalWs(wsSendTask, partialResponse, instanceId, final) {
  //console.log("partialResponse.delta", partialResponse.delta);
  const incr = JSON.stringify(partialResponse.delta); // check if we can send this
  let response;
  if (wsDelta[instanceId] === undefined) {
    wsDelta[instanceId] = 0;
  }
  if (final) {
    response = {partial: {text: partialResponse.text, mode: "final" }};
  } else if (wsDelta[instanceId] && wsDelta[instanceId] % 20 === 0) {
    response = {partial: {text: partialResponse.text, mode: "partial" }};
  } else if (incr) {
    response = {partial: {text: partialResponse.delta, mode: "delta" }};
  }
  if (response) {
    const partialTask = {
      instanceId: instanceId, 
      response: response, 
      command: "partial",
      node: {},
    };
    wsSendTask(partialTask);
    wsDelta[instanceId] += 1;
    //console.log(partialResponse.delta);
    //process.stdout.write(wsDelta[instanceId]);
    //process.stdout.write("\r");
  }
  //console.log("ws.data['delta_count'] " + ws.data['delta_count'])
}

// Build the parameters that are specific to ChatGPTAPI
// Manage cache
// Return response by websocket and return value
async function openaigpt_async(params) {
  const {
    systemMessage,
    prevMessages,
    noStreaming,
    prompt,
    useCache,
    modelVersion,
    temperature,
    maxTokens,
    instanceId,
    wsSendTask,
    cacheKeySeed,
    dummyAPI,
    functions,
    maxFunctionDepth,
    T,
  } = params;

  let {
    maxResponseTokens,
  } = params;

  const debug = true;
  let response_text_promise = Promise.resolve(["", [], false]);

  console.log("openaigpt_async noStreaming",noStreaming);

  // Need to build messages from systemMessage, messages, prompt

  function buildMessages(systemMessage, prevMessages, prompt) {
    //console.log("buildMessages systemMessage", systemMessage);
    //console.log("buildMessages prevMessages", prevMessages);
    //console.log("buildMessages prompt", prompt);
    let messages = [];
    if (systemMessage) {
      const systemMessageElement = {
        role: "system",
        content: systemMessage,
      }
      messages.push(systemMessageElement);
    }
    //console.log("buildMessages after systemMessage messages", messages);
    messages = [...messages, ...prevMessages];
    //console.log("buildMessages after prevMessages messages", messages);
    if (prompt) {
      const promptElement = {
        role: "user",
        content: prompt,
      }
      messages.push(promptElement);
    }
    //console.log("buildMessages after prompt messages", messages);
    const mappedMessages = messages.map((message) => ({
      role: message.role,
      content: message.content, // mapping text -> content
      function_call: message.function_call,
      name: message.name,
    }));
    //console.log("buildMessages mappedMessages", mappedMessages);
    return mappedMessages;
  }

  let messages = buildMessages(systemMessage, prevMessages, prompt);

  let currentMaxResponse = maxResponseTokens;
  
  function computeMaxResponseTokens(maxTokens, maxResponseTokens, currentMaxResponse, messages, functions) {
    // messages, functions, functions_call
    const tokenCountEstimate = promptTokensEstimate({messages, functions});
    let availableTokens = maxTokens - tokenCountEstimate;
    console.log("Tokens maxTokens " + maxTokens + " availableTokens " + availableTokens + " maxResponseTokens " + maxResponseTokens);
    availableTokens = availableTokens < maxResponseTokens ? availableTokens : maxResponseTokens;
    return availableTokens;
  }
  
  currentMaxResponse = computeMaxResponseTokens(maxTokens, maxResponseTokens, currentMaxResponse, messages, functions);

  const minimalTokens = 100;

  function shrinkMessages(systemMessage, prevMessages, prompt, functions, minimalTokens, maxResponseTokens, currentMaxResponse) {
    // Could have a parameter for this
    while (currentMaxResponse < minimalTokens) {
      if (prevMessages.length) {
        console.warn("currentMaxResponse too low " + currentMaxResponse);
        const forgetMessage = prevMessages.shift();
        console.warn("Forgetting message", forgetMessage);
        messages = buildMessages(systemMessage, prevMessages, prompt);
        currentMaxResponse = computeMaxResponseTokens(maxTokens, maxResponseTokens, currentMaxResponse, messages, functions);
        console.warn("Latest currentMaxResponse", currentMaxResponse);
      } else {
        throw new Error("currentMaxResponse too low and no messages to remove");
      }
    }
    return messages;
  }

  if (currentMaxResponse < minimalTokens) {
    // Avoid crashing out
    try {
      messages = shrinkMessages(systemMessage, prevMessages, prompt, functions, minimalTokens, maxResponseTokens, currentMaxResponse);
    } catch (e) {
      response_text_promise = Promise.resolve([`Internal ERROR, the prompt was too big, sorry. (${minimalTokens})`, [], true]);
      return response_text_promise;
    }
  }

  // This is a hack to get parameters into the API
  // We should be able to change this on the fly, I requested a feature
  // https://github.com/transitive-bullshit/chatgpt-api/issues/434
  let llmapi;
  if (!dummyAPI) {
    let llmconfig = {
      apiKey: process.env.OPENAI_API_KEY,
    }
    // Used this with proxy e.g. http://litellm_server:8000
    if (process.env.OPENAI_API_URL) {
      llmconfig["baseURL"] = process.env.OPENAI_API_URL;
    }
    llmapi = new OpenAI(llmconfig);
  }

  let cachedValue = null;
  let computedCacheKey = "";
  let cacheKeyText = "";
  if (useCache) {
    let contents = messages.map(message => message.content);
    let messagesText = contents.join(' ');
    cacheKeyText = [
      systemMessage,
      maxResponseTokens,
      maxTokens,
      modelVersion,
      temperature,
      prompt,
      messagesText,
      cacheKeySeed,
    ]
      .join("-")
      .replace(/\s+/g, "-");
    //console.log("cacheKeyText ", cacheKeyText);
    computedCacheKey = utils.djb2Hash(cacheKeyText);
    console.log("computedCacheKey " + computedCacheKey);
    cachedValue = await cacheStore_async.get(computedCacheKey);
    //console.log("cachedValue ", cachedValue);
  }

  // Message can be sent from one of multiple sources
  function message_from(source, text, noStreaming, instanceId) {
    // Don't add ... when response is fully displayed
    const shortText = text ? text.slice(0, 80) : "";
    console.log("Response from " + source + " : " + shortText + " ...");
    const response = {partial: {text: text, mode: "final" }};
    const partialTask = {
      instanceId: instanceId, 
      response: response,
      command: "partial",
      node: {},
    };
    if (!noStreaming) {
      wsDelta[instanceId] = 0
      wsSendTask(partialTask);
    }
  }

  if (cachedValue && cachedValue !== undefined && cachedValue !== null) {
    let text = cachedValue;
    let words = [];
    if (typeof text === "string") {
      words = text.split(" ");
    } else {
      console.warn("cachedValue.text is not a string. Cannot split into words.");
    }
    if (!noStreaming) {
      // call SendIncrementalWs for pairs of word
      let partialText = "";
      for (let i = 0; i < words.length; i += 2) {
        let delta = words[i] + " ";
        if (words[i + 1]) {
          delta += words[i + 1] + " ";
        }
        partialText += delta;
        const partialResponse = { delta: delta, text: partialText };
        SendIncrementalWs(wsSendTask, partialResponse, instanceId);
        await sleep(40);
      }
    }
    message_from("cache", text, noStreaming, instanceId);
    if (debug) {
      console.log("Debug: ", cacheKeyText);
    }
    response_text_promise = Promise.resolve([text, [], false]);
  } else {
    // Need to return a promise
    if (dummyAPI) {
      if (debug) {
        console.log("Debug: ", cacheKeyText);
      }
      const text = "Dummy text ".repeat(10) + new Date().toISOString();
      //const text = "Dummy text ";;
      const words = text.split(" ");
      if (!noStreaming) {
        // call SendIncrementalWs for pairs of word
        let partialText = "";
        for (let i = 0; i < words.length; i += 2) {
          let delta = words[i] + " ";
          if (words[i + 1]) {
            delta += words[i + 1] + " ";
          }
          partialText += delta;
          const partialResponse = { delta: delta, text: partialText };
          SendIncrementalWs(wsSendTask, partialResponse, instanceId);
          await sleep(40);
        }
      }
      message_from("Dummy API", text, noStreaming, instanceId);
      response_text_promise = Promise.resolve([text, [], false]);
    } else {
      let newMessages = [];
      let functionDepth = 0;
      let errored = false;
      //console.log("messages", messages);
      try {
        let options = {
          model: modelVersion,
          //model: "mistral", // When experimenting with LiteLLM as a proxy to ollama running mistral
          stream: true,
          // messages, maybe need to do this explicitly if using sendExtraMessageFields
          // https://github.com/vercel/ai/issues/551
          messages: messages
        };
        if (functions) {
          options.functions = functions;
          options.function_call = "auto";
        }   
        const TIMEOUT_DURATION = 20000; // 20 seconds, adjust as needed
        console.log("llmapi.chat.completions.create(options)", options);
        let response = await Promise.race([
            llmapi.chat.completions.create(options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('ServiceVercelAI timed out after' + TIMEOUT_DURATION + 'ms')), TIMEOUT_DURATION)
            )
        ]);
        console.log("llmapi.chat.completions.create responded");
        // eslint-disable-next-line no-unused-vars
        response_text_promise = new Promise((resolve, reject) => {
          // eslint-disable-next-line no-unused-vars
          let partialText = "";
          const stream = OpenAIStream(response, {
            onStart: async () => {},
            experimental_onFunctionCall: async (
              { name, arguments: args },
              createFunctionCallMessages,
            ) => {
              console.log("experimental_onFunctionCall", functionDepth, name, args);
              functionDepth++;
              // if you skip the function call and return nothing, the `function_call`
              // message will be sent to the client for it to handle
              newMessages = createFunctionCallMessages({result: `Unknown function ${name}`});
              switch (name) {
                case 'get_task': {
                  newMessages = createFunctionCallMessages({task:T()});
                  break;
                }
                case 'get_task_paths': {
                  const paths = getObjectPaths(T());
                  newMessages = createFunctionCallMessages({paths});
                  break;
                }
                case 'get_current_task_value': {
                  newMessages = createFunctionCallMessages({[args.path]: T(args.path)});
                  break;
                }
                default: {
                  // Should use the functions schema for validation
                  try {
                    const targetFunction = functions.find(func => func.name === 'update_value');
                    if (!targetFunction) {
                      throw new Error(`Undefined because function ${name} does not exist.`);
                    }
                    if (args.path && typeof args.path !== "string") {
                      throw new Error(`Undefined because function ${name} requires a path.`);
                    }
                    if (args.value && typeof args.value !== args.valueType) {
                      throw new Error(`${args.value} id not of type ${args.valueType}.`);
                    }
                    T("request.action", name);
                    T("request.actionId", args.id);
                    T("request.actionPath", args.path);
                    T("request.actionValue", args.value);
                    T("request.actionTargetConfig", args.targetConfig);
                    T("request.actionTask", args.task);
                    T("request.functionArgs", args);
                    T("state.current", "configFunctionRequest");
                    T("command", "update");
                    T("commandArgs", {lockBypass: true});
                    T("commandDescription", `Request action ${name}`);
                    const updatedTask = await wsSendTask(T(), "configFunctionResponse");
                    //console.log(`${name} updatedTask`, updatedTask);
                    newMessages = createFunctionCallMessages(updatedTask?.response?.functionResult);
                  } catch (error) {
                    console.error(`An error occurred while processing ${name}:`, error);
                    newMessages = createFunctionCallMessages({error: `function ${name} failed.`});
                    errored = true;
                  }
                  break;
                }
              }
              //console.log("newMessages", newMessages);
              // Should check the token limits here
              console.log("Extending newMessages", newMessages);
              let functionMessages = [...messages, ...newMessages];
              currentMaxResponse = computeMaxResponseTokens(maxTokens, maxResponseTokens, currentMaxResponse, messages, functions)
              if (currentMaxResponse < minimalTokens) {
                functionMessages = shrinkMessages(systemMessage, functionMessages, prompt, functions, minimalTokens, maxResponseTokens, currentMaxResponse)
              }
              let completionOptions = {
                messages: functionMessages,
                stream: true,
                model: modelVersion,
              }
              if (functionDepth < maxFunctionDepth) {
                completionOptions["functions"] = functions;
                completionOptions["function_call"] = "auto";
              }
              return llmapi.chat.completions.create(completionOptions);
            },
            onToken: async (token) => {
              // This callback is called for each token in the stream
              // You can use this to debug the stream or save the tokens to your database
              //console.log("onToken:", token);
              if (!noStreaming) {
                partialText += token;
                const partialResponse = { delta: token, text: partialText };
                SendIncrementalWs(wsSendTask, partialResponse, instanceId);
              }
            },
            onFinal: async (completion) => {
              console.log("final messages", messages);
              //console.log("onFinal", completion);
              message_from("API", completion, noStreaming, instanceId);
              if (useCache) {
                cacheStore_async.set(computedCacheKey, completion);
                console.log("cache stored key ", computedCacheKey);
              }
              resolve([completion, newMessages, errored]);
            },
            // eslint-disable-next-line no-unused-vars
            onCompletion: async (completion) => {
              // This callback is called after each response from the model (e.g. function call)
              // If we pass a callback into this service form the task then it could return messages as they complete
              console.log("onCompletion", completion);
            }
          })
          // This is a way to pull from the stream so the callbacks to OpenAIStream get called
          // It is a hack to "drop in" thei API
          const reader = stream.getReader();
          function read() {
            // eslint-disable-next-line no-unused-vars
            reader.read().then(({ done, value }) => {
              if (done) { return }
              read();
            });
          }
          read();
        });
      } catch (err) {
        let text = "ERROR " + err.message;
        if (err instanceof OpenAI.APIError) {
          const { name, status, headers, message } = err;
          text = `OpenAI.APIError ${name} ${status} ${headers} ${message}`;
        }
        message_from("API", text, noStreaming, instanceId);
        response_text_promise = Promise.resolve([text, [], true]);
      }
    }
  }
  console.log("response_text_promise", response_text_promise);
  return response_text_promise;
}

function getObjectPaths(obj, currentPath = '', result = []) {
  const skipPaths = ["node.origTask", "meta.hashTask"]
  for (const key in obj) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(key)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;

      if (skipPaths.includes(newPath)) {
        continue;
      }
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        getObjectPaths(obj[key], newPath, result);
      } else {
        result.push(newPath);
      }
    }
  }
  return result;
}

// eslint-disable-next-line no-unused-vars
async function openaistub_async(params) {
  const newMessages = [];
  const errored = false;
  let response_text_promise = Promise.resolve(["test text", newMessages, errored]);
  return response_text_promise;
}

export { openaigpt_async, openaistub_async };

export const ServiceVercelAI = {
  openaigpt_async, 
  openaistub_async,
} 