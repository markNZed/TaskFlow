
#!/bin/bash

# Get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Declare the files array with paths relative to this script's location
files=("$DIR/../hub/hub.log" "$DIR/../processor/rxjs/one.log" "$DIR/../processor/rxjs/two.log" "$DIR/../processor/rxjs/three.log")

serverFiles=("hub/server.js" "processor/rxjs/server.js")
