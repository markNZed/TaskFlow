/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import withTask from "../../hoc/withTask";
import 'react-data-grid/lib/styles.css';
import DataGrid from 'react-data-grid';
import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/*
The task keys that should be columns in datagrid (still provide an option to hide them):

* meta.updatedAt
* id
* instanceId (but don't need to show full value)
* familyId (but don't need to show full value)
* type

The task keys that should be initially hiddne but can be added as columns:

* config.label
* name
* state.current
* output (this is an object)
* input (this is an object)
* request (this is an object)
* response (this is an object)

How should we display objects?
*/


// Recursive utility function to convert taskData into a TreeItem structure
const renderTree = (nodes, idPrefix = '') => (
  <TreeItem key={idPrefix} nodeId={idPrefix.toString()} label={nodes.id}>
    {Array.isArray(nodes.object) || (typeof nodes.object === 'object' && nodes.object !== null)
      ? Object.entries(nodes.object).map(([key, value], idx) => 
          renderTree({ id: key, object: value }, `${idPrefix}-${idx}`)
        )
      : JSON.stringify(nodes.object)}   {/* Updated here */}
  </TreeItem>
);

// We may not want to render as a tree, this is just an experiment
const TaskDataTree = ({ taskData }) => (
  <TreeView
    defaultCollapseIcon={<ExpandMoreIcon />}
    defaultExpandIcon={<ChevronRightIcon />}
  >
    {renderTree({ id: `Root-${taskData.instanceId}`, object: taskData })}
  </TreeView>
);

const TaskSystemLog = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  // Task state machine
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "query":
        break;
      case "response":
        console.log("tasks", task.response.tasks);
        // Build the correct structure 
        let responseData = [];
        task.response.tasks.forEach((t) => {
          responseData.push({
            id: t.currentTask.instanceId,
            key: t.currentTask.instanceId,
            value: t.currentTask,
            history: t.history, // An array
          });
        });        
        setData(responseData);
        nextState = "query";
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  // Filter rows based on search term
  const filteredData = data.filter(row => 
    row.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
    JSON.stringify(row.value).toLowerCase().includes(searchTerm.toLowerCase())
  );
  console.log("filteredData", filteredData);

  const handleButtonClick = () => {
    if (task.state.current === "query") {
      modifyTask({ "request.query": "all", "command": "update" });
    }
  };

  const columns = [
      {  
        name: 'instanceId', 
        width: 150,
        key: "key"
      },
      { 
        name: 'Current',
        width: 400,
        formatter: ({ row }) => ( <TaskDataTree taskData={row.value} /> ),
        key: "value"
      },
      {  
        name: 'History',
        width: 400,
        formatter: ({ row }) => ( row.history && row.history.length > 0 ? <TaskDataTree taskData={row.history[0].taskData} />  : "No History"),
        key: "history"
      }
  ];

  return (
    <div style={{ width: '100%' }}>
      <h2>System Log Viewer</h2>
      <button onClick={handleButtonClick}>Update Tasks</button>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
      <DataGrid 
        columns={columns} 
        rows={filteredData} 
        pageSize={10}
      />
    </div>
  );

};

export default withTask(TaskSystemLog);