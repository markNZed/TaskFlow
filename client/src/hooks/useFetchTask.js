/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { useState, useEffect, useRef } from 'react';
import { useGlobalStateContext } from '../contexts/GlobalStateContext';
import { serverUrl } from '../config';

const useFetchTask = (fetchNow) => {
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

      console.log("useFetchTask ", fetchNow.id)

      async function fetchTask() {

        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: globalState.sessionId,
            task: fetchNow,
            address: globalState?.address
          }),
        };

        const response = await fetch(`${serverUrl}api/task/update`, requestOptions);
        const data = await response.json();
        console.log("Response from fetchTask ", data)

        if (isMounted.current) {
          if (data?.error) {
            console.log("ERROR " + data.error.message);
          }
          setFetchResponse(data);
          setFetched(data.id);
        }
      }

      fetchTask().catch((error) => {
        console.log("ERROR " + error.message);
        if (isMounted.current) {
          setFetched(false);
        }
      });
    }
  }, [fetchNow]);

  return { fetchResponse, fetched };
};

export default useFetchTask;