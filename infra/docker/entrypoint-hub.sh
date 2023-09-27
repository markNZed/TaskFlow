#!/bin/bash

cd /app/nodes/hub
npm install
screen -d -m NODE_NAME=hub PORT=3000 npm start 2>&1 | tee hub.log
sleep infinity
