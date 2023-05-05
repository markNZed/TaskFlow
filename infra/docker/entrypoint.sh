#!/bin/sh

cd /app/taskflow/nodejsProcessor
npm install
npm run server &
cd /app/taskflow/browserProcessor
npm install
npm start &
sleep infinity
