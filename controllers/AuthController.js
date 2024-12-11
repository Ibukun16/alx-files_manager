#!/usr/bin/yarn dev

/* eslint-disable no-else-return */
import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

/**
 * Controller for handling authentication-related tasks
 */
class AuthController {
  /**
   * Signs in the user and generates an authentication token.
   *
   * Using the Basic auth technique (Base64 of the <email>:<password>),
   * it finds the user associated with the provided email and password
   * (The password is stored as a SHA1 hash).
   * If no user is found, returns a 401 Unauthorized error.
   * If a user is found:
   * - Generates a random token using uuidv4
   * - Creates a Redis key `auth_<token>`
   * - Stores the user's ID in Redis for 24 hours
   * - Returns the token with a 200 status code.
   */
  static async getConnect(request, response) {
    const authData = request.header('authorization') || '';
    const credentials = authData.split(' ')[1];
    if (!credentials) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    // Decode the credentials from Base64
    const decodedCredentials = Buffer.from(credentials, 'base64').toString(
      'utf-8',
    );
    const [email, password] = decodedCredentials.split(':');
    if (!email || !password) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const hashedPwd = sha1(password);
    const users = dbClient.db.collection('users');
    try {
      const user = await users.findOne({ email, password: hashedPwd });
      if (!user) {
        return response.status(401).send({ error: 'Unauthorized' });
      }
      const token = uuidv4();
      const key = `auth_${token}`;
      const duration = 24;
      await redisClient.set(key, user._id.toString(), duration * 24);
      return response.status(200).send({ token });
    } catch (error) {
      console.error(error.message);
      return response.status(500).send({ error: 'Error creating user.' });
    }
  }

  /**
   * Method that signs out the user by deleting their authentication token from Redis.
   *
   * Retrieves the user based on the provided token.
   * If not found, returns a 401 Unauthorized error.
   * If found, deletes the token from Redis and returns a 204 status code.
   */
  static async getDisconnect(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
    }
    await redisClient.del(key);
    return response.status(204).send({});
  }
}

export default AuthController;
