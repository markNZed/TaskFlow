/* ToDo
-------
// Should set this in client ChatArea.js from server exercise
const welcomeMessage = "Bienvenue ! Comment puis-je vous aider aujourd'hui ?"
Multiple language support
-------
*/

// If the module is exporting a named export, use curly braces to destructure the named export. 
// If the module is exporting a default export, import it directly without using curly braces.
import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import { ChatGPTAPI } from 'chatgpt'
import { WebSocketServer } from 'ws'
import http from 'http'
import bodyParser from 'body-parser'
import path from 'path';
import { fileURLToPath } from 'url';
import Keyv from 'keyv'
import KeyvBetterSqlite3 from 'keyv-better-sqlite3';
import { encode } from 'gpt-3-encoder';
import { v4 as uuidv4 } from 'uuid'
import { components } from './components.js';
import { utils } from './utils.js';
dotenv.config()

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// For now we use JS data structures instead of a DB
const CONFIG_DIR = process.env.CONFIG_DIR || "./config/";
var students = await utils.load_data_async(CONFIG_DIR, 'students')
var exercises = await utils.load_data_async(CONFIG_DIR, 'exercises')
var agents = await utils.load_data_async(CONFIG_DIR, 'agents')

// Cache should use SQLite too?
const CACHE = process.env.CACHE || "disable";
console.log("CACHE " + CACHE)

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const messageStore_async = new Keyv({
  store: new KeyvBetterSqlite3({
    uri: 'sqlite://db/messages.sqlite',
    table: 'cache',
  }),
});
const sessionsStore_async = new Keyv({
  store: new KeyvBetterSqlite3({
    uri: 'sqlite://db/sessions.sqlite',
    table: 'cache',
  }),
});
const cache_async = new Keyv({
  store: new KeyvBetterSqlite3({
    uri: 'sqlite://db/cache.sqlite',
    table: 'cache',
  }),
});

const serverOptions = {}

const app = express();

app.use(bodyParser.json());

const server = http.createServer(serverOptions, app)

const websocketServer = new WebSocketServer({ server: server, path: '/ws' });

var wsObject;

websocketServer.on('connection', (ws) => {

  wsObject = ws;

  console.log("websocketServer.on 'connection'")

  let sessionId = uuidv4();

  //send feedback to the incoming connection
  ws.send('{ "connection" : "ok", "sessionId" : "' + sessionId + '"}');

  //when a message is received
  ws.on('message', async (message) => {

    const j = JSON.parse(message)

    if (j?.sessionId) {
      console.log("sessionId from client: ", j.sessionId)
      sessionId = j.sessionId
    } 
    
    if (!await sessionsStore_async.has(sessionId + 'userId') && j?.userId) {
      let userId = j.userId
      console.log("Creating userId", userId);
      await sessionsStore_async.set(sessionId + 'userId', userId);
    }

    if (j?.selectedExerciseId) {
      let selectedExerciseId = j.selectedExerciseId
      await sessionsStore_async.set(sessionId + 'selectedExerciseId', selectedExerciseId);
      // Initialize at step 'start'
      //await sessionsStore_async.set(sessionId + selectedExercise + 'selectedStep', 'start');
      console.log("sessionId + 'selectedExerciseId' " + selectedExerciseId)
    }

    if (j?.selectedStep) {
      let selectedStep = j.selectedStep
      let selectedExercise = j.selectedExercise
      await sessionsStore_async.set(sessionId + selectedExercise + 'selectedStep', selectedStep);
    }

    if (j?.prompt) {
      let { langModel, temperature, maxTokens, prompt } = j;
      prompt_response_async(sessionId, prompt, ws, true, null, langModel, temperature, maxTokens)
    }

  });

  ws.on('close', function(code, reason) {
    console.log('ws is closed with code: ' + code + ' reason: '+ reason);
    // Don't delete sessions because the socket might drop
    // Also useful to restart the server without loosng session
  });

});

