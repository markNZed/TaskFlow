# T@skFlow

T@skFlow is a distributed Task framework for leveraging AI. It is under development.

# Overview

T@skFlow combines software, AI models, and human interaction in a unique way. A software developer creates a Task's functionality, a Task may be distributed over many Processors, a Task may monitor a set of Tasks, and a set of Tasks may be a workflow. T@skFlow adopts a hub-and-spoke architecture.

![T@skFlow Diagram](Task.drawio.svg)  *`<small>`[editable](https://app.diagrams.net/) `</small>`

The functionality of Tasks can be shared without sharing proprietary/private configuration information such as the sequencing of Tasks and the content of prompts.

# Motivation

The potential of large langauge models (LLM) like chatGPT has become apparent to many people. LLM enable natural language interfaces with computers and allow computers to generate natural language text. The underlying transformer architecture will continue to evolve and expand the capabilities of these systems for the foreseeable future. Furthermore, LLM have a limited (but rapidly improving) ability to follow instructions, this allows LLM to provide the "glue" for combining many different computing paradigms (e.g. databases, AI models, programming languages, search engines, etc.) Many systems are being built to capture value from new services.

The purpose of T@skFlow is to explore new ways of building and interacting with computers while assuming that AI will play a central role. If T@skFlow can amplify humans such that their abilities in a particular domain far exceed what most humans with most other systems are capable of then T@skFlow becomes a lever to propose new social/business practices. This is inline with the view of a **technology of ethics** i.e., using technology to prefer certain moral outcomes over other possible outcomes (technology is not amoral!). T@skFlow is intended to support a new way of thinking.

# Key Concepts

## Task

Tasks consist of:

* **Task Definition** that conform to a generic Task schema
  * A Task may reference data not provided by T@skFLow
* **Task Function** available in one or more Environment(s)
  * A Task Function may use services not provided by T@askFlow
  * A Task Function maintains a state
* **Task Data** available in one or more Environment(s)
  * Task Data may use services not provided by T@skFlow

For example, a chat application could include a Task to receive user input and return language model responses, along with another Task for the management of the conversation history (e.g., displaying or deleting previous messages). Unlike a chat framework, T@skFlow generates any user interface depending on the implementation of a Task. Unlike a workflow framework, T@skFlow uses Tasks to dynamically build a user interface (UI) rather than providing a UI to configure a workflow (a workflow-like tool could, in theory, be built using T@askFlow).

The concept of **Task Instance** refers to a particular object conforming to the Task Definition.

The concept of **Task Context** refers to the complete data and functionality used by the Task, this may extend beyond the Task Function and Task Data.

A Task Function may be distributed across multiple Environments, intra-task communication uses the task object (in particular `task.request` and `task.response`). The Task Function sends commands to the Processor using `task.command` and `task.commandArgs` Only Task Functions write to `task.command`

The Task Function may implement a state machine using `task.state.current` and the Processor may provide features for managing the state machine.

### Task State Machine

A Task may be distributed over multiple Processors and share a single finite state machine (FSM) definition in the `shared/FSM` directory. The preferred approach is to define a serializable FSM using the [XState](https://xstate.js.org/) format and implement the various actions and guards in the relevant Task Function. A **Task Configuration** may override some, or all, of the FSM configuration. For example, TaskTest provides generic functions to drive Task inputs and check Task outputs, different configurations of TaskTest can test different Tasks.

## Node

A **Node** is a process that is processing Tasks.

### Node Type

A Node is of type:

* **Hub** coordinates Task synchronization in the hub-and-spoke architecture
* **Processor** processes Tasks as a spoke in the hub-and-spoke architecture
* **Bridge** a Processor that connects to more than one Hub

### Node Role

A Node adopts a role of:

* **Core** the entry point for Tasks
* **Coprocessor** processing at the Node with shared memory (Redis)
* **Consumer** processing Tasks received at the Node

Roles could be performed by separate processes (or servers) to enable horizontal scaling.

### Node Processing

A Node Roll is performed by processing as:

* **Stream** required for complex event processing (CEP) that monitor Task activity
* **Batch** required to process Task Functions

A Batch defaults to size of one but Processors may make more efficient use of resources by batching Task processing.

### Environment

Each Node provides a Environment for the Task Function to run in. The React Processor currently provides a React Javascript environment. The RxJS Processor currently provides a RxJS Javascript environment.

### Node Functions

Nodes are composed of Node Functions:

* **Services** API using the Node's Environment
* **Operators** transform Tasks
* **CEPs** complex event processing of Tasks
* **Tasks** as defined in [Task](#task)

The Task Definition uses JSON and does not support the transport of functions i.e. functions are specific to a Node, although the configuration of a function can be part of a Task Definition.

Services and Operators do not maintain a state (except handles to resources for efficiency). CEPs and Tasks can hold a state. Unlike Tasks, CEP are not distributed i.e. the CEP runs on a specific Node. CEP are installed through the Task configuration or by a Task Function.

#### Services

A service provides a native (e.g. Javascript) API to functionality shared across Tasks in the Environment. A Processor provides services that provide a functionality in the native style of the environment i.e. services are not restricted by a Task Definition.

#### Operators

An Operator expects to receives a Task instance and returns the same Task instance. The Operator assumes it is called from a Task. The Operator runs within a Environment (i.e., it is part of the Processor) and provides a standard interface for Task functionality that is shared across many Tasks.

There may be side-effects from an Operator, for example, it may return partial results to a Task on another Processor using the Processor's web socket connection to the Hub.

#### CEPs

Complex event processing (CEP) functions monitor the stream of Tasks and respond to patterns by updating Tasks. By convention a Task using CEP is prefixed with TaskCEP and a Task with this prefix only peforms CEP. There are two levels of CEP compared Operators and Services because the CEP is associated with a task that instantiates the CEP and also to the Node where the CEP is executed.

## Processor

Tasks are processed by Processors, currently the Processors implemented in T@skFlow:

* React Processor runs React in a web browser
* RxJS Processor runs RxJS on a server

The Processors communicate with the Hub using websocket. A Processor may be composed of multiple Nodes.

The React Processor (user interface) provides a kernel for evaluating Task functions and generic web functionality (e.g., current user location). User input may change Task state and start new Tasks. The React Processor runs in a web browser using the React Javascript library with Material UI (MUI) user interface components.

The RxJS Processor provides a kernel for evaluating Task functions. Tasks are asynchronous. Tasks may run on the RxJS Processor without user interaction. The RxJS Processor uses Node, Express, and RxJS.

For more information see the Processor [README.md](processor/README.md).

## Hub

Information shared between Processors is maintained in the Hub which also acts as a router, see the Hub [README.md](nodes/hub/README.md).

A Hub may be composed of multiple Nodes.

### Hub Coprocessor

A Hub Coprocessor offloads processing from the Hub. The Hub Coprocessor is a Node that can modify Tasks before they are broadcast by the Hub.

## Error Handling

If a Task Function sets `task.error` and the Task is updated then the Hub will detect this and set `task.hub.command` to "error" then set `task.hub.commandArgs.errorTask` to `task.config.errorTask` or the nearest error task (task.id ending in ".error"). The task that errored is then considered to be "done" by the Hub and the error Task is started (it will be sent to all the Processors associated with the errored Task).

# Getting Started

To run T@skFlow with docker, see the [README.md](infra/docker/README.md) in the infra/docker directory.

To learn more about the RxJS Processor, see the [README.md](nodes/rxjs/README.md) in the RxJS Processor directory.

To learn more about the React Processor, see the [README.md](nodes/react/README.md) in the React Processor directory.

To learn more about the Task object, see the [README.md](shared/README.md) in the shared directory.

T@skFlow will play nicely with other libraries such as:

* [LangChain](https://langchain.com/) (e.g., use LangChain features from within a Task function on the RxJS Processor)
* [LlamaIndex](https://pypi.org/project/gpt-index/) (from within a Task function on the RxJS Processor)

## Creating a New Task

Imagine a new task that will be called TaskNew:

* Create React Processor/src/components/Tasks/TaskNew.js (copy an existing Task)
* Create RxJS Processor/src/Tasks/TaskNew.mjs (copy and existing TaskFunction)
* Add information about the new Task to nodes/hub/config/tasktypes.mjs

You will need to include TaskNew in a sequence of tasks (or it could be standalone):

* Add it to nodes/hub/config/tasks.mjs

### Task Patterns

**How to reference values from previous Tasks ?**

Available in the `task.output` object of the previous Task Instance.

# Authentication

With a proxy T@skFlow provides a simple authentication mechanism:

* The proxy should generate a sub-request to /auth that is a routed to the Hub for authentication
* The proxy needs to allow unauthenticated access to /login.html and /login
* The proxy should redirect to /login.html if the /auth fails (returns HTTP error 401)
* The user enters credentials at /login.html which posts a request for a JWT token at /login and stores the token in a cookie
* The /auth path checks the cookie for the JWT token, the token contains the user id which will correspond to `task.user.id`
* The Hub checks task.tokens.authToken to authenticate websocket messages

One advantage of this approach is that the React client is only served after authentication. The username and password hash are stored in nodes/hub/db/accessDB.sqlite3 other information about the user is stored in usersStore_async. The password_hash storage is separated from the user data so authentication can be independent of T@skFlow internal data structure.

# Configuration

The primary configuration of Taskflow uses Javascript objects. These objects are read by the script/dumpOneConfig.js which imports Javascript modules from the CONFIG_DIR and writes JSON configuration files to the db/config directory. This is a result of the development history: setting a javascript object in a module was an easy way to configure the early system, the flexibility of using Javascript allowed for "programming" the configuration (e.g. a tree structure with inheritance). To reload the primary configuraton without restarting T@skFlow the configuration modules need to be reloaded which is not obvous in nodejs, this is why a script is used to dump the configuration in JSON format that can be reloaded without restarting the app.

# Coding Guidelines

Code is currently formatted using Prettier defaults.

# License

This project is licensed under the Mozilla Public License Version 2.0, see [LICENSE.txt](LICENSE.txt), and is open to contributions. An [ICLA](ICLA.txt) is provided for pull requests and managed automatically by https://cla-assistant.io. Contributions are licensed for use through the ICLA i.e., contributors continue to own their contributions. An important part of the ICLA allows the Project Owner to change the project license in the future. If the license is changed in the future, the source code prior to the change would still be available under the MPL 2.0, i.e., anyone could fork the MPL 2.0 project and continue using/developing T@skFlow.

## Contributors

The initial React Processor code was based on the React chatbot client [https://github.com/YaokunLin/chatbot-react-React Processor](https://github.com/YaokunLin/chatbot-react-client), and the initial NodeJS Processor code was based on the Node Express chatbot server [https://github.com/YaokunLin/chatbot-server](https://github.com/YaokunLin/chatbot-NodeJS Processor). The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."

[![built with Codeium](https://codeium.com/badges/main)](https://codeium.com)
