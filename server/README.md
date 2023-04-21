# server
This is the backend / server side of chat2flow
1. written in Node JS run-time, Express framework
3. source msg data is powered by OpenAi API's
4. feteched data is cached by SQLite

To install the node packages:
`npm install` 

Then to run: 

`npm run server` 

We can set the port for the websocket server with environment variable WS_PORT=5000
The client URL can be set with environment variable CLIENT_URL="http://localhost:3000"