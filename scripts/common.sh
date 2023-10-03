
#!/bin/bash

# Get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Declare the files array with paths relative to this script's location
files=("$DIR/../nodes/hub/hub-core.log" "$DIR/../nodes/rxjs/hub-consumer.log" "$DIR/../nodes/rxjs/hub-coprocessor.log" "$DIR/../nodes/rxjs/processor-consumer.log")

serverFiles=("nodes/hub/server.js" "nodes/rxjs/server.js")
