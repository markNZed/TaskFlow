chat2flow is a task centric collaborative web application leveraging AI that is under development.

To run with docker:
<br> `cd docker`
<br> Add your OPENAI_API_KEY to docker-compose.yml file or set that environment variable
<br> `docker-compose build`
<br> `docker-compose up`
<br> Access the client at http://localhost:3000 
There have been issues with Firefox and websocket on localhost, if Firefox does not work, restart or try Chrome.

To learn more about the server see [README.md](server/README.md)

To learn more about the client see [README.md](client/README.md)

The initial client code was based on the React client https://github.com/YaokunLin/chatbot-react-client and the initial server code was based on the Node Express server https://github.com/YaokunLin/chatbot-server The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."
