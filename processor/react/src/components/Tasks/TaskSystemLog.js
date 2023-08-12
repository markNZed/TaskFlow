/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useMemo, useCallback } from "react";
import withTask from "../../hoc/withTask";
import 'react-data-grid/lib/styles.css';
import DataGrid from 'react-data-grid';
import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DraggableHeaderRenderer from '../Generic/DraggableHeaderRenderer';
import CellExpanderFormatter from '../Generic/CellExpanderFormatter';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

/*
The task keys that should be initially hidden but can be added as columns:

* config.label
* name
* state.current
* output (this is an object)
* input (this is an object)
* request (this is an object)
* response (this is an object)

How should we display objects?
Why was headerRenderer so poorly documented?
Center the headers
The row sorting is not working with the header sorting
*/

// Recursive utility function to convert taskData into a TreeItem structure
// Needed to override height, --rdg-row-height, lineHeight because TreeItem is picking it up from the datagrid
const renderTree = (nodes, idPrefix = '') => (
  <TreeItem style={{height: 'auto', lineHeight: '30px !important', '--rdg-row-height': 'auto'}} key={idPrefix} nodeId={idPrefix.toString()} label={nodes.id}>
    {Array.isArray(nodes.object) || (typeof nodes.object === 'object' && nodes.object !== null)
      ? Object.entries(nodes.object).map(([key, value], idx) => 
          renderTree({ id: key, object: value }, `${idPrefix}-${idx}`)
        )
      : JSON.stringify(nodes.object)}
  </TreeItem>
);

// We may not want to render as a tree, this is just an experiment
const TaskDataTree = ({ taskData }) => (
  <TreeView
    defaultCollapseIcon={<ExpandMoreIcon />}
    defaultExpandIcon={<ChevronRightIcon />}
    style={{ overflowY: 'auto', maxHeight: '200px' }}
  >
    {renderTree({ id: `Root-${taskData?.instanceId}`, object: taskData })}
  </TreeView>
);

function getComparator(sortColumn) {
  switch (sortColumn) {
    case 'updatedAt':
    case 'instanceId':
    case 'taskId':
    case 'familyId':
    case 'type':
    case 'processorId':
      return (a, b) => {
        if (typeof a[sortColumn] === 'string' && typeof b[sortColumn] === 'string') {
            return a[sortColumn].localeCompare(b[sortColumn]);
        } else {
            return a[sortColumn] === b[sortColumn] ? 0 : a[sortColumn] > b[sortColumn] ? 1 : -1;
        }
      };
    default:
      throw new Error(`unsupported sortColumn: "${sortColumn}"`);
  }
}

function createColumns() {
  const columns = [
    {
      key: 'expanded',
      name: '',
      minWidth: 30,
      width: 30,
      colSpan(args) {
        return args.type === 'ROW' && args.row.expanderType === 'DETAIL' ? columns.length  : undefined;
      },
      cellClass(row) {
        return row.expanderType === 'DETAIL'
            ? { padding: '24px' }
            : undefined;
      },
      formatter({ row, tabIndex, onRowChange }) {
        if (row.expanderType === 'DETAIL') {
          return (<TaskDataTree taskData={row.current} />);
        }
        return (
          <CellExpanderFormatter
            expanded={row.expanded}
            tabIndex={tabIndex}
            onCellExpand={() => {
              onRowChange({ ...row, expanded: !row.expanded });
            }}
          />
        );
      }
    },
    {  
      name: 'updatedAt', 
      width: 200,
      formatter: ({ row }) => {
        if (row.updatedAt) {
          const date = new Date(row.updatedAt);
          const timeString = date.toTimeString().split(' ')[0]; // Extracts hh:mm:ss
          return <time dateTime={row.updatedAt}>{date.toDateString()} {timeString}</time>;
        }
        return null;
      },
      key: "updatedAt",
      flex: 1,
    },
    {  
      name: 'instanceId', 
      width: 50,
      key: "instanceId",
      flex: 1,
    },
    {  
      name: 'id', 
      width: 150,
      key: "taskId",
      flex: 1,
    },
    {  
      name: 'familyId', 
      width: 50,
      key: "familyId",
      flex: 1,
    },
    {  
      name: 'type', 
      width: 150,
      key: "type",
      flex: 1,
    },
    {  
      name: 'processorId', 
      width: 50,
      key: "processorId",
      flex: 1,
    },
  ];
  return columns;
}

