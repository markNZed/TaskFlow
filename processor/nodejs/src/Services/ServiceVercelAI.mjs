/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { encode } from "gpt-3-encoder";
import OpenAI from 'openai';
// eslint-disable-next-line no-unused-vars
import { OpenAIStream } from 'ai';
import { utils } from "../utils.mjs";
import { cacheStore_async } from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config(); // For process.env.OPENAI_API_KEY


const wsDelta = {}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function SendIncrementalWs(wsSendTask, partialResponse, instanceId) {
  //console.log("partialResponse.delta", partialResponse.delta);
  const incr = JSON.stringify(partialResponse.delta); // check if we can send this
  let response;
  if (wsDelta[instanceId] === undefined) {
    wsDelta[instanceId] = 0;
  }
  if (wsDelta[instanceId] && wsDelta[instanceId] % 20 === 0) {
    response = {partial: {text: partialResponse.text, mode: "partial" }};
  } else if (incr) {
    response = {partial: {text: partialResponse.delta, mode: "delta" }};
  }
  if (response) {
    const partialTask = {
      instanceId: instanceId, 
      response: response, 
      command: "partial",
      processor: {},
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
    messages,
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
    T,
  } = params;

  let {
    maxResponseTokens,
  } = params;

  const debug = true;
  
  // Need to account for the system message and some margin because the token count may not be exact.
  //console.log("prompt " + prompt + " systemMessage " + systemMessage)
  let promptTokenLength = 0;
  if (prompt) {
    promptTokenLength = encode(prompt).length
  } else {
    console.log("WARNING: no prompt");
  }
  if (!systemMessage) {
    console.log(
      "Warning: expect systemMessage to calculate tokens unless vierge"
    );
  }
  const availableTokens =
    maxTokens -
    Math.floor(maxTokens * 0.1) -
    promptTokenLength -
    encode(systemMessage).length;
  maxResponseTokens =
    availableTokens < maxResponseTokens ? availableTokens : maxResponseTokens;
  console.log(
    "Tokens maxTokens " + maxTokens + " maxResponseTokens " + maxResponseTokens
  );

  // Could have a parameter for this
  if (maxResponseTokens < 100) {
    throw new Error("maxResponseTokens too low " + maxResponseTokens);
  }

  // This is a hack to get parameters into the API
  // We should be able to change this on the fly, I requested a feature
  // https://github.com/transitive-bullshit/chatgpt-api/issues/434
  let openai;
  if (!dummyAPI) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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
    console.log("cacheKeyText ", cacheKeyText);
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
      processor: {},
    };
    if (!noStreaming) {
      wsDelta[instanceId] = 0
      wsSendTask(partialTask);
    }
  }

  let response_text_promise = Promise.resolve("");

  if (cachedValue && cachedValue !== undefined && cachedValue !== null) {
    let text = cachedValue;
    let words = [];
    if (typeof text === "string") {
      words = text.split(" ");
    } else {
      console.warn("cachedValue.text is not a string. Cannot split into words.");
    }
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
      await sleep(80);
    }
    message_from("cache", text, noStreaming, instanceId);
    if (debug) {
      console.log("Debug: ", cacheKeyText);
    }
    response_text_promise = Promise.resolve(text);
  } else {
    // Need to return a promise
    if (dummyAPI) {
      if (debug) {
        console.log("Debug: ", cacheKeyText);
      }
      const text = "Dummy text ".repeat(10) + new Date().toISOString();
      //const text = "Dummy text ";;
      const words = text.split(" ");
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
        await sleep(80);
      }
      message_from("Dummy API", text, noStreaming, instanceId);
      response_text_promise = Promise.resolve(text);
    } else {
      const systemMessageElement = {
        role: "system",
        text: systemMessage,
      } 
      const promptElement = {
        role: "user",
        text: prompt,
      }
      messages.unshift(systemMessageElement);
      messages.push(promptElement);
      const mappedMessages = messages.map((message) => ({
        role: message.role,
        content: message.content || message.text, // mapping text -> content
        function_call: message.function_call,
        name: message.name,
      }));
      // Need to build messages from systemMessage, messages, prompt
      console.log("mappedMessages", mappedMessages);
      try {
        let options = {
          model: modelVersion,
          stream: true,
          // messages, maybe need to do this explicitly if using sendExtraMessageFields
          // https://github.com/vercel/ai/issues/551
          messages: mappedMessages
        };
        if (functions) {
          options.functions = functions;
          options.function_call = "auto";
        }   
        const response = await openai.chat.completions.create(options);
        //console.log("response", response);
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
              console.log("experimental_onFunctionCall", name, args);
              // if you skip the function call and return nothing, the `function_call`
              // message will be sent to the client for it to handle
              let newMessages = createFunctionCallMessages({result: `Unknown function ${name}`});
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
                  try {
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
                    const updatedTask = await wsSendTask(T(), "configFunctionResponse");
                    //console.log(`${name} updatedTask`, updatedTask);
                    newMessages = createFunctionCallMessages({label: updatedTask?.response?.functionResult});
                  } catch (error) {
                    console.error("An error occurred while processing get_parent_task_label:", error);
                    newMessages = createFunctionCallMessages({label: "Undefined because function failed"});
                  }
                  break;
                }
              }
              console.log("newMessages", newMessages);
              // Should check the token limits here
              return openai.chat.completions.create({
                messages: [...mappedMessages, ...newMessages],
                stream: true,
                model: modelVersion,
                functions,
                function_call: "auto",
              });
            },
            onToken: async (token) => {
              // This callback is called for each token in the stream
              // You can use this to debug the stream or save the tokens to your database
              //console.log("onToken:", token);
              partialText += token;
              const partialResponse = { delta: token, text: partialText };
              SendIncrementalWs(wsSendTask, partialResponse, instanceId);
            },
            onFinal: async (completion) => {
              console.log("onFinal", completion);
              message_from("API", completion, noStreaming, instanceId);
              if (useCache) {
                cacheStore_async.set(computedCacheKey, completion);
                console.log("cache stored key ", computedCacheKey);
              }
              resolve(completion);
            },
            // eslint-disable-next-line no-unused-vars
            onCompletion: async (completion) => {
              // This callback is called when the stream completes
              //console.log("onCompletion", completion);
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
      } catch (error) {
        let text = "ERROR " + error.message;
        if (error instanceof OpenAI.APIError) {
          const { name, status, headers, message } = error;
          text = `OpenAI.APIError ${name} ${status} ${headers} ${message}`;
        }
        message_from("API", text, noStreaming, instanceId);
        response_text_promise = Promise.resolve(text);
      }
    }
  }
  console.log("response_text_promise", response_text_promise);
  return response_text_promise;
}

function getObjectPaths(obj, currentPath = '', result = []) {
  for (const key in obj) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(key)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      
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
  let response_text_promise = Promise.resolve("");
  response_text_promise = Promise.resolve("test text");
  return response_text_promise;
}

export { openaigpt_async, openaistub_async };

export const ServiceVercelAI = {
  openaigpt_async, 
  openaistub_async,
} 