const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);

const db = {
  BIDS: mongoClient.db("BOT_NFT").collection("BIDS"),
};

(async () => {
  // If obj.type === OS_BID_SUB, edit obj.type to OS_BID_SUB_BASIC
  await db.BIDS.updateMany(
    { type: "OS_BID_SUB" },
    { $set: { type: "OS_BID_SUB_BASIC" } }
  );

  // If obj.type === OS_BID_GET, edit obj.type to OS_BID_GET_BASIC
  await db.BIDS.updateMany(
    { type: "OS_BID_GET" },
    { $set: { type: "OS_BID_GET_BASIC" } }
  );
})();
