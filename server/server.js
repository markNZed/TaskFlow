/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/* ToDo
-------

Compare with similar systems
  LangChain is a framework for developing applications powered by language models.
    An abstraction above JS and Python
    Standard interface to models (could reuse this)
    Model output parsing sytem (could reuse this from TaskFunction)
    Provides stores for custom data e.g. text splitter
    The workflow in chat2flow is like an Agent in LangChain
  GPT-Index
    Should leverage this
  Open-AI Plugins
    This is LLM centric and will allow something similar
  Auto-GPT
    https://github.com/Significant-Gravitas/Auto-GPT
    This might be the close but the focus on autonomy is quite different
  https://github.com/modal-labs/quillman
    A complete chat app that transcribes audio in real-time, streams back a response
    from a language model, and synthesizes this response as natural-sounding speech.
    This repo is meant to serve as a starting point for your own language model-based apps
  https://gradio.app/
    It would ideally be easy to use a Gradio component
    Embed in an iFrame
  Algovera
    Not open sourced yet
  
Backlog
-------

  Bugs
  -----
  Scrolling to view suggested_prompts in TaskChat

  Features
  --------
    High Priority
    -------------
    Components should be separate from Workflow
    Workflow features:
      Replace globalState with Redux
        Switching between chat and workflow loses the chat messages - store at app level could resolve that
      Allow the user to specify the system prompt.
      Use a different route for configuring: user, session, workflow, task
      Create a new route for the Client side defaults. Manage that in a global state. Send on all requests.
    Msgs should be loaded from the server rather than saved on the client. Similar to stepper - both have history.
    If a Task has properties that are not declared then error (so we can catch things being filtered).
      Add properties list to Task Components
    Allow task to start another task on server side (needs functional interface to api/task/start )

    Components
    ----------
    MyAgents -> MyAgentConversation

    Low Priority
    ------------
    Multiple language support 'i18next-http-middleware for server and react-i18next for client
    Defensive programming + logging
    Websocket for tasks (so server can drive) just send incremental info for the task


Notes/Idea
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
  Asking the model to output in a format that would pass a test might be a good way of constraining prmopts
    e.g. provide Python/JS code that the output should pass (e.g. a single word)

  Architecture
  ------------
    How to manage multiple interfaces for a Task: directory with sub-components and basically a style or theme
    Create separate common repo for Tasks: config + component + taskFn. Maybe do not gain much form this for now.
    Tasks could be thought of as something like plugins, maybe there are patterns in that sort of software
    User defaults, workflow defaults etc can be tasks
    Could have something like middleware that tasks can use to modify input/output
      Cuurrently that would just be in the TaskFunction but should be easy to factor out when that makes sense
    How does a task monitor other tasks ? Callback to monitor a thread or a task (middleware catch updates to instance store)
      Maybe tasks are responsible for their own communication protocol 
      Pattern of having the parent own the state? That allows for communication.
      In React this is fairly easy. On the server this could be a pub-sub system. The common point is asynchronous messages.
    Should the geolocation be a task? It could still update the globalState on the client side
    How to call out to Python from the Task function
      "child process execution" with child_process library
      RabbitMQ for message passing good for a local model but do we need high speed, probably not.
      REST API would allow for remote etc, maybe better
      AMQP or MQTT would be scalable. 

  Infra
  -----
  Components repository so can be shared between server and client
  Run prod version instead of dev
  https://modal.com/

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
