# Client

This is the frontend/client side of chat2flow written in Javascript using React and Material Design (MUI)

To install the node packages: `npm install` 

To run locally: `npm start`

Running on localhost set the port for the React client server in package.json where PORT=3000. Specify the port of the websocket server with environment variable REACT_APP_WS_LOCALHOST_PORT (default is 5000).

Coding preferences:
* ES6 Javascript
* React functional component style (not class component style)
* Wrap components withDebug and use the log function passed in as a prop
* Configure which log messages are displayed in App.js using debug.enable
* Hooks deal with cross-cutting concerns in the React functional style

## Task Conventions
* If a component receives a Task the parent manages the Task state
  * This implies the parent will have an array of Tasks if it instantiates multiple Task components
* Use the higher-order-component (HOC) withTask which for Task components
  * Standard approach to [debug/logging](#Debug)
  * Tracing of the task object (logged to console if debugging enabled)
  * Props for starting a new Task
    * startTaskLoading
    * startTaskError
    * startTask
    * startTaskFn()
  * Props for getting the next Task
    * nextTaskLoading,
    * nextTaskError
    * nextTask
    * setDoneTask()
  * Prop for updating properties of a Task  
    * `updateTask({param : 2})` is equivalent to `setTask(p => { return {...p, param : 2} })`
  * Prop to update the step in a Task
    * `updateStep('input')` is equivalent to `setTask(p => { return {...p, step : 'input'} })`
  * Prop for websocket event that is filtered so only events for the task.id initiating the task arrive
  * Prop component_depth that presents where in the component stack the component is (starts at 1)
  * Logging of changes for any Task variable e.g. `const [X, setX] = useTaskState(null,'X')`

### Debug
* The HOC withTask also wraps the Task component with the HOC withDebug
* Enable debug from App.js and leave useful regex for debug commented in the file
* The HOC provides the `log()` function as a prop

# Notes

## Cloudflare
Be careful of cloudflare caching.

The compression via cloudflare is br which is different from the gzip used by the React server, so file sizes can differ
https://react.dev/learn/start-a-new-react-project#production-grade-react-frameworks 
NS_BINDING_ABORTED Shown in Firefox when forcing a page reload. FireFox forced refresh, it assumes that you want to double-check what is in the cache, so it temporarily ignores Expires. https://github.com/facebook/react/issues/25218 "The request gets blocked because the page hasnt loaded yet and there is already another request (get image) being sent while the page request is yet to return completely."
The Nginx proxy was timing out WS connections after 60seconds. Extended to one hour.
Running this behind the CloudFlare Trust Zone with caching breaks React dev mode.