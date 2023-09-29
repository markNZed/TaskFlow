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
Task Function
  
ToDo:
  
*/

const TaskNodeConfigEditor = (props) => {
  const {
    log,
    task,
    modifyTask,
  } = props;

  const [configTreeAsObject, setconfigTreeAsObject] = useState();
  const [configTree, setConfigTree] = useState();
  const [selectedTask, setSelectedTask] = useState();
  const [selectedTaskDiff, setSelectedTaskDiff] = useState();
  const [rightClickedNode, setRightClickedNode] = useState();
  const [copiedTaskId, setCopiedTaskId] = useState();
  const [newTaskLabel, setnewTaskLabel] = useState();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [menuAction, setMenuAction] = useState();
  const [configTreeLastUpdatedAt, setConfigTreeLastUpdatedAt] = useState();


  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  function loadTree() {
    if (configTreeLastUpdatedAt !== task.meta.updatedAt.date) {
      setConfigTreeLastUpdatedAt(task.meta.updatedAt.date);
      const targetStore = task.config.local.targetStore;
      console.log("loadTree", targetStore, "from", task.config.local.sharedVariable);
      setconfigTreeAsObject(task.shared[task.config.local.sharedVariable]);
    }
  }

  useEffect(() => {
    if (task?.config?.local?.sharedVariable && task?.meta?.modified?.shared && task.meta.modified.shared[task.config.local.sharedVariable]) {
      loadTree();
    }
  }, [task]);

  // Task state machine
  useEffect(() => {
    // modifyState may have been called by not yet updated test.state.current
    if (!props.checkIfStateReady()) {log("State Machine !checkIfStateReady");return}
    let nextState; 
    // Log each transition, other events may cause looping over the same state
    if (props.transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        loadTree();
        nextState = "loaded";
        break;
      case "loaded":
        // General rule: if we set a field on a processor then clear it down on the same processor
        //   Not for response/request
        if (task.input.action) {
          modifyTask({
            "input": {},
            "request": task.input,
            "command": "update",
            "commandDescription": "Requesting action " + task.input.action,
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
        console.log(`${props.componentName} State Machine unknown state:`, task.state.current);
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
    // Rename 'id' to 'key' if it exists
    if (obj && obj['id']) {
      obj['key'] = obj['id'];
      delete obj['id'];
    }
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

  // task.shared.configTreeHubconsumerTasks uses a hash because we cannot merge arrays and delete elements
  useEffect(() => {
    if (configTreeAsObject) {
      // Deep copy so we do not mess with configTreeAsObject
      const sortedConfigTreeAsObject = utils.sortKeys(configTreeAsObject);
      const sortedConfigTreeAsArray = hashToArrayOnProperty(utils.deepClone(sortedConfigTreeAsObject), "children");
      console.log("configTree sortedConfigTreeAsArray", sortedConfigTreeAsArray);
      if (Object.entries(sortedConfigTreeAsArray).length) {
        setConfigTree([sortedConfigTreeAsArray]);
      }
    }
  }, [configTreeAsObject]);

  const handleTreeSelect = (selectedKeys, info) => {
    const {node} = info;
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

  const handleDrop = (info) => {
    //console.log('onDrop', info);
    const draggedNode = info.dragNode;
    const draggedToNode = info.node;
    // The nodes are sorted so we do not care about the dropPosition
    modifyTask({
      "input.action": "move",
      "input.actionId": draggedNode.key,
      "input.destinationId": draggedToNode.key,
    });
  }

  const handleDataChanged = (newDataContainer) => {
    //console.log('handleDataChanged');
    if (newDataContainer && newDataContainer.json) {
      console.log('setSelectedTask', newDataContainer.json);
      setSelectedTask(newDataContainer.json)
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
    setMenuAction(key);
    if (key === "copy") {
      setCopiedTaskId(rightClickedNode.key);
      console.log("setCopiedTaskId", rightClickedNode.key);
    } else if (key === "paste" || key === "insert") {
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

  const handleModalOk = () => {
    setIsModalVisible(false);
    if (menuAction === "paste" && copiedTaskId && newTaskLabel) {
      modifyTask({
        "input.action": menuAction,
        "input.actionId": copiedTaskId,
        "input.destinationId": rightClickedNode.key,
        "input.newTaskLabel": newTaskLabel,
      });
    }
    if (menuAction === "insert" && newTaskLabel) {
      modifyTask({
        "input.action": menuAction,
        "input.actionId": rightClickedNode.key,
        "input.newTaskLabel": newTaskLabel,
      });
    }
  };

  const handleModalCancel = () => {
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
                onDrop={handleDrop}
                onRightClick={handleRightClick}
              />
            </Dropdown>
          : null}
        </div>
        <div>
          {(selectedTaskDiff && Object.keys(selectedTaskDiff).length > 0) ? (
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
      <Modal title="Enter the new name for the task" open={isModalVisible} onOk={handleModalOk} onCancel={handleModalCancel}>
        <Input placeholder="Task name" onChange={e => setnewTaskLabel(e.target.value)} />
      </Modal>
    </>
  );
};

export default withTask(TaskNodeConfigEditor);
