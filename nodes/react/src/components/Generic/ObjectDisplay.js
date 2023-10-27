/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React from "react";

const ObjectDisplay = ({ obj, level = 0 }) => {
  const indent = 10 * level; // 40px indentation for each level
  if (!obj) {
    return null;
  }
  return (
    <ul style={{ textAlign: 'left', marginLeft: `${indent}px` }}>
      {Object.keys(obj).map((key, index) => (
        <li key={index}>
          {key}:{" "}
          {typeof obj[key] === "object" ? (
            <ObjectDisplay obj={obj[key]} level={level + 1} />
          ) : (
            obj[key]
          )}
        </li>
      ))}
    </ul>
  );
};

export default ObjectDisplay;
