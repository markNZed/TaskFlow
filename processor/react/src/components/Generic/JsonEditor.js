import React from 'react';
import { JsonEditor as Editor } from 'jsoneditor-react18';

const JsonEditor = ({ initialData, onDataChanged }) => {

  return (
    <div>
      <Editor value={initialData} onChange={onDataChanged} />
    </div>
  );
}

export default JsonEditor;
