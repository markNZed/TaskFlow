#!/bin/bash

cd /app/taskflow/hub
npm install
screen -d -m npm start
sleep infinity
