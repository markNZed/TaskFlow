#!/bin/bash

cd /app/nodes/hub
npm install
screen -d -m NODE_NAME=hub-core PORT=3000 npm start 2>&1 | tee hub-core.log
sleep infinity
