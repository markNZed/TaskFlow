/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect, useRef } from 'react';
import { TreeView, TreeItem } from '@mui/lab';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useGlobalStateContext } from '../../contexts/GlobalStateContext';

function WorkflowTree() {

    const { globalState, replaceGlobalState } = useGlobalStateContext();

    const [expanded, setExpanded] = useState([]);
    const [expandedAll, setExpandedAll] = useState(false);
    const [leafCount, setLeafCount] = useState(false);
    const leafCountRef = useRef(0);

    useEffect(() => {
      setTimeout(() => {
        // Your code here will run after rendering has finished
        if (tempNodeIds.length > 0 && !expandedAll) {
          setExpandedAll(true)
          setExpanded(tempNodeIds)
        }
      }, 0);
    }); // Effect runs after every render but will set expanded only once

    let tempNodeIds = []

    const handleToggle = (event, nodeIds) => {
        setExpanded(nodeIds);
    };

    function handleSelectNode(node) {
      replaceGlobalState('selectedTaskId', node.id);
    }

    function countSubtreeLeafNodes() {
      let leafCountLocal = 0;
      Object.keys(globalState.workflowsTree).forEach((nodeId) => {
        if (globalState.workflowsTree[nodeId].leaf === true) {
          leafCountLocal++;
        }
      });
      setLeafCount(leafCountLocal)
      return leafCountLocal
    }  

    useEffect(() => {
      if ( globalState.workflowsTree && globalState?.workflowLeafCount !== leafCount ) {
        countSubtreeLeafNodes()
        //const subtreeLeafCount = countSubtreeLeafNodes('root');
        // This code will run after the component mounts and renders
        replaceGlobalState('workflowLeafCount', countSubtreeLeafNodes())
      }
    });


    function renderTree(nodes, id, handleSelectNode, propagateDefault) {
      if (!nodes) {return ''}
      
      const node = nodes[id]
      if (!node) {
        // May not exist because of permissions
        // Would be better to strip from children also
        return ''
      }
      const { label, children, initiator } = node;
      //console.log(id)
      if (propagateDefault) {
          tempNodeIds = [...tempNodeIds, id];
      }
      
      if (children && children.length > 0) {
          if (initiator) {
            return (
              <TreeItem key={id} nodeId={id} label={label} >
                {children.map((child) => renderTree(nodes, child, handleSelectNode, propagateDefault))}
              </TreeItem>
            );
          } else {
            return children.map((child) => renderTree(nodes, child, handleSelectNode, propagateDefault))
          }
      } else {
          if (!initiator) {return ''}
          globalState.workflowsTree[id].leaf = true
          if (propagateDefault && node?.default) {
              handleSelectNode(node)
          }
          return (
          <TreeItem
              key={id}
              label={label}
              nodeId={id}
              onClick={() => handleSelectNode(node)}
          />
          );
      }
    }

    if (!globalState.workflowsTree) {
      return <div>Loading...</div>;
    }
  
    return (
      <div className="workflowTree">
        <TreeView
          aria-label="workflows"
          defaultCollapseIcon={<ExpandMoreIcon />}
          defaultExpandIcon={<ChevronRightIcon />}
          expanded={expanded}
          onNodeToggle={handleToggle}
        >
          { renderTree(globalState.workflowsTree, 'root', handleSelectNode, true) }
        </TreeView>
      </div>
    );
}

export default React.memo(WorkflowTree)