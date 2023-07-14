/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React from "react";
import Avatar from "@mui/material/Avatar";
import assistant from "../../../assets/assistant.svg";
import userSvg from "../../../assets/user.svg";

const Icon = ({ role, user }) => {
  //console.log("Icon component", role, user);

  if (role === "assistant") {
    return (
      <div className="profile">
        <img src={assistant} alt={role} />
      </div>
    );
  }

  if (user) {
    return <Avatar {...stringAvatar(user)} variant="square" />;
  }

  if (role === "user") {
    return (
      <div className="profile">
        <img src={userSvg} alt={role} />
      </div>
    );
  }

  return <Avatar {...stringAvatar(role)} variant="square" />;

};

export default React.memo(Icon);

function stringToColor(string) {
  let hash = 0;
  let i;

  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = "#";

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
}

function stringAvatar(name) {
  const avatarString = name.split(" ").reduce((initials, currentStr) => {
    if (currentStr.length > 0 && initials.length <= 2) {
      return initials + "" + currentStr[0];
    } else {
      return initials;
    }
  }, "");

  return {
    sx: {
      bgcolor: stringToColor(name),
      borderRadius: "5px",
      width: "36px",
      height: "36px",
    },
    children: avatarString,
  };
}
