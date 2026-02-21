// src/client.js
import { getDatabase } from "./db.js";

export class MongoDbClient {
  constructor(collection) {
    this.collection = collection;
  }

  async create(doc) {
    const db = await getDatabase();
    const result = await db.collection(this.collection).insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  async findOne(query) {
    const db = await getDatabase();
    return db.collection(this.collection).findOne(query);
  }

  async findMany(query, options = {}) {
    const db = await getDatabase();
    return db.collection(this.collection).find(query, options).toArray();
  }

  async update(filter, update, options = {}) {
    const db = await getDatabase();
    return db.collection(this.collection).updateMany(filter, update, options);
  }

  async delete(filter) {
    const db = await getDatabase();
    return db.collection(this.collection).deleteMany(filter);
  }
}
