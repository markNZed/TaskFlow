The following is for development where the NodeJS Task Processor and React Task Processor directories are mounted in the Docker container.

* `git clone https://github.com/markNZed/taskflow.git`
* `cd taskflow/infra/docker`
* Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable or leave it empty (T@skFlow will then use a "dummy" API)
* `docker-compose build`
* `docker-compose up -d`
* Access the React Task Processor at http://localhost:3000 
* NOTE: It can take many minutes for the npm install to complete
* WARNING: There have been issues with Firefox and insecure websocket on localhost, if Firefox does not work, restart Firefox or try Chrome

To interact with the servers:
* `docker exec -it $(docker ps -qf "name=docker_taskflow-demo") /bin/bash`
* Connect to the screen window manager to view the server instances `screen -r`
* There are 5 screen windows, use `Ctrl-c 0` to switch to the first one

# Notes

## Dev
This assumes T@skFlow is running behind a proxy on a docker network:

<br> docker-compose -f docker-compose-dev.yml build
<br> docker-compose -f docker-compose-dev.yml up -d

SetupVSCode debugging in .vscode/launch.json

docker exec -it $(docker ps -qf "name=docker_taskflow_1") /bin/bash

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
