import { useMemo, useRef } from 'react';
import useGlobalStateContext from "../../contexts/GlobalStateContext";
import { inspect } from '@xstate/inspect';

// useMemo so the iFrame does not get rerendered
// XState Inspect needs to find it when it is called

function IFrame() {

  const { globalState } =  useGlobalStateContext();
  const iframeRef = useRef();

  if (globalState.xStateDevTools && iframeRef.current) {
    inspect({
      //iframe: false,
      iframe: () => iframeRef.current,
      //url: "https://stately.ai/viz?inspect"
    });
  }

  const iframeElement = useMemo(() => {
    const iframeStyle = {
        width: '1600px',
        height: '500px',
        border: '0',
        display: 'block',
    };
    // Always return the iFrame so the inspect call can find it
    return <iframe
      ref={iframeRef}
      style={iframeStyle}
      title="XState Inspect"
      className="xstate"
    />
  }, [globalState.xStateDevTools]);

  return (
    <div>
      {iframeElement}
    </div>
  );

}

export default IFrame;