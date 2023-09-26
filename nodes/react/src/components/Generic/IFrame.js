import React, { useEffect, useMemo, useRef } from 'react';
import useGlobalStateContext from "../../contexts/GlobalStateContext";
import { inspect } from '@xstate/inspect';

function IFrame() {

  const { globalState } =  useGlobalStateContext();
  const iframeRef = useRef();

  useEffect(() => {
    if (globalState.xStateDevTools && iframeRef.current) {
      inspect({
        iframe: () => iframeRef.current,
      });
    }
  }, [globalState.xStateDevTools, iframeRef.current]);

  const iframeElement = useMemo(() => {
    const iframeStyle = {
        width: '100%',
        height: '500px',
        border: '0',
        display: 'block'
    };
    return (
      <iframe
        ref={iframeRef}
        style={iframeStyle}
        title="XState Inspect"
        className="xstate"
      />
    );
  }, [globalState.xStateDevTools]);

  return (
    <div>
      {globalState.xStateDevTools ? iframeElement : null}
    </div>
  );
}

export default IFrame;
