/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useMemo, useCallback, useContext } from "react";
import withTask from "../../hoc/withTask";
import 'react-data-grid/lib/styles.css';
import DataGrid from 'react-data-grid';
import DragFilterHeader from './TaskSystemLogViewer/DragFilterHeader';
import TaskQueryBuilder from './TaskSystemLogViewer/TaskQueryBuilder';
import PaginationControls from './TaskSystemLogViewer/PaginationControls';
import { createColumns } from './TaskSystemLogViewer/createColumns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button, Menu, MenuItem, Checkbox } from '@mui/material';

/*
Review Qs
  * Given the features we are using are there better free data grid alternatives?
  * How to deal with DragFilterHeader losing focus on remounting?
  * What is a clean way to deal with const element = document.getElementById('appDiv');
  * Is createContext really needed as it seems we re-render anyway

Issues:
  Is react-data-grid a good choic e.g. https://github.com/adazzle/react-data-grid/issues/3043
    react-data-grid examples seem to be out of date, check the index.ts in node_modules
  Date picker for datatype date

Ideas:
  Streaming of a query to the browser e.g. tail
  Being able to view through time - like "playing" the log
  React-Flow
  Testing
  Could react-querybuilder use the Task JSON schema
*/

const TaskSystemLogViewer = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  // Setup the initial filters dynamically based on initialColumns
  function initFilters(columns) {
    const filters = {};
    columns.forEach(column => {
      if (!columns.disableFilter) {
        filters[column.key] = '';
      }
    });
    return filters;
  }

  const rowDetailHeight = task.config.rowDetailHeight;
  const initPageSize = task.config.pageSize;
  const initialColumns = createColumns(rowDetailHeight);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [data, setData] = useState([]);
  const [rows, setRows] = useState([]);
  const [sortedRows, setSortedRows] = useState([]); 
  const [columns, setColumns] = useState(initialColumns);
  const [sortColumns, setSortColumns] = useState([]);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const onSortColumnsChange = useCallback((sortColumns) => {
    setSortColumns(sortColumns.slice(-1));
  }, []);
  const [filters, setFilters] = useState(initFilters(initialColumns));
  const [page, setPage] = useState(1);
  const [prevPage, setPrevPage] = useState(1);
  const [pageSize, setPageSize] = useState(initPageSize); // entries per page
  const [totalCount, setTotalCount] = useState(0);
  // Need the context becausee we don't want to pass filters and setFilters as props 
  // That would create a rendering loop when calling setFilters
  const FilterContext = React.createContext();

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

  // Build the correct data structure for react-data-grid 
  // The mapping comes from initialColumns except when processing e.g. command
  const transformedData = useMemo(() => {
    if (!task.response.tasks) return [];
    return task.response.tasks.map(t => {
      const transformedFields = {
        expanderType: 'MASTER',
        expanded: false,
        key: t._id,
        current: t.current,
      };
      initialColumns.forEach(col => {
        if (col.dataPath) {
          const value = col.dataPath.split('.').reduce((acc, prop) => acc && acc[prop], t);
          if (value !== undefined) {
            transformedFields[col.key] = value;
          }
        }
      });
      let command = transformedFields["command"];
      if (command === "update" && t.current.processor?.commandArgs?.sync) {
        transformedFields["command"] += "(sync)";
      }
      transformedFields["coprocessing"] = transformedFields["coprocessing"] ? "true" : "false";
      return transformedFields;
    });
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
        if (task.input.query) {
          // Transfer the input into a request and update the task
          // Also clear down the input
          modifyTask({ 
            "input.query": null,
            "request": task.input.query,
            "command": "update" 
          });
        }
        break;
      case "response":
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

  // Apply filtering to each row
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      return Object.keys(filters).every((key) => {
        return filters[key] ? r[key].includes(filters[key]) : true;
      });
    });
  }, [rows, filters]);

  // Generate function for sorting rows based on column
  // At the moment there is nothing specific but we could use the queryDatatype to select a filter function
  function getComparator(sortColumn) {
    switch (sortColumn) {
      default:
        return (a, b) => {
          if (typeof a[sortColumn] === 'string' && typeof b[sortColumn] === 'string') {
              return a[sortColumn].localeCompare(b[sortColumn]);
          } else {
              return a[sortColumn] === b[sortColumn] ? 0 : a[sortColumn] > b[sortColumn] ? 1 : -1;
          }
        };
    }
  }

  // Apply the sorting of rows based on chosen column
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

  const visibleColumns = columns.filter(column => !hiddenColumns.includes(column.key));

  const handleToggleColumnClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleToggleColumnClose = () => {
    setAnchorEl(null);
  };

  const toggleColumn = key => {
    setHiddenColumns(prevHiddenColumns => {
      if (prevHiddenColumns.includes(key)) {
        return prevHiddenColumns.filter(colKey => colKey !== key);
      } else {
        return [...prevHiddenColumns, key];
      }
    });
  };

  // Create a component so we can useContext inside it
  function HeaderRendererComponent({ handleColumnsReorder, ...props }) {
    const filters = useContext(FilterContext);
    return (
      <DragFilterHeader
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
    return visibleColumns.map((c) => {
      return { ...c, 
        headerRenderer: (headerProps) => <HeaderRendererComponent {...headerProps} handleColumnsReorder={handleColumnsReorder} setFilters={setFilters} />
      };
    });
  }, [visibleColumns]);

  // Filter visible rows based on global search term
  useEffect(() => {
    const filteredData = data.filter(row => 
      row.key.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
      JSON.stringify(row.current).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
    setRows(filteredData);
  }, [data, debouncedSearchTerm]);

  const handleQueryComplete = (queryBuilder) => {
    // Use the task input so it can be driven by other tasks
    modifyTask({ 
      "input.query.sortColumns": sortColumns,
      "input.query.queryBuilder": queryBuilder,
      "input.query.page": page,
      "input.query.pageSize": pageSize,
    });
    console.log("handleQueryComplete page:", page, "pageSize:", pageSize, "queryBuilder:", queryBuilder);
  }

  // User selects a new page of results
  useEffect(() => {
    if (prevPage !== page) {
      handleQueryComplete();
      setPrevPage(page);
    }
  }, [page]);

  // Manage the expanding of hidden row with Task data
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

  // Build the query fields for TaskQueryBuilder from initialColumns
  const queryFields = useMemo(() => {
    return initialColumns
      .filter(col => col.dataPath)
      .map(col => {
        const field = {
          name: col.dataPath,
          label: col.name,
        };
        if (col.queryDatatype) {
          field.datatype = col.queryDatatype;
        }
        return field;
      });
  }, [initialColumns]);

  return (
    <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
      <h2>System Log Viewer</h2>
      <TaskQueryBuilder 
        onQueryComplete={handleQueryComplete} 
        fields={queryFields}
        queryHistory={task.state.queryHistory}
        queryHistoryPtr={task.state.queryHistoryPtr}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button variant="outlined" onClick={handleToggleColumnClick} sx={{ width: 'fit-content' }}>
          Toggle Columns
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleToggleColumnClose}
        >
          {columns.map(column => (
            <MenuItem key={column.key} onClick={() => toggleColumn(column.key)}>
              <Checkbox checked={!hiddenColumns.includes(column.key)} />
              {column.name}
            </MenuItem>
          ))}
        </Menu>
        <input
          type="text"
          placeholder="Search in page..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{width: '300px'}}
        />
      </div>
      <DndProvider backend={HTML5Backend}>
        <FilterContext.Provider value={filters}>
          <PaginationControls totalCount={totalCount} pageSize={pageSize} page={page} setPage={setPage} rowCount={sortedRows.length} />
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
            enableVirtualization={false} // Due to dynamcic row heights
            headerRowHeight={70}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => setPageSize(newSize)}
            className="fill-grid"
          />
          <PaginationControls totalCount={totalCount} pageSize={pageSize} page={page} setPage={setPage} rowCount={sortedRows.length} />
        </FilterContext.Provider>
      </DndProvider>
    </div>
  );

};

export default withTask(TaskSystemLogViewer);