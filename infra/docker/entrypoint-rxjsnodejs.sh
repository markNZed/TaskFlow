#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/nodes/rxjsnodejs
screen -d -m NODE_NAME=three npm start 2>&1 | tee three.log
sleep infinity
