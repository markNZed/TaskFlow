import React, { useEffect, useState, useRef } from "react";
import { useDrag, useDrop, useContext } from 'react-dnd';
import { headerRenderer } from 'react-data-grid';

function DragFilterHeader({ setFilters, ...props }) {

  const { onColumnsReorder, onSort, column, filters } = props;
  const [debouncedFilterInput, setDebouncedFilterInput] = useState(filters[column.key]);
  const [filterInput, setFilterInput] = useState(filters[column.key]);
  const useFilter = column.disableFilter ? false : true;

  const [{ isDragging }, drag] = useDrag({
    type: 'COLUMN_DRAG',
    item: { key: column.key },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'COLUMN_DRAG',
    drop(item) {
      onColumnsReorder(item.key, column.key);
    },
    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  useEffect(() => {
    if (debouncedFilterInput !== filters[column.key]) {
      setFilters({
        ...filters,
        [column.key]: debouncedFilterInput,
      });
    }
  }, [debouncedFilterInput]);

  // The debounce time is long because when filters is set then the parent will re-render
  // causing this component to unmount and we lose focus
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilterInput(filterInput);
    }, 1000); // Delay in ms
    return () => {
      clearTimeout(timeoutId);
    };
  }, [filterInput]);

  const filterStyles = {
    inlineSize: '100%',
    padding: '4px',
    fontSize: '14px'
  };

  function inputStopPropagation(event) {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.stopPropagation();
    }
  }

  return useFilter ? (
    <div
      ref={ref => {
        drag(ref);
        drop(ref);
      }}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? '#ececec' : undefined,
        cursor: 'move',
        height: 30,
      }}
      className={'filter-cell'} // Added this to get filter input showing in the cell
    >
    <>
      <div style={{textAlign: 'center'}}>
        {headerRenderer({ column, onSort })}
      </div>
      <div>
        <input
          style={filterStyles}
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value) }
          onKeyDown={inputStopPropagation}
        />
      </div>
      </>
    </div>
  ) : (
    <div
        ref={ref => {
          drag(ref);
          drop(ref);
        }}
        style={{
          opacity: isDragging ? 0.5 : 1,
          backgroundColor: isOver ? '#ececec' : undefined,
          cursor: 'move',
          textAlign: 'center'
        }}
      >
        {headerRenderer({ column, onSort })}
    </div>
  );

}

export default DragFilterHeader;
