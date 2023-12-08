/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useState, useEffect, useCallback } from "react";
import DataGrid, { SelectColumn } from 'react-data-grid';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import PaginationControls from '../Grid/PaginationControls';
import withTask from "../../hoc/withTask";
import generatePassword from 'password-generator';

const TaskUsers = (props) => {
  const {
    task,
    modifyTask,
    transition,
    log,
  } = props;

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState({});
  const [page, setPage] = useState(1);
  const [prevPage, setPrevPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalUserCount, setTotalUserCount] = useState(0);

  const generateEasyPassword = () => {
    // Generate a memorable password that's 10 characters long
    const newPassword = generatePassword(10, false, /[\w\d]/);
    setPassword(newPassword);
  };

  const columns = [
    SelectColumn,
    //{ key: 'id', name: 'ID' },
    { key: 'name', name: 'Username', minWidth: 200, cellClass: 'leftAlign' },
    { key: 'label', name: 'Name', minWidth: 200, cellClass: 'leftAlign' },
    { key: 'profile', name: 'Profile', minWidth: 400, cellClass: 'leftAlign' },
    // More columns as needed
  ];

  useEffect(() => {
    console.log("selectedRows", selectedRows);
  }, [selectedRows]);

  // Task state machine
  useEffect(() => {
    if (!props.checkIfStateReady()) {return}
    let nextState;
    if (transition()) { log(`${props.componentName} State Machine State ${task.state.current}`) }
    switch (task.state.current) {
      case "start":
        nextState = "readAll";
        break;
      case "readAll":
        modifyTask({
          "input.action": "readAll",
          "input.page": page,
          "input.limit": limit,
          "command": "update",
          "commandDescription": "Fetching users",
        });
        nextState = "reactRequest";
        break;
      case "action":
        console.log("action", task.input);
        if (task.input.action === "create") {
          nextState = "create";
        } else if (task.input.action === "read") {
          nextState = "read";
        } else if (task.input.action === "update") {
          nextState = "update";
        } else if (task.input.action === "delete") {
          nextState = "delete";
        } else if (task.input.action === "readAll") {
          nextState = "readAll";
        }
        break;
      case "create":
        modifyTask({
          "command": "update",
          "commandDescription": "Creating new user",
        });
        nextState = "reactRequest";
        break;
      case "read":
        modifyTask({
            "command": "update",
            "commandDescription": "Read user",
        });
        nextState = "reactRequest";
        break;
      case "update":
        modifyTask({
            "command": "update",
            "commandDescription": "Updating user",
        });
        nextState = "reactRequest";
        break;
      case "delete":
        modifyTask({
          // [] is not deleting the array
          // null caused a hashDiff, should treat empty object as null ? 
          // Could use a set instead of an array
          "response.users": null, // clear users array (diff update is not good for delete)
          "command": "update",
          "commandDescription": "Deleting users",
        });
        nextState = "reactRequest";
        break;
      case "reactRequest":
        // Here you would typically wait for some response from the server
        // Once the response is received, you can transition to the next state
        break;
      case "hubResponse":
        // Handle the response from the server
        switch (task.input.action) {
          case "create":
            setUsers(task.response.users || []);
            setTotalUserCount(task.response.totalUserCount);
            break;
          case "read":
            setUser(task.response.user);
            break;
          case "readAll":
            setUsers(task.response.users || []);
            setTotalUserCount(task.response.totalUserCount);
            break;
          case "update":
            setUser(task.response.user);
            setUsers(task.response.users || []);
            break;
          case "delete":
            setUsers(task.response.users || []);
            setTotalUserCount(task.response.totalUserCount);
            break;
          default:
            console.log("ERROR unknown action : " + task.input.action);
        }
        modifyTask({
          "input.action": null,
        });
        setSelectedRows(new Set());
        // For example, you might refresh the user list
        nextState = "action";
        break;
      default:
        console.log("ERROR unknown state : " + task.state.current);
    }
    // Manage state.current
    props.modifyState(nextState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  // Handlers for user actions
  const handleCreateUser = useCallback(() => {
    modifyTask({
      "input.action": "create",
      "input.user": user,
      "input.password": password,
    });
    setIsDialogOpen(false);
    setPassword("");
  }, [user, password]);

  const handleUpdateUser = useCallback(() => {
    modifyTask({
      "input.action": "update",
      "input.user": user,
      "input.password": password,
    });
    setIsDialogOpen(false);
    setPassword("");
    setEditUser(null);
  }, [user, password]);

  const handleDeleteUser = useCallback(() => {
    modifyTask({
      "input.action": "delete",
      "input.usernames": [...selectedRows],
    });
  }, [selectedRows]);

  const handleCheckboxChange = (permission) => {
    let newGroups;
    if (user?.groupIds?.includes(permission)) {
      newGroups = user.groupIds.filter((group) => group !== permission);
    } else {
      newGroups = [...user.groupIds, permission];
    }

    // Update the user.groupIds with the selection
    setUser({ ...user, groupIds: newGroups });
  };

  // Handlers for dialog actions
  const openCreateDialog = () => {
    setIsDialogOpen(true);
    setEditUser(null);
    setUser({
      name: "",
      label: "",
      groupIds: [],
      profile: "",
    });
    generateEasyPassword(); // Generate a new password when opening the dialog
  };

  const openEditDialog = () => {
    if (selectedRows.size === 1) {
      const name = Array.from(selectedRows)[0];
      const user = users.find(u => u.name === name);
      user["groupIds"] = user.groupIds || [];
      setUser(user);
      //console.log("user", user);
      setPassword(""); // Don't prefill password for security
      setEditUser(name);
      setIsDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setPassword("");
    setEditUser(null);
  };

  function rowKeyGetter(row) {
    return row.name;
  }

  // User selects a new page of results
  useEffect(() => {
    if (prevPage !== page) {
      modifyTask({
        "input.action": "readAll",
      });
      setPrevPage(page);
    }
  }, [page]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', minWidth: '850px' }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', marginBottom: '20px' }}>
        <Button onClick={openCreateDialog}>Create User</Button>
        <Button onClick={openEditDialog} disabled={selectedRows.size !== 1}>Edit User</Button>
        <Button onClick={handleDeleteUser} disabled={selectedRows.size === 0}>Delete User</Button>
      </div>
      <PaginationControls totalCount={totalUserCount} pageSize={limit} page={page} setPage={setPage} rowCount={users?.length} />
      <DataGrid 
        columns={columns} 
        rows={users} 
        selectedRows={selectedRows} 
        onSelectedRowsChange={setSelectedRows} 
        rowKeyGetter={rowKeyGetter}
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newSize) => setLimit(newSize)}
        //className="fill-grid"
      />
      <Dialog open={isDialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>{editUser ? "Edit User" : "Create User"}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Username" fullWidth value={user.name} 
            onChange={(e) => setUser(p => {
              return {...p, name: e.target.value}
            })} 
            disabled={editUser !== null}
          />
          <TextField margin="dense" label="Name" fullWidth value={user.label} 
            onChange={(e) => setUser(p => { 
              return {...p, label: e.target.value}
            })} 
          />
          <TextField
            margin="dense"
            label="Password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button onClick={generateEasyPassword}>Generate Password</Button>
          Assign user groupIds:
          <div style={{ display: 'flex' }}>
            {task.user?.groupIds?.map((group, index) => (
              <label key={index} style={{ marginRight: '10px' }}>
                <input
                  type="checkbox"
                  checked={user?.groupIds?.includes(group)}
                  onChange={() => handleCheckboxChange(group)}
                />
                {group}
              </label>
            ))}
          </div>
          <TextField margin="dense" label="Profile" fullWidth value={user.profile} 
            onChange={(e) => setUser(p => { 
              return {...p, profile: e.target.value}
            })} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          {editUser ? <Button onClick={handleUpdateUser}>Update</Button> : <Button onClick={handleCreateUser}>Create</Button>}
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default withTask(TaskUsers);
