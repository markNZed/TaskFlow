/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import JsonEditor from '../Generic/JsonEditor.js'
import { message, Alert, ConfigProvider, theme, Tree } from 'antd';

/*
Task Process

This is intended to be a placeholder for experimenting with React
  
ToDo:
  
*/

const TaskSystemTasksConfig = (props) => {
  const {
    log,
    task,
    modifyTask,
    onDidMount,
  } = props;

  const [configTree, setConfigTree] = useState([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskDiff, setSelectedTaskDiff] = useState(null);

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // Each time this component is mounted then we reset the task state
  useEffect(() => {
    if (task.processor.command !== "init") {
      // This can write over the update
      // This overrides the setting of the state during init
      task.state.current = "start";
      task.state.done = false;
    }
  }, []);

  // Task state machine
  useEffect(() => {
    // modifyState may have been called by not yet updated test.state.current
    if (!props.checkIfStateReady()) {return}
    let nextState; 
    // Log each transition, other events may cause looping over a state
    if (props.transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "response":
        setConfigTree(task.state.configTree);
        break;
      default:
        console.log(`${props.componentName} State Machine ERROR unknown state : `, task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  useEffect(() => {
    console.log("selectedTask",selectedTask)
  }, [selectedTask]);

  const handleTreeSelect = (selectedKeys, info) => {
    console.log('onSelect', selectedKeys, info);
    const {selected, selectedNodes, node, event} = info;
    if (selectedKeys.length === 0) {
      return;
    }
    // Assuming each node has a task and taskDiff object
    setSelectedTask(node.task);
    setSelectedTaskDiff(node.taskDiff);
  };

  const handleDragEnd = ({event, node}) => {
    console.log('onDragEnd', event, node);
  }

  const handleRightClick = ({event, node}) => {
    console.log('onRightClick', event, node);
  }

  const handleDataChanged = (newData) => {
    console.log('Edited JSON data:', newData);
  };

  return (
    <>
      <ConfigProvider theme={{
          algorithm: theme.lightAlgorithm,
          // 2. Combine dark algorithm and compact algorithm
          // algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
          token: { colorPrimary: '#000000' }
      }}>
        <div>
          <Tree
            treeData={configTree}
            onSelect={handleTreeSelect}
            draggable={true}
            selectable={true}
            onDragEnd={handleDragEnd}
            onRightClick={handleRightClick}
          />
        </div>
        <div>
          <h2>Selected Task Diff</h2>
          {selectedTaskDiff ? (
            <JsonEditor initialData={selectedTaskDiff} onDataChanged={handleDataChanged} />
          ) : (
            <p>No task selected.</p>
          )}
        </div>
        <div>
          <h2>Selected Task</h2>
          {selectedTask ? (
            <JsonEditor initialData={selectedTask} onDataChanged={handleDataChanged} />
          ) : (
            <p>No task selected.</p>
          )}
        </div>
      </ConfigProvider>
    </>
  );
};

export default withTask(TaskSystemTasksConfig);
