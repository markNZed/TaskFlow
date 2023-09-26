# Nodes

## Processor

Information for the Processor is held in the `task.processor` object.

The Processor strips the `task.hub` object before passing to a Task Function.

The Task Function mainly communicates with the Processor using the object `task.command`. The Processor can use language specific side-channels to communicate with the Task Function e.g., events, callbacks, promises, etc. The principle has a Task Function is implemented for each environment raher than being agnostic, the JSON schema of the Task is language agnostic and allows for synchronization between environments. Only the Task Function writes to `task.command`

`task.command` maybe be one of:
  * update
  * start

The Processor communicates with the Hub using the object `task.processor` Only the Processor write to `task.processor`.

`task.processor.command` may be be one of:
  * update
  * start
  * error
  * ping
  * register
  * partial

The `update` sends a diff, not the entire object, this helps to avoid different Processors over-writing parts of the Task they are not modifying. The last state of the task received is stored in `task.processor.origTask` which is used to compute the diff before sending to the Hub.

The Processor receives commands from the Hub via `task.hub.command` and only the Hub writes to `task.hub`.

The Processor abstraction is useful during development. For example, create a new Processor by copying and renaming an existing one, then allocate a single Task Function to this new processor and remove it from the old processor, now you can experiment with refactoring the Processor without breaking all Task Functions. 

A Processor provides Task Functions which may be further decomposed into finite state machines (FSM), Operators, Services. The `task.fsm` object provides an XState representation of a statee machine. A Task can be configured to us a particular state machine. Operators are functions that receive a Task as input and return a Task as output. Services typically wrap a 3rd party API.

The object `task.processor.shared` provides a "global" space for data to be shared with all Tasks on the processor (other fields of `task.processor`` may be Task specific).

The startup seequence involves the Processor requesting a websocket connection, then the Hub will send a "register" command and there is an HTTP request/response that registers the Processor details. This will eventually be replaced with a System Task.

If the `task.processor.statesSupported` array is set then the Hub will only route updates to the processor if `task.processor.statesSupported` includes `task.state.current`.

If the `task.processor.statesNotSupported` array is set then the Hub will not route updates to the processor if `task.processor.statesNotSupported` includes `task.state.current`.

### Sharing Task Functionality

In the directory `shared/processor` there can be files shared between procesors, for example `fsm.mjs` provides abstrcations for the XState FSM in Javascript. Obviously, processors need to share a programming language to share Task Functionality. The finite state machines that define the dynamic behavior of a Task Function may be specified in `shared/fsm/Task...` the XState configuration can be specified using JSON to be programming language agnostic. 

### Hub Coprocessor

A Processor may register as a Hub Coprocessor in which case it follows a different protocol. A Hub Coprocessor reveives each task sent to the hub and can operate on that task before returning it to the hub. When a Processor sends a task update to the Hub, like all other Processors assocaited with the task, it also receives the update from the hub. The Hub Coprocessor can intercept a task update modify the task. The Hub Coprocessor sees all tasks that go through the hub while a Processor will only see tasks that are associated with the environment it provides.

### Future

Hub functionality that can be pushed to the Processor should be pushed to the processor e.g.,
* Filter execution
* Diff generation
* Throttling

 We want a notion of a Task event. For example, React could be sensitive to changes in the Task. The taskChange is the event. These can be numbered if wé need to ensure the event is processed once (the effect may be sensitive to other signals). It would be possible to use Javascript events so in the case of React so we can ensure delivery and consumption. The processor can provide event filtering so effects are insensitive to the order of events e.g., taskEvent("a && b") 

```javascript
// The expression will evaluate to true upon the event that completes the expression
// taskChange should be an event that holds the latest updates to the Task
// We should wrap taskEvent with a higher order function createTaskEvent then user only need call taskEvent without needing to pass in taskChange and task each time. 
function taskEvent(expression, taskChange, task) {
    // Use exprima to get the AST for expression
    // for each variable in the expression rewrite the expresion where that variable is refered to as taskChange.variable while the other variables are task.variable
    // Build modifiedExpression as a logical OR of all these expression rewrites
    // We are returning the math.evaluate it should be evaluated in the context of where the function was called
    // mathjs is safer than using eval, it suports AND not && (etc) but we can rewrite && as AND during the rewrite step above.
    // return math.evaluate(modifiedExpression, {taskChange, task}) 
}
```