#!/bin/sh

cd /app/chat2flow
git pull
cd /app/chat2flow/server
npm install
npm run server &
cd /app/chat2flow/client
npm install
npm start
sleep infinity