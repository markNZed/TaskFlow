#!/bin/bash

# We use `tee -a` so that tee will append after we run e.g. `truncate -s 0 hub/hub.log``

# Create a new detached screen session named "my-session"
screen -S my-session -d -m bash
screen -S my-session -p 0 -X stuff "cd /app/hub\n"
screen -S my-session -p 0 -X stuff "npm install\n"
screen -S my-session -p 0 -X stuff "touch hub.log && chmod 444 hub.log\n"
screen -S my-session -p 0 -X stuff "truncate -s 0 hub.log; npm run debug 2>&1 | tee -a hub.log\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash
screen -S my-session -p 1 -X stuff "cd /app/processor/nodejs\n"
screen -S my-session -p 1 -X stuff "npm install\n"
screen -S my-session -p 0 -X stuff "touch nodejs.log && chmod 444 nodejs.log\n"
screen -S my-session -p 1 -X stuff "truncate -s 0 nodejs.log; npm run debug 2>&1 | tee -a nodejs.log\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash
screen -S my-session -p 2 -X stuff "cd /app/processor/rxjs\n"
screen -S my-session -p 2 -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
screen -S my-session -p 0 -X stuff "touch rxjslog.log && chmod 444 rxjslog.log\n"
screen -S my-session -p 2 -X stuff "truncate -s 0 rxjslog.; npm run debug 2>&1 | tee -a rxjs.log\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash
screen -S my-session -p 3 -X stuff "cd /app/processor/rxjs\n"
# We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
screen -S my-session -p 0 -X stuff "touch rxjscopro.log && chmod 444 rxjscopro.log\n"
screen -S my-session -p 3 -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 rxjscopro.log; npm run debug-copro 2>&1 | tee -a rxjscopro.log\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash
screen -S my-session -p 4 -X stuff "cd /app/shared\n"
screen -S my-session -p 4 -X stuff "npm install\n"
screen -S my-session -p 4 -X stuff "npm run generate-converter-v02\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash
screen -S my-session -p 5 -X stuff "cd /app/processor/react\n"
screen -S my-session -p 5 -X stuff "npm install\n"
screen -S my-session -p 5 -X stuff "npm start 2>&1 | tee react.log\n"

# create a new window within the "my-session" screen
screen -S my-session -X screen bash
screen -S my-session -p 6 -X stuff "cd /app/\n"
screen -S my-session -p 6 -X stuff "npm install\n"

sleep infinity