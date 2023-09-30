#!/bin/bash

cd /app/nodes/rxjs
npm install
screen -d -m NODE_NAME=hubconsumer npm start 2>&1 | tee hubconsumer.log
sleep infinity
