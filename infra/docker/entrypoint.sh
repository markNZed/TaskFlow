#!/bin/bash

screen -S my-session -d -m

screen -S my-session -p 0 -X stuff "cd /app/hub\n"
screen -S my-session -p 0 -X stuff "npm install\n"
screen -S my-session -p 0 -X stuff "npm run debug\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash

screen -S my-session -p 1 -X stuff "cd /app/processor/nodejs\n"
screen -S my-session -p 1 -X stuff "npm install\n"
screen -S my-session -p 1 -X stuff "npm run debug\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash

screen -S my-session -p 2 -X stuff "cd /app/shared\n"
screen -S my-session -p 2 -X stuff "npm install\n"
screen -S my-session -p 2 -X stuff "npm run generate-converter-v02\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash

screen -S my-session -p 3 -X stuff "cd /app/processor/react\n"
screen -S my-session -p 3 -X stuff "npm install\n"
screen -S my-session -p 3 -X stuff "npm start\n"

sleep infinity