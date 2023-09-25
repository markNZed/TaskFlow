# T@skFlow

T@skFlow is a distributed Task framework for leveraging AI. It is under development.

# Overview

T@skFlow combines software, AI models, and human interaction in a unique way. A software developer creates a Task's functionality, a Task may be distributed over many Task Processors, a Task may monitor a set of Tasks, and a set of Tasks may be a workflow. T@skFlow adopts a hub-and-spoke architecture.

![T@skFlow Diagram](Task.drawio.svg)  *<small>[editable](https://app.diagrams.net/)</small>

The functionality of Tasks can be shared without sharing proprietary/private configuration information such as the sequencing of Tasks and the content of prompts.

# Motivation

The potential of large langauge models (LLM) like chatGPT has become apparent to many people. LLM enable natural language interfaces with computers and allow computers to generate natural language text. The underlying transformer architecture will continue to evolve and expand the capabilities of these systems for the foreseeable future. Furthermore, LLM have a limited (but rapidly improving) ability to follow instructions, this allows LLM to provide the "glue" for combining many different computing paradigms (e.g. databases, AI models, programming languages, search engines, etc.) Many systems are being built to capture value from new services.

The purpose of T@skFlow is to explore new ways of building and interacting with computers while assuming that AI will play a central role. If T@skFlow can amplify humans such that their abilities in a particular domain far exceed what most humans with most other systems are capable of then T@skFlow becomes a lever to propose new social/business practices. This is inline with the view of a **technology of ethics** i.e., using technology to prefer certain moral outcomes over other possible outcomes (technology is not amoral). T@skFlow is intended to support a new way of thinking.

# Core Concepts

## Task

Tasks consist of:
* **Task Definition** that conform to a generic Task schema
  * A Task may reference data not provided by T@skFLow
* **Task Function** available in one or more Task Environment(s)
  * A Task Function may use services not provided by T@askFlow
  * A Task Function maintains a state
* **Task Data** available in one or more Task Environment(s)
  * Task Data may use services not provided by T@skFlow

For example, a chat application is a simple Task (receive user input, return language model response) and the management of the conversation history (e.g., displaying or deleting previous messages) is another Task (or sequence of Tasks). Unlike a chat framework, T@skFlow generates any user interface depending on the implementation of a Task. Unlike a workflow framework, T@skFlow uses Tasks to dynamically build a user interface (UI) rather than providing a UI to configure a workflow (a workflow-like tool could, in theory, be built using T@askFlow).

The concept of **Task Instance** refers to a particular object conforming to the Task Definition.

The concept of **Task Context** refers to the complete data and functionality used by the Task, this may extend beyond the Task Function and Task Data. 

A Task Function may be distributed across multiple Task Environments, intra-task communication uses the task object (in particular `task.request` and `task.response`). The Task Function sends commands to the Task Processor using `task.command` and `task.commandArgs` Only Task Functions write to `task.command`

The Task Function may implement a state machine using `task.state.current` and the Task Processor may provide features for managing the state machine.

### Task State Machine

A Task may be distributed over multiple Task Processors and share a single finite state machine (FSM) definition in the `shared/fsm` directory. The preferred approach is to define a serializable FSM using the [XState](https://xstate.js.org/) format and implement the various actions and guards in the relevant Task Function. A **Task Configuration** may override some, or all, of the FSM configuration. For example, TaskTest provides generic functions to drive Task inputs and check Task outputs, different configurations of TaskTest can test different Tasks.

## Task Node

A **Task Node** is either a Task Hub or Task Processor i.e. a process that is processing Tasks.

## Task Processor

Tasks are processed by Task Processors, currently there are three Task Processors implemented in T@skFlow. 

* NodeJS Task Processor runs Node on a server
* React Task Processor runs React in a web browser
* RxJS Task Processor runs RxJS on a server

The Processors communicate with the Hub using websocket.

The NodeJS Task Processor provides a kernel for evaluating Task functions. Tasks are asynchronous. Tasks may run on the NodeJS Task Processor without user interaction. Tasks may use software/AI to decide on the next Task to start. The NodeJS Task Processor uses Node and the Express framework.

The React Task Processor (user interface) provides a kernel for evaluating Task functions and generic web functionality (e.g., current user location). User input may change Task state and start new Tasks. The React Task Processor runs in a web browser using the React Javascript library with Material UI (MUI) user interface components. 

The RxJS Task Processor provides a kernel for evaluating Task functions. Tasks are asynchronous. Tasks may run on the RxJS Task Processor without user interaction. The RxJS Task Processor uses Node, Express, and RxJS.

For more information see the Task Processor [README.md](processor/README.md).

### Task Environment

Each Task Processor provides a Task Environment for the Task Function to run in. The NodeJS Task Processor currently provides a Node Javascript environment. The React Task Processor currently provides a React Javascript environment. The RxJS Task Processor currently provides a RxJS Javascript environment. A Task Processor could provide multiple Task Environments.

### SubTask

A SubTask expects to receives a Task instance and returns the same Task instance. The SubTask assumes it is called from a Task. The SubTask runs within a Task Environment (i.e., it is part of the Task Processor) and provides a standard interface for Task functionality that is shared across many Tasks.

There may be side-effects from a SubTask, for example, it may return partial results to a Task on another Task Processor using the Task Processor's web socket connection to the Hub.

## Task Hub

Information shared between Task Processors is maintained in the Task Hub which also acts as a router, see the Task Hub [README.md](hub/README.md).

### Task Hub Co-Processor

A Task Hub Co-Processor offloads processing from the Task Hub. The Task Hub Co-Processor is a Task Processor that can modify Tasks before they are broadcast by the Task Hub. The Task Hub Co-Processor may provide a bridge to other systems e.g., logging, monitoring, testing, debugging, etc.

#### CEP

Complex event processing (CEP) functions monitor the stream of Tasks and respond to patterns by updating Tasks.

## Error Handling

If a Task Function sets `task.error` and the Task is updated then the Task Hub will detect this and set `task.hub.command` to "error" then set `task.hub.commandArgs.errorTask` to `task.config.errorTask` or the nearest error task (task.id ending in ".error"). The task that errored is then considered to be "done" by the Hub and the error Task is started (it will be sent to all the Task Processors associated with the errored Task).

# Getting Started

To run T@skFlow with docker, see the [README.md](infra/docker/README.md) in the infra/docker directory.

To learn more about the NodeJS Task Processor, see the [README.md](processor/nodejs/README.md) in the NodeJS Task Processor directory.

To learn more about the React Task Processor, see the [README.md](processor/react/README.md) in the React Task Processor directory.

To learn more about the Task object, see the [README.md](shared/README.md) in the shared directory.

For suggestion on debugging issues see [DEBUG.md](DEBUG.md).

T@skFlow will play nicely with other libraries such as:
* [LangChain](https://langchain.com/) (e.g., use LangChain features from within a Task function on the NodeJS Task Processor)
* [LlamaIndex](https://pypi.org/project/gpt-index/) (from within a Task function on the NodeJS Task Processor)

## Creating a New Task

Imagine a new task that will be called TaskNew:
* Create React Task Processor/src/components/Tasks/TaskNew.js (copy an existing Task)
* Create NodeJS Task Processor/taskFunctions/TaskNew.mjs (copy and existing TaskFunction)
* Add information about the new Task to hub/config/tasktypes.mjs

You will need to include TaskNew in a sequence of tasks (or it could be standalone):
* Add it to hub/config/tasks.mjs

### Task Patterns

**How to reference values from previous Tasks ?**

Available in the `task.output` object of the previous Task Instance.

# Coding Guidelines

Code is currently formatted using Prettier defaults.

# License

This project is licensed under the Mozilla Public License Version 2.0, see [LICENSE.txt](LICENSE.txt), and is open to contributions. An [ICLA](ICLA.txt) is provided for pull requests and managed automatically by https://cla-assistant.io. Contributions are licensed for use through the ICLA i.e., contributors continue to own their contributions. An important part of the ICLA allows the Project Owner to change the project license in the future. If the license is changed in the future, the source code prior to the change would still be available under the MPL 2.0, i.e., anyone could fork the MPL 2.0 project and continue using/developing T@skFlow.

## Contributors

The initial React Task Processor code was based on the React chatbot client [https://github.com/YaokunLin/chatbot-react-React Task Processor](https://github.com/YaokunLin/chatbot-react-client), and the initial NodeJS Task Processor code was based on the Node Express chatbot server [https://github.com/YaokunLin/chatbot-server](https://github.com/YaokunLin/chatbot-NodeJS Task Processor). The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."

