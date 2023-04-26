export function updateState(setState, update) {
    setState(prevState => ({ ...prevState, ...update }));
}

// e.g. delta(() => {updateStep('input')})
export const delta = (callback, delay=0) => setTimeout(callback, delay);
