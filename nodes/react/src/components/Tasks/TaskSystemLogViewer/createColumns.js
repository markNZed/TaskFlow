/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import CellExpander from './CellExpander';
import ReactJson from '@microlink/react-json-view'

export function createColumns(rowDetailHeight) {
    const columns = [
      {
        key: 'expanded',
        disableFilter: true,
        name: '',
        minWidth: 30,
        width: 30,
        colSpan(args) {
          return args.type === 'ROW' && args.row.expanderType === 'DETAIL' ? columns.length  : undefined;
        },
        cellClass(row) {
          return row.expanderType === 'DETAIL'
              ? { padding: '24px' }
              : undefined;
        },
        formatter({ row, tabIndex, onRowChange }) {
          if (row.expanderType === 'DETAIL') {
            return (
              <ReactJson 
                src={row.current} 
                style={{lineHeight: '15px', '--rdg-row-height': '15px', overflowY:'auto', maxHeight: rowDetailHeight + 'px'}}
                name={null}
                indentWidth={2}
                collapseStringsAfterLength={80}
                displayDataTypes={false}
                sortKeys={true}
                quotesOnKeys={false}
              />
            );
          }
          return (
            <CellExpander
              expanded={row.expanded}
              tabIndex={tabIndex}
              onCellExpand={() => {
                onRowChange({ ...row, expanded: !row.expanded });
              }}
            />
          );
        }
      },
      {  
        name: 'updatedAt', 
        dataPath: "updatedAt.date",
        queryDatatype: "date",
        width: 200,
        formatter: ({ row }) => {
          if (row.updatedAt) {
            const date = new Date(row.updatedAt);
            const timeString = date.toTimeString().split(' ')[0]; // Extracts hh:mm:ss
            return <time dateTime={row.updatedAt}>{date.toDateString()} {timeString}</time>;
          }
          return null;
        },
        key: "updatedAt",
        flex: 1,
      },
      {  
        name: 'instanceId', 
        dataPath: "current.instanceId",
        width: 50,
        key: "instanceId",
        flex: 1,
      },
      {  
        name: 'id',
        dataPath: "current.id",
        width: 300,
        key: "taskId",
        flex: 1,
      },
      {  
        name: 'familyId',
        dataPath: "current.familyId",
        width: 50,
        key: "familyId",
        flex: 1,
      },
      {  
        name: 'type',
        dataPath: "current.type",
        width: 150,
        key: "type",
        flex: 1,
      },
      {  
        name: 'processorId',
        dataPath: "current.processor.initiatingProcessorId",
        width: 50,
        key: "processorId",
        flex: 1,
      },
      {  
        name: 'state',
        dataPath: "current.state.current",
        width: 100,
        key: "state",
        flex: 1,
      },
      {  
        name: 'user',
        dataPath: "current.user.id", 
        width: 150,
        key: "user",
        flex: 1,
      },
      {  
        name: 'command',
        dataPath: "current.processor.command",
        width: 100,
        key: "command",
        flex: 1,
      },
      {  
        name: 'coprocessing',
        queryDatatype: "boolean",
        dataPath: "current.processor.coprocessingDone",
        width: 50,
        key: "coprocessing",
        flex: 1,
      },
    ];
    return columns;
  }