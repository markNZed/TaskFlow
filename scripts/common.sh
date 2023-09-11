
#!/bin/bash

# Get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Declare the files array with paths relative to this script's location
files=("$DIR/../hub/hub.log" "$DIR/../processor/nodejs/nodejs.log" "$DIR/../processor/rxjs/rxjs.log" "$DIR/../processor/rxjs/rxjscopro.log")

serverFiles=("hub/server.js" "processor/nodejs/server.js" "processor/rxjs/server.js")
