#!/bin/sh

cd /app/taskflow/browserProcessor
npm install
screen -d -m npm start
sleep infinity
