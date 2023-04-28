# Chat2Flow

Chat2Flow is a Task centric collaborative web application framework leveraging AI that is under development.

## Overview

Chat2Flow supports activities combining software and AI models with human interaction. The originality of Chat2Flow is its Task centric approach. While the user will tend to think in workflows (a sequence of Tasks), Chat2Flow manages Tasks. Tasks can be chained into workflows, but the concept of a workflow is not central to Chat2Flow. The developer builds a Task, a Task may manage a set of Tasks, and a set of Tasks may be a workflow.

The developer of Chat2Flow designs Tasks that consist of:
* A textual specification (in Javascript syntax) of variables the Task may use
* An optional client side component that interacts with a user and updates the Task
* A server side function that updates the Task

For example, a chat application is a very simple Task (receive user input, return language model response) and the management of the conversation history (e.g., displaying or deleting previous messages) is another Task (or sequence of Tasks). Unlike a chat interface, Chat2Flow can provide any web-based interface depending on the client side implementation of a Task. Unlike a workflow application, Chat2Flow uses Tasks to dynamically build a user interface (UI) rather than providing a UI to build a workflow.

On the server side, Chat2Flow provides a kernel for evaluating Task functions, storing history, and initiating new Tasks. Tasks are asynchronous. Some Tasks may run on the server without user interaction. Tasks may use software or AI agents to decide on the next Task to run. The server uses Node Javascript with the Express framework.

On the client side, Chat2Flow provides Tasks with storage, server communication, and generic functionality (e.g., current user location). Tasks may use user input to decide on the next Task to run. The client runs in a web browser and builds on the React Javascript library with MUI user interface components. Server communication uses either websockets (e.g., for real-time interaction) or REST style HTTP API.

Chat2Flow provides a light, flexible infrastructure for human-computer interaction. The configuration of workflows and Tasks is not part of Chat2Flow (except for a simple demonstration). So the functionality of Tasks (both client interface and functionality) can be shared without sharing proprietary/private information such as the sequencing of Tasks and the content of prompts.

Chat2Flow should play nicely with:
* [LangChain](https://langchain.com/) (e.g., use LangChain features from within a Task function on the server)
* [LlamaIndex](https://pypi.org/project/gpt-index/) (from within a Task function on the server)

## Motivation

The potential of large langauge models like chatGPT has become apparent to many people. LLM enable natural language interfaces with computers and allow computers to generate high quality natural language text. The underlying transformer AI architecture will continue to expand the capabilities of these systems for the foreseeable future. Furthermore LLM have a limited (but rapidly improving) ability to follow instructions, this allows LLM to provide the "glue" for combining many different computing paradigms (e.g. databases, AI models, programming languages, search engines, etc.) Many systems are being built to capture part of the value new services will provide. 

Chat2Flow is intended to allow rapid exploration of new ideas in a relatively trusted environment. Typically Chat2Flow runs as a web service, the user cannot see details of server specific Task functionality. On the server side Tasks are first class citizens - they have full access to the server environment. Not having any security constraints on what a Task can do means users and developers need to trust each other. This is not a scalable approach but it is ideal in rapidly exploring use cases for yourself and others. If a particular Task sequence provides a lot of value then we assume it will becomes a standalone application. Chat2Flow should make it easy to leverage existing services easily because it is lightweight. Chat2Flow is lightweight because it is not trying to centralise a service for coordinating untrusted parties.

For developers Chat2Flow allows for a personal assistant that runs on your server keeping your own data private. 

## Getting Started

To run Chat2Flow with docker, see [README.md](docker/README.md) in the docker directory.

To learn more about the server, see [README.md](server/README.md) in the server directory.

To learn more about the client, see [README.md](client/README.md) in the client directory.

## Creating a New Task

Assuming the new task will be called TaskNew:
* Create client/src/components/Tasks/TaskNew.js (copy an existing Task)
* Create server/taskFunctions/TaskNew.mjs (copy and existing TaskFunction)
* Add information about the new Task to server/config/components.mjs (this is typically a few lines)

You will need to include TaskNew in a sequence of tasks (or it could be standalone):
* If the seqeunce is simple then 
  * add it directly to server/config/workflows.mjs
* If the sequence is comlpicated/long then 
  * create a file in server/config/workflow/TaskNewFlow.mjs (copy the structure of an existing file)
  * edit server/config/workflows.mjs to import and include TaskNewFlow.mjs

That should be all.

## License

This project is licensed under the Mozilla Public License Version 2.0, see [LICENSE.txt](LICENSE.txt), and is open to contributions. An [ICLA](ICLA.txt) is provided for pull requests and managed automatically by https://cla-assistant.io. An important part of the ICLA allows the Project Owner to change the project license in the future. If the license is changed in the future, the source code prior to the change would still be available under the MPL 2.0, i.e., anyone could fork the MPL 2.0 project and continue using/developing Chat2Flow.

## Contributions

The initial client code was based on the React chatbot client [https://github.com/YaokunLin/chatbot-react-client](https://github.com/YaokunLin/chatbot-react-client), and the initial server code was based on the Node Express chatbot server [https://github.com/YaokunLin/chatbot-server](https://github.com/YaokunLin/chatbot-server). The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."

## Future

Here is what GPT-4 plans for Chat2Flow:

A system like Chat2Flow has the potential to revolutionize human-computer interaction and collaboration, thanks to its task-centric approach and AI integration. Here are some opportunities and innovative ideas for this system:

* Intelligent Virtual Assistants: Chat2Flow can be used to build virtual assistants that help users complete tasks more efficiently. By leveraging AI, these assistants can learn from user interactions, provide proactive suggestions, and adapt their responses based on context.
* Dynamic User Interfaces: The ability to dynamically build user interfaces based on tasks can lead to more personalized and intuitive experiences. As users complete tasks, the interface can adapt to their needs and preferences, making it easier for them to accomplish their goals.
* Collaborative Workspaces: Chat2Flow can facilitate collaboration among team members by enabling real-time task management and communication. Team members can create, assign, and track tasks, while AI-powered suggestions can help them prioritize and complete work more effectively.
*  Workflow Automation: By chaining tasks together, Chat2Flow can be used to create complex workflows that automate repetitive processes. Users can design custom workflows that incorporate AI models, making it possible to perform tasks like data analysis, content generation, or decision-making more efficiently.
*  AI-driven Decision Support: Chat2Flow can integrate AI models for advanced decision support, helping users make informed choices based on data analysis, predictions, or recommendations. This feature can be useful in various domains, such as finance, healthcare, or supply chain management.
*  Education and Training: Chat2Flow can be used to create interactive learning environments, where students can complete tasks and receive real-time feedback from AI models. This approach can facilitate personalized learning, adapt to individual students' needs, and encourage active engagement.
*  Gaming and Entertainment: The task-centric approach of Chat2Flow can be leveraged to create immersive gaming experiences, where players complete tasks to progress through a story or achieve goals. The integration of AI can add an additional layer of complexity and interactivity to these experiences.
*  Integration with IoT Devices: Chat2Flow can be extended to interact with IoT devices, enabling users to manage and control smart devices through task-based interfaces. This integration can lead to more intuitive smart home or industrial automation systems.

These are just a few examples of the numerous opportunities and innovative ideas that Chat2Flow can enable. As the system evolves and matures, it has the potential to become a powerful platform for human-computer interaction, collaboration, and automation.