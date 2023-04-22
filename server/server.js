/* ToDo
-------
Testing of Stepper
Review/simplification of code
React-query what is this ?
The suggested prompts are broken
License ?
WorkflowTree can be a Task?
Create TASK component names on the fly 

Firefox is not supporting websocket on ws://localhost:5000

Backlog
-------

  Bugs
  -----
  When we go to prev instance in stepper what do we do with the child instances ? 
    Maybe they should be deleted ? But not the same to jump back as active or to view.

  Features
  --------
    Priority High
    -------------
    Workflow features:
      Replace globalState with Redux
        Switching between chat and workflow loses the chat messages - store at app level could resolve that
      Allow the user to specify the system prompt.
      Use a different route for configuring: user, session, workflow, task
      Create a new route for the Client side defaults. Manage that in a global state. Send on all requests.
      Msgs should be loaded from the server rather than saved on the client. Similar to stepper - both have history.
        TaskChat should be receiving Msgs ? Ideally not. Try with interceptSetStartTask in TaskConversation

    Priority Low
    ------------
    Multiple language support 'i18next-http-middleware for server and react-i18next for client
    Defensive programming + logging
    Websocket for tasks (so server can drive) just send incremental info for the task
    Cache on client side for task fetching might require /api/task_get (so we know it is intended to just fetch)
    Allow task to start another task on server side (needs functional interface to api/task/start )

Notes
-----
  Possible hierarchy of configuration:
  Defaults
    User (Route)
      Session
        Workflow (Route)
          User Workflow
            Session Workflow
              Task 
                User Task
                  Session Task
  Meta-level is like a stack of tasks
    Could be a task that observes another thread on the server side, can also have a UI

  Architecture
  ------------
    How to manage multiple interfaces for a Task: directory with sub-components and choose e.g. display option
    Create separate common repo for Tasks: config + component + taskFn

  Infra
  -----
  Include docker in git
  Components repository so can be shared between server and client
  Run prod version instead of dev

-------
*/

// If the module is exporting a named export, use curly braces to destructure the named export. 
// If the module is exporting a default export, import it directly without using curly braces.

// 3rd party modules
import express from 'express'
import cors from 'cors'
import http from 'http'
import bodyParser from 'body-parser'
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv'
dotenv.config()

// App specific modules
import { CLIENT_URL } from './config.mjs';
import sessionRoutes from './routes/sessionRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import miscRoutes from './routes/miscRoutes.js';
import { initWebSocketServer } from './src/websocket.js';

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

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

app.use('/', miscRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/task', taskRoutes);

const serverOptions = {}
const server = http.createServer(serverOptions, app)

initWebSocketServer(server)

const port = process.env.WS_PORT || 5000;
server.listen(port, () => console.log('Chat2Flow server started'))
