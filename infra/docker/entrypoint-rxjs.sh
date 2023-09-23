#!/bin/bash

cd /app/processor/rxjs
npm install
screen -d -m ENVIRONMENT=rxjs npm start 2>&1 | tee rxjs.log
sleep infinity
