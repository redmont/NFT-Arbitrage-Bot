const dbName = "BOT_NFT";
const INDEX = {
  BOT_NFT: {
    SALES: [
      { key: { _id: 1 }, name: "_id_" },
      { key: { addr_tkn: 1, id_tkn: 1 }, name: "addr_tkn_1_id_tkn_1" },
      {
        key: {
          addr_tkn: 1,
          "traits.trait_key": 1,
          "traits.trait_value": 1,
          price: 1,
        },
        name: "addr_tkn_1_traits.trait_key_1_traits.trait_value_1_price_1",
        collation: {
          locale: "en_US",
          strength: 3,
          numericOrdering: true,
        },
      },
    ],
    BIDS: [
      {
        name: "_id_",
        key: { _id: 1 },
      },
      // For the fields used in the equality checks (addr_tkn and id_tkn):
      {
        name: "addr_tkn_1_id_tkn_1",
        key: { addr_tkn: 1, id_tkn: 1 },
      },
      // For the fields used in the equality checks (addr_tkn,id_tkn and type) and range checks (exp_time and price):
      // collation.numericOrdering is used to make the index numericOrdering for the same query to work.
      {
        v: 2,
        key: {
          addr_tkn: 1,
          id_tkn: 1,
          type: 1,
          exp_time: 1,
          price: 1,
        },
        name: "addr_tkn_1_id_tkn_1_type_1_exp_time_1_price_1",
        collation: {
          locale: "en_US",
          strength: 3,
          numericOrdering: true,
        },
      },
      {
        key: {
          type: 1,
        },
        name: "type_1",
      },
      // TTL index on exp_time field
      {
        v: 2,
        key: {
          exp_time: 1,
        },
        name: "exp_time_1",
        expireAfterSeconds: 0,
      },
    ],
    SUBS: [
      {
        name: "_id_",
        key: { _id: 1 },
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
