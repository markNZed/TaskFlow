import { useMemo } from 'react';
import useGlobalStateContext from "../../contexts/GlobalStateContext";
import { inspect } from '@xstate/inspect';

// useMemo so the iFrame does not get rerendered
// XState Inspect needs to find it when it is called

function IFrame() {

  const { globalState } =  useGlobalStateContext();

  const iframeStyle = useMemo(() => {

    inspect({
      //iframe: false,
      iframe: () => document.querySelector('iframe.xstate'),
      url: "https://stately.ai/viz?inspect"
    });

    return {
      width: '1600px',
      height: '500px',
      border: '0',
      display: globalState.xStateDevTools ? 'block' : 'none',
    };
  }, [globalState.xStateDevTools]);

  const iframeElement = (
    <iframe
      style={iframeStyle}
      title="XState Inspect"
      className="xstate"
    />
  );

  return (
    <div>
      {iframeElement}
    </div>
  );

}

export default IFrame;