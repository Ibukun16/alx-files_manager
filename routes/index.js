#!/usr/bin/yarn dev

import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

function routerController(server) {
  const router = express.Router();
  server.use('/', router);

  // App Controller

  // Endpoint to check if Redis and the database are operational
  router.get('/status', (req, res) => {
    AppController.getStatus(req, res);
  });

  // Endpoint to retrieve statistics about users and files in the database
  router.get('/stats', (req, res) => {
    AppController.getStats(req, res);
  });

  // User Controller

  // Endpoint to create new user in the database
  router.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });

  // Endpoint to get the details of the currently authenticated user based on token
  router.get('/users/me', (req, res) => {
    UsersController.getMe(req, res);
  });

  // Auth Controller

  // Endpoint to sign in the user and generate an authentication token
  router.get('/connect', (req, res) => {
    AuthController.getConnect(req, res);
  });

  // Endpoint to sign out the user based on the authentication token
  router.get('/disconnect', (req, res) => {
    AuthController.getDisconnect(req, res);
  });

  // Files Controller

  // Endpoint to upload a new file to the database and the local filesystem
  router.post('/files', (req, res) => {
    FilesController.postUpload(req, res);
  });

  // Endpoint to get all file documents for a specific parentId with pagination support
  router.get('/files', (req, res) => {
    FilesController.getIndex(req, res);
  });

  // Endpoint to make a file public based on its ID
  router.put('/files/:id/publish', (req, res) => {
    FilesController.putPublish(req, res);
  });

  // Endpoint to make a file private based on its ID
  router.put('/files/:id/unpublish', (req, res) => {
    FilesController.putUnpublish(req, res);
  });

  // Endpoint to retrieve the content of a file based on its ID
  router.get('/files/:id/data', (req, res) => {
    FilesController.getFiles(req, res);
  });
}

export default routerController;
