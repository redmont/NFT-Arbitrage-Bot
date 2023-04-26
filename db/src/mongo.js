const {MongoClient} = require("mongodb");
const url = "mongodb://localhost:27017";
const client = new MongoClient(url);
const dbName = "botNftData";

const Init = async () => {
    await client.connect();
    return client.db(dbName);
};
exports.InitializeDB = Init;
