#!/bin/bash

screen -S my-session -d -m

screen -S my-session -p 0 -X stuff "cd /app/taskflow/nodejsProcessor\n"
screen -S my-session -p 0 -X stuff "npm install\n"
screen -S my-session -p 0 -X stuff "npm run server\n"

screen -S my-session -X screen

screen -S my-session -p 1 -X stuff "cd /app/taskflow/browserProcessor\n"
screen -S my-session -p 1 -X stuff "npm install\n"
screen -S my-session -p 1 -X stuff "npm start\n"

sleep infinity