#!/bin/bash

# We use `tee -a` so that tee will append after we run e.g. `truncate -s 0 hub/hub.log``

# Create a new detached screen session named "app"
screen -S app -d -m bash
screen -S app -p 0 -X stuff "cd /app/hub\n"
screen -S app -p 0 -X stuff "npm install\n"
screen -S app -p 0 -X stuff "touch hub.log && chmod 444 hub.log\n"
screen -S app -p 0 -X stuff "truncate -s 0 hub.log; NODE_NAME=zero npm run debug 2>&1 | tee -a hub.log\n"

# create a new window within the "app" screen
screen -S app -X screen bash
screen -S app -p 1 -X stuff "cd /app/nodes/rxjs\n"
screen -S app -p 1 -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
screen -S app -p 1 -X stuff "touch one.log && chmod 444 one.log\n"
screen -S app -p 1 -X stuff "truncate -s 0 one.log; NODE_NAME=one npm run debug 2>&1 | tee -a one.log\n"

# create a new window within the "app" screen
screen -S app -X screen bash
screen -S app -p 2 -X stuff "cd /app/nodes/rxjs\n"
# We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
screen -S app -p 2 -X stuff "touch two.log && chmod 444 two.log\n"
screen -S app -p 2 -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 two.log; NODE_NAME=two DEBUG_PORT=0.0.0.0:9232 npm run debug 2>&1 | tee -a two.log\n"

# create a new window within the "app" screen
screen -S app -X screen bash
screen -S app -p 3 -X stuff "cd /app/nodes/rxjs\n"
# We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
screen -S app -p 3 -X stuff "touch three.log && chmod 444 three.log\n"
screen -S app -p 3 -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 three.log; NODE_NAME=three DEBUG_PORT=0.0.0.0:9230 npm run debug 2>&1 | tee -a three.log\n"

# create a new window within the "app" screen
screen -S app -X screen bash
screen -S app -p 4 -X stuff "cd /app/shared\n"
screen -S app -p 4 -X stuff "npm install\n"
screen -S app -p 4 -X stuff "npm run generate-converter-v02\n"

# create a new window within the "app" screen
screen -S app -X screen bash
screen -S app -p 5 -X stuff "cd /app/processor/react\n"
screen -S app -p 5 -X stuff "npm install\n"
screen -S app -p 5 -X stuff "PORT=3000 npm start 2>&1 | tee react.log\n"

# create a new window within the "app" screen
screen -S app -X screen bash
screen -S app -p 6 -X stuff "cd /app/\n"
screen -S app -p 6 -X stuff "npm install\n"

if [[ "$TASKFLOW_DEV" == "true" ]]; then

    # Create a new detached screen session named "app"
    screen -S meta -d -m bash
    screen -S meta -p 0 -X stuff "cd /meta/hub\n"
    screen -S meta -p 0 -X stuff "npm install\n"
    screen -S meta -p 0 -X stuff "export APP_LABEL=T@skFlow; export APP_NAME=TaskFlow; export APP_ABBREV=TF\n"
    screen -S meta -p 0 -X stuff "touch hub.log && chmod 444 hub.log\n"
    screen -S meta -p 0 -X stuff "truncate -s 0 hub.log; NODE_NAME=zero WS_PORT=6001 npm run 2>&1 | tee -a hub.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p 1 -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p 1 -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
    screen -S meta -p 1 -X stuff "export APP_LABEL=T@skFlow; export APP_NAME=TaskFlow; export APP_ABBREV=TF\n"
    screen -S meta -p 1 -X stuff "touch one.log && chmod 444 one.log\n"
    screen -S meta -p 1 -X stuff "truncate -s 0 one.log; NODE_NAME=one WS_PORT=6002 npm run 2>&1 | tee -a one.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p 2 -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p 2 -X stuff "export APP_LABEL=T@skFlow; export APP_NAME=TaskFlow; export APP_ABBREV=TF\n"
    # We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
    screen -S meta -p 2 -X stuff "touch two.log && chmod 444 two.log\n"
    screen -S meta -p 2 -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 two.log; NODE_NAME=two npm run 2>&1 | tee -a two.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p 3 -X stuff "cd /app/nodes/rxjs\n"
    screen -S meta -p 3 -X stuff "export APP_LABEL=T@skFlow; export APP_NAME=TaskFlow; export APP_ABBREV=TF\n"
    # We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
    screen -S meta -p 3 -X stuff "touch two.log && chmod 444 two.log\n"
    screen -S meta -p 3 -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 three.log; NODE_NAME=three npm run 2>&1 | tee -a three.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p 4 -X stuff "cd /meta/shared\n"
    screen -S meta -p 4 -X stuff "npm install\n"
    screen -S meta -p 4 -X stuff "npm run generate-converter-v02\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p 5 -X stuff "cd /meta/processor/react\n"
    screen -S meta -p 5 -X stuff "npm install\n"
    screen -S meta -p 5 -X stuff "PORT=4000 npm start 2>&1 | tee react.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p 6 -X stuff "cd /meta/\n"
    screen -S meta -p 6 -X stuff "npm install\n"

fi

sleep infinity