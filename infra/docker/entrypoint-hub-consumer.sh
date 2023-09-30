#!/bin/bash

cd /app/nodes/rxjs
npm install
screen -d -m NODE_NAME=hub-consumer npm start 2>&1 | tee hub-consumer.log
sleep infinity
