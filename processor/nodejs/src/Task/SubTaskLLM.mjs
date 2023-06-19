/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { encode } from "gpt-3-encoder";
import { ChatGPTAPI } from "chatgpt";
import { utils } from "../utils.mjs";
import { DUMMY_OPENAI, CACHE_ENABLE, CONFIG_DIR } from "../../config.mjs";
import {
  cacheStore_async,
} from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();

// Should we return a promise? Better to be task iin/out ?

var modelTypes = await utils.load_data_async(CONFIG_DIR, "modeltypes");
modelTypes = utils.flattenObjects(modelTypes);
//console.log(JSON.stringify(modelTypes, null, 2))

const wsDelta = {}

async function SubTaskLLM_async(wsSendTask, task) {
  let params = await chat_prepare_async(task);
  params["wsSendTask"] = wsSendTask;
  const res = ChatGPTAPI_request_async(params);
  task.response.text = await res;
  return task
}

function SendIncrementalWs(wsSendTask, partialResponse, instanceId) {
  const incr = JSON.stringify(partialResponse.delta); // check if we can send this
  let response;
  if (wsDelta[instanceId] === undefined) {
    wsDelta[instanceId] = 0;
  }
  if (wsDelta[instanceId] && wsDelta[instanceId] % 20 === 0) {
    response = { text: partialResponse.text, mode: "partial" };
  } else if (incr) {
    response = { text: partialResponse.delta, mode: "delta" };
  }
  if (response) {
    const partialTask = {
      instanceId: instanceId, 
      response: response, 
    };
    wsSendTask(partialTask, "partial");
    wsDelta[instanceId] += 1;
    //console.log(partialResponse.delta);
    //process.stdout.write(wsDelta[instanceId]);
    //process.stdout.write("\r");
  }
  //console.log("ws.data['delta_count'] " + ws.data['delta_count'])
}

