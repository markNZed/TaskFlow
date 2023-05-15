The following is for development where the nodejsProcessor and browserProcessor directories are mounted to the Docker container.

<br> git clone https://github.com/markNZed/taskflow.git
<br> cd taskflow/infra/docker
<br> Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable
<br> `docker-compose build`
<br> `docker-compose up`
<br> Access the browserProcessor at http://localhost:3000 
There have been issues with Firefox and websocket on localhost, if Firefox does not work, restart or try Chrome.

# Notes

## Prod
Eventually this will capture how to deploy T@skFlow in a "production" environment. 

!!Should not mount the nodejs dir in the browser and vice-versa

Set up a reverse proxy server, to listen on a single port and forward requests to different ports based on the requested URL.

<br> docker-compose -f docker-compose-prod.yml build
<br> docker stack deploy -c docker-stack-compose-taskflow.yml taskflow-prod

Remember to purge the cloudflare cache after updating on prod.

docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-nodejs") /bin/bash
docker exec -it $(docker ps -qf "name=taskflow-prod_taskflow-browser") /bin/bash

## Dev
This assumes T@skFlow is running behind a proxy on a docker network for dev:

<br> docker-compose -f docker-compose-dev.yml build
<br> docker-compose -f docker-compose-dev.yml up -d

docker exec -it $(docker ps -qf "name=docker_taskflow_1") /bin/bash
