/* ToDo
-------
Maybe switching to stepper should revert to start, so history is built on the fly
When we go to prv instance what do we do with the child instances ? Maybe they should be deleted ? But not the same to jump back as active or to view.

Meta-level is like a stack of tasks
  Needs to sit on server ?
  Task associated with stack
    Evaluate current task in each level of stack

Server:
  Stop using globals across modules
  How to split up functionality in server:
    Config
    Storage
    Websocket API
    HTTP API

-------
Future
  Multiple language support 'i18next-http-middleware for server and react-i18next for client
  Workflow features:
    Allow the user to specify the system prompt.
    Default agent for user (perhaps have user state e.g. last active conversation)
    Use a different route for configuring: user, session, workflow, task
    Should tasks have the option of starting other tasks?
  Defensive programming + logging
  Create a new route for the Client side defaults. Manage that in a global state. Send on all requests.
  Websocket for tasks (so server can drive) just send incremental info for the task
  Cache on client side for task fetching might require /api/task_get (so we know it is intended to just fetch)
  Switching between chat and workflow loses the chat messages - store at app level could resolve that
  Msgs should be loaded from the server rather than saved on the client. Similar to stepper - both have history.
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
import sessionRoutes from './routes/sessionRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import * as dotenv from 'dotenv'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import http from 'http'
import bodyParser from 'body-parser'
import path from 'path';
import { fileURLToPath } from 'url';
import { utils } from './utils.mjs';
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

// Each keyv store is in a different table
const DB_URI = 'sqlite://db/main.sqlite'

// We could have one keyv store and use prefix for different tables

// Schema: See ChatGPTAPI
// For now this is a dedicated store but eventually it
// should be an interface to the threads + instances
const messagesStore_async = utils.newKeyV(DB_URI, 'messages')
// Schema:
//   Key: sessionId || sessionId + 'userId'
//   Value: object
const sessionsStore_async = utils.newKeyV(DB_URI, 'sessions')
// Schema:
//   Key: hash
//   Value: object
const cache_async = utils.newKeyV(DB_URI, 'cache')
// Schema:
//   Key: instanceId
//   Value: task object
const instancesStore_async = utils.newKeyV(DB_URI, 'instances')
// Schema:
//   Key: threadId || taskId + userId || taskId + sessionId || taskId + groupId
//   Value: array of instanceId
const threadsStore_async = utils.newKeyV(DB_URI, 'threads')

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

const chatConfig = {
  defaults,
  agents,
  messagesStore_async,
  users,
  cache_async,
  DUMMY_OPENAI,
  connections,
  CACHE_ENABLE,
  wsSendObject,
}

// Hack for now
Object.assign(global, chatConfig);

const sessionConfig = {
  DEFAULT_USER,
  workflows,
  groups,
  sessionsStore_async,
}

// Hack for now
Object.assign(global, sessionConfig);

const taskConfig = {
  instancesStore_async,
  tasks,
  threadsStore_async,
}

// Hack for now
Object.assign(global, taskConfig);

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

// To use CloudFlare with POST requests we need to add the allowedOrigins to allow pre-flight requests (OPTIONS request) see
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/cors/#allow-preflighted-requests

const allowedOrigins = [CLIENT_URL];

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

app.use('/api/session', sessionRoutes);
app.use('/api/task', taskRoutes);

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

const port = process.env.WS_PORT || 5000;
server.listen(port, () => console.log('Chat2Flow server started'))
