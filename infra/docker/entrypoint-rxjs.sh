#!/bin/bash

cd /app/processor/nodejs
npm install
screen -d -m npm start
sleep infinity
