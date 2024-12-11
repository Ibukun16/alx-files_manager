/* eslint-disable no-else-return */
import { ObjectId } from 'mongodb';
import sha1 from 'sha1';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

/**
 * Controller for handling the users-related operations
 */
class UsersController {
  /**
   * User Class - create a new user using email and password
   *
   * If the email is missing, returns 400 with an error message 'Missing email'
   * If the password is missing, returns 400 with an error message 'Missing password'
   * If the email already exists, returns 400 with an error 'Already exist'
   * Saves the user's password after hashing it with SHA1
   * Returns the newly created user with the email and MongoDB-generated id
   * Status code: 201
   */
  static async postNew(request, response) {
    const { email, password } = request.body;

    if (!email) {
      return response.status(400).send({ error: 'Missing email' });
    }
    if (!password) {
      return response.status(400).send({ error: 'Missing password' });
    }

    const users = dbClient.db.collection('users');
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return response.status(400).send({ error: 'Already exist' });
    }
    try {
      const hashedPassword = sha1(password);
      const result = await users.insertOne({ email, password: hashedPassword });
      userQueue.add({ userId: result.insertedId.toString() });
      return response.status(201).send({ id: result.insertedId, email });
    } catch (error) {
      console.error(error.message);
      return response.status(500).send({ error: 'Error creating user.' });
    }
  }

  /**
   * Static method that rRetrieves a user based on the authentication token
   *
   * If the user is not found, returns 401 with an 'Unauthorized' error
   * Otherwise, returns the user's email and id
   */
  static async getMe(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    try {
      const userId = await redisClient.get(key);
      if (userId === null) {
        console.log('Hupatikani!');
        return response.status(401).send({ error: 'Unauthorized' });
      }
      if (!ObjectId.isValid(userId)) {
        return response.status(400).send({ error: 'Invalid userId' });
      }
      const users = dbClient.db.collection('users');
      const ObjId = new ObjectId(userId);
      const user = await users.findOne({ _id: ObjId });
      if (user) {
        return response.status(200).send({ id: userId, email: user.email });
      } else {
        return response.status(401).send({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.log('Error accessing Redis:', error.message);
      return response.status(500).send({ error: 'Internal server error' });
    }
  }
}

export default UsersController;
