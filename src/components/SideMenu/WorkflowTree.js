import React, { useState, useEffect } from 'react';
import { TreeView, TreeItem } from '@mui/lab';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useGlobalStateContext } from '../../contexts/GlobalStateContext';

function WorkflowTree() {

    const { globalState, replaceGlobalState } = useGlobalStateContext();

    const [expanded, setExpanded] = useState([]);
    const [expandedAll, setExpandedAll] = useState(false);

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
      replaceGlobalState('selectedTaskId', node.id + '.start');
    }

    // It would be better to move the renderTree function outside of the workflowTreeView component and define it as a separate utility function that can be used in other components as well.
    function renderTree(nodes, id, handleSelectNode, propagateDefault) {
        if (!nodes) {return ''}
        
        const node = nodes[id]
        if (!node) {
          // May not exist because of permissions
          // Would be better to strip from children also
          return ''
        }
        const { label, children } = node;
        //console.log(label, children)
        if (propagateDefault) {
            tempNodeIds = [...tempNodeIds, id];
        }
        
        if (children && children.length > 0) {
            return (
            <TreeItem key={id} nodeId={id} label={label}>
                {children.map((child) => renderTree(nodes, child, handleSelectNode, propagateDefault))}
            </TreeItem>
            );
        } else {
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
          {renderTree(globalState.workflowsTree, 'root', handleSelectNode, true)}
        </TreeView>
      </div>
    );
}

export default React.memo(WorkflowTree);