#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/processor/rxjs
screen -d -m COPROCESSOR=true npm start 2>&1 | tee rxjscopro.log
sleep infinity
