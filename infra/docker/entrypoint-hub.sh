#!/bin/bash

cd /app/hub
npm install
screen -d -m npm start 2>&1 | tee hub.log
sleep infinity
