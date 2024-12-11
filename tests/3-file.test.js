import { expect, use, should, request } from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { ObjectId } from 'mongodb';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

// User Endpoints Test Suite ==============================================

describe('Testing User Endpoints', () => {
  const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE='; // Base64 encoded email and password
  let token = ''; // Token to be used for authentication
  let userId = ''; // Variable to store userId after creating a user
  const user = {
    email: 'bob@dylan.com', // Test user email
    password: 'toto1234!', // Test user password
  };

  // Clear Redis and MongoDB collections before and after the test suite
  before(async () => {
    await redisClient.client.flushall('ASYNC'); // Flush all data from Redis
    await dbClient.usersCollection.deleteMany({}); // Delete all users from MongoDB
    await dbClient.filesCollection.deleteMany({}); // Delete all files from MongoDB
  });

  after(async () => {
    await redisClient.client.flushall('ASYNC'); // Clean Redis after tests
    await dbClient.usersCollection.deleteMany({}); // Clean users collection
    await dbClient.filesCollection.deleteMany({}); // Clean files collection
  });

  // Test POST /users - Creating users
  describe('POST /users', () => {
    // Successful creation of a user
    it('returns the id and email of created user', async () => {
      const response = await request(app).post('/users').send(user); // Send a POST request to create a user
      const body = JSON.parse(response.text);
      expect(body.email).to.equal(user.email); // Verify the email in the response
      expect(body).to.have.property('id'); // Verify that the response contains an id
      expect(response.statusCode).to.equal(201); // Check if the status code is 201 (Created)

      userId = body.id; // Store the created user's id
      const userMongo = await dbClient.usersCollection.findOne({
        _id: ObjectId(body.id),
      });
      expect(userMongo).to.exist; // Verify that the user exists in the MongoDB collection
    });

    // Test when password is missing
    it('fails to create user because password is missing', async () => {
      const user = {
        email: 'bob@dylan.com', // Only email is provided
      };
      const response = await request(app).post('/users').send(user); // Send a request without password
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Missing password' }); // Expect error response
      expect(response.statusCode).to.equal(400); // Expect status code 400 (Bad Request)
    });

    // Test when email is missing
    it('fails to create user because email is missing', async () => {
      const user = {
        password: 'toto1234!', // Only password is provided
      };
      const response = await request(app).post('/users').send(user); // Send a request without email
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Missing email' }); // Expect error response
      expect(response.statusCode).to.equal(400); // Expect status code 400 (Bad Request)
    });

    // Test when user already exists
    it('fails to create user because it already exists', async () => {
      const user = {
        email: 'bob@dylan.com',
        password: 'toto1234!',
      };
      const response = await request(app).post('/users').send(user); // Send a request with an existing user
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Already exist' }); // Expect error response
      expect(response.statusCode).to.equal(400); // Expect status code 400 (Bad Request)
    });
  });

  // Test GET /connect - User authentication
  describe('GET /connect', () => {
    // Fails if no user is found for the provided credentials
    it('fails if no user is found for credentials', async () => {
      const response = await request(app).get('/connect').send();
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Unauthorized' }); // Expect unauthorized error
      expect(response.statusCode).to.equal(401); // Expect status code 401 (Unauthorized)
    });

    // Successfully returns a token for valid credentials
    it('returns a token if user is found for credentials', async () => {
      const spyRedisSet = sinon.spy(redisClient, 'set'); // Spy on Redis set function

      const response = await request(app)
        .get('/connect')
        .set('Authorization', credentials)
        .send();
      const body = JSON.parse(response.text);
      token = body.token; // Store the token returned by the response
      expect(body).to.have.property('token'); // Verify that the response contains a token
      expect(response.statusCode).to.equal(200); // Expect status code 200 (OK)
      expect(
        spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600),
      ).to.be.true; // Check if Redis set was called with the correct arguments

      spyRedisSet.restore(); // Restore the original function
    });

    // Check if the token exists in Redis after successful authentication
    it('token exists in Redis', async () => {
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.exist; // Verify that the token exists in Redis
    });
  });

  // Test GET /disconnect - User sign-out
  describe('GET /disconnect', () => {
    after(async () => {
      await redisClient.client.flushall('ASYNC'); // Clean Redis after the tests
    });

    // Fails if no token is provided during sign-out
    it('should respond with unauthorized because there is no token for user', async () => {
      const response = await request(app).get('/disconnect').send();
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Unauthorized' }); // Expect unauthorized error
      expect(response.statusCode).to.equal(401); // Expect status code 401 (Unauthorized)
    });

    // Successfully signs out the user based on the provided token
    it('should sign-out the user based on the token', async () => {
      const response = await request(app)
        .get('/disconnect')
        .set('X-Token', token)
        .send();
      expect(response.text).to.be.equal(''); // Expect empty response on success
      expect(response.statusCode).to.equal(204); // Expect status code 204 (No Content)
    });

    // Check if the token no longer exists in Redis after sign-out
    it('token no longer exists in Redis', async () => {
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.not.exist; // Verify that the token no longer exists in Redis
    });
  });

  // Test GET /users/me - Retrieving user information
  describe('GET /users/me', () => {
    // Before test, connect the user and obtain a token
    before(async () => {
      const response = await request(app)
        .get('/connect')
        .set('Authorization', credentials)
        .send();
      const body = JSON.parse(response.text);
      token = body.token; // Store the token for further use
    });

    // Fails when no token is passed during user information retrieval
    it('should return unauthorized because no token is passed', async () => {
      const response = await request(app).get('/users/me').send();
      const body = JSON.parse(response.text);

      expect(body).to.be.eql({ error: 'Unauthorized' }); // Expect unauthorized error
      expect(response.statusCode).to.equal(401); // Expect status code 401 (Unauthorized)
    });

    // Successfully retrieves user information based on the token used
    it('should retrieve the user based on the token used', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('X-Token', token)
        .send();
      const body = JSON.parse(response.text);

      expect(body).to.be.eql({ id: userId, email: user.email }); // Verify user id and email in response
      expect(response.statusCode).to.equal(200); // Expect status code 200 (OK)
    });
  });
});
