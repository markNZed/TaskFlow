# General Developer Introduction

Here we have role neutral specifications of TF features, for usage or implementation details please consult the appropriate role. There is also information about how we can debug FT. The Issues include ideas and limitations of functionality.

## Specifications

Users are allocated to groups and Task permissions are associated with groups. Groups are in turn associated with Tribes. A tribe is a set of application provided to particular end points, for example, two different websites could use the same instance of TF (sharing compute resources) while appearing independent to TF users.

An instance of a Task is a particular Task type with a particular configuration. Each Task can implement a state machine so we should think of a Task as a process rather than a fixed entity. A Task's configuration can be modified by a second Task while the the first Task is running, this can be a feedback or a feedforward connection.

Multiple Tasks can be organised into a hierarchy whereby a parent Task can spawn children Tasks and so on. A set of Tasks is referred to as a family.

## Debug

[Strategies](./debug_strategies.md)

## Issues

* Node
  * [CEPs](./issues/ceps.md)

    * CEPShared, CEPConnection, etc., need to take into account whether tasks are active or not
    * When processing CEP we should do this in parallel using promises.all to speed this up
  * Services
  * Operators
  * Internal communication

    * A node can consist of multiple processors (core, coprocessor, consumer) and currently communication between these processors uses the same diff format as hub-spoke communication, it would be more efficient to transfer the full Task object between processors on the same Node.
    * Instead of using websocket for intra-hub communication we could use a queuing system such as Redis. This would allow a move to an event based architecture on the node.
  * FSM

    * React node is not sensitive to syncEvents
* Hub
  * Routing - currently HTTP is only used for authentication by the hub and all inter-node communication is through websocket. Each processor could have an optional public HTTP interface or HTTP could be routed through the hub. Anohter option is to only use websocket.
* Task synchronization
  * The concept of deactivating active Tasks needs to be implemented. Currently the hub can deactivate a Task if task.state.done is set but this is not communicated to other processors (in theory they also can see this event). If a Task is abandoned (e.g. browser reloaded) then we deactivate the Task on the hub but this is not communciated to other processors. One idea is to restore the Tasks when the browser is reloaded but the current state of the Task(s)) on the hub may not be in a stable state - a similar issue was resolve for cloning Tasks so we could adopt a similar strategy.
  * TaskStepper uses the task.state.done to have the hub start the task.config.nextTask and the hub will deactivate the done Task but the back button on TaskStepper requires reactivating the task and this needs more thought/testing.
