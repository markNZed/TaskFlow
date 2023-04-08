/* ToDo
-------
Multiple language support 'i18next-http-middleware for server and react-i18next for client
Change model context with session in client
Support a pre_input and post_input for surrounding prompt.
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
import { tasks } from './tasks.js';
import { utils } from './utils.js';
import { error } from 'console'
dotenv.config()

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// For now we use JS data structures instead of a DB
const CONFIG_DIR = process.env.CONFIG_DIR || "./config/";
var users = await utils.load_data_async(CONFIG_DIR, 'users')
var workflows = await utils.load_data_async(CONFIG_DIR, 'workflows')
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

var connections = new Map(); // Stores WebSocket instances with unique session IDs

const websocketServer = new WebSocketServer({ server: server, path: '/ws' });

websocketServer.on('connection', (ws) => {

  let sessionId = uuidv4();

  //send feedback to the incoming connection
  ws.send('{ "connection" : "ok", "sessionId" : "' + sessionId + '"}');

  connections.set(sessionId, ws);

  console.log("websocketServer.on 'connection' sessionId " + sessionId)

  //when a message is received
  ws.on('message', async (message) => {

    const j = JSON.parse(message)

    if (j?.sessionId) {
      console.log("sessionId from client: ", j.sessionId)
      sessionId = j.sessionId
      connections.set(sessionId, ws);
    } 
    
    if (!await sessionsStore_async.has(sessionId + 'userId') && j?.userId) {
      let userId = j.userId
      console.log("Creating userId", userId);
      await sessionsStore_async.set(sessionId + 'userId', userId);
    }

    if (j?.selectedworkflowId) {
      let selectedworkflowId = j.selectedworkflowId
      await sessionsStore_async.set(sessionId + 'selectedworkflowId', selectedworkflowId);
      // Initialize at step 'start'
      //await sessionsStore_async.set(sessionId + selectedworkflow + 'selectedStep', 'start');
      console.log("sessionId + 'selectedworkflowId' " + selectedworkflowId)
    }

    if (j?.selectedStep) {
      let selectedStep = j.selectedStep
      let selectedworkflow = j.selectedworkflow
      await sessionsStore_async.set(sessionId + selectedworkflow + 'selectedStep', selectedStep);
    }

    if (j?.prompt) {
      let { langModel, temperature, maxTokens, prompt } = j;
      prompt_response_async(sessionId, prompt, ws, null, langModel, temperature, maxTokens)
    }

  });

  ws.on('close', function(code, reason) {
    console.log('ws is closed with code: ' + code + ' reason: '+ reason);
    // Don't delete sessions because the socket might drop
    // Also useful to restart the server without loosng session
    connections.delete(sessionId);
  });

});

function logIncrementalOutput(partialResponse, conversationId, ws) {
  const incr = JSON.stringify(partialResponse.delta)
  if (incr) {
     ws.send(`{"conversationId" : "${conversationId}", "stream" : ${incr}}`)
  }
}

async function prompt_response_async(sessionId, prompt, ws, step, langModel = 'gpt-3.5-turbo', temperature = 0, maxTokens = 4000) {

  const currentDate = new Date().toISOString().split('T')[0]
  let systemMessage = `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`

  var workflow = {};
  var agent = {
    name: 'default',
    systemMessage: systemMessage,
  };
  let lastMessageId = null;
  let initializing = false;
  let use_cache = CACHE === "enable"

  let selectedworkflowId = await sessionsStore_async.get(sessionId + 'selectedworkflowId');
  if (selectedworkflowId) { 
    workflow = await sessionsStore_async.get(sessionId + selectedworkflowId + 'workflow');
    if (workflow) {
      console.log("workflow from selectedworkflowId")
    } else {
      workflow = utils.findSubObjectWithKeyValue(workflows, 'id', selectedworkflowId);
      await sessionsStore_async.set(sessionId + selectedworkflowId + 'workflow', workflow);
      console.log("Found workflow " + workflow.id)
    }
  }

  if (workflow) {
    systemMessage = workflow?.system_message || systemMessage;
    langModel = workflow?.model || langModel
    if (workflow?.one_session) {
      let userId = await sessionsStore_async.get(sessionId + 'userId');
      if (sessionId !== userId) {
        sessionId = userId
        let old_session = await sessionsStore_async.get(sessionId + 'userId');
        if (!old_session) {
          console.log("Creating one sesssion")
          await sessionsStore_async.set(sessionId + 'userId', userId);
          await sessionsStore_async.set(sessionId + selectedworkflowId + 'workflow', workflow);
        } else {
          console.log("Restoring one sesssion")
          await sessionsStore_async.set(sessionId + selectedworkflowId + 'workflow', workflow);
        }
      } else {
        console.log("Continuing one sesssion")
      }
    }
  }

  // Do we not allow multiple instances of an workflow in the same session
  // Will need to include agent id to allow for multiple agent conversations in an workflow

  if (workflow?.agent && agents) {
    agent = agents[workflow.agent]
    console.log("workflow set agent " + agent.name)
    if (typeof workflow?.use_cache !== "undefined") {
      use_cache = workflow.use_cache
      console.log("workflow set cache " + use_cache)
    }
    prompt = agent?.prepend_prompt ? (agent?.prepend_prompt + prompt) : prompt
    prompt = agent?.append_prompt ? (prompt + agent.append_prompt) : prompt

  }

  let conversationId = await sessionsStore_async.get(sessionId + selectedworkflowId + agent.name + 'conversationId');
  console.log("sessionId + selectedworkflowId + agent.name + conversationId " + sessionId + " " + selectedworkflowId + " " + agent.name  + " " + conversationId)

  if (step && workflow?.steps[step]) {
    if (typeof workflow.steps[step]?.use_cache !== "undefined") {
      use_cache = workflow.steps[step].use_cache
      console.log("Step set cache " + use_cache)
    }
    if (agents) {
      agent = agents[workflow.steps[step]?.agent] || agent
      console.log("Step set agent " + agent.name)
    }
    if (workflow.steps[step]?.initialize || step === 'start') {
      initializing = true
      console.log("Step agent initializing")
    }
  }

  if (initializing || conversationId === undefined) {
    initializing = true
    // Unique conversation per workflow type
    conversationId = uuidv4() + workflow?.id;
    await sessionsStore_async.set(sessionId + selectedworkflowId + agent.name + 'conversationId', conversationId);
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

   if (step && workflow?.steps[step]) {
    if (workflow.steps[step]?.messages) {
      lastMessageId = await utils.processMessages_async(workflow.steps[step].messages, messageStore_async, lastMessageId)
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
    if (users[userId] && workflow && workflow?.dyad && initializing) {
      let user = users[userId];
      console.log("Dyad in progress between " + agent.name + " and " + user.name)
      systemMessage += ` Vous etes en dyad avec votre user qui s'appelle ${user.name}. ${user.profile}`;
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

  const messageParams = {
    completionParams: {
      model: langModel,
      temperature: temperature,
    },
    onProgress: (partialResponse) => logIncrementalOutput(partialResponse, conversationId, ws),
    parentMessageId: lastMessageId,
  };

  // steps in workflow could add messages

  // May not need + agent.name for systemMessage if 
  
  // We need to keep the systemMessage as an explicit message to avoid it being truncated when conversation grows
  // Not sure we need this now
  if (await sessionsStore_async.has(sessionId + selectedworkflowId + agent.name + 'systemMessage')) {
    messageParams.systemMessage = await sessionsStore_async.get(sessionId + selectedworkflowId + agent.name + 'systemMessage')
  } else {
    messageParams.systemMessage = systemMessage;
  }

  sessionsStore_async.set(sessionId + selectedworkflowId + agent.name + 'systemMessage', messageParams.systemMessage)

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
    let text = cachedValue.text;
    console.log("Response from cache: " + text.slice(0, 20) + " ...");
    ws.send(`{"conversationId" : "${conversationId}", "final" : ${JSON.stringify(text)}}`)
    response_text_promise = Promise.resolve(text);
  } else {
    // Need to return a promise
    response_text_promise = api.sendMessage(prompt, messageParams)
    .then(response => {
      sessionsStore_async.set(sessionId + conversationId + agent.name + 'parentMessageId', response.id)
      let text = response.text;
      ws.send(`{"conversationId" : "${conversationId}", "final" : ${JSON.stringify(text)}}`)
      if (CACHE === "enable") {
        cache_async.set(cacheKey, response);
        console.log("cache stored key ", cacheKey);
      }
      // Don't add ... when response is fully displayed
      console.log("Response from API: " + text.slice(0, 20) + " ...")
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
        interface: users[username]?.interface,
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
      const [workflow_id, stepKey] = step_id.match(/^(.*)\.(.*)/).slice(1);
      let workflow = await sessionsStore_async.get(sessionId + workflow_id + 'workflow') 
      if (workflow === undefined || stepKey === 'start') {
        workflow = utils.findObjectById(workflows, workflow_id)
        await sessionsStore_async.set(sessionId + workflow_id + 'workflow', workflow) 
      }
      await sessionsStore_async.set(sessionId + 'selectedworkflowId', workflow_id);
      const ws = connections.get(sessionId);
      if (!ws) {
        // If the server has restarted the conenction is lost
        error("Could not find ws for sessionId " + sessionId)
        console.log(connections.keys())
        console.log("Has key " + connections.has(sessionId))
      }
      switch (component) {
        case 'TaskFromAgent':
          response = await tasks.TaskFromAgent_async(sessionsStore_async, sessionId, workflow, stepKey, prev_stepKey, prompt_response_async, ws)
          break;
        case 'TaskShowResponse':
          response = await tasks.TaskShowResponse_async(sessionsStore_async, sessionId, workflow, stepKey, prev_stepKey, prompt_response_async, ws)
          break;         
        case 'TaskChoose':
           response = await tasks.TaskChoose_async(sessionsStore_async, sessionId, workflow, stepKey, prev_stepKey, prompt_response_async, ws)
          break;         
        default:
          response = "ERROR: server unknown component:" + component
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

      // Update the session workflow with the information
      // Then next step will use that
      const [workflow_id, stepKey] = step_id.match(/^(.*)\.(.*)/).slice(1);
      let selectedworkflowId = await sessionsStore_async.get(sessionId + 'selectedworkflowId');
      let workflow = await sessionsStore_async.get(sessionId + selectedworkflowId + 'workflow');
      if (workflow.steps[stepKey]?.input !== input) {
        workflow.steps[stepKey].input = input
        workflow.steps[stepKey].last_change = Date.now()
      }
      await sessionsStore_async.set(sessionId + selectedworkflowId + 'workflow', workflow);
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ error: "No user" });
    }
  } else {
    res.status(401).json({ error: "No authentication" });
  }
});

app.get('/api/workflows', async (req, res) => {
  let stripped_workflows = {}
  if (process.env.AUTHENTICATION == "cloudflare") {
    const userId = req.headers['cf-access-authenticated-user-email'];
    if (userId) {
      // Extended to ignore by user if a user is specified
      // This is a hack unti lwe have a notin of group
      stripped_workflows = utils.ignoreByRegexList(
        workflows, userId,
        [/^agents$/]
      )
    }
  }
  res.send(stripped_workflows);
});

const port = 5000;
server.listen(port, () => console.log('AI server started'));