chat2flow is a task centric collaborative web application leveraging AI.

To run with docker:
`cd docker`
Add your OPENAI_API_KEY to docker-compose.yml or set that environment variable
`docker-compose build`
`docker-compose up`
Access the client at http://localhost:3000

To learn more about the server see [README.md](server/README.md)

To learn more about the client see [README.md](client/README.md)

The initial client code was based on the React client https://github.com/YaokunLin/chatbot-react-client and the initial server code was based on the Node Express server https://github.com/YaokunLin/chatbot-server The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."
