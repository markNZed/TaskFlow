import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import NodeCache from 'node-cache'
import { ChatGPTAPI } from 'chatgpt'
import config from 'config'
import { WebSocketServer } from 'ws'
import https from 'https'
import fs from 'fs'
//  If the module is exporting a named export, use curly braces to destructure the named export. If the module is exporting a default export, import it directly without using curly braces. 
import { TextDecoder } from 'util'
import bodyParser from 'body-parser'
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb'
import beaverLogger from 'beaver-logger/server/server.js';

// OPENAI_API_KEY
// MONGODB_KEY
dotenv.config()

const use_cache = config.get('Options.use_cache');
const use_logger = config.get('Options.use_logger');

// automatically handle appending the previous messages to the prompt and attempt to optimize for the available tokens (which defaults to 4096).
const api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  completionParams: {
    model: 'gpt-3.5-turbo-0301',
    temperature: 0.0,
    top_p: 1.0
  },
  //debug: true
})

const serverOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}

const app = express();

app.use(bodyParser.json());

const server = https.createServer(serverOptions, app)
//const server = http.createServer(app)

const websocketServer = new WebSocketServer({ server });

const decoder = new TextDecoder('utf-8');

const clients = new Map();

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

//when a websocket connection is established
websocketServer.on('connection', (ws) => {

  console.log("websocketServer.on 'connection'")

  const sessionId = uuidv4();

  clients.set(ws, { "sessionId": sessionId});
 
  //send feedback to the incoming connection
  ws.send('{ "connection" : "ok", "sessionId" : "' + sessionId + '"}');
  
  //when a message is received
  ws.on('message', async (message) => {

    const j = JSON.parse(message)
    if (j?.sessionId) {
      console.log("sessionId: ", j.sessionId)
    }
    const clientData = clients.get(ws);

    if (j?.prompt) {
      const { langModel, temperature, maxTokens, impersonation } = j;
      const prompt = impersonation?
                  `pretend you are ${impersonation}, ${j.prompt}`:
                  j.prompt;
      console.log("prompt ",prompt);

      let botMsg = ""
  
      if (use_cache) {
        const cacheKey = [prompt, langModel, temperature, maxTokens, impersonation].join('-').replace(/\s+/g, '-').toLowerCase();
        console.log("cacheKey", cacheKey);
  
        botMsg = myCache.get(cacheKey);
        if (botMsg){
          console.log("value found in cache.", botMsg);
        } else {
          console.log("value missing in cache. fecthing open api end point...");
        }
      }
  
      if (!botMsg) {

        // This is a hack to get parameters into the API
        // We should be able to change this on the fly, I requested a feature 
        // https://github.com/transitive-bullshit/chatgpt-api/issues/434
        const api = new ChatGPTAPI({
          apiKey: process.env.OPENAI_API_KEY,
          completionParams: {
            model: langModel, //'gpt-3.5-turbo-0301',
            temperature: temperature,
            top_p: 1.0,
          },
          maxResponseTokens: maxTokens,
          //debug: true
        })

        function logIncrementalOutput(partialResponse, ws) {
          const incr = JSON.stringify(partialResponse.delta)
          ws.send(`{"stream" : ${incr}}`)
        }
  
        const response = await api.sendMessage(prompt, {
          // print the partial response as the AI is "typing"
          onProgress: (partialResponse) => logIncrementalOutput(partialResponse, ws),
          parentMessageId: clientData?.parentMessageId 
        });
        
        //console.log("response ",response.detail.choices)
        clientData.parentMessageId = response.id
        botMsg = response.text
      }
  
      if (use_cache) {
        const cacheSetSuccess = myCache.set( cacheKey, botMsg);
        console.log("cacheSetSuccess: ", cacheSetSuccess);
        ws.send(`{"stream" : ${botMsg}}`)
      }

    }

    const client = clients.get(ws);
    client.lastMessage = decoder.decode(message);

  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove the WebSocket connection from the clients map
    const client = clients.get(ws);
    const sessionId =  client.sessionId
    clients.delete(ws);
  });

});

app.use(cors());
app.use(express.json());

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const myCache = new NodeCache( { 
  stdTTL: 3600, // standard time to live in sec's
  checkperiod: 120 
} );

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