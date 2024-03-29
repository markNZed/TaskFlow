# Debug Strategies

Following the setup of T@askFlow in a docker container as per [README.md](infra/docker/README.md) it can be difficult to debug issues.

The following assumes you are using VS Code as an IDE. There are several extensions which are of use:
* Dev Containers (run VS Code remotely in a Docker container)
* Remote - SSH (connect to a remote server using SSH and from there we can use Dev Containers to connect to a Docker container)
* SQLite Viewer (view SQLite database files as tables)
* Codeium AI (chat + search + code completion)
* Print (add a print option to VS Code)
* Prettier (code formatting)

Using VS Code
* From the VS Code command palette, create a terminal tab: Terminal Create new Terminal in Editor Area. 
* From the new terminal start screen: `screen -rd`.
  * There are multiple servers running in the Docker container and each has a window running in the [screen](https://linuxize.com/post/how-to-use-linux-screen/) application.
    * The output of each server can be viewed in the screen window (keyboard shortcuts allow navigating beween screens e.g. `Ctrl-a X` where X is the number of the terminal e.g. `Ctrl-a 1`).
    * The output of the servers are also logged into files and these can be opened in VS Code (which will update the contents in real-time and allows for searching).
    * Open the logs as tabs in VS Code:
        * /app/nodes/hub/hub.log
        * /app/nodes/rxjs/hub-consumer.log
        * /app/nodes/rxjs/hub-coprocessor.log
        * /app/nodes/rxjs/processor-consumer.log
* The node servers (e.g. Hub, RxJS, NodeJS) run in debug mode so breakpoints can be set in VS Code.

* The `/app/shared` directory is soft linked from `/app/nodes/hub/src/shared`, `/app/nodes/react/src/shared`, `/app/nodes/rxjs/src/shared`. In that directory we have the JSON schema for the Task object, `utils.mjs`, and XState finite state machine definitions in `/app/shared/FSM`.
* The React procssor runs in a web browser (preference for Firefox).
* From the Javascript console in Web Developer tools the current Task objects can be read in the variable `window.tasks`.
* The RxJS processor can use a dummy API (to avoid wasting money on OpenAI API calls), set `DUMMY_OPENAI=true` in `/app/nodes/rxjs/.env`.
* The System > Log Task provides insights into the sequence of task messages that have gone through coprocessing on the Hub.
* The script `./scripts/restartServers.sh` provides a simple way to restart all the servers during development (by touching the server.js files).
* The script `./scripts/restartLogs.sh` truncates all log files.
* The script `./scripts/filerLogs.sh` combines all logs into an output stream that can be filtered e.g. `./scripts/tailLogs.sh | grep init`
* The script `./scripts/filerLogs.sh` also creates `tailLogs.txt` which is the merge of all logs.
* The `nodes/hub/src/configdata.mjs` can generate a file `/tmp/tasks.json` which can be copied using a linux shell to `/app/dead` so it can be loaded into VS Code but ignored by git. This shows the task object after initialisation. The `nodes/hub/src/configdata.mjs` module uses that file to perform a diff and print to the screen/log which can be a way to see the impacts of changes to the tasks configuration. The diff can be "reset" by deleting `/tmp/tasks.json`.
* here is a debugTask function in `shared/utils.mjs` that is called from strategic locations with the Task object. From within that function we can add logic to debug and add tracing of particular "aspects" of functionality.
* The EMPTY_ALL_DB variable in `shared/config.mjs` can be set to true and then upon restarting a Task Node it should empty its DBs. This can help during debug by starting the systme in a known state. Hoever if this is enabled and only one of the Task NOdes restarts (e.g. due to nodemon monitoring) then active Tasks will get out of sync. The script `./restartServers.sh` can restart everything in one step.
* nodes/rxjs/scripts/runFunction.mjs allows for standalone testing of Task Functions

## Tips

### Firefox/Browser

* Regular expressions in "Filter Output" of Javascript console: wrap your regex pattern in forward slashes (/).
* React Dev Tools
* console.log() can display variables in a pretty format but be careful when logging references. The references can be updated after the console.log function is called and the updated value is logged depedning on when in the event loop the console.log is run. To avoid issues with this make a deep copy of references e.g. `console.log("x", utils.deepClone(X))`.
* Enable "Show Timestamps" in the JS Console helps find entries with the filter and then view them in context (after removing the filter).

### VS Code

* To view the log files install the ANSI Color extension then preview the file to see prettified view
* The log files can be "cleared" without restartin the server e.g. `truncate -s 0 nodes/hub/hub.log`
* In Preferences there is an option "Files: Readonly From Permissions" which will respect file system permissions - this is useful for respecting logs as read only
* It does support multi-line regex `(\s+)services: \[([\s\S\n]+?)\]`
* Running on a remote machine in a Docker container with a mount for the /root directory can cause problems for extensions because the disk is too slow. Better to use a location for ~/.vscode-server that is not on the volume. Set remote.SSH.serverInstallPath e.g. `server1 /tmp`
### Linux

* Find the process using a port 5000 `netstat -tulnp | grep :5000`

### Forever

* If `forever list` shows a process as `STOPPED` and you want to remove it from the list then run `forever stop PID` which will error but will also remove it from the list.
