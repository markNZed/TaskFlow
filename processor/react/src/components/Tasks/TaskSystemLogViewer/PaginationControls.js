/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { Button } from '@mui/material';

function PaginationControls({totalCount, pageSize, page, setPage, rowCount }) {
  const totalPages = Math.ceil(totalCount / pageSize);
  
  function handleNextPage() {
    if (page < totalPages) {
      setPage((prevPage) => prevPage + 1);
    }
  }

  function handlePreviousPage() {
    if (page > 1) {
      setPage((prevPage) => prevPage - 1);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Button variant="outlined" onClick={handlePreviousPage} disabled={page <= 1}>
        Previous
      </Button>
      <span>{`Page ${page} of ${totalPages}`} with {Math.min(rowCount, pageSize)} of {totalCount} results</span>
      <Button variant="outlined" onClick={handleNextPage} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  );
}

export default PaginationControls;