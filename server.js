/* ToDo
-------
The stepper should be a Tasks
  Should tasks have the option of starting other tasks?

Maybe switching to stepper should revert to start, so history is built on the fly
When we go to prv instance what do we do with the child instances ? Maybe they should be deleted ? But not the same to jump back as active or to view.

Msgs should be loaded from the server rather than saved on the client. Similar to stepper - both have history.

Meta-level is like a stack of tasks
  Needs to sit on server ?
  Task associated with stack
    Evaluate current task in each level of stack

Server:
  Split the API into files using routes
  Move chat function into file

-------
Future
  Multiple language support 'i18next-http-middleware for server and react-i18next for client
  Workflow features:
    Allow the user to specify the system prompt.
    Default agent for user (perhaps have user state e.g. last active conversation)
    Use a different route for configuring: user, session, workflow, task
  Defensive programming + logging
  Create a new route for the Client side defaults. Manage that in a global state. Send on all requests.
  Chatbot in workflow
  Websocket for tasks (so server can drive) just send incremental info for the task
  Cache on client side for task fetching would require /api/task_get (so we know it is intended to just fetch)
  Switching between chat and workflow loses the chat messages - store at app level could resolve that
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
  Infra
  -----
  Combine git repos into chat2flow
  Include docker in git
  Components repository so can be shared between server and client
  Run prod version instead of dev

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
import { tasksFn } from './tasksFn/tasksFn.mjs';
import { utils } from './utils.mjs';
import { error } from 'console'
dotenv.config()

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const DEFAULT_USER = 'test@testing.com'
const DUMMY_OPENAI = false

// Functions for logging
const fail = utils.fail

// For now we use JS data structures instead of a DB
// Removes need for an admin interface during dev
const CONFIG_DIR = process.env.CONFIG_DIR || "./config/";
var users = await utils.load_data_async(CONFIG_DIR, 'users')
var groups = await utils.load_data_async(CONFIG_DIR, 'groups')
var workflows = await utils.load_data_async(CONFIG_DIR, 'workflows')
var agents = await utils.load_data_async(CONFIG_DIR, 'agents')
var defaults = await utils.load_data_async(CONFIG_DIR, 'defaults')
var tasks = {} // We will build this from workflows

// We adopt a DRY strategy in the code and config files
// But not in the data structures that are generated from the config for the code
// Transform hierarchical workflows structure into a hash 
// Build tasks hash from the workflows hash

// This has side-effects, modifying workflows in-place
// Could check that each workflow has a 'start' task
workflows = utils.flattenWorkflows(workflows)
//console.log(JSON.stringify(workflows, null, 2))

//Create a group for each user
for (const userKey in users) {
  if (users.hasOwnProperty(userKey)) {
    if (!groups[userKey]) {
      groups[userKey] = {}
      groups[userKey]['name'] = users[userKey].name
      groups[userKey]['users'] = [userKey]
    }
  }
}

// Adding key of object as id in object
function add_index(config) {
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      config[key]['id'] = key
    }
  }
}

// Add id to groups (index in DB)
add_index(groups)
//console.log(JSON.stringify(groups, null, 2))

// Add id to users (index in DB)
add_index(users)
//console.log(JSON.stringify(users, null, 2))

// Add id to agents (index in DB)
add_index(agents)
//console.log(JSON.stringify(users, null, 2))

//Add list of groups to each user (a view in a DB)
for (const groupKey in groups) {
  if (groups.hasOwnProperty(groupKey)) {
    const group = groups[groupKey]
    group.users.forEach(function(userId) {
      // Groups may have users that do not exist
      if (!users[userId]) {
        console.log("Could not find user " + userId + " expected in group " + groupKey)
      } else {
        if (users[userId]['groups']) {
          // Should check that not already in groups
          users[userId]['groups'].push(groupKey)
        } else {
          users[userId]['groups'] = [groupKey]
        }
      }
    })
  }
}
//console.log(JSON.stringify(users, null, 2))

// Flatten the hash of tasks from workflows
// Add the parentId to task objects
function flattenTasks(workflows) {
  const tasks = {};
  for (const workflowKey in workflows) {
    if (Object.prototype.hasOwnProperty.call(workflows, workflowKey)) {
      const workflowTasks = workflows[workflowKey].tasks;
      if (workflowTasks) {
        for (const taskKey in workflowTasks) {
          if (Object.prototype.hasOwnProperty.call(workflowTasks, taskKey)) {
            const task = workflowTasks[taskKey];
            const taskId = task.id;
            tasks[taskId] = task;
            tasks[taskId].parentId = workflowKey;
          }
        }
      }
    }
  }
  return tasks;
}

tasks = flattenTasks(workflows)

const CACHE_ENABLE = process.env.CACHE_ENABLE === 'true' || false;
console.log("CACHE_ENABLE " + CACHE_ENABLE)

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The keyV could be in a single sqlite DB

const DB_URI = 'sqlite://db/main.sqlite'

function newKeyV(uri, table) {
  return new Keyv({
    store: new KeyvBetterSqlite3({
      uri: uri,
      table: table,
    }),
  });
}

// We could have one keyv store and use prefix for different tables

// Schema: See ChatGPTAPI
// For now this is a dedicated store but eventually it
// should be an interface to the threads + instances
const messagesStore_async = newKeyV(DB_URI, 'messages')
// Schema:
//   Key: sessionId || sessionId + 'userId'
//   Value: object
const sessionsStore_async = newKeyV(DB_URI, 'sessions')
// Schema:
//   Key: hash
//   Value: object
const cache_async = newKeyV(DB_URI, 'cache')
// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = newKeyV(DB_URI, 'instances')
// Schema:
//   Key: threadId || taskId + userId || taskId + sessionId || taskId + groupId
//   Value: array of instanceId
const threadsStore_async = newKeyV(DB_URI, 'threads')

const app = express();
app.use(bodyParser.json());

const serverOptions = {}
const server = http.createServer(serverOptions, app)
const websocketServer = new WebSocketServer({ server: server, path: '/ws' });

var connections = new Map(); // Stores WebSocket instances with unique session IDs

function wsSendObject(ws, message = {}) {
  // We need to check if ws is still active
  if (!ws) {
    console.log("Lost websocket for wsSendObject")
  } else {
    ws.send(JSON.stringify(message));
    //console.log("wsSendObject sent ", message)
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

  });

  ws.on('close', function(code, reason) {
    console.log('ws is closed with code: ' + code + ' reason: '+ reason);
    // Don't delete sessions because the socket might drop
    // Also useful during dev to restart the server without loosing session
    // Prod would require cleaning up old sessions
    connections.delete(sessionId);
  });

});

function SendIncrementalWs(partialResponse, instanceId, ws) {
  const incr = JSON.stringify(partialResponse.delta)
  if (ws) {
    if (ws.data['delta_count'] && ws.data['delta_count'] % 20 === 0) {
      const message = {'instanceId' : instanceId, 'text' : partialResponse.text}
      wsSendObject(ws, message)
    } else if (incr) {
      const message = {'instanceId' : instanceId, 'delta' : partialResponse.delta}
      wsSendObject(ws, message)
    }
    ws.data['delta_count'] += 1
    //console.log("ws.data['delta_count'] " + ws.data['delta_count'])
  } else {
    console.log("Lost websocket in SendIncrementalWs for instanceId " + instanceId)
  }
}

// Move into another file
// Split into preparing prompt, requesting to API
async function chat_async(task) {

  const sessionId = task.sessionId
  let ws = connections.get(sessionId);
  if (!ws) {
    console.log("Warning: chat_async could not find ws for " + sessionId)
  }
  let systemMessage = ''
  let lastMessageId = null;
  let initializing = false;
  let use_cache = CACHE_ENABLE
  let server_task = false;

  let langModel = task?.model || defaults.langModel
  let temperature = task?.temperature || defaults.temperature
  let maxTokens = task?.maxTokens || defaults.maxTokens

  let prompt = task?.prompt
  let agent = agents[task.agent]

  if (task?.one_thread) {
    // Prefix with location when it has changed
    if (task?.new_address) {
      prompt = "Location: " + task.address + "\n" + prompt
    }
    // Prefix prompt with date/time
    const currentDate = new Date();
    prompt = 'Time: ' + utils.formatDateAndTime(currentDate) + "\n" + prompt
    console.log("one_thread prompt : " + prompt)
  }
  
  if (typeof task.use_cache !== 'undefined') {
    use_cache = task.use_cache
    console.log("Task set cache " + use_cache)
  }

  if (typeof agent?.prepend_prompt !== 'undefined') {
    prompt = agent.prepend_prompt + prompt
    console.log("Prepend agent prompt " + agent.prepend_prompt)
  }

  if (typeof agent?.append_prompt !== 'undefined') {
    prompt += agent.append_prompt
    console.log("Append agent prompt " + agent.append_prompt)
  }

  if (typeof task.initialize !== 'undefined') {
    initializing = task.initialize
    console.log("Task initializing")
  }

  if (typeof task.server_task !== 'undefined') {
    server_task = task.server_task
    console.log("Task server_task")
  }

  if (!initializing) {
    lastMessageId = await messagesStore_async.get(task.threadId + agent.id + 'parentMessageId')
    console.log("!initializing task.threadId " + lastMessageId)
  }

  if (!lastMessageId || initializing) {

    if (agent?.messages) {
      lastMessageId = await utils.processMessages_async(agent.messages, messagesStore_async, lastMessageId)
      console.log("Initial messages from agent " + agent.name + " " + lastMessageId)
    }

    if (task?.messages) {
      lastMessageId = await utils.processMessages_async(task.messages, messagesStore_async, lastMessageId)
      console.log("Messages extended from task.name " + task.name + " lastMessageId " + lastMessageId)
    }
  
    if (agent?.system_message) {
      systemMessage = agent.system_message;
      console.log("Sytem message from agent " + agent.name)
    }

    if (users[task.userId] && task.dyad) {
      let user = users[task.userId];
      systemMessage += ` Vous etes en dyad avec votre user qui s'appelle ${user?.name}. ${user?.profile}`;
      console.log("Dyad in progress between " + agent.name + " and " + user?.name)
    }

  }

  // Need to account for the system message and some margin because the token count may not be exact.
  //console.log("prompt " + prompt + " systemMessage " + systemMessage)
  if (!prompt) {console.log("ERROR: expect prompt to calculate tokens")}
  if (!systemMessage) {console.log("Warning: expect systemMessage to calculate tokens unless vierge")}
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
    messageStore: messagesStore_async,
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
    messageParams['onProgress'] = (partialResponse) => SendIncrementalWs(partialResponse, task.instanceId, ws)
  }

  messagesStore_async.set(task.threadID + agent.id + 'systemMessage', messageParams.systemMessage)

  let cachedValue = '';
  let cacheKey = '';
  if (use_cache) {
    const messagesText = await utils.messagesText_async(messagesStore_async, lastMessageId)
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

  // Message can be sent from one of multiple sources
  function message_from(source, text, server_task, ws) {
     // Don't add ... when response is fully displayed
    console.log("Response from " + source + " : " + text.slice(0, 20) + " ...");
    const message = {
      'instanceId' : task.instanceId,
      'final' : text
    }
    if (ws) {
      ws.data['delta_count'] = 0
      if (!server_task) { wsSendObject(ws, message) }
    } else {
      console.log("Lost ws in message_from")
    }
  }

  let response_text_promise = Promise.resolve("");

  if (cachedValue && cachedValue !== undefined) {
    messagesStore_async.set(task.threadID + agent.id + 'parentMessageId', cachedValue.id)
    let text = cachedValue.text;
    message_from('cache', text, server_task, ws)
    response_text_promise = Promise.resolve(text);
  } else {
    // Need to return a promise
    if (DUMMY_OPENAI) {
      const text = "Dummy text"
      message_from('Dummy API', text, server_task, ws)
      response_text_promise = Promise.resolve(text);
    } else {
      response_text_promise = api.sendMessage(prompt, messageParams)
      .then(response => {
        messagesStore_async.set(task.threadID + agent.id + 'parentMessageId', response.id)
        let text = response.text;
        message_from('API', text, server_task, ws)    
        if (use_cache) {
          cache_async.set(cacheKey, response);
          console.log("cache stored key ", cacheKey);
        }
        return text
      })
      .catch(error => {
        let text = "ERROR " + error.message
        message_from('API', text, server_task, ws)    
        return text
      })
    } 
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

// How to put the API into separate files

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
  const sessionId = uuidv4();
  let authorised_workflows = {}
  for (const key in workflows) {
    if (utils.authenticatedTask(workflows[key], userId, groups)) {
      authorised_workflows[key] = workflows[key]
    }
  }
  //console.log("authorised_workflows ", authorised_workflows)
  let workflowsTree = {}
  for (const key in authorised_workflows) {
    let wf = authorised_workflows[key]
    workflowsTree[key] = utils.extract_client_info(wf, workflows[wf.id].filter_for_client)
  }
  //console.log("workflowsTree ", workflowsTree)
  if (userId) {
    console.log("Creating session for ", userId);
    sessionsStore_async.set(sessionId + 'userId', userId);
    res.send({
      user: {
        userId: userId,
        interface: users[userId]?.interface,
      },
      sessionId: sessionId,
      workflowsTree: workflowsTree,
    });
  } else {
    res.send({userId: ''});
  }
});

async function do_task_async(task) {
  let updated_task = {}
  switch (task.component) {
    case 'TaskFromAgent':
      updated_task = await tasksFn.TaskFromAgent_async(threadsStore_async, instancesStore_async, chat_async, task)
      break;
    case 'TaskShowResponse':
      updated_task = await tasksFn.TaskShowResponse_async(threadsStore_async, instancesStore_async, chat_async, task)
      break;         
    case 'TaskChoose':
      updated_task = await tasksFn.TaskChoose_async(threadsStore_async, instancesStore_async, chat_async, task)
      break;         
    case 'TaskChat':
      updated_task = await tasksFn.TaskChat_async(threadsStore_async, instancesStore_async, chat_async, task)
      break;         
    default:
      updated_task = task
      const msg = "ERROR: server unknown component:" + task.component
      updated_task.error = msg
      console.log(msg)
  }
  await instancesStore_async.set(task.instanceId, updated_task)
  console.log("instancesStore_async set " + task.instanceId )
  //console.log(updated_task)
  return updated_task
}

async function newTask_async(id, sessionId, parentTask = null) {
  let parentInstanceId
  let threadId
  if (parentTask) {
    parentInstanceId = parentTask.instanceId
    threadId = parentTask.threadId
  }
  let taskCopy = { ...tasks[id] };
  taskCopy['sessionId'] = sessionId
  let instanceId = uuidv4();
  taskCopy['instanceId'] = instanceId
  if (parentInstanceId) {
    taskCopy['parentInstanceId'] = parentInstanceId
    let parent = await instancesStore_async.get(parentInstanceId)
    if (parent?.address) { taskCopy['address'] = parent.address }
    if (!threadId) {
      threadId = parent.threadId
    }
    parent.childInstance = instanceId
    await instancesStore_async.set(parentInstanceId, parent)
  }
  if (threadId) {
    taskCopy['threadId'] = threadId
    let instanceIds = await threadsStore_async.get(threadId)
    if (instanceIds) {
      instanceIds.push(instanceId)
    } else {
      instanceIds = [instanceId]
    }
    await threadsStore_async.set(threadId, instanceIds)
  } else {
    taskCopy['threadId'] = instanceId
    await threadsStore_async.set(instanceId, [instanceId])
  }
  const now = new Date();
  taskCopy['created'] = now
  await instancesStore_async.set(instanceId, taskCopy)
  console.log("New task " + id)
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
    let task = req.body.task;
    let address = req.body.address;
    
    task.sessionId = sessionId
    if (sessionId) { task['sessionId'] = sessionId } else {console.log("Warning: sessionId missing")}
    if (address) { task['address'] = address }

    // Risk that client writes over server fields so extract_client_info before merge
    let instanceId = task.instanceId
    const server_side_task = await instancesStore_async.get(instanceId)
    // extract_client_info could also do some data cleaning
    let clean_client_task = utils.extract_client_info(task, tasks[task.id].filter_for_client)
    let updated_task = Object.assign({}, server_side_task, clean_client_task)

    /*
    console.log("task ", task)
    console.log("clean_client_task ", clean_client_task)
    console.log("server_side_task ", server_side_task)
    console.log("Merged task: ",updated_task)
    */

    if (updated_task?.done) {
      console.log("Client side task done " + updated_task.id)
      updated_task.done = false
      await instancesStore_async.set(instanceId, updated_task)
      updated_task = await newTask_async(updated_task.next, sessionId, updated_task)
    } else {
      updated_task = await do_task_async(updated_task)
    }

    let i = 0
    while (updated_task?.server_task) {
      // A sanity check to avoid erroneuos infinite loops
      i = i + 1
      if (i > 10) {
        console.log("Unexpected looping on server_task " + updated_task.id)
        exit
      }
      if (updated_task?.done) {
        console.log("Server side task done " + updated_task.id)
        updated_task.done = false
        await instancesStore_async.set(updated_task.instanceId, updated_task)
        updated_task = await newTask_async(updated_task.next, sessionId, updated_task)
      }
      if (updated_task?.server_task) {
        updated_task = await do_task_async(updated_task)
      } else {
        break
      }
    }

    let updated_client_task = utils.extract_client_info(updated_task, tasks[updated_task.id].filter_for_client)
    res.send(JSON.stringify(updated_client_task));
  } else {
    res.status(200).json({ error: "No user" });
  }
});

