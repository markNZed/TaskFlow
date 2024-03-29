import React, { useEffect, useState, useRef } from 'react';
import { JsonEditor as Editor } from 'jsoneditor-react18';
import { JSONEditor } from "vanilla-jsoneditor";
//import "./VanillaJSONEditor.css";
import { utils } from "../../utils/utils.mjs";

function SvelteJSONEditor(props) {
  const refContainer = useRef(null);
  const refEditor = useRef(null);

  useEffect(() => {
    // create editor
    console.log("create editor", refContainer.current);
    refEditor.current = new JSONEditor({
      target: refContainer.current,
      props
    });

    return () => {
      // destroy editor
      if (refEditor.current) {
        console.log("destroy editor");
        refEditor.current.destroy();
        refEditor.current = null;
      }
    };
  }, []);

  // update props
  useEffect(() => {
    if (refEditor.current) {
      //console.log("update props", props);
      refEditor.current.updateProps(props);
    }
  }, [props]);

  return <div className="vanilla-jsoneditor-react" ref={refContainer}></div>;
}


const JsonEditor = ({ content, onDataChanged, sortObjectKeys, readOnly }) => {

  return (
    <div>
      <SvelteJSONEditor
        content={{json: sortObjectKeys ? utils.sortKeys(content) : content}}
        onChange={onDataChanged}
        readOnly={readOnly}
      />
    </div>
  );
}

export default JsonEditor;
