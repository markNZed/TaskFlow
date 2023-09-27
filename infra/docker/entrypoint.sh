#!/bin/bash

# We use `tee -a` so that tee will append after we run e.g. `truncate -s 0 nodes/hub/hub.log``

# Create a new detached screen session named "app"
screen -S app -d -m -t hub bash
screen -S app -p hub -X stuff "cd /app/nodes/hub\n"
screen -S app -p hub -X stuff "npm install\n"
screen -S app -p hub -X stuff "touch hub.log && chmod 444 hub.log\n"
screen -S app -p hub -X stuff "truncate -s 0 hub.log; NODE_NAME=hub npm run debug 2>&1 | tee -a hub.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t hubconsumer bash
screen -S app -p hubconsumer -X stuff "cd /app/nodes/rxjs\n"
screen -S app -p hubconsumer -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
screen -S app -p hubconsumer -X stuff "touch hubconsumer.log && chmod 444 hubconsumer.log\n"
screen -S app -p hubconsumer -X stuff "truncate -s 0 hubconsumer.log; NODE_NAME=hubconsumer npm run debug 2>&1 | tee -a hubconsumer.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t hubcopro bash
screen -S app -p hubcopro -X stuff "cd /app/nodes/rxjs\n"
# We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
screen -S app -p hubcopro -X stuff "touch hubcopro.log && chmod 444 hubcopro.log\n"
screen -S app -p hubcopro -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 hubcopro.log; NODE_NAME=hubcopro DEBUG_PORT=0.0.0.0:9232 npm run debug 2>&1 | tee -a hubcopro.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t rxjs bash
screen -S app -p rxjs -X stuff "cd /app/nodes/rxjs\n"
# We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
screen -S app -p rxjs -X stuff "touch rxjs.log && chmod 444 rxjs.log\n"
screen -S app -p rxjs -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 rxjs.log; NODE_NAME=rxjs DEBUG_PORT=0.0.0.0:9230 npm run debug 2>&1 | tee -a rxjs.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t shared bash
screen -S app -p shared -X stuff "cd /app/shared\n"
screen -S app -p shared -X stuff "npm install\n"
screen -S app -p shared -X stuff "npm run generate-converter-v02\n"

# create a new window within the "app" screen
screen -S app -X screen -t react bash
screen -S app -p react -X stuff "cd /app/nodes/react\n"
screen -S app -p react -X stuff "npm install\n"
screen -S app -p react -X stuff "PORT=3000 npm start 2>&1 | tee react.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t app bash
screen -S app -p app -X stuff "cd /app/\n"
screen -S app -p app -X stuff "npm install\n"

if [[ "$TASKFLOW_DEV" == "true" ]]; then

    # Create a new detached screen session named "app"
    screen -S meta -d -m -t hub bash
    screen -S meta -p hub -X stuff "cd /meta/hub\n"
    screen -S meta -p hub -X stuff "npm install\n"
    screen -S meta -p hub -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    screen -S meta -p hub -X stuff "touch hub.log && chmod 444 hub.log\n"
    screen -S meta -p hub -X stuff "truncate -s 0 hub.log; NODE_NAME=hub WS_PORT=6001 npm run 2>&1 | tee -a hub.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t hubconsumer bash
    screen -S meta -p hubconsumer -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p hubconsumer -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
    screen -S meta -p hubconsumer -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    screen -S meta -p hubconsumer -X stuff "touch hubconsumer.log && chmod 444 hubconsumer.log\n"
    screen -S meta -p hubconsumer -X stuff "truncate -s 0 hubconsumer.log; NODE_NAME=hubconsumer WS_PORT=6002 npm run 2>&1 | tee -a hubconsumer.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t hubcopro bash
    screen -S meta -p hubcopro -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p hubcopro -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    # We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
    screen -S meta -p hubcopro -X stuff "touch hubcopro.log && chmod 444 hubcopro.log\n"
    screen -S meta -p hubcopro -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 hubcopro.log; NODE_NAME=hubcopro npm run 2>&1 | tee -a hubcopro.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p rxjs -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p rxjs -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    # We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
    screen -S meta -p rxjs -X stuff "touch hubcopro.log && chmod 444 hubcopro.log\n"
    screen -S meta -p rxjs -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done && truncate -s 0 rxjs.log; NODE_NAME=rxjs npm run 2>&1 | tee -a rxjs.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t shared bash
    screen -S meta -p shared -X stuff "cd /meta/shared\n"
    screen -S meta -p shared -X stuff "npm install\n"
    screen -S meta -p shared -X stuff "npm run generate-converter-v02\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t react bash
    screen -S meta -p react -X stuff "cd /meta/nodes/react\n"
    screen -S meta -p react -X stuff "npm install\n"
    screen -S meta -p react -X stuff "PORT=4000 npm start 2>&1 | tee react.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t meta bash
    screen -S meta -p meta -X stuff "cd /meta/\n"
    screen -S meta -p meta -X stuff "npm install\n"

fi

sleep infinity