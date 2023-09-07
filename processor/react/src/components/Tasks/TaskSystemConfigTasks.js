/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import JsonEditor from '../Generic/JsonEditor.js'
import { message, Alert, ConfigProvider, theme, Tree, Spin, Button, Menu, Dropdown } from 'antd';
import { utils } from "../../shared/utils.mjs";

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

  const [configTreeHash, setConfigTreeHash] = useState({});
  const [configTree, setConfigTree] = useState();
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedTask, setSelectedTask] = useState(null);
  const [editedTask, setEditedTask] = useState(null);
  const [selectedTaskDiff, setSelectedTaskDiff] = useState(null);
  const [rightClickedNode, setRightClickedNode] = useState(null);

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
    if (!props.checkIfStateReady()) {log("State Machine !checkIfStateReady");return}
    let nextState; 
    // Log each transition, other events may cause looping over a state
    if (props.transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "loaded":
        if (!utils.deepEqual(task.shared.configTree, configTreeHash)) {
          setConfigTreeHash(task.shared.configTree);
        }
        // Should manage task.input from this processor
        // General rule: if we set a field on a processor then clear it down on the same processor
        if (task.input.selectedTaskId) {
          modifyTask({
            "input.selectedTaskId": null,
            "request.action" : "read",
            "request.actionId": task.input.selectedTaskId,
            "command": "update",
          })
        }
        if (task.input.submit && editedTask) {
          modifyTask({
            "input.submit": null,
            "request.action" : "update",
            "request.actionId": editedTask.id,
            "request.actionTask": editedTask,
            "command": "update",
          });
          setEditedTask(null);
        }
        if (task.input.action) {
          modifyTask({
            "input.action": null,
            "input.actionId": null,
            "request.action": task.input.action,
            "request.actionId": task.input.actionId,
            "command": "update",
          });
        }
        break;
      case "actionDone":
          modifyTask({
            "request.action": null,
            "request.actionId": null,
          })
          if (task.request.action === "read") {
            setSelectedTask(task.response.task);
            setSelectedTaskDiff(task.response.taskDiff);
          } 
          nextState = "loaded";
          break;
      default:
        console.log(`${props.componentName} State Machine ERROR unknown state : `, task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  function childrenHashToArray(configHashIn) {
    if (configHashIn && configHashIn.children) {
      let children = [];
      for (const [key, value] of Object.entries(configHashIn.children)) {
        //console.log("push key", key);
        children.push(childrenHashToArray(value));
      }
      configHashIn.children = children;
    }
    if (Object.keys(configHashIn).length === 0) {
      return [];
    }
    return configHashIn;
  }

  // task.shared.configTree uses a hash because we cannot merge arrays and delete elements
  useEffect(() => {
    if (configTreeHash) {
      // Deep copy so we do not mess with configTreeHash
      const converted = childrenHashToArray(JSON.parse(JSON.stringify(configTreeHash)));
      //console.log("configTree converted", converted);
      if (Object.entries(converted).length) {
        setConfigTree([converted]);
      }
    }
  }, [configTreeHash]);

  const handleTreeSelect = (selectedKeys, info) => {
    const {selected, selectedNodes, node, event} = info;
    if (selectedKeys.length === 0) {
      return;
    }
    modifyTask({
      "input.selectedTaskId": node.key,
    })
  };

  const handleDragEnd = ({event, node}) => {
    console.log('onDragEnd', event, node);
  }

  const handleDataChanged = (newData) => {
    console.log('Edited JSON data:', newData);
    setEditedTask(newData);
  };

  const handleRightClick = ({ event, node }) => {
    event.preventDefault();
    setRightClickedNode(node);
  };

  const handleTaskSubmit = () => {
    if (selectedTask) {
      modifyTask({
        "input.submit": true,
      });
    }
  };

  const items = [
    {
      label: 'Delete',
      key: 'delete',
    },
    {
      label: 'Create',
      key: 'create',
    },
  ];

  const handleMenuClick = ({ item, key, keyPath, domEvent }) => {
    //console.log("rightClickedNode", rightClickedNode);
    //console.log("item, key, keyPath, domEvent", item, key, keyPath, domEvent);
    modifyTask({
      "input.action": key,
      "input.actionId": rightClickedNode.key,
    });
  }

  return (
    <>
      <ConfigProvider theme={{
          algorithm: theme.lightAlgorithm,
          // 2. Combine dark algorithm and compact algorithm
          // algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
          token: { colorPrimary: '#000000' }
      }}>
        <div>
          {configTree ?
            <Dropdown 
              menu={{ 
                items, 
                onClick: handleMenuClick,
              }} 
              trigger={['contextMenu']} 
              placement={"bottomLeft"}
            >
              <Tree
                treeData={configTree}
                onSelect={handleTreeSelect}
                draggable={true}
                selectable={true}
                onDragEnd={handleDragEnd}
                onRightClick={handleRightClick}
              />
            </Dropdown>
          : null}
        </div>
        {/*
        <div>
          <h2>Parent Diff</h2>
          {selectedTaskDiff ? (
            <JsonEditor 
              initialData={selectedTaskDiff} 
              onDataChanged={handleDataChanged}
              sortObjectKeys={true}
            />
          ) : (
            <p>No task selected.</p>
          )}
        </div>
        */}
        <div>
          <div>
            {selectedTask ? (
              <JsonEditor 
                initialData={selectedTask} 
                onDataChanged={handleDataChanged}
                history={true}
                sortObjectKeys={true}
              />
            ) : (
              task.request.selectedTaskId ? (
                <Spin />
              ) : (
                null
              )
            )}
          </div>
          <div>
            { (selectedTask) ? (
              <Button type="primary" onClick={handleTaskSubmit}>Submit</Button>
            ) : (
              task.request.selectedTaskId ? (
                null
              ) : (
                <p>No task selected.</p>
              )
            )}
          </div>
          {/*
          {contextMenuVisible && (
            <Dropdown
              menu={<RightClickMenu onDelete={handleDelete} />}
              trigger={['click']}
              open={true}
              onOpenChange={(visible) => setContextMenuVisible(visible)}
              getPopupContainer={() => document.body}
            >
              <div
                style={{
                  position: 'absolute',
                  top: `${menuPosition.y}px`,
                  left: `${menuPosition.x}px`,
                }}
              >
                <span style={{ opacity: 0 }}>.</span>
              </div>
            </Dropdown>
          )}
          */}
        </div>
      </ConfigProvider>
    </>
  );
};

export default withTask(TaskSystemTasksConfig);