The following is for development where the nodejsProcessor and browserProcessor directories are mounted to the Docker container.

<br> git clone https://github.com/markNZed/chat2flow.git
<br> cd chat2flow/infra/docker
<br> Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable
<br> `docker-compose build`
<br> `docker-compose up`
<br> Access the browserProcessor at http://localhost:3000 
There have been issues with Firefox and websocket on localhost, if Firefox does not work, restart or try Chrome.

# Notes

Eventually this will capture how to deploy T@skFlow in a "production" environment. 

<br> docker-compose -f docker-compose-prod.yml build
<br> docker-compose -f docker-compose-prod.yml up

Remember to purge the cloudflare cache after updating on prod.

npm run build
npm install -g serve
cd build
serve -s -l 3000

screen
