#!/bin/bash

# Define the environment variable with a default value
# RUN_MODE can be set to "debug" or "forever"
RUN_MODE=${RUN_MODE:-debug}

# We use `tee -a` so that tee will append after we run e.g. `truncate -s 0 nodes/hub/hub.log``

# Create a new detached screen session named "app"
screen -S app -d -m -t hub-core bash
screen -S app -p hub-core -X stuff "cd /app/nodes/hub\n"
screen -S app -p hub-core -X stuff "npm install\n"
screen -S app -p hub-core -X stuff "touch hub-core.log && chmod 444 hub-core.log\n"
screen -S app -p hub-core -X stuff "truncate -s 0 hub-core.log; NODE_NAME=hub-core DEBUG_PORT=0.0.0.0:9229 npm run $RUN_MODE 2>&1 | tee -a hub-core.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t hub-consumer bash
screen -S app -p hub-consumer -X stuff "cd /app/nodes/rxjs\n"
screen -S app -p hub-consumer -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
screen -S app -p hub-consumer -X stuff "touch hub-consumer.log && chmod 444 hub-consumer.log\n"
screen -S app -p hub-consumer -X stuff "truncate -s 0 hub-consumer.log; NODE_NAME=hub-consumer DEBUG_PORT=0.0.0.0:9231 npm run $RUN_MODE 2>&1 | tee -a hub-consumer.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t hub-coprocessor bash
screen -S app -p hub-coprocessor -X stuff "cd /app/nodes/rxjs\n"
# We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
screen -S app -p hub-coprocessor -X stuff "touch hub-coprocessor.log && chmod 444 hub-coprocessor.log\n"
screen -S app -p hub-coprocessor -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done \n"
screen -S app -p hub-coprocessor -X stuff "truncate -s 0 hub-coprocessor.log; NODE_NAME=hub-coprocessor DEBUG_PORT=0.0.0.0:9232 npm run $RUN_MODE 2>&1 | tee -a hub-coprocessor.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t processor-consumer bash
screen -S app -p processor-consumer -X stuff "cd /app/nodes/rxjs\n"
# We do not npm install here because we can assume that processor-consumer is doing that but wait for it to finish
screen -S app -p processor-consumer -X stuff "touch processor-consumer.log && chmod 444 processor-consumer.log\n"
screen -S app -p hub-coprocessor -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done \n"
screen -S app -p processor-consumer -X stuff "truncate -s 0 processor-consumer.log; NODE_NAME=processor-consumer DEBUG_PORT=0.0.0.0:9230 npm run $RUN_MODE 2>&1 | tee -a processor-consumer.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t shared bash
screen -S app -p shared -X stuff "cd /app/shared\n"
screen -S app -p shared -X stuff "npm install\n"
screen -S app -p shared -X stuff "npm run generate-converter-v02\n"

# create a new window within the "app" screen
screen -S app -X screen -t react bash
screen -S app -p react -X stuff "cd /app/nodes/react\n"
screen -S app -p react -X stuff "npm install\n"
screen -S app -p react -X stuff "PORT=3000 npm run $RUN_MODE 2>&1 | tee react.log\n"

# create a new window within the "app" screen
screen -S app -X screen -t app bash
screen -S app -p app -X stuff "cd /app/\n"
screen -S app -p app -X stuff "npm install\n"

if [[ "$TASKFLOW_DEV" == "true" ]]; then

    # Create a new detached screen session named "app"
    screen -S meta -d -m -t hub-core bash
    screen -S meta -p hub-core -X stuff "cd /meta/hub\n"
    screen -S meta -p hub-core -X stuff "npm install\n"
    screen -S meta -p hub-core -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    screen -S meta -p hub-core -X stuff "touch hub-core.log && chmod 444 hub-core.log\n"
    screen -S meta -p hub-core -X stuff "truncate -s 0 hub-core.log; NODE_NAME=hub-core WS_PORT=6001 npm run forever 2>&1 | tee -a hub-core.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t hub-consumer bash
    screen -S meta -p hub-consumer -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p hub-consumer -X stuff "npm install && touch /tmp/rxjs_npm_install_done\n"
    screen -S meta -p hub-consumer -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    screen -S meta -p hub-consumer -X stuff "touch hub-consumer.log && chmod 444 hub-consumer.log\n"
    screen -S meta -p hub-consumer -X stuff "truncate -s 0 hub-consumer.log; NODE_NAME=hub-consumer WS_PORT=6002 npm run forever 2>&1 | tee -a hub-consumer.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t hub-coprocessor bash
    screen -S meta -p hub-coprocessor -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p hub-coprocessor -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    # We do not npm install here because we can assume that rxjs is doing that but wait for it to finish
    screen -S meta -p hub-coprocessor -X stuff "touch hub-coprocessor.log && chmod 444 hub-coprocessor.log\n"
    screen -S meta -p hub-coprocessor -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done\n"
    screen -S meta -p hub-coprocessor -X stuff "truncate -s 0 hub-coprocessor.log; NODE_NAME=hub-coprocessor npm run forever 2>&1 | tee -a hub-coprocessor.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen bash
    screen -S meta -p processor-consumer -X stuff "cd /meta/nodes/rxjs\n"
    screen -S meta -p processor-consumer -X stuff "export APP_LABEL=MetaT@skFlow; export APP_NAME=MetaTaskFlow; export APP_ABBREV=MTF\n"
    # We do not npm install here because we can assume that processor-consumer is doing that but wait for it to finish
    screen -S meta -p processor-consumer -X stuff "touch hub-coprocessor.log && chmod 444 hub-coprocessor.log\n"
    screen -S meta -p processor-consumer -X stuff "while [ ! -f /tmp/rxjs_npm_install_done ]; do sleep 1; done\n"
    screen -S meta -p processor-consumer -X stuff "truncate -s 0 processor-consumer.log; NODE_NAME=processor-consumer npm run forever2>&1 | tee -a processor-consumer.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t shared bash
    screen -S meta -p shared -X stuff "cd /meta/shared\n"
    screen -S meta -p shared -X stuff "npm install\n"
    screen -S meta -p shared -X stuff "npm run generate-converter-v02\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t react bash
    screen -S meta -p react -X stuff "cd /meta/nodes/react\n"
    screen -S meta -p react -X stuff "npm install\n"
    screen -S meta -p react -X stuff "PORT=4000 npm run forever 2>&1 | tee react.log\n"

    # create a new window within the "app" screen
    screen -S meta -X screen -t meta bash
    screen -S meta -p meta -X stuff "cd /meta/\n"
    screen -S meta -p meta -X stuff "npm install\n"

fi

sleep infinity