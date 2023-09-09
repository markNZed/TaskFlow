/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import JsonEditor from '../Generic/JsonEditor.js'
import { ConfigProvider, theme, Tree, Spin, Button, Dropdown, Modal, Input } from 'antd';
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

  const [configTreeAsObject, setconfigTreeAsObject] = useState({});
  const [configTree, setConfigTree] = useState();
  const [selectedTask, setSelectedTask] = useState();
  const [selectedTaskDiff, setSelectedTaskDiff] = useState();
  const [rightClickedNode, setRightClickedNode] = useState();
  const [copyTaskId, setCopyTaskId] = useState();
  const [newTaskName, setNewTaskName] = useState();
  const [isModalVisible, setIsModalVisible] = useState(false);


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
        // Could use task.meta.updatedAt to detect a new task then generate events for task.meta.modified
        // A state variable e.g. lastModifiedX could make sure the event is processed once
        if (props.transition() && task.meta?.modified?.shared?.configTree) {
          setconfigTreeAsObject(task.shared.configTree);
        }
        // General rule: if we set a field on a processor then clear it down on the same processor
        //   Not for response/request
        if (task.input.action) {
          modifyTask({
            "input.action": null,
            "input.actionId": null,
            "input.actionTask": null,
            "input.destinationId": null,
            "request.action": task.input.action,
            "request.actionId": task.input.actionId,
            "request.actionTask": task.input.actionTask,
            "request.destinationId": task.input.destinationId,
            "request.copyTaskId": task.input.copyTaskId,
            "request.newTaskName": task.input.newTaskName,
            "command": "update",
          });
        }
        break;
      case "actionDone":
          if (task.response.task) {
            setSelectedTask(task.response.task);
          }
          if (task.response.taskDiff) {
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

  /**
   * Transforms a specific property in an object from a hash to an array.
   * Useful for standardizing object structures for easier manipulation.
   *
   * @param {Object} obj - Object containing the property to transform.
   * @param {String} propName - Name of the property to transform.
   * @returns {Object} - Object with transformed property.
   */
  function hashToArrayOnProperty(obj, propName) {
    // Only transform if the target property exists.
    if (obj && obj[propName]) {
      let newArray = [];
      for (const [_, value] of Object.entries(obj[propName])) {
        newArray.push(hashToArrayOnProperty(value, propName));
      }
      obj[propName] = newArray;
    }

    // Standardize empty objects to empty arrays for the sake of uniformity.
    if (Object.keys(obj).length === 0) {
      return [];
    }

    return obj;
  }

  // task.shared.configTree uses a hash because we cannot merge arrays and delete elements
  useEffect(() => {
    if (configTreeAsObject) {
      // Deep copy so we do not mess with configTreeAsObject
      const sortedConfigTreeAsObject = utils.sortKeys(configTreeAsObject);
      const converted = hashToArrayOnProperty(JSON.parse(JSON.stringify(sortedConfigTreeAsObject)), "children");
      //console.log("configTree converted", converted);
      if (Object.entries(converted).length) {
        setConfigTree([converted]);
      }
    }
  }, [configTreeAsObject]);

  const handleTreeSelect = (selectedKeys, info) => {
    const {selected, selectedNodes, node, event} = info;
    // In tree components, selecting and then deselecting a node may trigger the event handler
    // with an empty array for selectedKeys. In such cases, skip further processing.
    if (selectedKeys.length === 0) {
      return;
    }
    modifyTask({
      "input.action": "read",
      "input.actionId": node.key,
    });
  };

  const handleDragEnd = ({event, node}) => {
    console.log('onDragEnd', event, node);
  }

  const handleDrop = (info) => {
    console.log('onDrop', info);
    const draggedNode = info.dragNode;
    const draggedToNode = info.node;
    const draggedNodesKeys = info.dragNodesKeys;
    // The nodes are sortd so we do not care about the dropPosition
    const dropPosition = info.dropPosition;
    console.log("configTree:", configTree, "draggedNode", draggedNode,"draggedToNode", draggedToNode, "draggedNodesKeys", draggedNodesKeys, "dropPosition", dropPosition);
    modifyTask({
      "input.action": "move",
      "input.actionId": draggedNode.key,
      "input.destinationId": draggedToNode.key,
    });
  }

  const handleDataChanged = (newData) => {
    console.log('handleDataChanged');
    if (newData && newData.json) {
      console.log('setSelectedTask', newData.json);
      setSelectedTask(newData.json)
    }
  };

  const handleRightClick = ({ event, node }) => {
    event.preventDefault();
    setRightClickedNode(node);
  };

  const handleTaskSubmit = () => {
    console.log("handleTaskSubmit");
    if (selectedTask) {
      console.log("handleTaskSubmit selectedTask", selectedTask);
      modifyTask({
        "input.action": "update",
        "input.actionTask": selectedTask,
        "input.actionId": selectedTask.id,
      });
    }
  };

  const items = [
    {
      label: 'Delete',
      key: 'delete',
    },
    {
      label: 'Insert',
      key: 'insert',
    },
    {
      label: 'Copy',
      key: 'copy',
    },
    {
      label: 'Paste',
      key: 'paste',
    },
  ];

  const handleMenuClick = ({ item, key, keyPath, domEvent }) => {
    //console.log("rightClickedNode", rightClickedNode);
    //console.log("item, key, keyPath, domEvent", item, key, keyPath, domEvent);
    if (key === "copy") {
      setCopyTaskId(rightClickedNode.key);
      console.log("setCopyTaskId", rightClickedNode.key);
    } else if (key === "paste") {
      showModal();    
    } else {
      modifyTask({
        "input.action": key,
        "input.actionId": rightClickedNode.key,
      });
    }
  }

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
    if (copyTaskId && newTaskName) {
      modifyTask({
        "input.action": "paste",
        "input.actionId": copyTaskId,
        "input.destinationId": rightClickedNode.key,
        "input.newTaskName": newTaskName,
      });
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
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
                onDrop={handleDrop}
                onRightClick={handleRightClick}
              />
            </Dropdown>
          : null}
        </div>
        <div>
          {selectedTaskDiff ? (
            <>
              <h2>Inherited</h2>
              <JsonEditor 
                content={selectedTaskDiff} 
                sortObjectKeys={true}
                readOnly={true}
              />
            </>
          ) : (
            null
          )}
        </div>
        <div>
          <div>
            {selectedTask ? (
              <>
                <h2>{selectedTask.id}</h2>
                <JsonEditor 
                  content={selectedTask} 
                  onDataChanged={handleDataChanged}
                  history={true}
                  sortObjectKeys={true}
                />
              </>
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
              null
            )}
          </div>
        </div>
      </ConfigProvider>
      <Modal title="Enter the new name for the task" open={isModalVisible} onOk={handleOk} onCancel={handleCancel}>
        <Input placeholder="Task name" onChange={e => setNewTaskName(e.target.value)} />
      </Modal>
    </>
  );
};

export default withTask(TaskSystemTasksConfig);