// Prepare the parameters for the chat API request
// Nothing specific to a partiuclar chat API
// Also using modelTypes
async function chat_prepare_async(task) {
  const T = utils.createTaskValueGetter(task);

  const instanceId = T("instanceId");
  let systemMessage = "";
  let initializing = false;
  let use_cache = CACHE_ENABLE;
  let noWebsocket = false;

  let prompt = T("request.prompt");
  //console.log("prompt " + prompt);
  let modelType = modelTypes["root."+T("request.modelType")];
  if (!modelType) {
    console.log("No modelType for ", task.id);
  } else {
    console.log("ModelType for ", task.id, modelType.name);
  }
  let langModel = T("request.model") || modelType?.model;
  let temperature = T("request.temperature") || modelType?.temperature;
  let maxTokens = T("request.maxTokens") || modelType?.maxTokens;
  let maxResponseTokens = T("request.maxResponseTokens") || modelType?.maxResponseTokens;
  console.log("maxResponseTokens " + maxResponseTokens + " maxTokens " + maxTokens  + " temperature " + temperature + " langModel " + langModel);

  //console.log("Agent ", modelType)

  if (T("config.promptTemplate")) {
    console.log("Found promptTemplate");
    prompt = T("config.prompt");
    //console.log("Prompt " + prompt)
  } 

  if (T("config.oneThread")) {
    // Prefix with location when it has changed
    if (T("request.newAddress")) {
      prompt = "Location: " + T("request.address") + "\n" + prompt;
    }
    // Prefix prompt with date/time we use UTC to keep things simple
    // We need to be able to track user's timezone
    // Could be based on address
    const currentDate = new Date();
    const options = {
      timeZone: "UTC",
      timeZoneName: "short"
    };
    const formattedDate = currentDate.toLocaleString("en-US", options);
    prompt = "Time: " + formattedDate + "\n" + prompt;
    console.log("oneThread prompt : " + prompt);
  }

  if (T("request.use_cache") !== undefined) {
    use_cache = T("request.use_cache");
    console.log("Task set cache " + use_cache);
  }

  if (typeof modelType?.prepend_prompt !== "undefined") {
    prompt = modelType.prepend_prompt + prompt;
    console.log("Prepend modelType prompt " + modelType.prepend_prompt);
  }

  if (typeof modelType?.append_prompt !== "undefined") {
    prompt += modelType.append_prompt;
    console.log("Append modelType prompt " + modelType.append_prompt);
  }

  const environments = T("environments");
  // If the task is running on the nodejs processor we do not use websocket
  if (environments.length === 1 && environments[0] === "nodejs") {
    noWebsocket = true;
    console.log("Environment noWebsocket");
  }

  if (T("request.noWebsocket") !== undefined) {
    noWebsocket = T("request.noWebsocket");
    console.log("Request noWebsocket");
  }

  if (modelType?.forget) {
    initializing = true;
    console.log("Agent forget previous messages");
  }

  if (T("request.forget") !== undefined) {
    initializing = T("request.forget")
    console.log("Task forget previous messages", T("request.forget"));
  }

  let messages = [];

  if (modelType?.messages) {
    messages.push(...modelType.messages)
    console.log(
      "Initial messages from modelType " + modelType.name
    );
  }

  let requestMessages = T("request.messages");
  if (T("config.messagesTemplate")) {
    messages.push(...T("config.messages"))
    console.log("Found messagesTemplate");
  }

  // This is assuming the structure usd in TaskChat
  if (T("output.msgs")) {
    console.log("Initializing messages from output.msgs");
    messages.push(...T("output.msgs"));
    // Remove the empty response holder and the prompt
    messages.pop();
    messages.pop();
  }

  if (modelType?.systemMessage) {
    systemMessage = modelType.systemMessage;
    console.log("Sytem message from modelType " + modelType.name);
  }

  // Replace MODEL variables in systemMessageTemplate
  if (T("config.systemMessageTemplate")) {
    let systemMessageTemplate = T("config.systemMessage");
    console.log("systemMessageTemplate " + systemMessageTemplate);
    const regex = /(MODEL)\.([^\s.]+)/g;
    // Using replace with a callback function
    systemMessage = systemMessageTemplate.replace(regex, (match, p1, p2) => {
      if (!modelType[p2]) {
        throw new Error("modelType " + p2 + " does not exist");
      }
      return modelType[p2]
    });
    console.log("Sytem message from systemMessageTemplate " + T("id") + " " + systemMessage);
  }

  // If we can have PREPEND and APPEND then we could replace T('request.dyad') with something general
  // This allows for user defined system messages
  if (T("request.systemMessage")) {
    systemMessage = T("request.systemMessage");
    console.log("Sytem message from task " + T("id"));
  }

  const modelTypeId = modelType.id;

  //console.log("messages before map of id", messages);
  // The index starts at 1 so we do not have an id === 0 as this seemed to cause issues in ChatGPTAPI
  messages = messages.map((message, index) => ({
    ...message,
    parentMessageId: index === 0 ? null : (index),
    id: (index + 1)
  }));

  return {
    systemMessage,
    messages,
    noWebsocket,
    prompt,
    use_cache,
    langModel,
    temperature,
    maxTokens,
    maxResponseTokens,
    modelTypeId,
    instanceId,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build the parameters that are specific to ChatGPTAPI
// Manage cache
// Return response by websocket and return value
// Also using process.env.OPENAI_API_KEY, cacheStore_async, DUMMY_OPENAI
async function ChatGPTAPI_request_async(params) {
  const {
    systemMessage,
    messages,
    noWebsocket,
    prompt,
    use_cache,
    langModel,
    temperature,
    maxTokens,
    modelTypeId,
    instanceId,
    wsSendTask,
  } = params;

  let {
    maxResponseTokens,
  } = params;

  const debug = true;

  const lastMessageId = messages.length;

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
  const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY,
    getMessageById: async (id) => {
      //console.log("getMessageById", id, messages[(id - 1)])
      return messages[(id - 1)];
    },
    upsertMessage: async (id) => {
      // Not used
    },
    completionParams: {
      top_p: 1.0,
    },
    maxResponseTokens: maxResponseTokens,
    maxModelTokens: maxTokens,
    debug: debug,
  });

  const messageParams = {
    completionParams: {
      model: langModel,
      temperature: temperature,
    },
    parentMessageId: lastMessageId,
    systemMessage: systemMessage,
  };

  if (!noWebsocket) {
    messageParams["onProgress"] = (partialResponse) =>
      SendIncrementalWs(wsSendTask, partialResponse, instanceId);
  }

  let cachedValue = null;
  let cacheKey = "";
  let cacheKeyText = "";
  if (use_cache) {
    let contents = messages.map(message => message.content);
    let messagesText = contents.join(' ');
    cacheKeyText = [
      messageParams.systemMessage,
      messageParams.maxResponseTokens,
      messageParams.maxModelTokens,
      JSON.stringify(messageParams.completionParams),
      prompt,
      messagesText,
    ]
      .join("-")
      .replace(/\s+/g, "-");
    cacheKey = utils.djb2Hash(cacheKeyText);
    console.log("cacheKey " + cacheKey);
    cachedValue = await cacheStore_async.get(cacheKey);
    //console.log("cachedValue ", cachedValue);
  }

  // Message can be sent from one of multiple sources
  function message_from(source, text, noWebsocket, instanceId) {
    // Don't add ... when response is fully displayed
    console.log("Response from " + source + " : " + text.slice(0, 80) + " ...");
    const response = { text: text, mode: "final" };
    const partialTask = {
      instanceId: instanceId, 
      response: response, 
    };
    if (!noWebsocket) {
      wsDelta[instanceId] = 0
      wsSendTask(partialTask, "partial");
    }
  }

  let response_text_promise = Promise.resolve("");

  if (cachedValue && cachedValue !== undefined && cachedValue !== null) {
    let text = cachedValue.text;
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
      //await sleep(80);
    }
    message_from("cache", text, noWebsocket, instanceId);
    if (debug) {
      console.log("Debug: ", cacheKeyText);
    }
    response_text_promise = Promise.resolve(text);
  } else {
    // Need to return a promise
    if (DUMMY_OPENAI) {
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
      message_from("Dummy API", text, noWebsocket, instanceId);
      response_text_promise = Promise.resolve(text);
    } else {
      response_text_promise = api
        .sendMessage(prompt, messageParams)
        .then((response) => {
          let text = response.text;
          message_from("API", text, noWebsocket, instanceId);
          if (use_cache) {
            cacheStore_async.set(cacheKey, response);
            console.log("cache stored key ", cacheKey);
          }
          return text;
        })
        .catch((error) => {
          let text = "ERROR " + error.message;
          message_from("API", text, noWebsocket, instanceId);
          return text;
        });
    }
  }
  return response_text_promise;
}

export { SubTaskLLM_async };
