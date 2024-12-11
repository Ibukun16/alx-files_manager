# alx-files_manager

This project is a summary of everything learned in the Backend Specialization trimester: authentication, NodeJS, MongoDB, Redis, pagination and background processing.<br/>
The objective is to build a simple platform to upload and view files:

- User authentication via a token
- List all files
- Upload a new file
- Change permission of a file
- View a file
- Generate thumbnails for images.<br/>The system gives step by step guidance for building it, gave some freedoms of implementation, split in more files etc… (utils folder is your friend).<br/>It’s a learning purpose to assemble each piece and build a full product.

Starting Redis:

- wget http://download.redis.io/releases/redis-6.0.10.tar.gz
- tar xzf redis-6.0.10.tar.gz
- cd redis-6.0.10
- make test
- Start Redis in the background with - src/redis-server.
- Make sure that the server is working with a ping - src/redis-cli ping
- Using the Redis client again, set the value School for the key ALX - set ALX School
- Get the value School for the key ALX - get ALX
- Kill the server with the process id of the redis-server (hint: use ps and grep)
- Copy the dump.rdb from the redis-5.0.7 directory into the root of the Queuing project.
