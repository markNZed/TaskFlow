/* ToDo
-------
Combine git repos into chat2flow
Switching from chat to workflow loses the chat messages - I guess need to store these at app level
This is true for workflow switch too. But if chat becomes workflow this goes away.
Workflow object is intended to change quite a bit so maybe not in global - that can be at Workflow level. Just use a selected workflow id at global?
API context
Process workflow to add name, flatten first
Lodash should help for merging the task
Components repository so can be shared between server and client
workflowhierarchy.mjs instead of hierarchical data structure
Hierarchy of configuration:
  Defaults
    User (Route)
      Session
        Workflow (Route)
          User Workflow
            Session Workflow
              Task 
                User Task
                  Session Task
Should error if agent not found - no default
The stream/send could have a task ID. (has workflowId)
Create a new route for the Client side defaults. Manage that in a global state. Send on all requests.
Include docker in git
Defensive programming + logging
-------
Future
  Multiple language support 'i18next-http-middleware for server and react-i18next for client
  Workflow features:
    Allow the user to specify the system prompt.
    Default agent for user (perhaps have user state e.g. last active conversation)
    Use a different route for configuring: user, session, workflow, task
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
const DEFAULT_USER = 'test@testing.com'

// For now we use JS data structures instead of a DB
const CONFIG_DIR = process.env.CONFIG_DIR || "./config/";
var users = await utils.load_data_async(CONFIG_DIR, 'users')
var workflows = await utils.load_data_async(CONFIG_DIR, 'workflows')
var agents = await utils.load_data_async(CONFIG_DIR, 'agents')
var defaults = await utils.load_data_async(CONFIG_DIR, 'defaults')

// Cache should use SQLite too?
const CACHE_ENABLE = process.env.CACHE_ENABLE === 'true' || false;
console.log("CACHE_ENABLE " + CACHE_ENABLE)

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

const app = express();
app.use(bodyParser.json());

const serverOptions = {}
const server = http.createServer(serverOptions, app)
const websocketServer = new WebSocketServer({ server: server, path: '/ws' });

var connections = new Map(); // Stores WebSocket instances with unique session IDs

function wsSendObject(ws, message = {}) {
  // We need to check if ws is still active?
  if (!ws) {
    console.log("Lost websocket for wsSendObject " + JSON.stringify(ws))
  } else {
    if (ws.data['sessionId']) { message['sessionId'] = ws.data['sessionId'] }
    ws.send(JSON.stringify(message));
    //console.log("wsSendObject sent")
  }
}

websocketServer.on('connection', (ws) => {

  console.log("websocketServer.on")

  let sessionId = undefined
  ws.data = { 'sessionId': sessionId } 

  ws.on('message', async (message) => {

    const j = JSON.parse(message)

    if (j?.sessionId) {
      //console.log("sessionId from client: ", j.sessionId)
      sessionId = j.sessionId
      connections.set(sessionId, ws);
      ws.data['sessionId'] = sessionId
    }

    if (j?.ping) {
      wsSendObject(ws, {"pong" : "ok"})
      //console.log("Pong ", j)
    }
    
    if (!await sessionsStore_async.has(sessionId + 'userId') && j?.userId) {
      const userId = j.userId
      console.log("Creating userId", userId);
      await sessionsStore_async.set(sessionId + 'userId', userId);
    }

    if (j?.workflowId) {
      const workflowId = j.workflowId
      await sessionsStore_async.set(sessionId + 'workflowId', workflowId);
      // Initialize at task 'start'
      //await sessionsStore_async.set(sessionId + selectedworkflow + 'selectedTask', 'start');
      console.log("sessionId + 'workflowId' " + workflowId)
    }

    if (j?.selectedTask) {
      const selectedTask = j.selectedTask
      const selectedworkflow = j.selectedworkflow
      await sessionsStore_async.set(sessionId + selectedworkflow + 'selectedTask', selectedTask);
    }

    if (j?.address && j?.userId) {
      await sessionsStore_async.set(j.userId + 'location', j.address);
      console.log("Address: " + j.address)
    }

    if (j?.prompt) {
       const task = {
        'langModel' : j?.langModel,
        'temperature' : j?.temperature,
        'maxTokens' : j?.maxTokens,
        'prompt' : j.prompt,
      }
      prompt_response_async(sessionId, task)
    }

  });

  ws.on('close', function(code, reason) {
    console.log('ws is closed with code: ' + code + ' reason: '+ reason);
    // Don't delete sessions because the socket might drop
    // Also useful during dev to restart the server without loosing session
    // Prod would require cleaning up old sessions
    connections.delete(sessionId);
  });

});

function SendIncrementalWs(partialResponse, workflowId, ws) {
  const incr = JSON.stringify(partialResponse.delta)
  if (ws) {
    if (ws.data['delta_count'] && ws.data['delta_count'] % 20 === 0) {
      const message = {'workflowId' : workflowId, 'text' : partialResponse.text}
      wsSendObject(ws, message)
    } else if (incr) {
      const message = {'workflowId' : workflowId, 'delta' : partialResponse.delta}
      wsSendObject(ws, message)
    }
    ws.data['delta_count'] += 1
    //console.log("ws.data['delta_count'] " + ws.data['delta_count'])
  } else {
    console.log("Lost websocket in SendIncrementalWs ")
  }
}

async function prompt_response_async(sessionId, task) {

  let prompt = task.prompt
  let taskName = task?.name // We should require this later (chat not providing it yet)

  let ws = connections.get(sessionId);
  let systemMessage = ''
  let workflow = {};
  let agent = {};
  let lastMessageId = null;
  let initializing = false;
  let use_cache = CACHE_ENABLE
  let server_task = false;
  let langModel = defaults.langModel
  let temperature = defaults.temperature
  let maxTokens = defaults.maxTokens

  let workflowId = await sessionsStore_async.get(sessionId + 'workflowId');
  // Need to get workflow from session because data is stored there
  workflow = await sessionsStore_async.get(sessionId + workflowId + 'workflow');

  if (workflowId && !workflow) { 
    workflow = utils.findSubObjectWithKeyValue(workflows, 'id', workflowId);
    await sessionsStore_async.set(sessionId + workflowId + 'workflow', workflow);
    console.log("Session workflow " + workflow.id)
  }

  if (workflow) {
    langModel = workflow?.model || langModel
    if (workflow?.one_session) {
      let userId = await sessionsStore_async.get(sessionId + 'userId');
      if (sessionId !== userId) {
        sessionId = userId
        let old_session = await sessionsStore_async.get(sessionId + 'userId');
        if (!old_session) {
          console.log("Creating one sesssion")
          await sessionsStore_async.set(sessionId + 'userId', userId);
          await sessionsStore_async.set(sessionId + workflowId + 'workflow', workflow);
        } else {
          console.log("Restoring one sesssion")
          await sessionsStore_async.set(sessionId + workflowId + 'workflow', workflow);
        }
      } else {
        console.log("Continuing one sesssion")
      }
      // Prefix with location
      const location = await sessionsStore_async.get(userId + 'location');
      const old_location = await sessionsStore_async.get(userId + 'old_location');
      if (location && location !== old_location) {
        await sessionsStore_async.set(userId + 'old_location', location);
        prompt = "Location: " + location + "\n" + prompt
      }
      // Prefix prompt with date/time
      const currentDate = new Date();
      prompt = 'Time: ' + utils.formatDateAndTime(currentDate) + "\n" + prompt
      // Can we add location for user ?
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
  }

  if (taskName && workflow?.tasks[taskName]) {
    if (typeof workflow.tasks[taskName]?.use_cache !== "undefined") {
      use_cache = workflow.tasks[taskName].use_cache
      console.log("Task set cache " + use_cache)
    }
    if (agents) {
      agent = agents[workflow.tasks[taskName]?.agent] || agent
      console.log("Task set agent " + agent.name)
      prompt = agent?.prepend_prompt ? (agent?.prepend_prompt + prompt) : prompt
      if (agent?.prepend_prompt) {console.log("Prepend agent prompt " + agent.prepend_prompt)}
      prompt = agent?.append_prompt ? (prompt + agent.append_prompt) : prompt
      if (agent?.append_prompt) {console.log("Append agent prompt " + agent.append_prompt)}
    }
    if (workflow.tasks[taskName]?.initialize || taskName === 'start') {
      initializing = true
      console.log("Task agent initializing")
    }
    langModel = workflow.tasks[taskName]?.model || langModel
    if (workflow.tasks[taskName]?.model) {console.log("Task set model " + langModel)}
    server_task = workflow.tasks[taskName]?.server_task || server_task
  }

  if (!initializing) {
    lastMessageId = await sessionsStore_async.get(sessionId + workflowId + agent.name + 'parentMessageId')
  }

  if (!lastMessageId || initializing) {

    if (agent?.messages) {
      lastMessageId = await utils.processMessages_async(agent.messages, messageStore_async, lastMessageId)
      console.log("Initial messages from agent " + agent.name + " " + lastMessageId)
    }

    console.log("taskName " + taskName)

    if (taskName && workflow?.tasks[taskName]) {
      // console.log("workflow OK " + JSON.stringify(workflow.tasks[taskName].messages))
      if (workflow.tasks[taskName]?.messages) {
        lastMessageId = await utils.processMessages_async(workflow.tasks[taskName].messages, messageStore_async, lastMessageId)
        console.log("Messages extended from taskName " + taskName + " lastMessageId " + lastMessageId)
      }
    }
  
    if (agent?.system_message) {
      systemMessage = agent.system_message;
      console.log("Sytem message from agent " + agent.name)
    }
  }

  // This might be an idea for the future
  //let address = await sessionsStore_async.get(userId + 'location')
  //if (address) {
  //  systemMessage.replace(/ADDRESS/, address);
  //}

  // Could have messages instead of prompt in a task
  
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
    parentMessageId: lastMessageId,
    systemMessage: systemMessage,
  };

  if (!server_task) {
    messageParams['onProgress'] = (partialResponse) => SendIncrementalWs(partialResponse, workflowId, ws)
  }

  // tasks in workflow could add messages

  sessionsStore_async.set(sessionId + workflowId + agent.name + 'systemMessage', messageParams.systemMessage)

  let cachedValue = '';
  let cacheKey = '';
  if (use_cache) {
    const messagesText = await utils.messagesText_async(messageStore_async, lastMessageId)
    //console.log("messagesText " + messagesText + " lastMessageId " + lastMessageId)
    const cacheKeyText = [
      messageParams.systemMessage,  
      JSON.stringify(messageParams.completionParams), 
      prompt, 
      messagesText
    ].join('-').replace(/\s+/g, '-')
    cacheKey = utils.djb2Hash(cacheKeyText);
    console.log("cacheKey " + cacheKey)
    cachedValue = await cache_async.get(cacheKey);
  }
  let response_text_promise = Promise.resolve("");
  if (cachedValue && cachedValue !== undefined) {
    sessionsStore_async.set(sessionId + workflowId + agent.name + 'parentMessageId', cachedValue.id)
    let text = cachedValue.text;
    console.log("Response from cache: " + text.slice(0, 20) + " ...");
    const message = {
      'workflowId' : workflowId,
      'final' : text
    }
    if (!server_task) { wsSendObject(ws, message) }
    response_text_promise = Promise.resolve(text);
  } else {
    // Need to return a promise
    if (ws) {ws.data['delta_count'] = 0}
    response_text_promise = api.sendMessage(prompt, messageParams)
    .then(response => {
      sessionsStore_async.set(sessionId + workflowId + agent.name + 'parentMessageId', response.id)
      let text = response.text;
      const message = {
        'workflowId' : workflowId,
        'final' : text
      }
      if (!server_task) { wsSendObject(ws, message) }
      if (use_cache) {
        cache_async.set(cacheKey, response);
        console.log("cache stored key ", cacheKey);
      }
      // Don't add ... when response is fully displayed
      console.log("Response from API: " + text.slice(0, 20) + " ...")
      return text
    })
    .catch(error => {
      let text = "ERROR " + error
      console.log(text)
      const message = {
        'workflowId' : workflowId,
        'final' : text
      }
      if (!server_task) { wsSendObject(ws, message) }
      return text
    })
  }
  return response_text_promise
}

const allowedOrigins = [CLIENT_URL];

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
  let userId = DEFAULT_USER
  console.log(userId)
  if (process.env.AUTHENTICATION === "cloudflare") {
    userId = req.headers['cf-access-authenticated-user-email'];
  }
  if (userId) {
    res.send(`Hello, ${userId}!`);
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Needed to add this to workaround for Cloudflare Zero Trust
// We need to visit this server from the browser to get cookies etc
app.get('/authenticate', async (req, res) => {
  let authenticated_url = CLIENT_URL + '/authenticated'
  let userId = DEFAULT_USER
  if (process.env.AUTHENTICATION === "cloudflare") {
    userId = req.headers['cf-access-authenticated-user-email'];
  }
  if (userId) {
    res.redirect(authenticated_url);
  } else {
    res.redirect(authenticated_url);
  }
});

app.get('/api/session', async (req, res) => {
  console.log("/api/session")
  let userId = DEFAULT_USER
  if (process.env.AUTHENTICATION === "cloudflare") {
    userId = req.headers['cf-access-authenticated-user-email'];
  }
  let sessionId = uuidv4();
  // Extended to ignore by user if a user is specified
    // This is a hack until we have a notion of group
  let stripped_workflows = utils.ignoreByRegexList(
    workflows, userId,
    [/^agents$/]
  );
  if (userId) {
    res.send({
      user: {
        userId: userId,
        interface: users[userId]?.interface,
      },
      sessionId: sessionId,
      workflows: stripped_workflows,
    });
  } else {
    res.send({userId: ''});
  }
});

async function workflow_from_id_async(sessionId, workflowId, taskName) {
  let workflow = await sessionsStore_async.get(sessionId + workflowId + 'workflow') 
  if (workflow === undefined || taskName === 'start') {
    workflow = utils.findObjectById(workflows, workflowId)
    await sessionsStore_async.set(sessionId + workflowId + 'workflow', workflow) 
  }
  await sessionsStore_async.set(sessionId + 'workflowId', workflowId);
  return workflow
}

async function do_task_async(sessionId, workflowId, taskName, task) {
  let workflow = await workflow_from_id_async(sessionId, workflowId, taskName)
  const ws = connections.get(sessionId);
  if (!ws) {
    // If the server has restarted the conenction is lost
    error("Could not find ws for sessionId " + sessionId)
    console.log(connections.keys())
    console.log("Has key " + connections.has(sessionId))
  }
  let updated_task = {}
  const component = workflow.tasks[taskName].component
  switch (component) {
    case 'TaskFromAgent':
      updated_task = await tasks.TaskFromAgent_async(sessionsStore_async, sessionId, workflow, taskName, prompt_response_async, task)
      break;
    case 'TaskShowResponse':
      updated_task = await tasks.TaskShowResponse_async(sessionsStore_async, sessionId, workflow, taskName, prompt_response_async, task)
      break;         
    case 'TaskChoose':
      updated_task = await tasks.TaskChoose_async(sessionsStore_async, sessionId, workflow, taskName, prompt_response_async, task)
      break;         
    case 'TaskChat':
      updated_task = await tasks.TaskChat_async(sessionsStore_async, sessionId, workflow, taskName, prompt_response_async, task)
      break;         
    default:
      updated_task = "ERROR: server unknown component:" + component
  }
  return updated_task
}

function extract_client_info(task, filter_list) {
  const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
  for (const key in taskCopy) {
    if (!filter_list.includes(key)) {
      delete taskCopy[key];
    }
  }
  return taskCopy
}

app.post('/api/task', async (req, res) => {
  console.log("/api/task")
  let userId = DEFAULT_USER
  if (process.env.AUTHENTICATION === "cloudflare") {
    userId = req.headers['cf-access-authenticated-user-email'];
  }
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    const sessionId = req.body.sessionId;
    const task = req.body.task;
    const task_id = task.id;

    // Need to check for errors
    let [workflowId, taskName] = task_id.match(/^(.*)\.(.*)/).slice(1);

    // May be starting the workflow 
    if (!await sessionsStore_async.has(sessionId + 'workflowId', workflowId)) {
      await sessionsStore_async.set(sessionId + 'workflowId', workflowId);
    }

    let updated_task = await do_task_async(sessionId, workflowId, taskName, task)

    while (updated_task?.server_task) {
      // Check if the next task is server-side
      taskName = updated_task.next
      let workflow = await workflow_from_id_async(sessionId, workflowId, taskName)
      if (workflow.tasks[taskName]?.server_task) {
        console.log("Next task is server side taskName " + taskName)
        updated_task = await do_task_async(sessionId, workflowId, taskName)
      } else {
        break
      }
    }

    let updated_client_task = extract_client_info(
      updated_task, 
      ['id', 'component', 'response', 'next', 'input', 'input_label', 'initialize', 'server_task', 'name']
    );
    // A function for each component? In a library.
    res.send(JSON.stringify(updated_client_task));
  } else {
    res.status(200).json({ error: "No user" });
  }
});

const port = process.env.WS_PORT || 5000;
server.listen(port, () => console.log('AI server started'))