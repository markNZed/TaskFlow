import React, { useState, useEffect } from 'react';
import { defaultValidator, formatQuery, QueryBuilder } from 'react-querybuilder';
import 'react-querybuilder/dist/query-builder.css';

const TaskSystemLogQueryBuilder = ({ fields, onQueryComplete }) => {
  const [query, setQuery] = useState({
    combinator: 'and',
    rules: [
      { field: 'current.meta.updatedAt.date', operator: '>', value: '' }, // This is just a default rule for the sake of initialization
    ],
  });

  const [submittedQuery, setSubmittedQuery] = useState(query);
  const [querySent, setQuerySent] = useState(false);

  useEffect(() => {
    if (querySent === false && submittedQuery) {
      onQueryComplete(formatQuery(submittedQuery, 'mongodb'));
      setQuerySent(true);
    }
  }, [submittedQuery]);

  const handleSubmit = () => {
    setSubmittedQuery(query);
  };

  const handleQueryChange = (newQuery) => {
    setQuery(newQuery);
    setQuerySent(false); // Reset the querySent flag whenever the query changes
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
      <button onClick={handleSubmit}>Submit Query</button>
    </div>
  );
};

export default TaskSystemLogQueryBuilder;