async function prompt_response_async(sessionId, prompt, ws, send, step, langModel = 'gpt-3.5-turbo', temperature = 0, maxTokens = 4000) {

  const currentDate = new Date().toISOString().split('T')[0]
  let systemMessage = `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`

  var exercise = {};
  var agent = {
    name: 'default',
    systemMessage: systemMessage,
  };
  let lastMessageId = null;
  let initializing = false;
  let use_cache = CACHE === "enable"

  let selectedExerciseId = await sessionsStore_async.get(sessionId + 'selectedExerciseId');
  if (selectedExerciseId) { 
    exercise = await sessionsStore_async.get(sessionId + selectedExerciseId + 'exercise');
    if (exercise) {
      console.log("Exercise from selectedExerciseId")
    } else {
      exercise = utils.findSubObjectWithKeyValue(exercises, 'id', selectedExerciseId);
      await sessionsStore_async.set(sessionId + selectedExerciseId + 'exercise', exercise);
      console.log("Found exercise " + exercise.id)
    }
  }

  if (exercise) {
    systemMessage = exercise?.system_message || systemMessage;
    langModel = exercise?.model || langModel
    if (exercise?.one_session) {
      let userId = await sessionsStore_async.get(sessionId + 'userId');
      if (sessionId !== userId) {
        sessionId = userId
        let old_session = await sessionsStore_async.get(sessionId + 'userId');
        if (!old_session) {
          console.log("Creating one sesssion")
          await sessionsStore_async.set(sessionId + 'userId', userId);
          await sessionsStore_async.set(sessionId + selectedExerciseId + 'exercise', exercise);
        } else {
          console.log("Restoring one sesssion")
          await sessionsStore_async.set(sessionId + selectedExerciseId + 'exercise', exercise);
        }
      } else {
        console.log("Continuing one sesssion")
      }
    }
  }

  // Do we not allow multiple instances of an exercise in the same session
  // Will need to include agent id to allow for multiple agent conversations in an exercise

  if (exercise?.agent && agents) {
    agent = agents[exercise.agent]
    console.log("Exercise set agent " + agent.name)
    if (typeof exercise?.use_cache !== "undefined") {
      use_cache = exercise.use_cache
      console.log("Exercise set cache " + use_cache)
    }
    prompt = agent?.prepend_prompt + prompt
    prompt += agent?.append_prompt

  }

   if (step && exercise?.steps[step]) {
    if (typeof exercise.steps[step]?.use_cache !== "undefined") {
      use_cache = exercise.steps[step].use_cache
      console.log("Step set cache " + use_cache)
    }
    if (agents) {
      agent = agents[exercise.steps[step]?.agent] || agent
      console.log("Step set agent " + agent.name)
    }
    if (exercise.steps[step]?.initialize || step === 'start') {
      initializing = true
      console.log("Step agent initializing")
    }
  }

  let conversationId = await sessionsStore_async.get(sessionId + selectedExerciseId + agent.name + 'conversationId');
  console.log("sessionId + selectedExerciseId + agent.name + conversationId " + sessionId + " " + selectedExerciseId + " " + agent.name  + " " + conversationId)

  if (initializing || conversationId === undefined) {
    initializing = true
    // Unique conversation per exercise type
    conversationId = uuidv4() + exercise?.id;
    await sessionsStore_async.set(sessionId + selectedExerciseId + agent.name + 'conversationId', conversationId);
    // Don't need/use ths?
    if (send) {ws.send(`{"conversationId" : "${conversationId}"}`)}
    console.log("Initializing conversation " + conversationId)
   } else if (conversationId) {
     console.log("Continuing conversation " + conversationId)
     lastMessageId = await sessionsStore_async.get(sessionId + conversationId + agent.name + 'parentMessageId')
   }
 
   if (initializing && agent?.messages) {
     // Initializing conversation
     lastMessageId = await utils.processMessages_async(agent.messages, messageStore_async, lastMessageId)
     console.log("Initial messages from agent " + agent.name + " " + lastMessageId)
   }

   console.log("step " + step)

   if (step && exercise?.steps[step]) {
    if (exercise.steps[step]?.messages) {
      lastMessageId = await utils.processMessages_async(exercise.steps[step].messages, messageStore_async, lastMessageId)
      console.log("Messages extended from step " + step + " lastMessageId " + lastMessageId)
    }
  }
 
   if (agent?.system_message) {
    systemMessage = agent.system_message;
    console.log("Sytem message from agent " + agent.name)
  }

  // Could have messages instead of prompt in a step
  
  if (await sessionsStore_async.has(sessionId + 'userId')) {
    let userId = await sessionsStore_async.get(sessionId + 'userId')
    if (students[userId] && exercise && exercise?.dyad && initializing) {
      let student = students[userId];
      console.log("Dyad in progress between " + agent.name + " and " + student.name)
      systemMessage += ` Vous etes en dyad avec votre student qui s'appelle ${student.name}. ${student.profile}`;
    }
  }

  // Need to account for the system message and some margin because the token count may not be exact.
  //console.log("prompt " + prompt + " systemMessage " + systemMessage)
  if (!prompt) {console.log("ERROR: expect prompt to calculate tokens")}
  if (!systemMessage) {console.log("ERROR: expect systemMessage to calculate tokens")}
  const availableTokens = (maxTokens - Math.floor(maxTokens * 0.1)) - encode(prompt).length - encode(systemMessage).length
  let maxResponseTokens = 1000 // Leave room for conversation history
  maxResponseTokens = availableTokens < maxResponseTokens ? availableTokens : maxResponseTokens
  console.log("Tokens maxTokens " + maxTokens + " maxResponseTokens " + maxResponseTokens)
  
  // This is a hack to get parameters into the API
  // We should be able to change this on the fly, I requested a feature 
  // https://github.com/transitive-bullshit/chatgpt-api/issues/434
  const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY,
    completionParams: {
      top_p: 1.0,
    },
    messageStore: messageStore_async,
    maxResponseTokens: maxResponseTokens,
    maxModelTokens: maxTokens,
    debug: true
  })

  function logIncrementalOutput(partialResponse, ws) {
    const incr = JSON.stringify(partialResponse.delta)
    if (incr) {
       if (send) {ws.send(`{"conversationId" : "${conversationId}", "stream" : ${incr}}`)}
    }
  }

  const messageParams = {
    completionParams: {
      model: langModel,
      temperature: temperature,
    },
    onProgress: (partialResponse) => logIncrementalOutput(partialResponse, ws),
    parentMessageId: lastMessageId,
  };

  // steps in exercise could add messages

  // May not need + agent.name for systemMessage if 
  
  // We need to keep the systemMessage as an explicit message to avoid it being truncated when conversation grows
  // Not sure we need this now
  if (await sessionsStore_async.has(sessionId + selectedExerciseId + agent.name + 'systemMessage')) {
    messageParams.systemMessage = await sessionsStore_async.get(sessionId + selectedExerciseId + agent.name + 'systemMessage')
  } else {
    messageParams.systemMessage = systemMessage;
  }

  sessionsStore_async.set(sessionId + selectedExerciseId + agent.name + 'systemMessage', messageParams.systemMessage)

  let cachedValue = '';
  let cacheKey = '';
  if (use_cache) {
    const conversation = await utils.conversationText_async(messageStore_async, lastMessageId)
    //console.log("conversation " + conversation + " lastMessageId " + lastMessageId)
    const cacheKeyText = [
      messageParams.systemMessage,  
      JSON.stringify(messageParams.completionParams), 
      prompt, 
      conversation
    ].join('-').replace(/\s+/g, '-')
    cacheKey = utils.djb2Hash(cacheKeyText);
    console.log("cacheKey " + cacheKey)
    cachedValue = await cache_async.get(cacheKey);
  }
  let response_text_promise = Promise.resolve("");
  if (cachedValue && cachedValue !== undefined) {
    sessionsStore_async.set(sessionId + conversationId + agent.name + 'parentMessageId', cachedValue.id)
    let text = cachedValue;
    console.log("Response from cache")  // + text)
    if (send) {ws.send(`{"conversationId" : "${conversationId}", "final" : ${JSON.stringify(text)}}`)}
    response_text_promise = Promise.resolve(text);
  } else {
    // Need to return a promise
    response_text_promise = api.sendMessage(prompt, messageParams)
    .then(response => {
      sessionsStore_async.set(sessionId + conversationId + agent.name + 'parentMessageId', response.id)
      let text = response.text;
      if (send) {ws.send(`{"conversationId" : "${conversationId}", "final" : ${JSON.stringify(text)}}`)}
      if (CACHE === "enable") {
        cache_async.set(cacheKey, text);
        console.log("cache stored key ", cacheKey);
      }
      console.log("Response from API") // + text)
      return text
    })
    .catch(error => {
      console.log("ERROR " + error)
      return "ERROR TRY AGAIN"
    })
  }
  return response_text_promise
}

