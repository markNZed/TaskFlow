#!/bin/bash

cd /app/nodes/react
npm install
screen -d -m npm start 2>&1 | tee react.log
sleep infinity
