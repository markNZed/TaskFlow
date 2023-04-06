import React from 'react';

function ObjectDisplay({ data }) {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div>
      <pre>{jsonString}</pre>
    </div>
  );
}

export default ObjectDisplay;