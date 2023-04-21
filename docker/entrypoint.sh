#!/bin/sh

cd /app/chat2flow/server
npm run server &
cd /app/chat2flow/client
npm start
sleep infinity