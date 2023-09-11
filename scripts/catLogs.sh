#!/bin/bash

# This is a way to filter the logs e.g.
# ./catLogs.sh | grep ERROR

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Include common variables
source "$DIR/common.sh"

# Loop through the array and cat the files with added prefix
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    cat "$file" | sed "s/^/$(basename "$file"): /"
  else
    echo "$(basename "$file"): File does not exist"
  fi
done
