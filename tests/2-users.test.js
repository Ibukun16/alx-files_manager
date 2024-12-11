import { expect, use, should, request } from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { ObjectId } from 'mongodb';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

// Test cases for User Endpoints ==============================================

describe('Testing User Endpoints', () => {
  const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
  let token = '';
  let userId = '';
  const user = {
    email: 'bob@dylan.com',
    password: 'toto1234!',
  };

  // Clear Redis and MongoDB collections before and after the test suite
  before(async () => {
    await redisClient.client.flushall('ASYNC');
    await dbClient.usersCollection.deleteMany({});
    await dbClient.filesCollection.deleteMany({});
  });

  after(async () => {
    await redisClient.client.flushall('ASYNC');
    await dbClient.usersCollection.deleteMany({});
    await dbClient.filesCollection.deleteMany({});
  });

  // Test for creating users
  describe('POST /users', () => {
    // Successfully creates a new user
    it('returns the id and email of created user', async () => {
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);

      // Expect user creation with email and id
      expect(body.email).to.equal(user.email);
      expect(body).to.have.property('id');
      expect(response.statusCode).to.equal(201);

      userId = body.id;
      const userMongo = await dbClient.usersCollection.findOne({
        _id: ObjectId(body.id),
      });

      // Check that the user was created in MongoDB
      expect(userMongo).to.exist;
    });

    // Fails when password is missing
    it('fails to create user because password is missing', async () => {
      const user = {
        email: 'bob@dylan.com',
      };
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Missing password' });
      expect(response.statusCode).to.equal(400);
    });

    // Fails when email is missing
    it('fails to create user because email is missing', async () => {
      const user = {
        password: 'toto1234!',
      };
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Missing email' });
      expect(response.statusCode).to.equal(400);
    });

    // Fails when the user already exists
    it('fails to create user because it already exists', async () => {
      const user = {
        email: 'bob@dylan.com',
        password: 'toto1234!',
      };
      const response = await request(app).post('/users').send(user);
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Already exist' });
      expect(response.statusCode).to.equal(400);
    });
  });

  // Test for user connection (authentication)
  describe('GET /connect', () => {
    // Fails when no user is found with the provided credentials
    it('fails if no user is found for credentials', async () => {
      const response = await request(app).get('/connect').send();
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    // Returns a token when valid credentials are provided
    it('returns a token if user is found for credentials', async () => {
      const spyRedisSet = sinon.spy(redisClient, 'set');

      const response = await request(app)
        .get('/connect')
        .set('Authorization', credentials)
        .send();
      const body = JSON.parse(response.text);
      token = body.token;

      // Check if the token was created and Redis set function was called
      expect(body).to.have.property('token');
      expect(response.statusCode).to.equal(200);
      expect(
        spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600),
      ).to.be.true;

      spyRedisSet.restore();
    });

    // Token exists in Redis after successful connection
    it('token exists in Redis', async () => {
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.exist;
    });
  });

  // Test for user disconnection (sign-out)
  describe('GET /disconnect', () => {
    after(async () => {
      await redisClient.client.flushall('ASYNC');
    });

    // Fails if no token is provided during disconnection
    it('should respond with unauthorized because there is no token for user', async () => {
      const response = await request(app).get('/disconnect').send();
      const body = JSON.parse(response.text);
      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    // Successfully signs out the user based on the token
    it('should sign-out the user based on the token', async () => {
      const response = await request(app)
        .get('/disconnect')
        .set('X-Token', token)
        .send();
      expect(response.text).to.be.equal('');
      expect(response.statusCode).to.equal(204);
    });

    // Token no longer exists in Redis after disconnection
    it('token no longer exists in Redis', async () => {
      const redisToken = await redisClient.get(`auth_${token}`);
      expect(redisToken).to.not.exist;
    });
  });

  // Test for retrieving user information
  describe('GET /users/me', () => {
    // Obtain token before running the tests
    before(async () => {
      const response = await request(app)
        .get('/connect')
        .set('Authorization', credentials)
        .send();
      const body = JSON.parse(response.text);
      token = body.token;
    });

    // Fails when no token is provided
    it('should return unauthorized because no token is passed', async () => {
      const response = await request(app).get('/users/me').send();
      const body = JSON.parse(response.text);

      expect(body).to.be.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    // Successfully retrieves user details based on the token used
    it('should retrieve the user based on the token used', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('X-Token', token)
        .send();
      const body = JSON.parse(response.text);

      expect(body).to.be.eql({ id: userId, email: user.email });
      expect(response.statusCode).to.equal(200);
    });
  });
});
