import React from "react";

/**
 * @desc the dynamic component is used to render various component dynamically
 * @params props: {
 *    useDefaultPath: this indicates that the component to be used is in the components folder if set to true else you would have to pass in a different component
 *    is: if `useDefaultPath` is true, you pass in the name of the component file or the path to the component in the component folder eg: NewComponent or BaseUI/NewComponent
 *    ...rest: the props to be passed into the new component
 * }
 */
const DynamicComponent = ({ is, useDefaultPath = true, ...rest }) => {
  console.log("DynamicComponent " + " is " + is + " useDefaultPath " + useDefaultPath + " " + `./../Tasks//${is}.js`)
  return React.createElement(
    useDefaultPath ? require(`./../Tasks/${is}.js`).default : is,
    {
      ...rest,
    }
  );
};

export default DynamicComponent;