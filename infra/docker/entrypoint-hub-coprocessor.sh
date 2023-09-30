#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/nodes/rxjs
screen -d -m NODE_NAME=hub-coprocessor npm start 2>&1 | tee hub-coprocessor.log
sleep infinity
