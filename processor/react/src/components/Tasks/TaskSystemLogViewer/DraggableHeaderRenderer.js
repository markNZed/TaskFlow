import { useDrag, useDrop, useContext } from 'react-dnd';
import { headerRenderer } from 'react-data-grid';

function DraggableHeaderRenderer({ setFilters, ...props }) {

  const { onColumnsReorder, column, filters } = props;

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

  const useFilter = true;

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
        {headerRenderer({ column, ...props })}
      </div>
      <div>
        <input
          {...props }
          style={filterStyles}
          value={filters[column.key]}
          onChange={(e) =>
            setFilters({
              ...filters,
              [column.key]: e.target.value
            })
          }
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
        {headerRenderer({ column, ...props })}
    </div>
  );

}

export default DraggableHeaderRenderer;
