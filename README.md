# T@skFlow

T@skFlow is a Task centric collaborative framework for leveraging AI. It is under development.

# Overview

T@skFlow combines software and AI models and human interaction. Tasks can be chained into workflows. A developer creates a Task's functionality, a Task may manage a set of Tasks, and a set of Tasks may be a workflow.

![T@skFlow Diagram](Task.drawio.svg)

T@skFlow is intended to provide a flexible infrastructure for human-computer interaction. The configuration of Tasks is not part of T@skFlow (except for demonstration purposes). The functionality of individual Tasks can be shared without sharing proprietary/private configuration information such as the sequencing of Tasks and the content of prompts.

T@skFlow will play nicely with:
* [LangChain](https://langchain.com/) (e.g., use LangChain features from within a Task function on the NodeJS Task Processor)
* [LlamaIndex](https://pypi.org/project/gpt-index/) (from within a Task function on the NodeJS Task Processor)

## Task

Tasks consist of:
* Task Definition that conforms to a generic Task schema
  * In Task Definition may reference data not provided by T@skFLow
* Task Function available in one or more Task Environment(s)
  * A Task Functions may use API services not provided by T@askFlow

For example, a chat application is a simple Task (receive user input, return language model response) and the management of the conversation history (e.g., displaying or deleting previous messages) is another Task (or sequence of Tasks). Unlike a chat interface, T@skFlow can provide any web-based interface depending on the implementation of a Task. Unlike a workflow application, T@skFlow uses Tasks to dynamically build a user interface (UI) rather than providing a UI to build a workflow.

The concpet of **Task Instance** refers to a particular Task Definition object.

The concept of **Task Context** refers to the data and functionality beyond the Task Definition and Task Function that is used by the Task Instance.  

## Task Processor

Tasks are processed by Task Processors, there are two Task Processors implemented in T@skFlow: NodeJS Task Processor and React Task Processor. The NodeJS Task Processor runs on a server and the React Task Processor runs in a web browser. The NodeJS Task Processor and React Task Processor communicate using websockets or REST style HTTP API. The NodeJS Task Processor and React Task Processor are implemented in Javascript.

On the NodeJS Task Processor side, T@skFlow provides a kernel for evaluating Task functions, storing history, and initiating new Tasks. Tasks are asynchronous. Some Tasks may run on the NodeJS Task Processor without user interaction. Tasks may use software/AI to decide on the next Task to start. The NodeJS Task Processor uses Node Javascript and the Express framework.

On the React Task Processor (user interface) side, T@skFlow provides Tasks with storage, NodeJS Task Processor communication, and generic functionality (e.g., current user location). Tasks may use user input to decide on the next Task to start. The React Task Processor runs in a web browser using the React Javascript library with MUI user interface components. Server communication uses either websockets (e.g., for real-time interaction) or REST style HTTP API.

### Task Environment

The Task Processor provides a Task Environment for the Task to run in. The NodeJS Task Processor currently provides a Node Javascript environment. The React Task Processor currently provides a React Javascript environment. Eventually the Task Environment will be decoupled from the Task Processor so a Task Processor can provide multiple Task Environments.

### SubTask

A SubTask expects to be passed a Task instance and returns the same Task instance. The SubTask assumes it is called from a Task. The SubTask runs within a Task Environment (i.e., it is part of the Task Processor) and provides a standard interface for Task functionality that is shared across many Tasks. The SubTask may return asynchronously e.g., the response field could include a promise in Javascript.

There may be side-effects from a SubTask, for example, it may return results to a Task on another Task Processor using a WebSocket.

## Task Hub

Information shared between Task Processors is maintained in the Task Hub which also acts as a router, see [README.md](hub/README.md) 

# Motivation

The potential of large langauge models like chatGPT has become apparent to many people. LLM enable natural language interfaces with computers and allow computers to generate high quality natural language text. The underlying transformer architecture will continue to evolve and expand the capabilities of these systems for the foreseeable future. Furthermore LLM have a limited (but rapidly improving) ability to follow instructions, this allows LLM to provide the "glue" for combining many different computing paradigms (e.g. databases, AI models, programming languages, search engines, etc.) Many systems are being built to capture parts of the value new services will provide.

The purpose of T@skFlow is to explore new ways of building and interacting with computers while assuming that AI will play a central role. If T@skFlow can amplify humans such that their abilities in a particular domain far exceed what most humans with most other systems are capable of then T@skFlow becomes a lever to propose new social/business practices. This is inline with the view of a technology of ethics i.e., using technology to prefer certain moral outcomes over other possible outcomes. T@skFlow is intended to support a new way of thinking.

T@skFlow is intended to allow rapid exploration of new ideas in a relatively trusted environment. On the NodeJS Task Processor side Tasks are first class citizens - they have full access to the NodeJS Task Processor environment. Not having any security constraints on what a Task can do means users and developers need to trust each other. This is not a scalable approach but it is ideal in rapidly exploring use cases for yourself and others. If a particular Task sequence provides a lot of value then it will likely become a standalone application. T@skFlow should make it easy to leverage existing services. T@skFlow is lightweight because it is not trying to centralise a service for coordinating untrusted parties.

For developers T@skFlow could become a personal assistant that runs on your computer keeping your data local.

# Getting Started

To run T@skFlow with docker, see [README.md](infra/docker/README.md) in the docker directory.

To learn more about the NodeJS Task Processor, see [README.md](NodeJS Task Processor/README.md) in the NodeJS Task Processor directory.

To learn more about the React Task Processor, see [README.md](React Task Processor/README.md) in the React Task Processor directory.

To learn more about the Task object, see [README.md](shared/README.md) in the shared directory.

## Creating a New Task

Imagine a new task that will be called TaskNew:
* Create React Task Processor/src/components/Tasks/TaskNew.js (copy an existing Task)
* Add the license header to the file
* Create NodeJS Task Processor/taskFunctions/TaskNew.mjs (copy and existing TaskFunction)
* Add the license header to the file
* Add information about the new Task to NodeJS Task Processor/config/tasktemplates.mjs

You will need to include TaskNew in a sequence of tasks (or it could be standalone):
* If the seqeunce is simple then 
  * add it directly to NodeJS Task Processor/config/taskflows.mjs
* If the sequence is complicated/long then 
  * create a file in NodeJS Task Processor/config/taskflow/TaskNewFlow.mjs (copy the structure of an existing file)
  * Add the license header to the file
  * edit NodeJS Task Processor/config/taskflows.mjs to import and include TaskNewFlow.mjs

### Task Patterns

**How to reference values from previous Tasks ?**

Available in the "output" object of the previous Task Instance. Another option is to provide data from previous tasks in the "input" object. In either case the data could be a reference rather than the values. 

# Coding Guidelines

Code is currently formatted using Prettier defaults.

# License

This project is licensed under the Mozilla Public License Version 2.0, see [LICENSE.txt](LICENSE.txt), and is open to contributions. An [ICLA](ICLA.txt) is provided for pull requests and managed automatically by https://cla-assistant.io. Contributions are licensed for use through the ICLA i.e., contributors continue to own their contributions. An important part of the ICLA allows the Project Owner to change the project license in the future. If the license is changed in the future, the source code prior to the change would still be available under the MPL 2.0, i.e., anyone could fork the MPL 2.0 project and continue using/developing T@skFlow.

## Contributors

The initial React Task Processor code was based on the React chatbot client [https://github.com/YaokunLin/chatbot-react-React Task Processor](https://github.com/YaokunLin/chatbot-react-React Task Processor), and the initial NodeJS Task Processor code was based on the Node Express chatbot server [https://github.com/YaokunLin/chatbot-NodeJS Task Processor](https://github.com/YaokunLin/chatbot-NodeJS Task Processor). The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."

# Future

Many systems are trying to capture value and this often limits the solution in some way. For example, many businesses would like to have influence over the community using their infrastructure and eventually monetize this. Proprietary system tend to seek to lock-in users. T@skFlow is not not intended to capture value, it is intended to enable users to capture value. It is assumed that if this value is significant then T@skFlow will be given resources to further amplify that value creation.

Here is what GPT-4 has to say about T@skFlow:

A system like T@skFlow has the potential to revolutionize human-computer interaction and collaboration, thanks to its task-centric approach and AI integration. Here are some opportunities and innovative ideas for this system:

* **Intelligent Virtual Assistants**: T@skFlow can be used to build virtual assistants that help users complete tasks more efficiently. By leveraging AI, these assistants can learn from user interactions, provide proactive suggestions, and adapt their responses based on context.
* **Dynamic User Interfaces**: The ability to dynamically build user interfaces based on tasks can lead to more personalized and intuitive experiences. As users complete tasks, the interface can adapt to their needs and preferences, making it easier for them to accomplish their goals.
* **Collaborative Workspaces**: T@skFlow can facilitate collaboration among team members by enabling real-time task management and communication. Team members can create, assign, and track tasks, while AI-powered suggestions can help them prioritize and complete work more effectively.
*  **Taskflow Automation**: By chaining tasks together, T@skFlow can be used to create complex taskflows that automate repetitive processes. Users can design custom taskflows that incorporate AI models, making it possible to perform tasks like data analysis, content generation, or decision-making more efficiently.
*  **AI-driven Decision Support**: T@skFlow can integrate AI models for advanced decision support, helping users make informed choices based on data analysis, predictions, or recommendations. This feature can be useful in various domains, such as finance, healthcare, or supply chain management.
*  **Education and Training**: T@skFlow can be used to create interactive learning environments, where students can complete tasks and receive real-time feedback from AI models. This approach can facilitate personalized learning, adapt to individual students' needs, and encourage active engagement.
*  **Gaming and Entertainment**: The task-centric approach of T@skFlow can be leveraged to create immersive gaming experiences, where players complete tasks to progress through a story or achieve goals. The integration of AI can add an additional layer of complexity and interactivity to these experiences.
*  **Integration with IoT Devices**: T@skFlow can be extended to interact with IoT devices, enabling users to manage and control smart devices through task-based interfaces. This integration can lead to more intuitive smart home or industrial automation systems.

These are just a few examples of the numerous opportunities and innovative ideas that T@skFlow can enable. As the system evolves and matures, it has the potential to become a powerful platform for human-computer interaction, collaboration, and automation.

Here are some innovative applications for T@skFlow that you might find surprising:
* **Virtual Escape Room**: T@skFlow can be used to create a virtual escape room experience where players solve puzzles and riddles collaboratively using the task-centric approach. Different tasks can represent individual challenges or puzzles, and players can work together to complete them and "escape" the room.
* **Language Learning**: T@skFlow can create a dynamic language learning environment. Users can engage with tasks tailored to their proficiency level, covering grammar, vocabulary, listening, and speaking exercises. The system can also provide instant feedback and suggest personalized next steps for improvement.
* **Interactive Storytelling**: T@skFlow can enable users to participate in interactive stories where their choices influence the narrative. Each task represents a decision point or interaction, and users can explore multiple storylines and outcomes based on their choices.
* **Mental Health Support**: T@skFlow can facilitate mental health support by connecting users with trained professionals or AI-powered chatbots. The task-centric approach allows for tailored self-help exercises, journaling prompts, and guided meditations, depending on users' needs.
* **Medical Diagnosis Assistant**: T@skFlow can be used to create a medical diagnosis assistant, guiding users through a series of tasks to gather symptoms, medical history, and other relevant information. The system can then provide a list of possible diagnoses or recommend further medical consultation.
* **Cooking Companion**: T@skFlow can be a cooking companion, assisting users in finding recipes based on their preferences, dietary restrictions, or available ingredients. The task-centric approach can break down recipes into individual steps, offering guidance and tips during the cooking process.
* **Virtual Travel Guide**: T@skFlow can serve as a virtual travel guide, helping users plan their trips and explore destinations. Tasks can include booking flights, accommodations, and local activities or providing personalized recommendations based on users' interests and preferences.
* **Online Tutoring**: T@skFlow can enable a personalized online tutoring experience, where students work on tasks related to specific subjects, receive feedback, and engage with tutors or AI-powered chatbots for additional support.

These are just a few of the many possible applications for T@skFlow. Its flexible, task-centric approach can be adapted to a wide variety of use cases, providing unique and engaging experiences for users.
