/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import JsonEditor from '../Generic/JsonEditor.js'
import { message, Alert, ConfigProvider, theme, Tree, Spin, Button, Menu, Dropdown } from 'antd';

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
    if (!props.checkIfStateReady()) {return}
    let nextState; 
    // Log each transition, other events may cause looping over a state
    if (props.transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "loaded":
        setConfigTree(task.state.configTree);
        // Should manage task.input from this processor
        // General rule: if we set a field on a processor then clear it down on the same processor
        if (task.input.selectedTaskId) {
          modifyTask({
            "input.selectedTaskId": null,
            "request.action" : "read",
            "request.actionId": task.input.selectedTaskId,
            "state.configTree" : null, // Hack around array delete is not working
            "command": "update",
          })
        }
        if (task.input.submit && editedTask) {
          modifyTask({
            "input.submit": null,
            "request.action" : "update",
            "request.actionId": editedTask.id,
            "request.actionTask": editedTask,
            "state.configTree" : null, // Hack around array delete is not working
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
            "state.configTree" : null, // Hack around array delete is not working
            "command": "update",
          });
        }
        break;
      case "actionDone":
          if (task.request.action === "read") {
            setSelectedTask(task.response.task);
            setSelectedTaskDiff(task.response.taskDiff);
          } else {
            modifyTask({
              "request.action": null,
              "request.actionId": null,
            })
            // Here we should refresh the TaskSystemMenu
            if (task.processor.shared.menuInstanceId) {
              const syncTask = {
                instanceId: task.processor.shared.menuInstanceId,
                input: { update: true},
              }
              modifyTask({
                "command": "update",
                "commandArgs": {
                  sync: true,
                  syncTask,
                }
              })
            }
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

  useEffect(() => {
    console.log("selectedTask",selectedTask)
  }, [selectedTask]);

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
