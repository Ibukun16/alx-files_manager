#!/usr/bin/yarn dev

import { ObjectId } from 'mongodb';
import { promise as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

/**
 * Controller for handling file-related operations
 */
class FilesController {
  /**
   * A method that get user details from the database and locally.
   * Use token and key to get the user Id from the database
   * Return details of the user if successful, else null.
   */
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const users = dbClient.db.collection('users');
      const ObjId = new ObjectId(userId);
      const user = await users.findOne({ _id: ObjId });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  /**
   * Creates a new file and stores it in the database and locally.
   * Handles user authentication and file validation.
   * If the file type is "folder", it directly adds the file to the DB.
   * For other file types, it stores the file locally and updates the database.
   * Returns a 201 status code if the file is successfully created.
   */
  static async postUpload(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const { name } = request.body;
    const { type } = request.body;
    const { parentId } = request.body;
    const isPublic = request.body.isPublic || false;
    const { data } = request.body;
    if (!name) {
      return response.status(400).send({ error: 'Missing name' });
    }
    if (!type) {
      return response.status(400).send({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).send({ error: 'Missing data' });
    }

    const files = dbClient.db.collection('files');
    if (parentId) {
      const ObjId = new ObjectId(parentId);
      const file = await files.findOne({ _id: ObjId, userId: user._id });
      if (!file) {
        return response.status(400).send({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return response.status(400).send({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      files
        .insertOne({
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
        })
        .then((result) => {
          response.status(201).send({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          });
        })
        .catch((error) => {
          console.error(error.message);
        });
    } else {
      const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = `${filePath}/${uuidv4()}`;
      const buf = Buffer.from(data, 'base64');
      // const storeVal = buf.toString('utf-8');
      try {
        try {
          await fs.mkdir(filePath);
        } catch (error) {
          console.error('Error, File already exist:', error.message);
        }
        await fs.writeFile(fileName, buf, 'utf-8');
      } catch (error) {
        console.log(error);
      }
      files
        .insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileName,
        })
        .then((result) => {
          response.status(201).send({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          });
          if (type === 'image') {
            fileQueue.add({
              userId: user._id,
              fileId: result.insertedId,
            });
          }
        })
        .catch((error) => console.log(error.message));
    }
    return null;
  }

  /**
   * Retrieves a file document based on the provided file ID.
   * Ensures the user is authenticated and that the file exists.
   * Returns the file document if found, otherwise returns appropriate error codes.
   */
  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const fileId = request.params.id;
    const files = dbClient.db.collection('files');
    const ObjId = new ObjectId(fileId);
    const file = await files.findOne({ _id: ObjId, userId: user._id });
    if (!file) {
      return response.status(404).send({ error: 'Not found' });
    }
    return response.status(200).send(file);
  }

  /**
   * Retrieves files based on the parentId and supports pagination.
   * Handles user authentication and validates the parentId.
   * Returns paginated results with a maximum of 20 items per page.
   */
  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).send({ error: 'Unathorized' });
    }
    const { parentId, page } = request.query;
    const pageNumber = page || 0;
    const files = dbClient.db.collection('files');
    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectId(parentId) };
    }
    files
      .aggregate([
        { match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [
              { $count: 'total' },
              { $addFields: { page: parseInt(pageNumber, 10) } },
            ],
            data: [{ $skip: 20 * parseInt(pageNumber, 10) }, { $limit: 20 }],
          },
        },
      ])
      .toArray((error, result) => {
        if (result) {
          const final = result[0].data.map((file) => {
            const tmpFile = {
              ...file,
              id: file._id,
            };
            delete tmpFile._id;
            delete tmpFile.localPath;
            return tmpFile;
          });
          // console.log(final);
          return response.status(200).send(final);
        }
        console.error('Error Occured');
        return response.status(404).send({ error: 'Not found' });
      });
    return null;
  }

  /**
   * Publishes a file (sets isPublic to true) based on the file ID.
   *
   * Ensures the user is authenticated and the file exists.
   * Updates the isPublic value of the file and returns the updated file.
   */
  static async putPublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const ObjId = new ObjectId(id);
    const newValue = { $set: { isPublish: true } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate(
      { _id: ObjId, userId: user._id },
      newValue,
      options,
      (error, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          return response.status(404).send({ error: 'Not found' });
        }
        return response.status(200).send(file.value);
      },
    );
    return null;
  }

  /**
   * Unpublishes a file (sets isPublic to false) based on the file ID.
   *
   * Ensures the user is authenticated and the file exists.
   * Updates the isPublic value of the file and returns the updated file.
   */
  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const ObjId = new ObjectId(id);
    const newValue = { $set: { isPublic: false } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate(
      { _id: ObjId, userId: user._id },
      newValue,
      options,
      (error, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          return response.status(404).send({ error: 'Not found' });
        }
        return response.status(200).send(file.value);
      },
    );
    return null;
  }

  /**
   * Retrieves the content of a file based on the file ID.
   *
   * Ensures the file is available, the user has access to it, and it is not a folder.
   * Returns the file content with the appropriate MIME type.
   */
  static async getFile(request, response) {
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const ObjId = new ObjectId(id);
    files.findOne({ _id: ObjId }, async (error, file) => {
      if (!file) {
        return response.status(404).send({ error: 'Not found' });
      }
      console.log(file.localPath);
      if (file.isPublic) {
        if (file.type === 'folder') {
          return response
            .status(400)
            .send({ error: "A folder doesn't have content" });
        }
        try {
          let fileName = file.localPath;
          const size = request.param('size');
          if (size) {
            fileName = `${file.localPath}_${size}`;
          }
          const data = await fs.readFile(fileName);
          const contentType = mime.contentType(file.name);
          return response
            .header('Content-Type', contentType)
            .status(200)
            .send(data);
        } catch (error) {
          console.error(error.message);
          return response.status(404).send({ error: 'Not found' });
        }
      } else {
        const user = await FilesController.getUser(request);
        if (!user) {
          return response.status(404).send({ error: 'Not found' });
        }
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === 'folder') {
            return response
              .status(400)
              .send({ error: "A folder doesn't have content" });
          }
          try {
            let fileName = file.localPath;
            const size = request.param('size');
            if (size) {
              fileName = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);
            return response
              .header('Content-Type', contentType)
              .status(200)
              .sendFile(fileName);
          } catch (error) {
            console.error(error.message);
            return response.status(404).send({ error: 'Not found' });
          }
        } else {
          console.log(
            `Wrong user: file.userId=${file.userId}; userId=${user._id}`,
          );
          return response.status(404).send({ error: 'Not found' });
        }
      }
    });
  }
}

export default FilesController;
