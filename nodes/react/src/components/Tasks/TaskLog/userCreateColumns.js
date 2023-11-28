/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import CellExpander from '../../Grid/CellExpander';
import ReactJson from '@microlink/react-json-view'

export function createColumns(rowDetailHeight, actionFormatter, mode) {
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
        name: 'type',
        dataPath: "current.type",
        width: 150,
        key: "type",
        flex: 1,
      },
      {  
        name: 'id',
        dataPath: "current.id",
        width: 150,
        key: "taskId",
        flex: 1,
        formatter: ({ row }) => {
          // chop "root.user." from the begining of the id
          const id = row.current.id;
          const shortId = id.split('.').slice(2).join('.');
          return shortId;
        },
      },
      {  
        name: 'topTerms', 
        dataPath: "topTerms",
        width: 300,
        key: "topTerms",
        flex: 1,
        formatter: ({ row }) => {
          const joined = row.topTerms.join(' ');
          return joined;
        },
      },
      {  
        name: 'action', 
        dataPath: "",
        //width: 100, // How can this size automatically?
        key: "action",
        flex: 1,
        // A link that will launch another task, we might need an commandArg to indicate the "founder"
        formatter: (cell) => actionFormatter({cell, mode}),
      },
    ];
    return columns;
  }