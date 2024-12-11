#!/usr/bin/yarn dev

import Queue from 'bull';
import { ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from '../utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

async function thumbNail(width, localPath) {
  const thumbnail = await imageThumbnail(localPath, { width });
  return thumbnail;
}

fileQueue.process(async (job, done) => {
  console.log('Processing...');
  const { fileId, userId } = job.data;
  /**
   * A method that check to ensure userId and fileId are provided
   * If either of fileId or userId is not available throw error
   * */
  if (!fileId) {
    done(new Error('Missing fileId'));
  }

  if (!userId) {
    done(new Error('Missing userId'));
  }

  console.log(fileId, userId);
  const files = dbClient.db.collection('files');
  const ObjId = new ObjectId(fileId);
  files.findOne({ _id: ObjId }, async (error, file) => {
    if (!file) {
      console.error('Not found');
      done(new Error('File not found'));
    } else {
      const fileName = file.localPath;
      const thumbnail500 = await thumbNail(500, fileName);
      const thumbnail250 = await thumbNail(250, fileName);
      const thumbnail100 = await thumbNail(100, fileName);

      console.log('Writing files to system');
      const image500 = `${file.localPath}_500`;
      const image250 = `${file.localPath}_250`;
      const image100 = `${file.localPath}_100`;

      await fs.writeFile(image500, thumbnail500);
      await fs.writeFile(image250, thumbnail250);
      await fs.writeFile(image100, thumbnail100);
      done();
    }
  });
});

userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) done(new Error('Missing userId'));
  const users = dbClient.db.collection('users');
  const ObjId = new ObjectId(userId);
  const user = await users.findOne({ _id: ObjId });
  if (user) {
    console.log(`Welcome ${user.email}!`);
  } else {
    done(new Error('User not found'));
  }
});
