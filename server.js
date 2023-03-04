import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import NodeCache from 'node-cache'
import { ChatGPTAPI } from 'chatgpt'
import config from 'config'
import { WebSocketServer } from 'ws'
import https from 'https'
import http from 'http'
import fs from 'fs'
//  If the module is exporting a named export, use curly braces to destructure the named export. If the module is exporting a default export, import it directly without using curly braces. 
import { TextDecoder } from 'util'
import bodyParser from 'body-parser'
import path from 'path';
import { fileURLToPath } from 'url';

// OPENAI_API_KEY
// port
dotenv.config()

const use_cache = config.get('Options.use_cache');

const api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY
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
  ws.on('message', (message) => {

    const j = JSON.parse(message)
    if (j?.sessionId) {
      console.log("sessionId: ", j.sessionId)
    }

    if (j?.newMsg) {
      //let lastOutput = '';

      function logIncrementalOutput(partialResponse, ws) {
        //console.log(partialResponse)
        //const newOutput = partialResponse.text.slice(lastOutput.length);
        const incr = JSON.stringify(partialResponse.delta)
        ws.send(`{"stream" : ${incr}}`)
        //console.log("logIncrementalOutput ", newOutput);
        //lastOutput = partialResponse.text;
      }

      const response = api.sendMessage(j.newMsg, {
        // print the partial response as the AI is "typing"
        onProgress: (partialResponse) => logIncrementalOutput(partialResponse, ws)
      })
            
      //console.log(response.text)
      //botMsg = response.text;
    }


    const client = clients.get(ws);
    client.lastMessage = decoder.decode(message);

    //console.log(client.lastMessage)

    //for each websocket client
    websocketServer
    .clients
    .forEach( client => {
        //send the client the current message
        client.send(`{ "message broadcast" : ${message} }`);
        //client.send(`{"stream" : "he"}`)
        //client.send(`{"stream" : "ll"}`)
        //client.send(`{"stream" : "o"}`)
        //client.send(`{"end_of_stream" : 1}`)
       });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove the WebSocket connection from the clients map
    const client = clients.get(ws);
    const sessionId =  client.sessionId
    clients.delete(ws);
  });

});

/*
// Set up a headless websocket server that prints any
// events that come in.
const wsServer = new WebSocketServer({ noServer: true });
wsServer.on('connection', socket => {
  socket.on('message', message => console.log(message));
});
*/

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

app.post('/', async (req, res) => {
  try {
    const {prompt, langModel, temperature, maxTokens, impersonation} = req.body;
    const msg = impersonation?
                `pretend you are ${impersonation}, ${prompt}`:
                prompt;
    console.log("msg", msg);
    let botMsg = ""
    if (use_cache) {
      const cacheKey = [prompt, langModel, temperature, maxTokens, impersonation].join('-').replace(/\s+/g, '-').toLowerCase();
      console.log("cacheKey", cacheKey);

      let botMsg = myCache.get(cacheKey);
      if (botMsg){
        console.log("value found in cache.", botMsg);
      } else {
        console.log("value missing in cache. fecthing open api end point...");
      }
    }

    if (!botMsg) {
      //const response = await api.sendMessage(`${msg}`)

      let lastOutput = '';

      function logIncrementalOutput(partialResponse) {
        const newOutput = partialResponse.text.slice(lastOutput.length);
        console.log(newOutput);
        lastOutput = partialResponse.text;
      }
      
      /*
      const response = await api.sendMessage(msg, {
        // print the partial response as the AI is "typing"
        onProgress: (partialResponse) => logIncrementalOutput(partialResponse)
      })
            
      console.log(response.text)
      botMsg = response.text;
      */
      botMsg = "Brian's not here"

      /*
      const response = await openai.createChatCompletion({
        model: `${langModel}`,
        messages: [{
          role: "user",
          content: `${msg}`,
        }],
        //temperature: temperature, // Higher values means the model will generate more variations.
        //max_tokens: maxTokens, // The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 4096).
        top_p: 1, // alternative to sampling with temperature, called nucleus sampling
        frequency_penalty: 0.5, // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
        presence_penalty: 0, // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
      });

      console.log("response.data", response.data);

      const botMsg = response.data.choices[0].text;
      */
    }

    if (use_cache) {
      const cacheSetSuccess = myCache.set( cacheKey, botMsg);
      console.log("cacheSetSuccess: ", cacheSetSuccess);
    }

    res.status(200).send({
      bot: botMsg
    });

  } catch (error) {
    console.error(error)
    res.status(500).send(error || 'Something went wrong');
  }
});

/*
// Upgrade the HTTP server to a WebSocket server
server.on('upgrade', (req, socket, head) => {
  //const sessionId = req.headers['x-session-id'];
  const sessionId = "abc";

  console.log("HERE")

  // Find the WebSocket connection associated with the session ID
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId)
    var ws = session.ws
    var client = clients.get(ws);
  }

  if (!ws) {
    // If there is no WebSocket connection associated with the session ID, close the socket
    socket.destroy();
    console.log("socket.destroy()")
    return;
  }

  // Upgrade the socket to a WebSocket connection
  ws.handleUpgrade(req, socket, head, (newWs) => {
    ws.emit('connection', newWs, req);
  });
});
*/

const port = process.env.port || 5000;
server.listen(port, () => console.log('AI server already started at the back-end'));