The following is for development where the server and client directories are mounted into the Docker container.

<br> git clone https://github.com/markNZed/chat2flow.git
<br> cd chat2flow/docker
<br> Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable
<br> `docker-compose build`
<br> `docker-compose up`
<br> Access the client at http://localhost:3000 
There have been issues with Firefox and websocket on localhost, if Firefox does not work, restart or try Chrome.

<br> docker-compose -f docker-compose-prod.yml build
<br> docker-compose -f docker-compose-prod.yml up

npm run build
npm install -g serve
cd build
serve -s -l 3000

screen
