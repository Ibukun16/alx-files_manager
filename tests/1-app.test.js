import { expect, use, should, request } from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import dbClient from '../utils/db';

use(chaiHttp);
should();

// Test cases for App Status Endpoints ==============================================

describe('testing App Status Endpoints', () => {
  // Tests for /status endpoint to check if Redis and MongoDB are alive
  describe('get /status', () => {
    it('returns the status of Redis and MongoDB connections', async () => {
      const response = await request(app).get('/status').send();

      // Validate that Redis and MongoDB are connected
      expect(response.body).to.eql({ redis: true, db: true });
      expect(response.statusCode).to.equal(200);
    });
  });

  // Tests for /stats endpoint to check the number of users and files in the database
  describe('GET /stats', () => {
    // Before running the tests, clear the collections for users and files
    before(async () => {
      await dbClient.usersCollection.deleteMany({});
      await dbClient.filesCollection.deleteMany({});
    });

    // Test case when there are 0 users and files in the database
    it('returns number of users and files in the DB (0 users, 0 files)', async () => {
      const response = await request(app).get('/stats').send();

      // Expect no users and no files in the database
      expect(response.body).to.eql({ users: 0, files: 0 });
      expect(response.statusCode).to.equal(200);
    });

    // Test case when there is 1 user and 2 files in the database
    it('returns number of users and files in the DB (1 user, 2 files)', async () => {
      // Insert one user and two files into the database
      await dbClient.usersCollection.insertOne({ name: 'Larry' });
      await dbClient.filesCollection.insertOne({ name: 'image.png' });
      await dbClient.filesCollection.insertOne({ name: 'file.txt' });

      const response = await request(app).get('/stats').send();

      // Expect 1 user and 2 files in the database
      expect(response.body).to.eql({ users: 1, files: 2 });
      expect(response.statusCode).to.equal(200);
    });
  });
});