//app.use(cors());
const allowedOrigins = ['https://chat.understudy.top'];

// To use CloudFlare with POST requests we need to add the allowedOrigins to allow pre-flight requests (OPTIONS request) see
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/cors/#allow-preflighted-requests

app.use(cors({
  credentials: true,
  origin: function (origin, callback) {
    if (!origin) {
      // Allow requests without "Origin" header (such as img requests)
      callback(null, true);
    } else if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, origin)
    } else {
      callback(new Error('Not allowed by CORS '+ origin));
      console.log('Not allowed by CORS '+ origin)
    }
  }
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
  if (process.env.AUTHENTICATION == "cloudflare") {
    const username = req.headers['cf-access-authenticated-user-email'];
    if (username) {
      res.send(`Hello, ${username}!`);
    } else {
      res.status(401).send('Unauthorized');
    }
  } else {
    res.status(200).send({
      message: 'Welcome to the chatbot server side!'
    });
  }
});

// Needed to add this to workaround for Cloudflare Zero Trust
// We need to visit this server from the browser to get cookies etc
app.get('/authenticate', async (req, res) => {
  let authenticated_url = CLIENT_URL + 'authenticated'
  if (process.env.AUTHENTICATION == "cloudflare") {
    const username = req.headers['cf-access-authenticated-user-email'];
    if (username) {
      res.redirect(authenticated_url);
    } else {
      res.redirect(authenticated_url);
    }
  } else {
    res.redirect(authenticated_url);
  }
});

