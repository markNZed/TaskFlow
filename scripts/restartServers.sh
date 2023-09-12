#!/bin/bash

# This is a quick way to restart all the servers during dev
# They are using nodemon so they will see the file updating and restart

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Include common variables
source "$DIR/common.sh"

source "$DIR/restartLogs.sh"

# Loop through the array and touch each file
for file in "${serverFiles[@]}"; do
  touch "$file"
  echo "Touched $file"
done
