# Server
This is the nodejsProcessor side of Chat@Flow
1. written in Node JS run-time, Express framework
3. LLM responses powered by OpenAi API's
4. fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm run server` 

We can set the port for the websocket server with environment variable WS_PORT (defaults to 5000).
The browserProcessor URL can be set with environment variable BROWSER_URL (defauts to "http://localhost:3000")