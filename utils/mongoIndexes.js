const dbName = "BOT_NFT";
const INDEX = {
  BOT_NFT: {
    SALES: [
      { key: { _id: 1 }, name: "_id_" },
      { key: { type: 1 }, name: "type_1" },
      { key: { "sale.createdAt": -1 }, name: "sale.createdAt_-1" },
      { key: { addr_tkn: 1, id_tkn: 1 }, name: "addr_tkn_1_id_tkn_1" },
      { key: { price: 1 }, name: "price_1" },
    ],
    BIDS: [
      {
        name: "_id_",
        key: { _id: 1 },
      },
      {
        name: "addr_tkn_1_id_tkn_1",
        key: { addr_tkn: 1, id_tkn: 1 },
      },
      { key: { price: 1 }, name: "price_1" },
    ],
  },
};

async function ensureIndexes(mongoClient) {
  try {
    const collections = Object.keys(INDEX[dbName]);
    for (const collectionName of collections) {
      const indexes = INDEX[dbName][collectionName];
      for (const index of indexes) {
        console.log(`Ensuring index: ${index.name} in ${collectionName} ...`);
        await mongoClient
          .db(dbName)
          .collection(collectionName)
          .createIndex(index.key, { name: index.name });
      }
    }

    console.log("All indexes ensured successfully.");
  } catch (err) {
    console.error("All indexes not ensured", err);
  }
}

exports.ensureIndexes = ensureIndexes;
