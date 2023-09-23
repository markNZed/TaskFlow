#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/processor/rxjsnodejs
screen -d -m ENVIRONMENT=nodejs npm start 2>&1 | tee rxjsnodejs.log
sleep infinity
