
#!/bin/bash

# Get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Declare the files array with paths relative to this script's location
files=("$DIR/../nodes/hub/hub.log" "$DIR/../nodes/rxjs/hubconsumer.log" "$DIR/../nodes/rxjs/hubcopro.log" "$DIR/../nodes/rxjs/rxjs.log")

serverFiles=("nodes/hub/server.js" "nodes/rxjs/server.js")
