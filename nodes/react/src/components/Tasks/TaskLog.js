/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useMemo, useCallback } from "react";
import withTask from "../../hoc/withTask";
import 'react-data-grid/lib/styles.css';
import DataGrid from 'react-data-grid';
import DragFilterHeader from '../Grid/DragFilterHeader';
import TaskQueryBuilder from './Shared/TaskQueryBuilder';
import PaginationControls from '../Grid/PaginationControls';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button, Menu, MenuItem, Checkbox, TextField } from '@mui/material';
import useGlobalStateContext from "../../contexts/GlobalStateContext";

/*
Review Qs
  * Given the features we are using are there better free data grid alternatives?
  * How to deal with DragFilterHeader losing focus on remounting?
  * Is createContext really needed as it seems we re-render anyway

Issues:
  Is react-data-grid a good choice e.g. https://github.com/adazzle/react-data-grid/issues/3043
    react-data-grid examples seem to be out of date, check the index.ts in node_modules
  Date picker for datatype date

Ideas:
  Streaming of a query to the browser e.g. tail
  Being able to view through time - like "playing" the log
  React-Flow
  Testing
*/

const TaskLog = (props) => {

  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  function initFilters(columns) {
    const filters = {};
    if (columns) {
      columns.forEach(column => {
        if (!columns.disableFilter) {
          filters[column.key] = '';
        }
      });
    }
    //console.log("initFilters", filters);
    return filters;
  }

  // Custom Formatter component, for different actions/buttons
  const actionFormatter = ({cell, mode}) => {
    //console.log("actionFormatter", cell, mode);
    const row = cell.row;

    // Click handler for clone action
    const handleClickClone = () => {
      modifyTask({ 
        command: "start",
        commandArgs: {
          init: {
            id: "root.system.taskclone",
            input: {
              cloneInstanceId: task.input.cloneInstanceId,
              cloneId: task.input.cloneId,
              cloneFamilyId: task.input.cloneFamilyId,
              cloneUpdatedAt: row.updatedAt,
            }
          }
        },
        "commandDescription": `Clone task ${row.taskId} from instanceId ${row.current.instanceId}`,
      });
    };

    // Click handler for restart action
    const handleClickContinue = () => {
      // Implement restart logic here
      modifyTask({ 
        command: "start",
        commandArgs: {
          init: {
            id: "root.system.taskclone",
            input: {
              cloneInstanceId: row.current.instanceId,
              cloneId: row.taskId,
              cloneFamilyId: row.current.familyId,
              cloneContinue: true, // take the latest
            }
          }
        },
        "commandDescription": `Continue task ${row.taskId} from instanceId ${row.current.instanceId}`,
      });
    };

    // Click handler for back action
    // eslint-disable-next-line no-unused-vars
    const handleClickBack = () => {
      // Switch the mode back to selectFounder and reload
    };

    // Click handler for select action
    const handleClickSelect = () => {
      console.log("handleClickSelect", row);
      // Need to refresh the query using the familyId of the current row
      // change the mode to selectState
      modifyTask({
        "request.mode": "selectState",
        "state.autoQuery": false,
        "request.queryBuilder": {},
        "input.cloneInstanceId": row.current.instanceId,
        "input.cloneId": row.taskId,
        "input.cloneFamilyId": row.current.familyId,
        "command": "update",
        "commandDescription": `Switch from selectFounder to selectState for ${row.current.familyId}`,
      });
    };

    switch (mode) {
      case "selectFounder":
        return (
          <>
            <Button variant="contained" size="small" onClick={handleClickSelect} style={{ marginRight: '10px' }}>History</Button>
            <Button variant="contained" size="small" onClick={handleClickContinue}>Continue</Button>
          </>
        )
      case "selectState":
        return (
          <>
            <Button variant="contained" size="small" onClick={handleClickClone}>Clone</Button>
            {/* <Button variant="contained" size="small" onClick={handleClickBack}>Back</Button> */}
          </>
        );
      default:
        return null;
    }
  };

  const [createColumnsFn, setCreateColumnsFn] = useState(null);
  
  // Dynamic loading of the column definitions
  useEffect(() => {
    const createColumnsFileName = task.config.local.createColumns + "CreateColumns.js";
    import('./TaskLog/' + createColumnsFileName)
      .then((module) => {
        console.log("module ", createColumnsFileName);
        setCreateColumnsFn(() => module.createColumns);
        return module.createColumns;
      })
      .then((createColumns) => {
        const initialColumns = createColumns(rowDetailHeight, actionFormatter, task.config.local.mode);
        //console.log("initialColumns", initialColumns);
        setColumns(initialColumns);
        const initFiltersOut = initFilters(initialColumns);
        //console.log("initFiltersOut", initFiltersOut);
        setFilters(initFiltersOut);
      })
      .catch((error) => {
        console.error(`Failed to import ${createColumnsFileName}:`, error);
      });
  }, []);

  const rowDetailHeight = task.config.local.rowDetailHeight;
  const initPageSize = task.config.local.pageSize;
  const [mode, setMode] = useState(task.config.local.mode);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [data, setData] = useState([]);
  const [rows, setRows] = useState([]);
  const [sortedRows, setSortedRows] = useState([]); 
  const [columns, setColumns] = useState([]);
  const [sortColumns, setSortColumns] = useState([]);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const onSortColumnsChange = useCallback((sortColumns) => {
    setSortColumns(sortColumns.slice(-1));
  }, []);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [prevPage, setPrevPage] = useState(1);
  const [pageSize, setPageSize] = useState(initPageSize); // entries per page
  const [totalCount, setTotalCount] = useState(0);
  const { globalState, setGlobalStateEntry } = useGlobalStateContext();

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  useEffect(() => {
    if (globalState.lastSelectedTaskId && globalState.lastSelectedTaskId === task.id) {
      setGlobalStateEntry("maxWidth", "100%");
    }
  }, [globalState.lastSelectedTaskId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // Adjust the delay to your liking
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Build the correct data structure for react-data-grid 
  const transformedData = useMemo(() => {
    if (!task.response.tasks || !columns) return [];
    return task.response.tasks.map(t => {
      const transformedFields = {
        expanderType: 'MASTER',
        expanded: false,
        key: t._id,
        current: t.current,
      };
      columns.forEach(col => {
        if (col.dataPath) {
          const value = col.dataPath.split('.').reduce((acc, prop) => acc && acc[prop], t);
          transformedFields[col.key] = value;
        }
      });
      let command = transformedFields["command"];
      if (command === "update" && t.current.node?.commandArgs?.sync) {
        transformedFields["command"] += "(sync)";
      }
      transformedFields["coprocessing"] = transformedFields["coprocessing"] ? "true" : "false";
      //console.log("transformedFields", transformedFields);
      return transformedFields;
    });
  }, [task.response.tasks, columns]);

  // Task state machine
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        break;
      case "query":
        if (task.input?.query) {
          // Transfer the input into a request and update the task
          // Also clear down the input
          modifyTask({ 
            "input.query": null,
            "request": task.input.query,
            "response": {}, // Need to clear out old repsonses in case new response is smaller (diff would not replace old data)
            "command": "update",
            "commandDescription": "Transition to query state with query request",
          });
        }
        break;
      case "response":
        if (createColumnsFn) {
          if (mode !== task.config.local.mode) {
            setMode(task.config.local.mode);
          }
          const localInitialColumns = createColumnsFn(rowDetailHeight, actionFormatter, task.config.local.mode);
          console.log("mode change", mode, localInitialColumns);
          //console.log("localInitialColumns", localInitialColumns);
          setColumns(localInitialColumns);
          const initFiltersOut = initFilters(localInitialColumns);
          //console.log("initFiltersOut", initFiltersOut);
          setFilters(initFiltersOut);
          setData(transformedData);
          //console.log("transformedData", transformedData);
          setTotalCount(task.response.total)
          nextState = "query";
        } else {
          console.log("waiting for createColumnsFn");
        }
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, createColumnsFn]);
  
  // Apply filtering to each row
  const filteredRows = useMemo(() => {
    console.log("Row count before filter", rows.length, filters);
    const result = rows.filter((r) => {
      return Object.keys(filters).every((key) => {
        // Some key values may be undefined so ".includes" would fail
        if (r[key] === undefined) {
          r[key] = '';
        }
        return filters[key] ? r[key].includes(filters[key]) : true;
      });
    });
    console.log("Row count after filter", result.length);
    return result;
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
    if (columns && filters) {
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
      const visibleColumns = columns.filter(column => !hiddenColumns.includes(column.key));
      return visibleColumns.map((c) => {
        return { ...c, 
          headerRenderer: (headerProps) => <HeaderRendererComponent {...headerProps} handleColumnsReorder={handleColumnsReorder} setFilters={setFilters} />
        };
      });
    } else {
      return [];
    }
  }, [columns, hiddenColumns]);

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
    if (columns) {
      return columns
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
    }
  }, [columns]);

  return (
    <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column'}}>
      <TaskQueryBuilder 
        onQueryComplete={handleQueryComplete} 
        fields={queryFields}
        queryHistory={task.state.queryHistory}
        queryHistoryPtr={task.state.queryHistoryPtr}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button variant="contained" size="medium" onClick={handleToggleColumnClick} sx={{ marginLeft: '1rem', width: 'fit-content' }}> 
          Toggle Columns
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleToggleColumnClose}
        >
          {columns && columns.map(column => (
            <MenuItem key={column.key} onClick={() => toggleColumn(column.key)}>
              <Checkbox checked={!hiddenColumns.includes(column.key)} />
              {column.name}
            </MenuItem>
          ))}
        </Menu>
        <TextField
          type="text"
          placeholder="Search in page..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{width: '300px'}}
          variant="outlined"
        />
      </div>
      <DndProvider backend={HTML5Backend}>
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
      </DndProvider>
    </div>
  );

};

export default withTask(TaskLog);