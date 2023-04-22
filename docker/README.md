The following will git clone chat2flow into the Docker container. So it does not use the local server/client directories.

<br> Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable
<br> `docker-compose build`
<br> `docker-compose up`
<br> Access the client at http://localhost:3000 
There have been issues with Firefox and websocket on localhost, if Firefox does not work, restart or try Chrome.

The following is for development where the server and client directories are mounted into the Docker container.

<br> `docker-compose -f docker-compose-dev.yml build`
<br> `docker-compose -f docker-compose-dev.yml up`
<br> Access the client at http://localhost:3000 
