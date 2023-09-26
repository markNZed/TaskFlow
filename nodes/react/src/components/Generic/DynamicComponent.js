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
  let Component;

  if (!is) {
    console.log("Warning: DynamicComponent ", rest);
  }

  try {
    //console.log("loading " + `./../Tasks/${is}`)
    Component = useDefaultPath ? require(`./../Tasks/${is}`).default : is;
  } catch (error) {
    console.warn(`Failed to load component ${is}:`, error);
    return "";
  }

  return <Component {...rest} />;
};

export default DynamicComponent;
