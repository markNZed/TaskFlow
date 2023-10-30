/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useRef } from "react";
import withTask from "../../hoc/withTask";
import DynamicComponent from "./../Generic/DynamicComponent";

/*
Task Function

This is intended to be a placeholder for experimenting with React
  
ToDo:
  
*/

const TaskRAG = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
    childTasks,
    setChildTasksTask,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const hardModelVersion = "gpt-4-0613";
  const softModelVersion = "gpt-3.5-turbo-0613";
  const [think, setThink] = useState(softModelVersion);
  const [level, setLevel] = useState('');
  const [topic, setTopic] = useState('');
  const [cachePrefix, setCachePrefix] = useState();
  const [initialUser, setInitialUser] = useState();

  // Each time this component is mounted then we reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
    task.state.done = false;
    setInitialUser(task?.config?.local?.user);
  }, []);

  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (props.transition()) { props.log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "loaded":
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  useEffect(() => {
    if (task?.input?.select) {
      const inputThink = task?.input?.select?.think || '';
      const inputLevel = task?.input?.select?.level || '';
      const inputTopic = task?.input?.select?.topic || '';
      const inputCachePrefix = `${inputThink}-${inputLevel}-${inputTopic}`;
      const selectedModelVersion = task?.output?.chat?.services?.chat?.modelVersion;
      if (inputThink !== think) {
        setThink(inputThink);
        if (inputThink === "thinkharder") {
          if (selectedModelVersion !== hardModelVersion) {
            modifyTask({ 
              "command": "update", 
              "output.chat.services.chat.modelVersion": hardModelVersion,
              "output.config.local.cachePrefix": inputCachePrefix,
              "commandDescription": "Think harder",
            });
          }
        // Switch back, should not hard code modelVersion
        } else if (selectedModelVersion === hardModelVersion) {
          modifyTask({ 
            "command": "update", 
            "output.chat.services.chat.modelVersion": softModelVersion,
            "output.config.local.cachePrefix": inputCachePrefix,
            "commandDescription": "Think softer",
          });
        }
      }
      if (inputLevel !== level) {
        console.log("setLevel", inputLevel);
        setLevel(inputLevel);
        const user = initialUser + "The user is a " + inputLevel + " in " + task?.input?.select?.topic + "."; 
        modifyTask({ 
          "command": "update", 
          "output.config.local.user": user,
          "output.config.local.cachePrefix": inputCachePrefix,
          "commandDescription": "Update RAG user level",
        });
      }
      if (inputTopic !== topic) {
        console.log("setTopic", inputTopic);
        setTopic(inputTopic);
        modifyTask({ 
          "command": "update", 
          "output.select.config.local.fields.level.hide": false,
          "output.config.local.cachePrefix": inputCachePrefix,
          "commandDescription": "Unhide the level checkboxes",
        });
      }
    }
  }, [task?.input?.select]);

  return (
    <div>
      <div>
      {/* The component layout order is the order of task.meta.childrenIds which is the order the tasks are declared in the task configuration*/}
      {childTasks && childTasks.map((childTask, idx) => (
        <div key={"styling" + childTask.id} style={childTask?.config?.local?.style || {}}>
          <DynamicComponent
              key={childTask.id}
              is={childTask.type}
              task={childTask}
              setTask={(t) => setChildTasksTask(t, idx)} // Pass idx as an argument
              parentTask={task}
          />
        </div>
      ))}
      </div>
    </div>
  );
};

export default withTask(TaskRAG);
