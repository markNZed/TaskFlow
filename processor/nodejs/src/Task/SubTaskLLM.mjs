/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { encode } from "gpt-3-encoder";
import { ChatGPTAPI } from "chatgpt";
import { utils } from "../utils.mjs";
import { DUMMY_OPENAI, CONFIG_DIR } from "../../config.mjs";
import {
  cacheStore_async,
} from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config(); // For process.env.OPENAI_API_KEY

// Should we return a promise? Better to be task iin/out ?

var serviceTypes = await utils.load_data_async(CONFIG_DIR, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);
//console.log(JSON.stringify(serviceTypes, null, 2))

const wsDelta = {}

async function SubTaskLLM_async(wsSendTask, task) {
  let params = await chat_prepare_async(task);
  params["wsSendTask"] = wsSendTask;
  const res = ChatGPTAPI_request_async(params);
  task.response.LLM = await res;
  return task
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

function checkSubTaskCache (T, task, subTaskName) {
  // Loop over each object in task.config.cache if it exists
  let enabled = false;
  let seed = T("id");
  for (const cacheObj of task.config.cache) {
    if (cacheObj.subTask === subTaskName) {
      if (cacheObj.enable === undefined) {
        enabled = true;
      } else {
        enabled = cacheObj.enable;
      }
      if (enabled && cacheObj.seed) {
        for (const cacheKeySeed of cacheObj.seed) {
          if (cacheKeySeed.startsWith("task.")) {
            seed += T(cacheKeySeed.slice(5));
          } else {
            seed += cacheKeySeed;
          }
        }
        console.log("cacheObj.seed", seed);
      }
      break;
    }
  }
  return [enabled, seed];
}

// Prepare the parameters for the chat API request
// Nothing specific to a partiuclar chat API
// Also using serviceTypes
async function chat_prepare_async(task) {
  const T = utils.createTaskValueGetter(task);

  const instanceId = T("instanceId");
  let systemMessage = "";
  let forget = false;
  let [useCache, cacheKeySeed] = checkSubTaskCache(T, task, "SubTaskLLM");
  console.log("useCache config " + useCache + " seed " + cacheKeySeed);
  let dummyAPI = T("config.service.dummyAPI") || DUMMY_OPENAI;
  console.log("dummyAPI " + dummyAPI);
  let noWebsocket = false;

  let prompt = T("state.request.service.prompt") || T("config.service.prompt");
  //console.log("prompt " + prompt);
  let type = T("state.request.service.type") || T("config.service.type");
  let serviceType = serviceTypes["root."+type];
  if (!serviceType) {
    console.log("No serviceType for ", task.id, type);
  } else {
    console.log("ServiceType for ", task.id, serviceType.name, serviceType.base);
  }
  let baseService = T("state.request.service.base") || T("config.service.base") || serviceType?.base;
  let temperature = T("state.request.service.temperature") || T("config.service.temperature") || serviceType?.temperature;
  let maxTokens = T("state.request.service.maxTokens") || T("config.service.maxTokens") || serviceType?.maxTokens;
  console.log("state.request.service.maxTokens config.service.maxTokens serviceType?.maxTokens", T("state.request.service.maxTokens"), T("config.service.maxTokens"), serviceType?.maxTokens);
  let maxResponseTokens = T("state.request.service.maxResponseTokens") || T("config.service.maxResponseTokens") || serviceType?.maxResponseTokens;
  console.log("maxResponseTokens " + maxResponseTokens + " maxTokens " + maxTokens  + " temperature " + temperature + " base " + baseService);

  //console.log("Agent ", serviceType)

  if (T("config.promptTemplate")) {
    console.log("Found promptTemplate");
    prompt = T("config.prompt");
    //console.log("Prompt " + prompt)
  } 

  if (T("config.promptWithTime")) {
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
    console.log("oneFamily prompt : " + prompt);
  }

  if (T("config.service.useCache") !== undefined) {
    useCache = T("config.service.useCache");
    console.log("Task service config set cache " + useCache);
  }

  if (T("state.request.service.useCache") !== undefined) {
    useCache = T("state.request.service.useCache");
    console.log("Task request set service cache " + useCache);
  }

  if (typeof serviceType?.prepend_prompt !== "undefined") {
    prompt = serviceType.prepend_prompt + prompt;
    console.log("Prepend serviceType prompt " + serviceType.prepend_prompt);
  }

  if (typeof serviceType?.append_prompt !== "undefined") {
    prompt += serviceType.append_prompt;
    console.log("Append serviceType prompt " + serviceType.append_prompt);
  }

  const environments = T("environments");
  // If the task is running on the nodejs processor we do not use websocket
  if (environments.length === 1 && environments[0] === "nodejs") {
    noWebsocket = true;
    console.log("Environment noWebsocket");
  }

  if (T("state.request.service.noWebsocket") !== undefined) {
    noWebsocket = T("state.request.service.noWebsocket");
    console.log("Request noWebsocket");
  }

  if (serviceType?.forget) {
    forget = true;
    console.log("Agent forget previous messages");
  }

  if (T("config.service.forget") !== undefined) {
    forget = T("config.service.forget")
    console.log("Task config forget previous messages", T("config.service.forget"));
  }

  if (T("state.request.service.forget") !== undefined) {
    forget = T("state.request.service.forget")
    console.log("Task request forget previous messages", T("state.request.service.forget"));
  }

  let messages = [];

  if (serviceType?.messages) {
    messages.push(...serviceType.messages)
    console.log(
      "Initial messages from serviceType " + serviceType.name
    );
  }

  if (T("config.service.messages")) {
    messages.push(...T("config.service.messages"))
    console.log("Found config messages");
  }

  if (T("state.request.service.messages")) {
    messages.push(...T("state.request.service.messages"))
    console.log("Found request messages");
  }

  // This is assuming the structure used in TaskChat
  if (T("output.msgs") && !forget) {
    console.log("Initializing messages from output.msgs");
    messages.push(...T("output.msgs"));
    //console.log("messages", messages);
  }

  if (serviceType?.systemMessage) {
    systemMessage = serviceType.systemMessage;
    console.log("Sytem message from serviceType " + serviceType.name);
  }

  // Replace MODEL variables in systemMessageTemplate
  if (T("config.systemMessageTemplate")) {
    let systemMessageTemplate = T("config.systemMessage");
    console.log("systemMessageTemplate " + systemMessageTemplate);
    const regex = /(MODEL)\.([^\s.]+)/g;
    // Using replace with a callback function
    systemMessage = systemMessageTemplate.replace(regex, (match, p1, p2) => {
      if (!serviceType[p2]) {
        throw new Error("serviceType " + p2 + " does not exist");
      }
      return serviceType[p2]
    });
    console.log("Sytem message from systemMessageTemplate " + T("id") + " " + systemMessage);
  }

  // This allows for user defined system messages
  if (T("state.request.service.systemMessage")) {
    systemMessage = T("state.request.service.systemMessage");
    console.log("Sytem message from task " + T("id"));
  }

  //console.log("messages before map of id", messages);
  // The index starts at 1 so we do not have an id === 0 as this seemed to cause issues in ChatGPTAPI
  messages = messages.map((message, index) => ({
    ...message,
    parentMessageId: index === 0 ? null : (index),
    id: (index + 1)
  }));

  if (T("config.service.cacheKeySeed")) {
    cacheKeySeed = T("config.service.cacheKeySeed");
  }

  // Check if we need to preprocess
  if (task.config.regexProcessPrompt) {
    for (const [regexStr, replacement] of task.config.regexProcessPrompt) {
      let { pattern, flags } = utils.parseRegexString(regexStr);
      let regex = new RegExp(pattern, flags);
      prompt = prompt.replace(regex, replacement);
      //console.log("regexProcessPrompt", regexStr, prompt);
    }
  }

  return {
    systemMessage,
    messages,
    noWebsocket,
    prompt,
    useCache,
    baseService,
    temperature,
    maxTokens,
    maxResponseTokens,
    instanceId,
    cacheKeySeed,
    dummyAPI,
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
    useCache,
    baseService,
    temperature,
    maxTokens,
    instanceId,
    wsSendTask,
    cacheKeySeed,
    dummyAPI,
  } = params;

  let {
    maxResponseTokens,
  } = params;

  const debug = true;

  const lastMessageId = messages.length;
  
  // Need to account for the system message and some margin because the token count may not be exact.
  console.log("prompt " + prompt + " systemMessage " + systemMessage)
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
      model: baseService,
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
  let computedCacheKey = "";
  let cacheKeyText = "";
  if (useCache) {
    let contents = messages.map(message => message.content);
    let messagesText = contents.join(' ');
    cacheKeyText = [
      messageParams.systemMessage,
      maxResponseTokens,
      maxTokens,
      JSON.stringify(messageParams.completionParams),
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
  function message_from(source, text, noWebsocket, instanceId) {
    // Don't add ... when response is fully displayed
    console.log("Response from " + source + " : " + text.slice(0, 80) + " ...");
    const response = {partial: {text: text, mode: "final" }};
    const partialTask = {
      instanceId: instanceId, 
      response: response,
      command: "partial",
      processor: {},
    };
    if (!noWebsocket) {
      wsDelta[instanceId] = 0
      wsSendTask(partialTask);
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
      message_from("Dummy API", text, noWebsocket, instanceId);
      response_text_promise = Promise.resolve(text);
    } else {
      response_text_promise = api
        .sendMessage(prompt, messageParams)
        .then((response) => {
          let text = response.text;
          message_from("API", text, noWebsocket, instanceId);
          if (useCache) {
            cacheStore_async.set(computedCacheKey, response);
            console.log("cache stored key ", computedCacheKey);
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
