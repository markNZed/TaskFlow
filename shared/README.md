The "additionalProperties": false attribute in a JSON schema specifies that no additional properties (other than the ones defined in the schema) are allowed in the JSON object being validated. In other words, it restricts the object to only have the properties listed under the "properties" attribute in the schema.

In a JSON schema, the title attribute is used to provide a short, human-readable description or title for the schema.

To install the node packages: `npm install` 

Then to run: `npm run generate-converter-v02` 

#Open Issues
-----------
How to deal with Task specific schema ? We will create separate schema files 
Move sessionId out of Task?

Config should have: label

The request/response fields are used to send Task specific information between the server and client but the princple could be applied for other services. We need to think about how this should be separated from the Task specific schema e.g. a distinction between internal and external requests. In this way a Task could publish a service and ohter tasks could make requests (rahter than assuming the communication is within a Task)

The chat.mjs is like an internal request? make it part of TaskChat not TaskFromAgent (rename this to TaskTextIO)

# History
Moving from v0.1 to v0.2 was a major hassle because v0.1 was a "flat" object and v0.2 has a hierarchical structure e.g. name
Javascript does not have a compact way for accessing keys e.g. {name: "toto"} is not possible
Updating objects in React also becomes more comlpicated as the ...task is shallow and we need to manage the deep merge/update of objects.

The basic approach to updating the client/server code is to use the taskV01toV02Map.mjs functions so parts of the system can be converted to v0.2 progressively rather than having everything break at once. For example if a function is dealing with a task then at the beginning `task = fromV01toV02(task)` then update the code for v0.2 and at the end of hte code block `task = fromV02toV01(task)`. Then once all the client or server code is moved we can place the conversion at the API, eventually only the communicatin is in v0.1 then it can be dropped. 

I actually modified the task object to suport a v02 field that holds the new v0.2 object. This in theory allows to use both. It does have the advantage of being able to view the content and spot problems with taskV01toV02Map.mjs 

Moving from v0.1 to v0.2 also makes a split between generic Task data and specific task data. Eventually each specific Task would have a schema.

