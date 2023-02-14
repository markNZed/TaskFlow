export const fetchGptRes = async ({ queryKey }) => {
  const [k, newMsg, model, url] = queryKey;
  console.log('fetching backend...', k, newMsg, model, url);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...model,
      prompt: newMsg,
    }),
  });

  if (res.ok){
    const resData = await res.json();
    // console.log(resData)
    const parsedData = resData.bot.trim(); // Trim any trailing spaces/'\n'
    return parsedData;
  }
  else{
    throw new Error('Something went wrong');
  }

};