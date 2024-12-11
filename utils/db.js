#!/usr/bin/yarn dev

import { MongoClient } from 'mongodb';

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || 27017;
const DATABASE = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${HOST}:${PORT}`;

/**
 * Class that defines methods to interact with the mongodb service
 */
class DBClient {
  constructor() {
    this.connected = false;
    this.client = new MongoClient(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    this.client
      .connect()
      .then(() => {
        // Connection to MongnDB server successful
        this.db = this.client.db(`${DATABASE}`);
        console.log(`MongoDB Connection to server at ${url}`);
      })
      .catch((error) => {
        const reject = `Error Connection to MongoDB server not successful at ${url}: ${error.message}`;
        console.error(reject);
      });
  }

  /**
   * Check if the MongoDB connection is active.
   * @return {boolean} Returns true if connected, else false.
   */
  isAlive() {
    return Boolean(this.client.db);
  }

  /**
   * Get the number of documents in the 'users' collection.
   * @return {number} The number of users in the collection.
   */
  async nbUsers() {
    try {
      await this.client.connect();
      const usersCollection = this.db.collection('users');
      const numberOfUsers = await usersCollection.countDocuments();
      return numberOfUsers;
    } catch (error) {
      console.error('Error, cannot get the number of users:', error);
      return 0;
    }
  }

  /**
   * Get the number of documents in the 'files' collection.
   * @return {number} The number of files in the collection.
   */
  async nbFiles() {
    try {
      await this.client.connect();
      const filesCollection = this.db.collection('files');
      const numberOfFiles = await filesCollection.countDocuments();
      return numberOfFiles;
    } catch (error) {
      console.error('Error, cannot get the number of files:', error);
      return 0;
    }
  }
}

const dbClient = new DBClient();

export default dbClient;