const TaskSystemLog = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [rows, setRows] = useState([]);
  const [sortedRows, setSortedRows] = useState([]); 
  const [columns, setColumns] = useState(createColumns());
  const [sortColumns, setSortColumns] = useState([]);
  const onSortColumnsChange = useCallback((sortColumns) => {
    setSortColumns(sortColumns.slice(-1));
  }, []);

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  // This is a hack to override the width of the App (max of 1200px) when presenting this Task
  const element = document.getElementById('appDiv');
  if (element) {
    element.style.maxWidth = '100%';
  }

  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedSearchTerm(searchTerm);
      }, 300); // Adjust the delay to your liking
      return () => {
          clearTimeout(handler);
      };
  }, [searchTerm]);

  // Separate out transformedData for useMemo
  const transformedData = useMemo(() => {
    if (!task.response.tasks) return [];
    return task.response.tasks.map(t => ({
        expanderType: 'MASTER',
        expanded: false,
        taskId: t.current.id,
        familyId: t.current.familyId,
        type: t.current.type,
        instanceId: t.current.instanceId,
        processorId: t.current.processor.initiatingProcessorId,
        key: t.current.instanceId + t.updatedAt.date,
        current: t.current,
        updatedAt: t.updatedAt.date,
    }));
  }, [task.response.tasks]);

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
        setData(transformedData);
        nextState = "query";
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current and state.last
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  useEffect(() => {
    if (sortColumns.length === 0) {
      setSortedRows(rows); // Update sortedRows state here
      return;
    }
    
    const newSortedRows = [...rows].sort((a, b) => {
      for (const sort of sortColumns) {
        const comparator = getComparator(sort.columnKey);
        const compResult = comparator(a, b);
        if (compResult !== 0) {
          return sort.direction === 'ASC' ? compResult : -compResult;
        }
      }
      return 0;
    });

    setSortedRows(newSortedRows); // Update sortedRows state here
  }, [rows, sortColumns]);

  const draggableColumns = useMemo(() => {
    function headerRenderer(props) {
      return <DraggableHeaderRenderer {...props} onColumnsReorder={handleColumnsReorder} />;
    }
    function handleColumnsReorder(sourceKey, targetKey) {
      const sourceColumnIndex = columns.findIndex((c) => c.key === sourceKey);
      const targetColumnIndex = columns.findIndex((c) => c.key === targetKey);
      const reorderedColumns = [...columns];
      reorderedColumns.splice(
        targetColumnIndex,
        0,
        reorderedColumns.splice(sourceColumnIndex, 1)[0]
      );
      setColumns(reorderedColumns);
    }
    return columns.map((c) => {
      return { ...c, headerRenderer };
    });
  }, [columns]);

  useEffect(() => {
    // Filter rows based on search term
    // This will be inefficient with large datasets
    const filteredData = data.filter(row => 
      row.key.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
      JSON.stringify(row.current).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
    console.log("filteredData", filteredData);

    setRows(filteredData);
  }, [data, debouncedSearchTerm]);

  const handleUpdateButtonClick = () => {
    if (task.state.current === "query") {
      modifyTask({ "request.query": "all", "command": "update" });
    }
  }

  function onRowsChange(rows, { indexes }) {
    const row = rows[indexes[0]];
    if (row.expanderType === 'MASTER') {
      if (row.expanded) {
        rows.splice(indexes[0] + 1, 0, {
          expanderType: 'DETAIL',
          key: row.key + 100,
          parentId: row.key,
          current: row.current,
        });
      } else {
        rows.splice(indexes[0] + 1, 1);
      }
      setSortedRows(rows);
    }
  }

  return (
    <div style={{ width: '100%', textAlign: 'left' }}>
      <h2>System Log Viewer</h2>
      <button onClick={handleUpdateButtonClick}>Update Tasks</button>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
      <DndProvider backend={HTML5Backend}>
        <DataGrid 
          columns={draggableColumns}
          sortColumns={sortColumns}
          onSortColumnsChange={onSortColumnsChange}
          rows={sortedRows}
          onRowsChange={onRowsChange}
          pageSize={10}
          defaultColumnOptions={{
            sortable: true,
            resizable: true
          }}
          rowHeight={(prop) => { 
            if (prop.row.expanderType === 'DETAIL') {
              return 200;
            } else { 
              return 30; 
            }
          }}
          /*
          onCellKeyDown={(_, event) => {
            if (event.isDefaultPrevented()) {
              // skip parent grid keyboard navigation if nested grid handled it
              event.preventGridDefault();
            }
          }}
          */
          rowKeyGetter={(row) => (row.key)}
          className="fill-grid"
          enableVirtualization={false}
          style={{ overflowY: 'hidden' }}
        />
      </DndProvider>
    </div>
  );

};

export default withTask(TaskSystemLog);