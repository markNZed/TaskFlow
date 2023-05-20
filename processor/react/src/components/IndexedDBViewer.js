/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import React, { useEffect, useState } from "react";
import { openStorage } from "../storage.js";
import 'react-data-grid/lib/styles.css';
import DataGrid from 'react-data-grid';

const columns = [
  { key: 'key', name: 'Key' },
  { key: 'value', name: 'Value', formatter: ({ row }) => JSON.stringify(row.value) }
];

const IndexedDBViewer = () => {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const storage = await openStorage();

      const indexedDBData = [];
      for await (const [key, value] of storage) {
        indexedDBData.push({ key, value });
      }
      
      setData(indexedDBData);
    };

    fetchData();
  }, []);

  // Filter rows based on search term
  const filteredData = data.filter(row => 
    row.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
    JSON.stringify(row.value).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h2>IndexedDB Viewer</h2>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
      <DataGrid columns={columns} rows={filteredData} />
    </div>
  );
};

export default IndexedDBViewer;

