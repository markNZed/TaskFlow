/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import JsonEditor from '../Generic/JsonEditor.js'
import { DatePicker, message, Alert, ConfigProvider, theme, Tree } from 'antd';

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
    transition,
    onDidMount,
  } = props;

  const [dummy, setDummy] = useState("");
  const [date, setDate] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();

  const treeData = [
    {
      title: 'TreeMain',
      key: 'TreeMain',
      children: [
        {
          title: 'ParentLeaf',
          key: 'ParentLeaf',
          children: [
            {
              title: 'ChildLeaf1',
              key: 'ChildLeaf1',
            },
            {
              title: 'ChildLeaf2',
              key: 'ChildLeaf2',
            },
          ],
        },
      ],
    },
  ];

  const handleChange = (value) => {
    messageApi.info(`Selected Date: ${value ? value.format('YYYY-MM-DD') : 'None'}`);
    setDate(value);
  };

  // onDidMount so any initial conditions can be established before updates arrive
  onDidMount();

  // Each time this component is mounted then we reset the task state
  useEffect(() => {
    // This can write over the update
    task.state.current = "start";
    task.state.done = false;
  }, []);

  // Task state machine
  // Unique for each component that requires steps
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const handleDataChanged = (newData) => {
    console.log('Edited JSON data:', newData);
    modifyTask(newData);
  };

  return (
    <>
      <div>
      <h1>JSON Editor</h1>
      <JsonEditor initialData={task} onDataChanged={handleDataChanged} />
      </div>
      <ConfigProvider theme={{
          // 1. Use dark algorithm
          algorithm: theme.darkAlgorithm,
          // 2. Combine dark algorithm and compact algorithm
          // algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
          token: { colorPrimary: '#000000' }
      }}>
        <div style={{ width: 400, margin: '100px auto' }}>
          <DatePicker onChange={handleChange} />
          <div style={{ marginTop: 16 }}>
            Selected Date: {date ? date.format('YYYY-MM-DD') : 'None'}
            <Alert message="Selected Date" description={date ? date.format('YYYY-MM-DD') : 'None'} />
          </div>
          {contextHolder}
          <Tree
            treeData={treeData}
          />
        </div>
      </ConfigProvider>
    </>
  );
};

export default withTask(TaskSystemTasksConfig);
