The following is for development where the NodeJS Task Processor and React Task Processor directories are mounted in the Docker container.

* `git clone https://github.com/markNZed/taskflow.git`
* `cd taskflow/infra/docker`
* Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable or leave it empty (T@skFlow will then use a "dummy" API)
* `docker-compose build`
* `docker network create taskflow`
* `docker-compose up -d`
* Access the React Task Processor at http://localhost:3000
* NOTE: It can take many minutes for the npm install to complete
* WARNING: There have been issues with Firefox and insecure websocket on localhost, if Firefox does not work, restart Firefox or try Chrome

To interact with the servers:
* `docker exec -it $(docker ps -qf "name=docker_taskflow-demo") /bin/bash`
* Connect to the screen window manager to view the server instances `screen -r`
* There are 5 screen windows, use `Ctrl-c 0` to switch to the first one

To interact with mongodb inside the mongodb container:
* `docker exec -it $(docker ps -qf "name=docker_mongodb") /bin/bash`
* `mongosh -u user` (the default password is "pass")

To interact with mongodb from another container's shell:
* `mongosh -u user --host mongodb` (the default password is "pass")

To interact with redis from another container:
* `redis-cli -h redis-stack-svc`
* Run commands in the redis-cli shell e.g. `redis-stack-svc:6379> info`

# Notes

On the server running the Redis Docker container I ran `sysctl vm.overcommit_memory=1``

## T@skFlow Ntwork Services

Overview of the services/ports:

* 3000 React serving the React Processor app and the React dev server for live updates (path /ws)
* 5000 NodeJS Task Processor
* 5001 Task Hub
* 5002 RxJS Task Processor
* 5003 RxJS Task Hub Coprocessor
* 9229 Task Hub node debug
* 9230 NodeJS Task Processor node debug
* 9231 RxJS Task Processor node debug
* 9232 RxJS Task Hub Coprocessor node debug
* 27017 MongoDB (on mongodb container)
* 6379 Redis (on redis-stack-svc container)
* 8001 RedisInsight (on redis-stack-svc container)

## Dev
This assumes T@skFlow is running behind a proxy on a docker network:

<br> `docker-compose -f docker-compose-dev.yml build`
<br> `docker-compose -f docker-compose-dev.yml up -d`

Because we are running a meta version there are two screen sessions:
`screen -rd meta` and `screen -rd app`

SetupVSCode debugging in .vscode/launch.json

<br>`docker exec -it $(docker ps -qf "name=docker_taskflow_1") /bin/bash`

* `mongosh -u user --host mongodb`
* `use taskflow`
* `show collections`
* `db.tasks.find({"current.user.id": {"$regex": "mark"}})`

There is a meta version which shares MongoDB and Redis, all the other ports increase by 1000:

* 4000 React serving the React Processor app and the React dev server for live updates (path /ws)
* 6000 NodeJS Task Processor
* 6001 Task Hub
* 6002 RxJS Task Processor
* 6003 RxJS Task Hub Coprocessor
* 10229 Task Hub node debug
* 10230 NodeJS Task Processor node debug
* 10231 RxJS Task Processor node debug
* 10232 RxJS Task Hub Coprocessor node debug

The meta version resides in `/meta`
The code for the meta version needs to be modified at `shared/config.mjs` to give a unique DB prefix

## Prod
Eventually this will capture how to deploy T@skFlow in a "production" environment. 

Assumes there is a reverse proxy server, to listen on a single port and forward requests to different ports based on the URL path.

<br> docker-compose -f docker-compose-prod.yml build
<br> docker stack deploy -c docker-stack-compose-taskflow.yml taskflow-prod

If using Cloudflare remember to purge the cache after updating!

docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-nodejs") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-rxjs") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-react") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-hub") /bin/bash
