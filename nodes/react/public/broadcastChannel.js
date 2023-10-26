let workerCount = 0;
let activeIds = [];
// eslint-disable-next-line no-undef
const uid = uuidv4(); // defined in index.html
window.taskflowUID = uid

//console.log("BroadcastChannel initiating", uid);
const channel = new BroadcastChannel('sharedChannel');
let workerId;

channel.onmessage = function (e) {
    switch(e.data.type) {
        case "workerCount":
            //console.log(`BroadcastChannel ${uid} received workerCount from ${e.data.uid}`);
            channel.postMessage({ uid, type: "ping", workerId});
            //console.log(`BroadcastChannel ${uid} sent ping`);
            activeIds = [];
            workerCount = 0;
            setTimeout(function() {
                channel.postMessage({ uid, type: "setWorkerCount", workerCount });
                //console.log(`BroadcastChannel ${uid} sent setWorkerCount`, workerCount);
                workerId = workerId || getLowestAvailableId();
                activeIds.push(e.data.workerId);
                channel.postMessage({ uid, type: "setWorkerId", workerId });
                //console.log(`BroadcastChannel ${uid} sent setWorkerId`, workerId);
            }, 500);
            break;
            
        case "pong":
            //console.log(`BroadcastChannel ${uid} received pong from ${e.data.uid}`);
            workerCount++;
            break;

        case "ping":
            if (e.data.uid !== uid) {
                activeIds.push(e.data.workerId);
            }
            break;
        case "setWorkerCount": 
            // Ignore as this is from another worker
            break;       
        case "setWorkerId":
            break;

        default:
            // For now, don't echo the message.
            // You can add logging here if you want to observe unrecognized messages.
            console.log(`BroadcastChannel ${uid} Received unrecognized message:`, e.data);
            break;
    }
};

function getLowestAvailableId() {
    activeIds.sort((a, b) => a - b);
    for(let i = 0; i < activeIds.length; i++) {
        if(activeIds[i] !== (i + 1)) {
            return (i + 1);
        }
    }
    return ((activeIds.length || 0)  + 1);
}

