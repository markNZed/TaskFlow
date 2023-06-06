# Task Processor

* Set Task's updatedAt when requesting to hub's update route

We want a notion of a Task event. For example, React could be sensitive to changes in the Task. The taskChange is the event. These can be numbered if wéneed to ensure the event is processed once (the effect may be sensitive to other signals). It would be possible to use Javascript events to in the case of React so we can ensure delivery and consumption. The processor can provide event filtering so effects are insensitive to the order of events e.g., taskEvent("a && b") 

```javascript
// The expression will evaluate to true upon the event that completes the expression
// taskChange should be an event that holds the latest updates to the Task
// We should wrap taskEvent with a higher order function createTaskEvent then user only need call taskEvent without needing to pass in taskChnage and task each time. 
function taskEvent(expression, taskChange, task) {
    // Use exprima to get the AST for expression
    // for each variable in the expression rewrite the expresion where that variable is refered to as taskChange.variable while the other variables are task.variable
    // Build modifiedExpression as a logical OR of all these expression rewrites
    // Wee are returning the math.evaluate it should be evaluated in the context of where the function was called
    // mathjs is safer than using eval, it suports AND not && (etc) but we can rewrite && as AND during the rewrite step above.
    // return math.evaluate(modifiedExpression, {taskChange, task}) 
}
```


## Future
Hub functionality that can be pushed to the Processor should be puhsed to the processor e.g.,
* Filter execution
* Diff generation
* Template filling
* Throttling

 