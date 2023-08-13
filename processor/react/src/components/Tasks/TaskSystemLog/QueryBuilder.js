import React, { useState, useEffect } from 'react';
import { defaultValidator, formatQuery, QueryBuilder } from 'react-querybuilder';
import 'react-querybuilder/dist/query-builder.css';

const TaskSystemLogQueryBuilder = ({ fields, onQueryComplete, queryHistory, queryHistoryPtr }) => {
  const [query, setQuery] = useState({
    combinator: 'and',
    rules: [
      { field: 'current.id', operator: 'notNull', value: '' },
    ],
  });

  const [submittedQuery, setSubmittedQuery] = useState();
  const [submit, setSubmit] = useState(false);
  const [queryHistoryLocalPtr, setQueryHistoryLocalPtr] = useState(queryHistoryPtr);
  const queryHistoryLength = queryHistory ? queryHistory.length : 0;
  const [disablePrev, setDisablePrev] = useState(false);
  const [disableNext, setDisableNext] = useState(true);

  useEffect(() => {
    if (submittedQuery && submit) {
      onQueryComplete(query, submittedQuery);
      setSubmittedQuery(null);
      setSubmit(false);
    }
  }, [submittedQuery, submit]);

  useEffect(() => {
    setQueryHistoryLocalPtr(queryHistoryPtr);
    setDisablePrev(false);
    setDisableNext(true);
  }, [queryHistoryPtr]);

  useEffect(() => {
    console.log("query", query);
  }, [query]);

  useEffect(() => {
    console.log("queryHistoryLocalPtr", queryHistoryLocalPtr, queryHistoryPtr);
  }, [queryHistoryLocalPtr]);

  const handleSubmit = () => {
    setSubmittedQuery(formatQuery(query, 'mongodb'));
    setSubmit(true);
  };

  const handleQueryChange = (newQuery) => {
    setQuery(newQuery);
  };

  const handlePreviousQuery = () => {
    let currentQueryHistoryLocalPtr = queryHistoryLocalPtr;
    const previousQuery = queryHistory[currentQueryHistoryLocalPtr];
    if (previousQuery) {
      console.log("previousQuery", previousQuery);
      setQuery(previousQuery);
      currentQueryHistoryLocalPtr--;
      console.log("currentQueryHistoryLocalPtr, queryHistoryPtr", currentQueryHistoryLocalPtr, queryHistoryPtr);
      if (currentQueryHistoryLocalPtr < 0) {
        currentQueryHistoryLocalPtr = queryHistoryLength - 1;
        while (!queryHistory[currentQueryHistoryLocalPtr]) {
          currentQueryHistoryLocalPtr--;
        }
      }
      if (currentQueryHistoryLocalPtr === queryHistoryPtr) {
        setDisablePrev(true);
        setDisableNext(false);
      } else {
        setQueryHistoryLocalPtr(currentQueryHistoryLocalPtr);
        setDisableNext(false);
      }
    }
  };

  const handleNextQuery = () => {
    let currentQueryHistoryLocalPtr = queryHistoryLocalPtr;
    const nextQuery = queryHistory[queryHistoryLocalPtr];
    if (nextQuery) {
      console.log("nextQuery", nextQuery);
      setQuery(nextQuery);
      currentQueryHistoryLocalPtr++;
      if (currentQueryHistoryLocalPtr > queryHistoryLength - 1) {
        currentQueryHistoryLocalPtr = 0;
      }      
      if (queryHistoryLocalPtr === queryHistoryPtr) {
        setDisableNext(true);
        setDisablePrev(false);
      } else {
        setQueryHistoryLocalPtr(currentQueryHistoryLocalPtr);
        setDisablePrev(false);
      }
    }
  };
  
  return (
    <div>
      <QueryBuilder 
        fields={fields} 
        query={query} 
        onQueryChange={handleQueryChange}
        validator={defaultValidator}
      />
      <div style={{ marginLeft: '1rem' }}>
          <pre>{formatQuery(query, 'mongodb')}</pre>
      </div>
      {queryHistory && (
        <button onClick={handlePreviousQuery} disabled={disablePrev}>Previous</button>
      )}
      <button onClick={handleSubmit}>Submit Query</button>
      {queryHistory && (
        <button onClick={handleNextQuery} disabled={disableNext}>Next</button>
      )}
    </div>
  );
};

export default TaskSystemLogQueryBuilder;
