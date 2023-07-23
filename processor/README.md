# Task Processor

Information for the Processor is held in the `task.processor` object.

The Processor strips the `task.hub` object before passing to a Task Function.

The Task Function mainly communicates with the Task Processor using the object `task.command`. The Task Processor can use language specific side-channels to communicate with the Task Function e.g., events, callbacks, promises, etc. The principle has a Task Function is implemented for each environment raher than being agnostic, the JSON schema of the Task is language agnostic and allows for synchronization between environments. Only the Task Function writes to `task.command`

`task.command` maybe be one of:
  * update
  * start
  * sync

The Task Processor communicates with the Hub using the object `task.processor` Only the Task Processor write to `task.processor`.

`task.processor.command` may be be one of:
  * update
  * start
  * error
  * ping
  * register
  * partial
  * sync (update the Task object but do not evaluate the Task Function)

Both `update` and `sync` send a diff, not the entire object, this helps to avoid different Task Processors over-writing parts of the Task they are not modifying. 

The Task Processor receives commands from the Hub via `task.hub.command` and only the Hub writes to `task.hub`.

The Task Processor abstraction is useful during development. For example, create a new Task Processor by copying and renaming an existing one, then allocate a single Task Function to this new processor and remove it from the old processor, now you can experiment with refactoring the Task Processor without breaking all Task Functions. 

Task Processors can provide more or less complicated user interfaces, for example, the NodeJS Task Processor is coded in a procedural style while the RxJS Task Processor uses a functional programming style.

## Future

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