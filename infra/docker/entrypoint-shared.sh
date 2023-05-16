#!/bin/bash

cd /app/taskflow/shared
npm install
screen -d -m npm run generate-converter-v02
sleep infinity
