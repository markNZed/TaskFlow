export function updateState(setState, update) {
    setState(prevState => ({ ...prevState, ...update }));
}

export const delta = (callback) => setTimeout(callback, 0);
