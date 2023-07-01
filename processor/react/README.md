# React Task Processor

This is the React Task Processor of T@skFlow written in Javascript using React and Material Design (MUI)

To install the node packages: `npm install` 

To run locally: `npm start`

Running on localhost set the port for the React React Task Processor server in package.json where the default is PORT=3000. Specify the port of the websocket NodeJS Task Processor with environment variable REACT_APP_WS_LOCALHOST_PORT (default is 5000).

## Features
* Queue for updates to maintain order
* Rollback of Task store if fetchTask fails
* Shared worker for allocating processorId

## Task Conventions
* The task is passed to the component i.e. the parent manages the Task state
  * The parent will have an array of Tasks if it instantiates multiple components
* Use the higher-order-component (HOC) `withTask` for Task components
  * Standard approach to [debug/logging](#Debug)
  * Tracing of the task object (logged to console if debugging enabled)
  * Props for starting a new Task
    * startTaskError
    * startTask
    * startTaskFn()
  * Prop for updating properties of a Task  
    * `modifyTask({param : 2})` is equivalent to `setTask(p => { return {...p, param : 2} })`
  * Prop to update the state in a Task
    * `modifyState('input')` is equivalent to `setTask(p => { return {...p, state : 'input'} })`
  * Prop stackPtr that presents where in the component stack the component is (starts at 1)
  * Logging of changes for Task variable e.g. `const [X, setX] = useTaskState(null,'X')`
  * A parent Task can modify the state of a child through modifyChildState, this is the preferred method for commanding the child Task.
  * The `task.command` field is intended to send commands to the Task Processor.
  * The `task.request` field is intended for intra-task communication of a Task distributed across multiple environments.

### Debug
* The HOC `withTask` wraps the Task component with the HOC `withDebug`
* Enable debug from App.js and leave useful regex for debug commented in the file
* The HOC provides the `props.log()` function

# Notes

The Taskflows component holds an array of Tasks so the user can switch between Tasks that have started without losing the state.

Currently a shared worker sets a unique processorId per browser tab. This is not the intended architecture with a unique processor for each browser. Ultimately there should be a single master tab that makes the websocket connection and forwards events to a shared worker that forwards events to open tabs. The shared worker could also intercept HTTP requests from slave tabs and pass them to the master tab for forwarding to the Task Hub.

## Coding preferences:
* ES6 Javascript
* React functional component style (not class component style)
* Wrap components withDebug and use the log function passed in as a prop
* Configure which log messages are displayed in App.js using debug.enable
* Hooks deal with cross-cutting concerns in the React functional style

## Cloudflare
Cloudflare caching can create problems while updating the code. Running the React Processor behind the CloudFlare Trust Zone with caching breaks React dev mode.

The compression via cloudflare is br which is different from the gzip used by the React dev server, so file sizes can differ
https://react.dev/learn/start-a-new-react-project#production-grade-react-frameworks 

NS_BINDING_ABORTED Shown in Firefox when forcing a page reload. FireFox forced refresh, it assumes that you want to double-check what is in the cache, so it temporarily ignores Expires. https://github.com/facebook/react/issues/25218 "The request gets blocked because the page hasnt loaded yet and there is already another request (get image) being sent while the page request is yet to return completely."

The Nginx proxy was timing out WS connections after 60seconds. Extended to one hour.