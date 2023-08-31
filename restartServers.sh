#!/bin/bash

# This is a quick way to restart all the servers during dev
# They are using nodemon so they will see the file updating and restart

files=("hub/hub.log" "processor/nodejs/nodejs.log" "processor/rxjs/rxjs.log" "processor/rxjs/rxjscopro.log")

# Loop through the array and touch each file
for file in "${files[@]}"; do
  rm -f "$file"
  echo "Removed $file"
done

files=("hub/server.js" "processor/nodejs/server.js" "processor/rxjs/server.js")

# Loop through the array and touch each file
for file in "${files[@]}"; do
  touch "$file"
  echo "Touched $file"
done