app.post('/api/start', async (req, res) => {
  console.log("/api/start")
  let userId = DEFAULT_USER
  if (process.env.AUTHENTICATION === "cloudflare") {
    userId = req.headers['cf-access-authenticated-user-email'];
  }
  if (userId) {
    //console.log("req.body " + JSON.stringify(req.body))
    const sessionId = req.body.sessionId;
    const startId = req.body.startId;
    let groupId = req.body.groupId;
    let address = req.body.address;

    if (!tasks[startId]) {

      const msg = "ERROR could not find task " + startId
      console.log(msg)
      res.status(404).json({ error: msg });
      return

    } else {      

      // default is to start a new thread
      // Instances key: no recorded in DB
      let task = await newTask_async(startId, sessionId)
      task['userId'] = userId
      if (sessionId) { task['sessionId'] = sessionId }  else {console.log("Warning: sessionId missing")}
      if (address) { task['address'] = address }

      //console.log(task)

      // Check if the user has permissions
      if (!utils.authenticatedTask(task, userId, groups)) {
        console.log(task, userId, groups)
        res.status(400).json({ error: "Task authentication failed" });
        return
      }

      if (task?.one_thread) {
        const threadId = startId + userId
        let instanceIds = await threadsStore_async.get(threadId)
        if (instanceIds) {
          // Returning last so continuing (maybe should return first?)
          const instanceId = instanceIds[instanceIds.length - 1]
          task = await instancesStore_async.get(instanceId)
          console.log("Restarting one_thread " + instanceId + " for " + task.id)
        }
      }
      if (task?.restore_session) {
        const threadId = startId + sessionId
        let instanceIds = await threadsStore_async.get(threadId)
        if (instanceIds) {
          // Returning last so continuing (maybe should return first?)
          const instanceId = instanceIds[instanceIds.length - 1]
          task = await instancesStore_async.get(instanceId)
          console.log("Restarting session " + instanceId + " for " + task.id)
        }
      }
      if (task?.collaborate) {
        // Workflow to choose the group (workflow should include that)
        if (!groupId) {
          // This is a hack for the collaborate feature
          groupId = task.collaborate
        }
        const threadId = startId + groupId
        let instanceIds = await threadsStore_async.get(threadId)
        if (instanceIds) {
          // Returning last so continuing (maybe should return first?)
          const instanceId = instanceIds[instanceIds.length - 1]
          task = await instancesStore_async.get(instanceId)
          console.log("Restarting collaboration " + instanceId + " for " + task.id)
        }
      }

      await instancesStore_async.set(task.instanceId, task)
  
      let updated_client_task = utils.extract_client_info(task, tasks[task.id].filter_for_client)
      res.send(JSON.stringify(updated_client_task));
    }
  } else {
    res.status(200).json({ error: "No user" });
  }
});

const port = process.env.WS_PORT || 5000;
server.listen(port, () => console.log('AI server started'))
