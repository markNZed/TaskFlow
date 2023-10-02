/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import withTask from "../../hoc/withTask";

/*
Task Function
  
ToDo:
  
*/

const TaskHelloWorld = (props) => {

  // onDidMount so any initial conditions can be established before updates arrive
  props.onDidMount();

  return (
    <div>
      <h1>Hello World!</h1>
    </div>
  );
};

export default withTask(TaskHelloWorld);
