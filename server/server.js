/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

/* ToDo
-------
Review/simplification of code
  Up to client/src/components/Tasks/TaskConversation
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
  

Backlog
-------

  Bugs
  -----
  When we go to prev instance in stepper what do we do with the child instances ? 
    Maybe they should be deleted ? But not the same to jump back as active or to view.
  Scrolling to view suggested_prompts in TaskChat
  // This assumes the components are expanded - need to do this in dataconfig


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
      TaskChat should be receiving Msgs ? Ideally not. Try with interceptSetStartTask in TaskConversation
      https://tanstack.com/query/latest ? maybe Redux is a better choice
    If a Task has properties that are not declared then error (so we can catch things being filtered).
      Add properties list to Task Components

    Low Priority
    ------------
    Multiple language support 'i18next-http-middleware for server and react-i18next for client
    Defensive programming + logging
    Websocket for tasks (so server can drive) just send incremental info for the task
    Cache on client side for task fetching might require /api/task_get (so we know it is intended to just fetch)
    Allow task to start another task on server side (needs functional interface to api/task/start )

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
  Meta-level is like a stack of tasks
    Could be a task that observes another thread on the server side, can also have a UI
  Asking the model to output in a format that would pass a test might be a good way of constraining
    e.g. provide Python/JS code that the output should pass (e.g. a single word)

  Architecture
  ------------
    How to manage multiple interfaces for a Task: directory with sub-components and choose e.g. display option, basically a style or theme
    Create separate common repo for Tasks: config + component + taskFn
    User defaults, workflow defaults etc can be tasks
    Could have something like middleware that tasks can use to modify input/output
      Cuurrently that would just be in the TaskFunction but should be easy to factor out when that makes sense
    How does a task monitor other tasks ? Callback to mointor a thread or a task (middleware catch updates to instance store)
    Should the geolocation be a task? It could still update the globalState on the client side
    How to call out to Python from the Task function
      How to manage launching processes from Task function
        "child process execution" with child_process library
        RabbitMQ for message passing good for a local model but do we need high speed, probably not.
        REST API would allow for remote etc, maybe better
    HOC in React. higher-order component is a function that takes in a component and returns a new component.
      Cross-cutting concerns
      Manage the task state (available as a prop), setTask that would sync with server
    React Compound component could be used by a task that is composed of other tasks, allows shared context. 

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
