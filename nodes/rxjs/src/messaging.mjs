import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { NODE } from "#root/config";

class MessagingClient extends EventEmitter {
  constructor() {
    super(); // Initializing the EventEmitter
    this.client = new Redis(NODE.storage.redisUrl); 
    this.subscriber = new Redis(NODE.storage.redisUrl); 
  }

  async publish(channel, message) {
    return this.client.publish(channel, message);
  }

  async subscribe(channel, handler = null) {
    this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, message) => {
      this.emit('message', ch, message);
      handler && handler(ch, message);
    });
  }

  // Additional cleanup, unsubscribe logic, etc.
}

export const messagingClient = new MessagingClient();
