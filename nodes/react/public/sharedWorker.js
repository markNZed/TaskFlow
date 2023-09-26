if (typeof self.SharedWorkerGlobalScope !== undefined) {

  console.log("SharedWorkerGlobalScope");

  let portIdCounter = 0;
  var activeWorkerPorts = [];
  var activeWorkerIds = {};
  var activeWorkerCount = 0;
  var activeIds = [];


  self.onconnect = function (e) {
    const port = e.ports[0];

    // Assign a unique ID to the port
    port.id = portIdCounter++;
    activeWorkerPorts.push(port);
  
    // Handle incoming messages from any connected tab or window
    port.onmessage = function (e) {
      //console.log('Message received in shared worker:', e.data);
      if (e.data === "activeWorkerCount") {
        broadcastMessage("ping");
        activeWorkerCount = 0;
        activeIds = [];
        // Delayed broadcast of activeWorkerCount value
        setTimeout(function() {
          port.postMessage('activeWorkerCount:' + activeWorkerCount);
          // calculate lowerSlotId, which is the first missing ID in the list, and then send it as part of a message
          // Sort activeWorkerIds in ascending order
          activeIds.sort((a, b) => a - b);
          let lowerSlotId = -1;
          // Search for the first missing ID
          for(let i = 0; i < activeIds.length; i++){
            if(activeIds[i] != i){
              lowerSlotId = i;
              break;
            }
          }
          // If no missing ID, set lowerSlotId to the next available ID
          if(lowerSlotId == -1){
            lowerSlotId = activeIds.length || 0;
          }
          activeWorkerIds[port.id] = lowerSlotId;
          activeIds.push(activeWorkerIds[port.id]);
          port.postMessage("id:" + lowerSlotId);
        }, 1000); // Delay of 1 second (1000 milliseconds)
      } else if (e.data === "pong") {
        activeWorkerCount++;
        if (activeWorkerIds[port.id] !== undefined) {
          activeIds.push(activeWorkerIds[port.id]);
        }
      } else {
        // Process the message and send back a response
        const response = `Echo: ${e.data}`;
        port.postMessage(response);
      }
    };

    // Handle the shared worker disconnection
    port.onmessageerror = () => {
      // Decrement the active worker count when a worker is disconnected
      console.log("Shared worker disconnected due to error");
      broadcastMessage("error activeWorkerCount " + activeWorkerCount);
      activeWorkerCount--;
      // Remove the port from the array of active worker ports
      var index = activeWorkerPorts.indexOf(port);
      if (index !== -1) {
        activeWorkerPorts.splice(index, 1);
        activeWorkerIds.splice(index, 1);
      }
    };
     
    // Notify the connected tab or window that the shared worker is ready
    //port.postMessage('Shared worker connected.');
    port.start();
  }; 

  // Broadcast a message to all connected clients
  function broadcastMessage(message) {
    activeWorkerPorts.forEach(function(port) {
      port.postMessage(message);
    });
  }

  // Broadcast a message to all connected clients
  function broadcastId(message) {
    activeWorkerPorts.forEach(function(port) {
      port.postMessage("id:" + port.workerId);
    });
  }

}
