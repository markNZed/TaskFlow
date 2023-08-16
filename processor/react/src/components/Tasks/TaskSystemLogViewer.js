/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useMemo, useCallback, useContext } from "react";
import withTask from "../../hoc/withTask";
import 'react-data-grid/lib/styles.css';
import DataGrid from 'react-data-grid';
import DraggableHeaderRenderer from './TaskSystemLogViewer/DraggableHeaderRenderer';
import CellExpanderFormatter from './TaskSystemLogViewer/CellExpanderFormatter';
import TaskSystemLogViewerQueryBuilder from './TaskSystemLogViewer/QueryBuilder';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ReactJson from '@microlink/react-json-view'

/*
The task keys that could be initially hidden but can be added as columns:

* config.label
* name
* output (this is an object)
* input (this is an object)
* request (this is an object)
* response (this is an object)

Being able to view through time - like "playing" the log
react-data-grid https://github.com/adazzle/react-data-grid 
  https://github.com/adazzle/react-data-grid/tree/main/website/demos // Not aligned with latest code ?
  View the index.ts in node_models to get an idea of the interface
Issues:
  Coprocessor will not log sync messages that are not processed by the rxjs pipeline
  https://github.com/adazzle/react-data-grid/issues/3043
  Date picker for datatype date
  React warnings e.g. Warning: React does not recognize the `sortDirection`
Ideas:
  Streaming of a query to the browser e.g. tail
  React-Flow
  Testing
  Could react-querybuilder use the Task JSON schema?
  Replace the filtering inputs with a page option for the query builder
    Mingo provides MongoDB-style query syntax on arrays of objects in JavaScript
*/

const rowDetailHeight = 500;

function getComparator(sortColumn) {
  switch (sortColumn) {
    case 'updatedAt':
    case 'instanceId':
    case 'taskId':
    case 'familyId':
    case 'type':
    case 'processorId':
    case 'state':
    case 'user':
    case 'command':
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
          return (
            <ReactJson 
              src={row.current} 
              style={{lineHeight: '15px', '--rdg-row-height': '15px', overflowY:'auto', maxHeight: rowDetailHeight + 'px'}}
              name={null}
              indentWidth={2}
              collapseStringsAfterLength={80}
              displayDataTypes={false}
              sortKeys={true}
              quotesOnKeys={false}
            />
          );
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
      width: 300,
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
    {  
      name: 'state', 
      width: 100,
      key: "state",
      flex: 1,
    },
    {  
      name: 'user', 
      width: 150,
      key: "user",
      flex: 1,
    },
    {  
      name: 'command', 
      width: 100,
      key: "command",
      flex: 1,
    },
  ];
  return columns;
}

// Context is needed to read filter values otherwise columns are
// re-created when filters are changed and filter loses focus

const TaskSystemLogViewer = (props) => {

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
      state: '',
      user: '',
      command: '',
    }
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100); // entries per page
  const [totalCount, setTotalCount] = useState(0);

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
        key: t._id,
        current: t.current,
        state: t.current?.state?.current,
        user: t.current.user.id,
        command: t.current.processor.command,
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
        setTotalCount(task.response.total)
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
        (filters.state ? r.state.includes(filters.state) : true) &&
        (filters.user ? r.user.includes(filters.user) : true) &&
        (filters.command ? r.command.includes(filters.command) : true) &&
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
  // Need the context becausee we don't want to pass filters that will be updated inside the component 
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
      state: '',
      user: '',
      command: '',
    });
  }

  function transformToMongoSortCriteria(sortDescriptors) {
    const mongoSortCriteria = {};
    sortDescriptors.forEach(descriptor => {
        const direction = (descriptor.direction === 'ASC') ? 1 : -1;
        mongoSortCriteria[descriptor.columnKey] = direction;
    });
    return mongoSortCriteria;
  }

  const handleQueryComplete = (queryBuilder, query) => {
    const sortCriteria = transformToMongoSortCriteria(sortColumns);
    console.log("sortCriteria", sortCriteria);
    if (task.state.current === "query") {
      modifyTask({ 
        "request.sortCriteria": sortCriteria,
        "request.query": query, 
        "request.queryBuilder": queryBuilder,
        "request.page": page,
        "request.limit": limit,
        "command": "update" 
      });
    }
    console.log("handleQueryComplete page:", page, "limit:", limit, "query:", query);
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

  useEffect(() => {
    handleQueryComplete();
  }, [page]);

  function PaginationControls() {
    const totalPages = Math.ceil(totalCount / limit);
    
    function handleNextPage() {
      if (page < totalPages) {
        setPage((prevPage) => prevPage + 1);
      }
    }
  
    function handlePreviousPage() {
      if (page > 1) {
        setPage((prevPage) => prevPage - 1);
      }
    }
  
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={handlePreviousPage} disabled={page <= 1}>
          Previous
        </button>
        <span>{`Page ${page} of ${totalPages}`}</span>
        <button onClick={handleNextPage} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
      <h2>System Log Viewer</h2>
      <TaskSystemLogViewerQueryBuilder 
        onQueryComplete={handleQueryComplete} 
        fields={[
          { name: 'current.meta.updatedAt.date', label: 'Updated At', datatype: 'date', },
          { name: 'current.instanceId', label: 'Instance ID' },
          { name: 'current.id', label: 'Task ID' },
          { name: 'vfamilyId', label: 'Family ID' },
          { name: 'current.type', label: 'Type' },
          { name: 'current.processor.id', label: 'Processor ID' },
          { name: 'current.state.current', label: 'State' },
          { name: 'current.user.id', label: 'User ID' },
          { name: 'current.processor.command', label: 'Command' },
        ]}
        queryHistory={task.state.queryHistory}
        queryHistoryPtr={task.state.queryHistoryPtr}
      />
      {/*
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{width: '300px'}}
      />
      */}
      <DndProvider backend={HTML5Backend}>
        <FilterContext.Provider value={filters}>
          <PaginationControls />
          <DataGrid 
            columns={draggableColumns}
            sortColumns={sortColumns}
            onSortColumnsChange={onSortColumnsChange}
            rows={sortedRows}
            onRowsChange={onRowsChange}
            defaultColumnOptions={{
              sortable: true,
              resizable: true
            }}
            rowHeight={(prop) => { 
              if (prop.row.expanderType === 'DETAIL') {
                return rowDetailHeight;
              } else { 
                return 30; 
              }
            }}
            rowKeyGetter={(row) => (row.key)}
            enableVirtualization={false} // Why this?
            //style={{ overflowY: 'hidden' }} // So we scroll inside the expanded cell not in the data grid
            headerRowHeight={70}
            pageSize={limit}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => setLimit(newSize)}
            className="fill-grid"
          />
          <PaginationControls />
        </FilterContext.Provider>
      </DndProvider>
    </div>
  );

};

export default withTask(TaskSystemLogViewer);