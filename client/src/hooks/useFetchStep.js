import { useState, useEffect, useRef } from 'react';
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import { serverUrl } from '../config';

const useFetchStep = (fetchNow, myTask, myStep) => {
  const { globalState } = useGlobalStateContext();
  const [fetchResponse, setFetchResponse] = useState('');
  const [fetched, setFetched] = useState('');
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (fetchNow) {
      console.log("useFetchStep ", myTask.id)

      async function fetchTask() {

        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: globalState.sessionId,
            task: myTask,
          }),
        };

        const response = await fetch(`${serverUrl}api/task/update`, requestOptions);
        const data = await response.json();

        if (isMounted.current) {
          if (data?.error) {
            console.log("ERROR " + data.error.message);
          }
          setFetchResponse(data);
          setFetched(myStep);
        }
      }

      fetchTask().catch((error) => {
        console.log("ERROR " + error.message);
        if (isMounted.current) {
          setFetched(myStep);
        }
      });
    }
  }, [fetchNow]);

  return { fetchResponse, fetched };
};

export default useFetchStep;