#!/bin/bash

# We do not npm install here because we can assume that rxjs is doing that
cd /app/processor/rxjs
screen -d -m npm start-copro 2>&1 | tee rxjs-copro.log
sleep infinity
