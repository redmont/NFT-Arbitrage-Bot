const dbName = "BOT_NFT";
const INDEX = {
  BOT_NFT: {
    SALES: [
      { key: { _id: 1 }, name: "_id_" },
      { key: { type: 1 }, name: "type_1" },
      { key: { "sale.createdAt": -1 }, name: "sale.createdAt_-1" },
      { key: { addr_tkn: 1, id_tkn: 1 }, name: "addr_tkn_1_id_tkn_1" },
      {
        key: {
          price: 1.0,
        },
        name: "price_1",
        collation: {
          locale: "en_US",
          caseLevel: false,
          caseFirst: "off",
          strength: 3,
          numericOrdering: true,
          alternate: "non-ignorable",
          maxVariable: "punct",
          normalization: false,
          backwards: false,
          version: "57.1",
        },
      },
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
      {
        key: {
          addr_tkn: 1,
          id_tkn: 1,
          type: 1,
          exp_time: 1,
          price: 1,
        },
        name: "addr_tkn_1_id_tkn_1_type_1_exp_time_1_price_1",
      },
      {
        key: {
          price: 1.0,
        },
        name: "price_1",
        collation: {
          locale: "en_US",
          caseLevel: false,
          caseFirst: "off",
          strength: 3,
          numericOrdering: true,
          alternate: "non-ignorable",
          maxVariable: "punct",
          normalization: false,
          backwards: false,
          version: "57.1",
        },
      },
      {
        key: {
          type: 1,
        },
        name: "type_1",
      },
      {
        name: "exp_time_1",
        key: { exp_time: 1.0 },
        collation: {
          locale: "en_US",
          caseLevel: false,
          caseFirst: "off",
          strength: 3,
          numericOrdering: true,
          alternate: "non-ignorable",
          maxVariable: "punct",
          normalization: false,
          backwards: false,
          version: "57.1",
        },
      },
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
