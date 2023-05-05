#!/bin/sh

cd /app/chat2flow/nodejsProcessor
npm install
npm run server &
cd /app/chat2flow/browserProcessor
npm install
npm start &
sleep infinity
