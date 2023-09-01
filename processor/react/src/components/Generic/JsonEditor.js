import React, { useEffect, useState } from 'react';
import { JsonEditor as Editor } from 'jsoneditor-react18';

const JsonEditor = ({ initialData, onDataChanged, ...restProps }) => {
  const [editorData, setEditorData] = useState(initialData);
  const [editorKey, setEditorKey] = useState(0);

  // Update internal state when initialData prop changes
  useEffect(() => {
    setEditorData(initialData);
    setEditorKey(editorKey + 1);
  }, [initialData]);

  // Update parent component when internal state changes
  const handleChange = (newData) => {
    setEditorData(newData);
    onDataChanged(newData);
  };

  useEffect(() => {
    console.log("editorData", editorData)
  }, [editorData]);

  return (
    <div>
      <Editor key={editorKey} value={editorData} onChange={handleChange} {...restProps} />
    </div>
  );
}

export default JsonEditor;
