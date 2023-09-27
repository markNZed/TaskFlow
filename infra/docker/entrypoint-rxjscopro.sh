#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/nodes/rxjs
screen -d -m NODE_NAME=hubcopro npm start 2>&1 | tee hubcopro.log
sleep infinity
