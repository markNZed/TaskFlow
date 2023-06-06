The following is for development where the NodeJS Task Processor and React Task Processor directories are mounted to the Docker container.

<br> git clone https://github.com/markNZed/taskflow.git
<br> cd taskflow/infra/docker
<br> Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable
<br> `docker-compose build`
<br> `docker-compose up`
<br> Access the React Task Processor at http://localhost:3000 
WARNING: There have been issues with Firefox and insecure websocket on localhost, if Firefox does not work, restart Firefox or try Chrome.

# Notes

## Dev
This assumes T@skFlow is running behind a proxy on a docker network:

<br> docker-compose -f docker-compose-dev.yml build
<br> docker-compose -f docker-compose-dev.yml up -d

SetupVSCode debugging in .vscode/launch.json

docker exec -it $(docker ps -qf "name=docker_taskflow_1") /bin/bash

## Prod
Eventually this will capture how to deploy T@skFlow in a "production" environment. 

Assumes there is a reverse proxy server, to listen on a single port and forward requests to different ports based on the requested URL.

<br> docker-compose -f docker-compose-prod.yml build
<br> docker stack deploy -c docker-stack-compose-taskflow.yml taskflow-prod

Remember to purge the cloudflare cache after updating on prod.

docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-nodejs") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-react") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-hub") /bin/bash