app.get('/api/user', async (req, res) => {
  console.log("/user")
  if (process.env.AUTHENTICATION == "cloudflare") {
    const username = req.headers['cf-access-authenticated-user-email'];
    if (username) {
      res.send({
        userId: username,
        interface: students[username]?.interface,
      });
    } else {
      res.send({userId: ''});
    }
  } else {
    res.send({userId: ''});
  }
});

app.get('/api/step', async (req, res) => {
  console.log("/step")
  if (process.env.AUTHENTICATION == "cloudflare") {
    const username = req.headers['cf-access-authenticated-user-email'];
    if (username) {
      //console.log("req.query " + JSON.stringify(req.query))
      const step_id = req.query.step_id;
      const prev_stepKey = req.query?.prev_step;
      const component = req.query.component;
      const sessionId = req.query.sessionId;
      let response = '';
      // Need to check for errors
      const [exercise_id, stepKey] = step_id.match(/^(.*)\.(.*)/).slice(1);
      let exercise = await sessionsStore_async.get(sessionId + exercise_id + 'exercise') 
      if (exercise === undefined || stepKey === 'start') {
        exercise = utils.findObjectById(exercises, exercise_id)
        await sessionsStore_async.set(sessionId + exercise_id + 'exercise', exercise) 
      }
      await sessionsStore_async.set(sessionId + 'selectedExerciseId', exercise_id);
      switch (component) {
        case 'TaskFromAgent':
          response = await components.TaskFromAgent_async(sessionsStore_async, sessionId, exercise, stepKey, prev_stepKey, prompt_response_async, wsObject)
          break;
        case 'TaskShowText':
          response = await components.TaskShowText_async(sessionsStore_async, sessionId, exercise, stepKey)
          break;         
        default:
          response = "ERROR: unknown component:" + component
      }
      // A function for each component? In a library.
      res.send({response});
    } else {
      res.send({userId: ''});
    }
  } else {
    res.send({userId: ''});
  }
});

app.post('/api/input', async (req, res) => {
  console.log("/input")
  if (process.env.AUTHENTICATION == "cloudflare") {
    const username = req.headers['cf-access-authenticated-user-email'];
    if (username) {
      const sessionId = req.body.sessionId;
      const component = req.body.component;
      const step_id = req.body.step_id;
      const input = req.body.input;

      // Update the session exercise with the information
      // Then next step will use that
      const [exercise_id, stepKey] = step_id.match(/^(.*)\.(.*)/).slice(1);
      let selectedExerciseId = await sessionsStore_async.get(sessionId + 'selectedExerciseId');
      let exercise = await sessionsStore_async.get(sessionId + selectedExerciseId + 'exercise');
      if (exercise.steps[stepKey]?.input !== input) {
        exercise.steps[stepKey].input = input
        exercise.steps[stepKey].last_change = Date.now()
      }
      await sessionsStore_async.set(sessionId + selectedExerciseId + 'exercise', exercise);
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ error: "No user" });
    }
  } else {
    res.status(401).json({ error: "No authentication" });
  }
});

app.get('/api/exercises', async (req, res) => {
  let stripped_exercises = {}
  if (process.env.AUTHENTICATION == "cloudflare") {
    const userId = req.headers['cf-access-authenticated-user-email'];
    if (userId) {
      // Extended to ignore by user if a user is specified
      // This is a hack unti lwe have a notin of group
      stripped_exercises = utils.ignoreByRegexList(
        exercises, userId,
        [/^agents$/]
      )
    }
  }
  res.send(stripped_exercises);
});

const port = 5000;
server.listen(port, () => console.log('AI server started'));