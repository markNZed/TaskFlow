import React from 'react';

function CellExpanderFormatter(props) {
  const { tabIndex, expanded, onCellExpand } = props;

  const styles = {
    cellExpand: {
      float: 'right',
      display: 'table',
      blockSize: '100%'
    },
    span: {
      display: 'table-cell',
      verticalAlign: 'middle',
      cursor: 'pointer'
    }
  };

  function handleKeyDown(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onCellExpand();
    }
  }

  return (
    <div style={styles.cellExpand}>
      <span style={styles.span} onClick={onCellExpand} onKeyDown={handleKeyDown}>
        <span tabIndex={tabIndex}>{expanded ? '\u25BC' : '\u25B6'}</span>
      </span>
    </div>
  );
}

export default CellExpanderFormatter;
