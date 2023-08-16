#!/bin/bash

cd /app/processor/react
npm install
screen -d -m npm start 2>&1 | tee react.log
sleep infinity
