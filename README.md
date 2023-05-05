# Chat@Flow

Chat@Flow is a Task centric collaborative web application framework for leveraging AI that is under development.

## Overview

Chat@Flow supports combining software and AI models and human interaction. Chat@Flow adopts a Task centric approach. Tasks can be chained into workflows. A developer creates a Task's functionality, a Task may manage a set of Tasks, and a set of Tasks may be a workflow.

![Chat@Flow Diagram](Task.drawio.svg)

Chat@Flow is intended to provide a light, flexible infrastructure for human-computer interaction. The configuration of Tasks is not part of Chat2Flow (except for demonstration purposes) . The functionality of individual Tasks can be shared without sharing proprietary/private configuration information such as the sequencing of Tasks and the content of prompts.

Chat@Flow should play nicely with:
* [LangChain](https://langchain.com/) (e.g., use LangChain features from within a Task function on the nodejsProcessor)
* [LlamaIndex](https://pypi.org/project/gpt-index/) (from within a Task function on the nodejsProcessor)

### Task Object

Tasks consist of:
* A text specification of additional Task variables
* An optional user interface component
* An optional software function

For example, a chat application is a simple Task (receive user input, return language model response) and the management of the conversation history (e.g., displaying or deleting previous messages) is another Task (or sequence of Tasks). Unlike a chat interface, Chat@Flow can provide any web-based interface depending on the implementation of a Task. Unlike a workflow application, Chat@Flow uses Tasks to dynamically build a user interface (UI) rather than providing a UI to build a workflow.

### Task Processor

Tasks are processed by Task Processors, there are two Task Processors implemented in Chat@Flow: nodejsProcessor and browserProcessor. The nodejsProcessor runs on a server and the browserProcessor runs in a web browser. The nodejsProcessor and browserProcessor communicate using websockets or REST style HTTP API. The nodejsProcessor and browserProcessor are implemented in Javascript.

On the nodejsProcessor side, Chat@Flow provides a kernel for evaluating Task functions, storing history, and initiating new Tasks. Tasks are asynchronous. Some Tasks may run on the nodejsProcessor without user interaction. Tasks may use software/AI to decide on the next Task to start. The nodejsProcessor uses Node Javascript and the Express framework.

On the browserProcessor (user interface) side, Chat@Flow provides Tasks with storage, nodejsProcessor communication, and generic functionality (e.g., current user location). Tasks may use user input to decide on the next Task to start. The browserProcessor runs in a web browser using the React Javascript library with MUI user interface components. Server communication uses either websockets (e.g., for real-time interaction) or REST style HTTP API.

### Task Environment

The Task Processor provides a Task Environment for the Task to run in. The nodejsProcessor currently provides a Node Javascript environment. The browserProcessor currently provides a React Javascript environment. Eventually the Task Environment will be decoupled from the Task Processor so a Task Processor can provide multiple Task Environments.

## Motivation

The potential of large langauge models like chatGPT has become apparent to many people. LLM enable natural language interfaces with computers and allow computers to generate high quality natural language text. The underlying transformer architecture will continue to evolve and expand the capabilities of these systems for the foreseeable future. Furthermore LLM have a limited (but rapidly improving) ability to follow instructions, this allows LLM to provide the "glue" for combining many different computing paradigms (e.g. databases, AI models, programming languages, search engines, etc.) Many systems are being built to capture value new services will provide. 

Chat@Flow is intended to allow rapid exploration of new ideas in a relatively trusted environment. Typically Chat@Flow runs as a web service. On the nodejsProcessor side Tasks are first class citizens - they have full access to the nodejsProcessor environment. Not having any security constraints on what a Task can do means users and developers need to trust each other. This is not a scalable approach but it is ideal in rapidly exploring use cases for yourself and others. If a particular Task sequence provides a lot of value then it will likely become a standalone application. Chat@Flow should make it easy to leverage existing services. Chat@Flow is lightweight because it is not trying to centralise a service for coordinating untrusted parties.

For developers Chat@Flow allows for a personal assistant that runs on your computer keeping your data local.

## Getting Started

To run Chat@Flow with docker, see [README.md](infra/docker/README.md) in the docker directory.

To learn more about the nodejsProcessor, see [README.md](nodejsProcessor/README.md) in the nodejsProcessor directory.

To learn more about the browserProcessor, see [README.md](browserProcessor/README.md) in the browserProcessor directory.

To learn more about the Task object, see [README.md](shared/README.md) in the shared directory.

### Creating a New Task

Imagine a new task that will be called TaskNew:
* Create browserProcessor/src/components/Tasks/TaskNew.js (copy an existing Task)
* Add the license header to the file
* Create nodejsProcessor/taskFunctions/TaskNew.mjs (copy and existing TaskFunction)
* Add the license header to the file
* Add information about the new Task to nodejsProcessor/config/components.mjs

You will need to include TaskNew in a sequence of tasks (or it could be standalone):
* If the seqeunce is simple then 
  * add it directly to nodejsProcessor/config/workflows.mjs
* If the sequence is complicated/long then 
  * create a file in nodejsProcessor/config/workflow/TaskNewFlow.mjs (copy the structure of an existing file)
  * Add the license header to the file
  * edit nodejsProcessor/config/workflows.mjs to import and include TaskNewFlow.mjs

### Coding Guidelines

Code is currently formatted using Prettier defaults.

## License

This project is licensed under the Mozilla Public License Version 2.0, see [LICENSE.txt](LICENSE.txt), and is open to contributions. An [ICLA](ICLA.txt) is provided for pull requests and managed automatically by https://cla-assistant.io. Contributions are licensed for use through the ICLA i.e., contributors continue to own their contributions. An important part of the ICLA allows the Project Owner to change the project license in the future. If the license is changed in the future, the source code prior to the change would still be available under the MPL 2.0, i.e., anyone could fork the MPL 2.0 project and continue using/developing Chat@Flow.

### Contributors

The initial browserProcessor code was based on the React chatbot client [https://github.com/YaokunLin/chatbot-react-browserProcessor](https://github.com/YaokunLin/chatbot-react-browserProcessor), and the initial nodejsProcessor code was based on the Node Express chatbot server [https://github.com/YaokunLin/chatbot-nodejsProcessor](https://github.com/YaokunLin/chatbot-nodejsProcessor). The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."

## Future

Here is what GPT-4 has to say about Chat@Flow:

A system like Chat@Flow has the potential to revolutionize human-computer interaction and collaboration, thanks to its task-centric approach and AI integration. Here are some opportunities and innovative ideas for this system:

* **Intelligent Virtual Assistants**: Chat@Flow can be used to build virtual assistants that help users complete tasks more efficiently. By leveraging AI, these assistants can learn from user interactions, provide proactive suggestions, and adapt their responses based on context.
* **Dynamic User Interfaces**: The ability to dynamically build user interfaces based on tasks can lead to more personalized and intuitive experiences. As users complete tasks, the interface can adapt to their needs and preferences, making it easier for them to accomplish their goals.
* **Collaborative Workspaces**: Chat@Flow can facilitate collaboration among team members by enabling real-time task management and communication. Team members can create, assign, and track tasks, while AI-powered suggestions can help them prioritize and complete work more effectively.
*  **Workflow Automation**: By chaining tasks together, Chat@Flow can be used to create complex workflows that automate repetitive processes. Users can design custom workflows that incorporate AI models, making it possible to perform tasks like data analysis, content generation, or decision-making more efficiently.
*  **AI-driven Decision Support**: Chat@Flow can integrate AI models for advanced decision support, helping users make informed choices based on data analysis, predictions, or recommendations. This feature can be useful in various domains, such as finance, healthcare, or supply chain management.
*  **Education and Training**: Chat@Flow can be used to create interactive learning environments, where students can complete tasks and receive real-time feedback from AI models. This approach can facilitate personalized learning, adapt to individual students' needs, and encourage active engagement.
*  **Gaming and Entertainment**: The task-centric approach of Chat@Flow can be leveraged to create immersive gaming experiences, where players complete tasks to progress through a story or achieve goals. The integration of AI can add an additional layer of complexity and interactivity to these experiences.
*  **Integration with IoT Devices**: Chat@Flow can be extended to interact with IoT devices, enabling users to manage and control smart devices through task-based interfaces. This integration can lead to more intuitive smart home or industrial automation systems.

These are just a few examples of the numerous opportunities and innovative ideas that Chat@Flow can enable. As the system evolves and matures, it has the potential to become a powerful platform for human-computer interaction, collaboration, and automation.

Here are some innovative applications for Chat@Flow that you might find surprising:
* **Virtual Escape Room**: Chat@Flow can be used to create a virtual escape room experience where players solve puzzles and riddles collaboratively using the task-centric approach. Different tasks can represent individual challenges or puzzles, and players can work together to complete them and "escape" the room.
* **Language Learning**: Chat@Flow can create a dynamic language learning environment. Users can engage with tasks tailored to their proficiency level, covering grammar, vocabulary, listening, and speaking exercises. The system can also provide instant feedback and suggest personalized next steps for improvement.
* **Interactive Storytelling**: Chat@Flow can enable users to participate in interactive stories where their choices influence the narrative. Each task represents a decision point or interaction, and users can explore multiple storylines and outcomes based on their choices.
* **Mental Health Support**: Chat@Flow can facilitate mental health support by connecting users with trained professionals or AI-powered chatbots. The task-centric approach allows for tailored self-help exercises, journaling prompts, and guided meditations, depending on users' needs.
* **Medical Diagnosis Assistant**: Chat@Flow can be used to create a medical diagnosis assistant, guiding users through a series of tasks to gather symptoms, medical history, and other relevant information. The system can then provide a list of possible diagnoses or recommend further medical consultation.
* **Cooking Companion**: Chat@Flow can be a cooking companion, assisting users in finding recipes based on their preferences, dietary restrictions, or available ingredients. The task-centric approach can break down recipes into individual steps, offering guidance and tips during the cooking process.
* **Virtual Travel Guide**: Chat@Flow can serve as a virtual travel guide, helping users plan their trips and explore destinations. Tasks can include booking flights, accommodations, and local activities or providing personalized recommendations based on users' interests and preferences.
* **Online Tutoring**: Chat@Flow can enable a personalized online tutoring experience, where students work on tasks related to specific subjects, receive feedback, and engage with tutors or AI-powered chatbots for additional support.

These are just a few of the many possible applications for Chat@Flow. Its flexible, task-centric approach can be adapted to a wide variety of use cases, providing unique and engaging experiences for users.