/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect, useRef } from "react";
import { TreeView, TreeItem } from "@mui/lab";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import useGlobalStateContext from "../../contexts/GlobalStateContext";

function TaskflowTree({ onClose }) {
  const { globalState, replaceGlobalState } = useGlobalStateContext();

  const [expanded, setExpanded] = useState([]);
  const [expandedAll, setExpandedAll] = useState(false);
  const [leafCount, setLeafCount] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      // Your code here will run after rendering has finished
      if (tempNodeIds.length > 0 && !expandedAll) {
        setExpandedAll(true);
        setExpanded(tempNodeIds);
      }
    }, 0);
  }); // Effect runs after every render but will set expanded only once

  let tempNodeIds = [];

  const handleToggle = (event, nodeIds) => {
    setExpanded(nodeIds);
  };

  function handleSelectNode(e, node) {
    replaceGlobalState("selectedTaskId", node.id);
    onClose(e);
  }

  function countSubtreeLeafNodes() {
    let leafCountLocal = 0;
    Object.keys(globalState.tasksTree).forEach((nodeId) => {
      if (globalState.tasksTree[nodeId].leaf === true) {
        leafCountLocal++;
      }
    });
    setLeafCount(leafCountLocal);
    return leafCountLocal;
  }

  useEffect(() => {
    if (
      globalState.tasksTree &&
      globalState?.taskflowLeafCount !== leafCount
    ) {
      countSubtreeLeafNodes();
      //const subtreeLeafCount = countSubtreeLeafNodes('root');
      // This code will run after the component mounts and renders
      replaceGlobalState("taskflowLeafCount", countSubtreeLeafNodes());
    }
  });

  function renderTree(nodes, id, handleSelectNode, propagateDefault) {
    if (!nodes) {
      return "";
    }

    const node = nodes[id];
    if (!node) {
      // May not exist because of permissions
      // Would be better to strip from children also
      return "";
    }
    const { label, childrenId, initiator, menu } = node;
    //console.log(id)
    if (propagateDefault) {
      tempNodeIds = [...tempNodeIds, id];
    }

    if (childrenId && childrenId.length > 0 && !initiator) {
      if (id !== "root") {
        if (menu) {
          return (
            <TreeItem key={id} nodeId={id} label={label}>
              {childrenId.map((child) =>
                renderTree(nodes, child, handleSelectNode, propagateDefault)
              )}
            </TreeItem>
          );
        } else {
          return childrenId.map((child) =>
            renderTree(nodes, child, handleSelectNode, propagateDefault)
          );
        }
      } else {
        return childrenId.map((child) =>
          renderTree(nodes, child, handleSelectNode, propagateDefault)
        );
      }
    } else {
      if (!initiator) {
        return "";
      }
      globalState.tasksTree[id].leaf = true;
      if (propagateDefault && node?.default) {
        handleSelectNode(null, node);
      }
      return (
        <TreeItem
          key={id}
          label={label}
          nodeId={id}
          onClick={(e) => handleSelectNode(e, node)}
        />
      );
    }
  }

  if (!globalState.tasksTree || !globalState?.hubId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="taskflowTree">
      <TreeView
        aria-label="taskflows"
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        expanded={expanded}
        onNodeToggle={handleToggle}
      >
        {renderTree(globalState.tasksTree, "root", handleSelectNode, true)}
      </TreeView>
    </div>
  );
}

export default TaskflowTree;
