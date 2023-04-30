import { serverUrl } from '../config';

// This was extracted into a common util function because we set body_options_default

export const fetchTask = async (globalState, end_point, body_options) => {
    const body_options_default = {
      sessionId: globalState.sessionId,
      address: globalState?.address
    }
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...body_options_default, ...body_options }),
    };
  
    const response = await fetch(`${serverUrl}api/${end_point}`, requestOptions);
    const data = await response.json();
    return data;
};
  
