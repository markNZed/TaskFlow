#!/bin/sh

cd /app/taskflow/nodejsProcessor
npm install
screen -d -m npm run server

cd /app/taskflow/browserProcessor
npm install
screen -d -m npm start

sleep infinity