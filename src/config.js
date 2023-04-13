const socketProtocol = (window.location.protocol === 'https:' ? 'wss:' : 'ws:')

var socketHost = window.location.hostname
var socketPort = process.env.REACT_APP_WS_LOCALHOST_PORT || 5000
if (window.location.hostname !== "localhost") {
  socketPort = process.env.REACT_APP_WS_PORT || socketPort
  socketHost = process.env.REACT_APP_WS_HOST || 'localhost'
}

export const socketUrl = `${socketProtocol}//${socketHost}:${socketPort}/ws`
export const serverUrl = window.location.protocol + `//${socketHost}:${socketPort}/`
