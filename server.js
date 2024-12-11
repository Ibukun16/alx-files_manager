#!/usr/bin/yarn dev

import express from 'express';
import routerController from './routes/index';

const server = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON requests
server.use(express.json());

// Attach routing controllers to the server
routerController(server);

// Start the server and listen on the specified port
server.listen(PORT, () => {
  console.log(`This server is running on port ${PORT}`);
});

export default server;
