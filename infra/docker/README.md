The following is for development where the Nodes run in a Docker container.

* `git clone https://github.com/markNZed/taskflow.git`
* `cd TaskFlow/infra/docker`
* To set the OPENAI_API_KEY
  * Add it to a .env file in this directory e.g.
    * OPENAI_API_KEY=your-api-key
  * Or leave it empty (T@skFlow will then use a "dummy" API)
  * Or set it in nodes/rxjs/.env
* `docker-compose build`
* `docker network create taskflow`
* To share the directory permissions we seet USER_ID and GROUP_ID before running docker-compose:
  * `USER_ID=$(id -u) GROUP_ID=$(id -g) docker-compose up -d`
* Access the React Processor at http://localhost:3000
* NOTE: It can take many minutes for the npm install to complete
* WARNING: There have been issues with Firefox and insecure websocket on localhost, if Firefox does not work, restart Firefox or try Chrome

To interact with the servers:

* If using docker-compose V2 then the name will be `docker-taskflow-demo` in V1 `docker_taskflow-demo`
* `docker exec -it $(docker ps -qf "name=docker-taskflow-demo") /bin/bash`
* Connect to the screen window manager to view the server instances `screen -r`
* There are 6 screen windows, use `Ctrl-c 0` to switch to the first one

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

Overview of the ports:

* 3000 React serving the React Processor app and the React dev server for live updates (path /ws)
* 5000 RxJS Processor Consumer
* 5001 Hub Core
* 5002 RxJS Hub Consumer
* 5003 RxJS Hub Coprocessor
* 6379 Redis (in redis-stack-svc container)
* 8000 Unstructured (in unstructured container)
* 8001 RedisInsight (in redis-stack-svc container)
* 8080 Weaviate (in weaviate container)
* 9229 Hub Core debug
* 9230 RxJS Processor Consumer debug
* 9231 RxJS Hub Consumer debug
* 9232 RxJS Hub Coprocessor node debug
* 27017 MongoDB (in mongodb container)

## Mark's Dev

This assumes T@skFlow is running behind a proxy on a docker network:

`docker-compose -f docker-compose-dev.yml build`
`docker-compose -f docker-compose-dev.yml up -d`

Because we are running a meta version there are two screen sessions:
`screen -rd meta` and `screen -rd app`

SetupVSCode debugging in .vscode/launch.json

`docker exec -it $(docker ps -qf "name=docker_taskflow_1") /bin/bash`

* `mongosh -u user --host mongodb`
* `use taskflow`
* `show collections`
* `db.tasks.find({"current.user.id": {"$regex": "mark"}})`

There is a meta version which shares MongoDB and Redis, all the other ports increase by 1000:

* 4000 React serving the React Processor app and the React dev server for live updates (path /ws)
* 6000 RxJS NodeJS Processor
* 6001 Hub
* 6002 RxJS Processor
* 6003 RxJS Hub Coprocessor

The meta version resides in `/meta`
The code for the meta version needs to be modified at `shared/config.mjs` to give a unique DB prefix

## Prod

Eventually this will capture how to deploy T@skFlow in a "production" environment.

Assumes there is a reverse proxy server, to listen on a single port and forward requests to different ports based on the URL path.

`docker-compose -f docker-compose-prod.yml build  docker stack deploy -c docker-stack-compose-taskflow.yml taskflow-prod`

If using Cloudflare remember to purge the cache after updating!

docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-hub-consumer") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-hub-coprocessor") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-processor-consumer") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-react") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-hub") /bin/bash
