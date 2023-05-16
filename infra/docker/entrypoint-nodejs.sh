#!/bin/bash

cd /app/taskflow/processor/nodejs
npm install
screen -d -m npm start
sleep infinity
