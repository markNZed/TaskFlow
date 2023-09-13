#!/bin/bash

cd /app/processor/nodejs
npm install
screen -d -m npm start 2>&1 | tee nodejs.log
sleep infinity
