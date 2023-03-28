import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import NodeCache from 'node-cache'
import { ChatGPTAPI } from 'chatgpt'
import config from 'config'
import { WebSocketServer } from 'ws'
import http from 'http'
import fs from 'fs'
//  If the module is exporting a named export, use curly braces to destructure the named export. If the module is exporting a default export, import it directly without using curly braces. 
import bodyParser from 'body-parser'
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb'
import beaverLogger from 'beaver-logger/server/server.js';
import Keyv from 'keyv'
import KeyvBetterSqlite3 from 'keyv-better-sqlite3';
import { encode } from 'gpt-3-encoder';
import { v4 as uuidv4 } from'uuid'


// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OPENAI_API_KEY
// MONGODB_KEY
dotenv.config()

const use_logger = config.get('Options.use_logger');

const store = new KeyvBetterSqlite3({
  uri: 'sqlite://database.sqlite'
})
const messageStore = new Keyv({ store, namespace: 'chatgpt-demo' })


// ChatGPTAPI looks after conversations for us
// To change some properties we need to restart the connection 
/*
const api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  completionParams: {
    model: 'gpt-3.5-turbo-0301',
    temperature: 0.0,
    top_p: 1.0
  },
  messageStore,
  //debug: true
})
*/

const serverOptions = {}

const app = express();

app.use(bodyParser.json());

const server = http.createServer(serverOptions, app)

const websocketServer = new WebSocketServer({ server: server, path: '/ws' });

// Sessions are stored in memory so a server restart starts new conversations
const clients = new Map();

//when a websocket connection is established
websocketServer.on('connection', (ws) => {

  console.log("websocketServer.on 'connection'")

  let sessionId = uuidv4();

  // Here the client is tied to the web socket 
  // If we reconnect we will lose this 
  //clients.set(ws, { "sessionId": sessionId});
 
  //send feedback to the incoming connection
  ws.send('{ "connection" : "ok", "sessionId" : "' + sessionId + '"}');
  
  //when a message is received
  ws.on('message', async (message) => {

    const j = JSON.parse(message)
    if (j?.sessionId) {
      console.log("sessionId: ", j.sessionId)
      sessionId = j.sessionId
    } 
    
    if (!clients.has(sessionId)) {
      console.log("Creating ", sessionId)
      clients.set(sessionId, new Map());
    }

    const clientData = clients.get(sessionId);

    if (!clientData.has('conversationId')) {
      clientData.set('conversationId', uuidv4());
      clientData.set('parentMessageId', undefined);
    }

    if (j?.prompt) {
      const { langModel, temperature, maxTokens, impersonation } = j;
      const prompt = impersonation?
                  `pretend you are ${impersonation}, ${j.prompt}`:
                  j.prompt;
      //console.log("prompt ",prompt);

      const currentDate = new Date().toISOString().split('T')[0]
      const systemMessage = process.env.REACT_APP_SYSTEM_MESSAGE || `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`
      // Need to account for the system message and some margin because the token count may not be exact.
      const availableTokens = (maxTokens - Math.floor(maxTokens * 0.1)) - encode(prompt).length - encode(systemMessage).length
      let maxResponseTokens = 1000
      maxResponseTokens = availableTokens < maxResponseTokens ? availableTokens : maxResponseTokens
      
      // This is a hack to get parameters into the API
      // We should be able to change this on the fly, I requested a feature 
      // https://github.com/transitive-bullshit/chatgpt-api/issues/434
      // It seems the API calls _buildMessages that will not restore messages
      // In https://github.com/transitive-bullshit/chatgpt-api/blob/main/bin/cli.js there is an example
      // of continuing conversations 
      const api = new ChatGPTAPI({
        apiKey: process.env.OPENAI_API_KEY,
        completionParams: {
          model: langModel, //'gpt-3.5-turbo-0301',
          temperature: temperature,
          top_p: 1.0,
        },
        systemMessage: systemMessage,
        messageStore,
        maxResponseTokens: maxResponseTokens,
        maxModelTokens: maxTokens,
        debug: true 
      })

      function logIncrementalOutput(partialResponse, ws) {
        const incr = JSON.stringify(partialResponse.delta)
        ws.send(`{"stream" : ${incr}}`)
      }

      const response = await api.sendMessage(prompt, {
        // print the partial response as the AI is "typing"
        onProgress: (partialResponse) => logIncrementalOutput(partialResponse, ws),
        conversationId: clientData.get('conversationId'),
        parentMessageId: clientData.get('parentMessageId')
      });
      
      clientData.set('parentMessageId', response.id);

      console.log("parentMessageId", clientData.get('parentMessageId'))

    }

  });

  ws.on('close', function(code, reason) {
    console.log('ws is closed with code: ' + code + ' reason: '+ reason);
    // Don't delete because the socket might drop
    //clients.delete(sessionId); 
  });

});

app.use(cors());
app.use(express.json());

// Serve a transparent pixel so we can get the authorization working with Cloudflare without
// visiting the website explicitly
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Welcome to the chatbot server side!'
  })
});

const port = 5000;
server.listen(port, () => console.log('AI server already started at the back-end'));

if (use_logger) {

  const myLogger = {
    log(req, level, name, payload) {
      const date = payload.timestamp ? new Date(payload.timestamp).toString() : new Date().toString();
      const str = [name, '\t[ ', date, ' ]\n', Object.keys(payload).map(key => {
        return `\t${key}: ${payload[key]}`;
      }).join('\n'), '\n'].join('');
      console[level](str);
    },

    async track(req, tracking) {
      console.log('[track]\n', Object.keys(tracking).map(key => {
        return `\t${key}: ${tracking[key]}`;
      }).join('\n'), '\n');
      const result = await client.db("test").collection("pai_log").insertOne(tracking);
    },

    meta(req, meta) {
      console.log('[meta]\n', Object.keys(meta).map(key => {
        return `\t${key}: ${meta[key]}`;
      }).join('\n'), '\n');
    }

  };

  const uri = "mongodb+srv://" + process.env.MONGODB_KEY + "/?retryWrites=true&w=majority";
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  client.connect(err => {
    const collection = client.db("test").collection("devices");
    // perform actions on the collection object
    client.close();
  });

  app.use(
    beaverLogger.expressEndpoint({
      uri: "/api/log",
      logger: myLogger,
      enableCors: true,
    })
  );

  process.on('exit', async (code) => {
    console.log('Closing DB');
    await client.close();
  });

}