import { expect, use, should } from 'chai';
import chaiHttp from 'chai-http';
import { promisify } from 'util';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

// Redis and MongoDB client tests

describe('Testing MongoDB and Redis clients', () => {
  // Redis client tests
  describe('Redis Client', () => {
    // Flush Redis before and after each test
    before(async () => {
      await redisClient.client.flushall('ASYNC');
    });

    after(async () => {
      await redisClient.client.flushall('ASYNC');
    });

    // Check if Redis connection is active
    it('verifies the Redis connection is alive', async () => {
      expect(redisClient.isAlive()).to.equal(true);
    });

    // Ensure key retrieval returns null if key doesn't exist
    it('returns null for non-existent key', async () => {
      expect(await redisClient.get('myKey')).to.equal(null);
    });

    // Test setting a key in Redis
    it('sets a key in Redis without error', async () => {
      expect(await redisClient.set('myKey', 12, 1)).to.equal(undefined);
    });

    // Ensure key expires after the set TTL
    it('returns null after key expires', async () => {
      const sleep = promisify(setTimeout);
      await sleep(1100); // Wait for key to expire
      expect(await redisClient.get('myKey')).to.equal(null);
    });
  });

  // MongoDB client tests
  describe('MongoDB Client', () => {
    // Clear MongoDB collections before and after tests
    before(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    after(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    // Verify MongoDB connection is active
    it('checks if MongoDB connection is alive', () => {
      expect(dbClient.isAlive()).to.equal(true);
    });

    // Check if the number of user documents is correct
    it('checks the number of user documents', async () => {
      await dbClient.usersCollection.deleteMany({});
      expect(await dbClient.nbUsers()).to.equal(0);

      await dbClient.usersCollection.insertOne({ name: 'Larry' });
      await dbClient.usersCollection.insertOne({ name: 'Karla' });
      expect(await dbClient.nbUsers()).to.equal(2);
    });

    // Check if the number of file documents is correct
    it('checks the number of file documents', async () => {
      await dbClient.filesCollection.deleteMany({});
      expect(await dbClient.nbFiles()).to.equal(0);

      await dbClient.filesCollection.insertOne({ name: 'FileOne' });
      await dbClient.filesCollection.insertOne({ name: 'FileTwo' });
      expect(await dbClient.nbFiles()).to.equal(2);
    });
  });
});
