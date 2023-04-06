import React, { useState, useEffect } from 'react';
import { TreeView, TreeItem } from '@mui/lab';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { serverUrl } from '../App';

function ExerciseTree(props) {
    const [exercises, setExercises] = useState(null);
    const [expanded, setExpanded] = useState([]);
    let tempNodeIds = []

    const handleToggle = (event, nodeIds) => {
        setExpanded(nodeIds);
    };

    useEffect(() => {
      fetch(serverUrl + 'api/exercises', {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
            setExercises(data);
            // We can't set the default node during rendering because it impacts the state of a parent
            // So here we call renderTree only to set the default state. There must be a better way
            // to do this as we are calling renderTree too many times.
            renderTree(data, handleSelectNode, true);
            setExpanded(tempNodeIds)
        })
        .catch(error => console.error('Error fetching exercises:', error));
    }, []); //handleSelectNode, renderTree, tempNodeIds
  
    // It would be better to move the renderTree function outside of the ExerciseTreeView component and define it as a separate utility function that can be used in other components as well.
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
        } else if (node?.exercise) {
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
        props.onSelectExercise(node);
    }

    if (!exercises) {
      return <div>Loading...</div>;
    }
  
    return (
      <div className="exerciseTree">
        <TreeView
          aria-label="exercises"
          defaultCollapseIcon={<ExpandMoreIcon />}
          defaultExpandIcon={<ChevronRightIcon />}
          expanded={expanded}
          onNodeToggle={handleToggle}
        >
          {renderTree(exercises, handleSelectNode)}
        </TreeView>
        {props.selectedExercise?.name && (
          <div>
            Selected Exercise: {props.selectedExercise.name}
          </div>
        )}
      </div>
    );
}

export default React.memo(ExerciseTree);