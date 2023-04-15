import React, { useState, useEffect } from 'react';
import { TreeView, TreeItem } from '@mui/lab';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { serverUrl } from '../../config';

function WorkflowTree(props) {
    const [workflows, setworkflows] = useState(null);
    const [expanded, setExpanded] = useState([]);
    let tempNodeIds = []

    const handleToggle = (event, nodeIds) => {
        setExpanded(nodeIds);
    };

    useEffect(() => {
      fetch(serverUrl + 'api/workflows', {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
            setworkflows(data);
            // We can't set the default node during rendering because it impacts the state of a parent
            // So here we call renderTree only to set the default state. There must be a better way
            // to do this as we are calling renderTree too many times.
            renderTree(data, handleSelectNode, true);
            setExpanded(tempNodeIds)
        })
        .catch(error => console.error('Error fetching workflows:', error));
    }, []); //handleSelectNode, renderTree, tempNodeIds
  
    // It would be better to move the renderTree function outside of the workflowTreeView component and define it as a separate utility function that can be used in other components as well.
    function renderTree(node, handleSelectNode, propagateDefault = false) {
        if (!node) {return ""}

        const { id, name, children } = node;
        if (propagateDefault) {
            tempNodeIds = [...tempNodeIds, id];
        }
        
        if (children && children.length > 0) {
            return (
            <TreeItem key={id} nodeId={id} label={name}>
                {children.map((child) => renderTree(child, handleSelectNode, propagateDefault))}
            </TreeItem>
            );
        } else if (node?.tasks) {
            if (propagateDefault && node?.default) {
                handleSelectNode(node)
            }
            return (
            <TreeItem
                key={id}
                label={name}
                nodeId={id}
                onClick={() => handleSelectNode(node)}
            />
            );
        }
    }

    function handleSelectNode(node) {
        // props are read only
        props.onSelectworkflow(node);
    }

    if (!workflows) {
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
          {renderTree(workflows, handleSelectNode)}
        </TreeView>
        {props.selectedworkflow?.name && (
          <div>
            Selected workflow: {props.selectedworkflow.name}
          </div>
        )}
      </div>
    );
}

export default React.memo(WorkflowTree);