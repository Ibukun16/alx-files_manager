#!/usr/bin/yarn dev

import { createClient } from 'redis';
import { promisify } from 'util';

/**
 * Class that defines methods to interact with the redis service.
 */
class RedisClient {
  constructor() {
    this.client = createClient();
    this.getAsync = promisify(this.client.GET).bind(this.client);

    this.client.on('error', (error) => {
      console.error(
        `Redis client not connected to the server: ${error.message}`,
      );
    });

    /**
     * Check if connection to the server is established
     * @return connected
     */
    this.client.on('connect', () => {
      console.log('Connected');
    });

    /**
     * Check if the server is ready to accept command
     * @return status readiness update
     */
    this.client.on('ready', () => {
      console.log('Redis client is ready');
    });
  }

  /**
   * Checks if the Redis connection is active.
   * @return {boolean} Returns true if connected, false otherwise.
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Retrieves the value of a given key from Redis.
   * @param {string} key The key to search for in Redis.
   * @return {string} The value associated with the key.
   */
  async get(key) {
    try {
      const value = await this.getAsync(key);
      return value;
    } catch (error) {
      console.error(`Error fetching key: ${error.message}`);
      return 0;
    }
  }

  /**
   * Sets a key with a value in Redis and specifies its time-to-live (TTL).
   * @param {string} key The key to store in Redis.
   * @param {string} value The value to associate with the key.
   * @param {number} duration The TTL for the key in seconds.
   */
  async set(key, value, time) {
    await this.client.setex(key, time, value);
  }

  /**
   * Deletes a key from Redis.
   * @param {string} key The key to remove from Redis.
   */
  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Error deleting key: ${error.message}`);
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
