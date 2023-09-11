#!/bin/bash

# This is a quick way to restart all the servers during dev
# They are using nodemon so they will see the file updating and restart

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Include common variables
source "$DIR/common.sh"

# Loop through the array and touch each file
for file in "${files[@]}"; do
  truncate -s 0 "$file"
  echo "Truncate $file"
done

truncate -s 0 "$DIR/../tailLogs.txt"
