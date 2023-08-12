/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useMemo, useCallback, useContext } from "react";
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
The task keys that could be initially hidden but can be added as columns:

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
  <TreeItem style={{height: 'auto', lineHeight: '30px', '--rdg-row-height': '30px'}} key={idPrefix} nodeId={idPrefix.toString()} label={nodes.id}>
    {Array.isArray(nodes.object) || (typeof nodes.object === 'object' && nodes.object !== null)
      ? Object.entries(nodes.object)
        .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))  // Sorting alphabetically
        .map(([key, value], idx) => 
          {
            if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
              return renderTree({ id: key, object: value }, `${idPrefix}-${idx}`)
            } else {
              const content = key + ": " + value + "<br>";
              return <div dangerouslySetInnerHTML={{ __html: content }} />;
            }
          }
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

const FilterContext = React.createContext();

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

// Context is needed to read filter values otherwise columns are
// re-created when filters are changed and filter loses focus

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
  const [filteredRows, setFilteredRows] = useState(rows);
  const [columns, setColumns] = useState(createColumns());
  const [sortColumns, setSortColumns] = useState([]);
  const onSortColumnsChange = useCallback((sortColumns) => {
    setSortColumns(sortColumns.slice(-1));
  }, []);
  const [filters, setFilters] = useState(
    {
      updatedAt: '',
      instanceId: '',
      taskId: '',
      familyId: '',
      type: '',
      processorId: '',
    }
  );

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

  // Could use memo here?
  useEffect(() => {
    const result = rows.filter((r) => {
      return (
        (filters.updatedAt ? r.updatedAt.includes(filters.updatedAt) : true) &&
        (filters.instanceId ? r.instanceId.includes(filters.instanceId) : true) &&
        (filters.taskId ? r.taskId.includes(filters.taskId) : true) &&
        (filters.familyId ? r.familyId.includes(filters.familyId) : true) &&
        (filters.type ? r.type.includes(filters.type) : true) &&
        (filters.v ? r.processorId.includes(filters.processorId) : true)
      );
    });
    console.log("filteredRows", result);
    setFilteredRows(result);
  }, [rows, filters]);

  useEffect(() => {
    if (sortColumns.length === 0) {
      setSortedRows(filteredRows);
      return;
    }
    const newSortedRows = [...filteredRows].sort((a, b) => {
      for (const sort of sortColumns) {
        const comparator = getComparator(sort.columnKey);
        const compResult = comparator(a, b);
        if (compResult !== 0) {
          return sort.direction === 'ASC' ? compResult : -compResult;
        }
      }
      return 0;
    });
    setSortedRows(newSortedRows);
  }, [filteredRows, sortColumns]);

  // Create a component so we can useContext inside it
  function HeaderRendererComponent({ handleColumnsReorder, ...props }) {
    const filters = useContext(FilterContext);
    return (
      <DraggableHeaderRenderer
        {...props}
        filters={filters}
        setFilters={setFilters}
        onColumnsReorder={handleColumnsReorder}
      />
    );
  }

  const draggableColumns = useMemo(() => {
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
      return { ...c, 
        headerRenderer: (headerProps) => <HeaderRendererComponent {...headerProps} handleColumnsReorder={handleColumnsReorder} setFilters={setFilters} />
      };
    });
  }, [columns]);

  useEffect(() => {
    // Filter rows based on global search term
    // This will be inefficient with large datasets
    const filteredData = data.filter(row => 
      row.key.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
      JSON.stringify(row.current).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
    console.log("global filteredData", filteredData);
    setRows(filteredData);
  }, [data, debouncedSearchTerm]);

  // Not used yet, could be connected to a button
  function clearFilters() {
    setFilters(    {
      updatedAt: '',
      instanceId: '',
      taskId: '',
      familyId: '',
      type: '',
      processorId: '',
    });
  }

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
        <FilterContext.Provider value={filters}>
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
            rowKeyGetter={(row) => (row.key)}
            enableVirtualization={false} // Why this?
            style={{ overflowY: 'hidden' }} // So we scroll inside the expanded cell not in the data grid
            headerRowHeight={70}
            //className={filterContainerClassname}
          />
        </FilterContext.Provider>
      </DndProvider>
    </div>
  );

};

export default withTask(TaskSystemLog);