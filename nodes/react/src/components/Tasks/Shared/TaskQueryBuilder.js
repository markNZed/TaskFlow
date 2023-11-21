import React, { useState, useEffect } from 'react';
import { defaultValidator, formatQuery, QueryBuilder } from 'react-querybuilder';
import 'react-querybuilder/dist/query-builder.css';
import { QueryBuilderMaterial } from '@react-querybuilder/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { blueGrey } from '@mui/material/colors';
import { Button } from '@mui/material';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';


const TaskQueryBuilder = ({ fields, onQueryComplete, queryHistory, queryHistoryPtr }) => {
  const [query, setQuery] = useState({
    combinator: 'and',
    rules: [
      { field: 'updatedAt.date', operator: 'notNull', value: 'null' },
    ],
  });

  const [queryHistoryLocalPtr, setQueryHistoryLocalPtr] = useState(queryHistoryPtr);
  const [queryHistoryOffset, setQueryHistoryOffset] = useState(0);
  const [disablePrev, setDisablePrev] = useState(false);
  const [disableNext, setDisableNext] = useState(true);
  const queryHistoryLength = queryHistory ? queryHistory.length : 0;

  const muiTheme = createTheme({
    palette: {
      secondary: {
        main: blueGrey[500],
      },
    },
  });
  
  // When queryHistoryPtr changes we reset the history
  useEffect(() => {
    setQueryHistoryLocalPtr(queryHistoryPtr);
    setDisablePrev(false);
    setDisableNext(true);
    setQueryHistoryOffset(0);
  }, [queryHistoryPtr]);

  const handleSubmit = () => {
    onQueryComplete(query);
  };

  const handleQueryChange = (newQuery) => {
    setQuery(newQuery);
  };

  useEffect(() => {
    if (queryHistoryOffset === 0) {
      setDisableNext(true);
    } 
  }, [queryHistoryOffset]);

  const handlePreviousQuery = () => {
    let currentQueryHistoryLocalPtr = queryHistoryLocalPtr;
    currentQueryHistoryLocalPtr--;
    // If reached beginning of circular buffer 
    if (currentQueryHistoryLocalPtr < 0) {
      // buffer may have null entries that we skip 
      currentQueryHistoryLocalPtr = queryHistoryLength - 1;
      while (!queryHistory[currentQueryHistoryLocalPtr]) {
        currentQueryHistoryLocalPtr--;
      }
    }
    const previousQuery = queryHistory[currentQueryHistoryLocalPtr];
    if (previousQuery) {
      setQuery(previousQuery);
      if (currentQueryHistoryLocalPtr === queryHistoryPtr) {
        setQueryHistoryOffset(0);
        setDisableNext(true);
      } else {
        setQueryHistoryOffset(queryHistoryOffset-1);
        setDisableNext(false);
      }
      setQueryHistoryLocalPtr(currentQueryHistoryLocalPtr);
    } else {
      setDisablePrev(true);
    }
  };

  const handleNextQuery = () => {
    let currentQueryHistoryLocalPtr = queryHistoryLocalPtr;
    currentQueryHistoryLocalPtr++;
    // If reached end of circular buffer 
    if (currentQueryHistoryLocalPtr === queryHistoryLength) {
      currentQueryHistoryLocalPtr = 0;
    }      
    const nextQuery = queryHistory[currentQueryHistoryLocalPtr];
    if (nextQuery) {
      setQuery(nextQuery);
      setQueryHistoryLocalPtr(currentQueryHistoryLocalPtr);
      setQueryHistoryOffset(queryHistoryOffset+1);
      setDisablePrev(false);
    } else {
      setDisableNext(true);
    }
  };
  
  return (
    <div>
      <ThemeProvider theme={muiTheme}>
        <QueryBuilderMaterial>
          <QueryBuilder 
            fields={fields} 
            query={query} 
            onQueryChange={handleQueryChange}
            validator={defaultValidator}
          />
        </QueryBuilderMaterial>
      </ThemeProvider>
      <Box>
        <Paper elevation={3} sx={{ padding: '1rem', margin: '1rem', overflow: 'auto' }}>
            <Typography variant="body2" component="pre" style={{ fontFamily: 'monospace' }}>
                {queryHistoryOffset}:{formatQuery(query, 'mongodb')}
            </Typography>
        </Paper>
      </Box>
      {queryHistory && (
        <Button sx={{ marginLeft: '1rem' }} variant="outlined" size="small" onClick={handlePreviousQuery} disabled={disablePrev}>&lt;</Button>
      )}
      <Button sx={{ marginLeft: '1rem', marginRight: '1rem' }} variant="contained" onClick={handleSubmit}>Submit Query</Button>
      {queryHistory && (
        <Button sx={{ marginLeft: '1rem' }} variant="outlined" size="small" onClick={handleNextQuery} disabled={disableNext}>&gt;</Button>
      )}
    </div>
  );
};

export default TaskQueryBuilder;
