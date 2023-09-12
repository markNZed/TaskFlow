#!/bin/bash

# This is a way to filter the logs e.g.
# ./scripts/tailLogs.sh | grep ERROR
# Or to be able to filter the history, from another shell:
# grep ERROR tailLogs.txt 

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Include common variables
source "$DIR/common.sh"

pids=()
pipes=()

cleanup() {
  echo "Cleaning up..."
  for pid in "${pids[@]}"; do
    kill "$pid"
  done

  for pipe in "${pipes[@]}"; do
    rm -f "$pipe"
  done
}

# Call cleanup when the script exits
trap cleanup EXIT

# Loop through the array and create pipes
for file in "${files[@]}"; do
  pipe="/tmp/pipe_$(basename $file)"
  pipes+=("$pipe")
  rm -f "$pipe"
  mkfifo "$pipe"
  tail -f "$file" 2>&1 | sed "s/^/$(basename $file): /" > "$pipe" &
  pids+=("$!")
done

# Loop through pipes and forward each one's output to stdout and /tmp/tailLogs.txt
rm -f /tmp/tailLogs.txt
for pipe in "${pipes[@]}"; do
  cat "$pipe" | tee -a "$DIR/../tailLogs.txt" &
  pids+=("$!")
done

# Wait forever (until the script is killed)
while true; do sleep 1; done

