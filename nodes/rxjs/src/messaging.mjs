import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';

class MessagingClient extends EventEmitter {
  constructor(redisUrl) {
    super();
    this.client = new Redis(redisUrl); 
    this.subscriber = new Redis(redisUrl); 
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

  async enqueue(queue, message) {
    return this.client.rpush(queue, message);
  }

  dequeue(queue, timeout = 0) {
    return new Observable((observer) => {
      const intervalId = setInterval(async () => {
        try {
          const message = await this.client.brpop(queue, timeout);
          if (message) {
            observer.next(message[1]);
          }
        } catch (err) {
          observer.error(err);
        }
      }, 1000);

      return () => {
        clearInterval(intervalId);
      };
    });
  }
  // Additional cleanup, unsubscribe logic, etc.
}

export { MessagingClient };


