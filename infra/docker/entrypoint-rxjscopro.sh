#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/processor/rxjs
screen -d -m NODE_NAME=two npm start 2>&1 | tee two.log
sleep infinity
