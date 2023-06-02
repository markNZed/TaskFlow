#!/bin/bash

cd /app/shared
npm install
screen -d -m npm run generate-converter-v02
sleep infinity
