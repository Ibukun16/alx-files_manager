#!/usr/bin/yarn dev

import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * The controller for handling application status and statistics
 */
class AppController {
  /**
   * This return the status of Redis and DB services
   * {"redis": true, "db":true } with a 200 status code
   */
  static getStatus(request, response) {
    const status = {
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    };
    response.status(200).send(status);
  }

  /**
   * Returns the number of users and files in the database
   * { "users": 12, "files": 1231 } with a 200 status code
   */
  static async getStats(request, response) {
    const stats = {
      users: await dbClient.nbUsers(),
      files: await dbClient.nbFiles(),
    };
    response.status(200).send(stats);
  }
}

export default AppController;
