const { OpenSeaStreamClient, EventType } = require("@opensea/stream-js");
const { WebSocket } = require("ws");
const ethers = require("ethers");
const crypto = require("crypto");

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);
const { ensureIndexes } = require("../../utils/mongoIndexes");

const osClient = new OpenSeaStreamClient({
  token: process.env.API_OS_0,
  networkName: "mainnet",
  connectOptions: {
    transport: WebSocket,
  },
  onError: (error) =>
    console.error(
      `ERR: osClient time: ${new Date()}`,
      JSON.stringify(error, null, 2)
    ),
  logLevel: 1,
});

const db = {
  TEST_MODE: true,

  SUBS: mongoClient.db("BOT_NFT").collection("SUBS"),
  BIDS: mongoClient.db("BOT_NFT").collection("BIDS"),

  ACTIVE_SUBS: new Map(), //~13k elements

  AMT_BIDS: 0,
  TEST_NFT_ID: "877",
  TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
  MIN_SELL_TO_PRICE: 10n ** 16n,
  OS_SUB_EVENTS: [
    EventType.ITEM_RECEIVED_BID,
    EventType.COLLECTION_OFFER,
    EventType.TRAIT_OFFER,
    // EventType.ITEM_CANCELLED,
    // EventType.ITEM_LISTED,
  ],
  ADDR_SEAPORT: new Set([
    "0x00000000006c3852cbEf3e08E8dF289169EdE581", //1.1
    "0x00000000000006c7676171937C444f6BDe3D6282", //1.2
    "0x0000000000000aD24e80fd803C6ac37206a45f15", //1.3
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", //1.4
    "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", //1.5
  ]),
};

const setup = async () => {
  await ensureIndexes(mongoClient);
  // '0x4df60a38D8c6b30bBaAA733Aa4DE1431bf9014f7' => 'slug_name'
  const SUBS = await db.SUBS.find({}, { _id: 1 }).toArray();
  for (const sub of SUBS) {
    if (!db.ACTIVE_SUBS.has(sub._id)) {
      db.ACTIVE_SUBS.set(sub._id, sub.slug);
    }
  }

  await db.BIDS.updateOne(
    { _id: "info" },
    {
      $set: {
        sub_bids_last: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
};

const subSubs = async () => {
  db.streamSUBS = db.SUBS.watch().on("change", async (next) => {
    if (!next || !next.documentKey || !next.fullDocument) return;
    const addr = next.fullDocument._id;
    const slug = next.fullDocument.slug;

    //add to active subs
    if (!db.ACTIVE_SUBS.has(addr)) {
      const lenBefore = db.ACTIVE_SUBS.size;
      db.ACTIVE_SUBS.set(addr, slug);
      console.log(
        `\nAdded ${addr} with slug ${slug} to active subs, len: ${lenBefore} => ${db.ACTIVE_SUBS.size}`
      );
    }
  });
};

const subBids = async () => {
  osClient.onEvents("*", db.OS_SUB_EVENTS, async (event) => {
    addToBidsDB(event);

    if (db.TEST_MODE && ++db.AMT_BIDS % 1000 == 0) {
      process.stdout.write(
        `\r\x1b[38;5;39mSUBSCRIBE OS BIDS\x1b[0m: ${
          db.AMT_BIDS
        }, date: ${new Date().toISOString()}`
      );

      //add info about ~update time to know when to catch up in getBids
      db.BIDS.updateOne(
        { _id: "info" },
        {
          $set: {
            sub_bids_last: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }
  });
};

const addToBidsDB = async (bid) => {
  const _getFormattedBid = async (addr_tkn, id_tkn, price, bid) => {
    const order_hash = bid.payload.order_hash.toLowerCase();
    const exp_time = new Date(
      Number(bid.payload.protocol_data.parameters.endTime) * 1000
    );

    const addr_buyer = ethers.getAddress(bid.payload.maker.address);

    let traits = null;
    let type;
    switch (bid.event_type) {
      case EventType.ITEM_RECEIVED_BID:
        type = "OS_BID_SUB_BASIC";
        break;
      case EventType.COLLECTION_OFFER:
        type = "OS_BID_SUB_COLLECTION";
        break;
      case EventType.TRAIT_OFFER:
        type = "OS_BID_SUB_TRAIT";

        if (
          bid?.payload?.trait_criteria?.trait_type &&
          bid?.payload?.trait_criteria?.trait_name
        ) {
          const hashKey = crypto.createHash("md5");
          hashKey.update(bid?.payload?.trait_criteria?.trait_type.toString());
          const trait_key_hash = hashKey.digest("hex");

          const hashValue = crypto.createHash("md5"); //need to redeclare after digest
          hashValue.update(bid?.payload?.trait_criteria?.trait_name.toString()); // Ensure the value is a string
          const trait_value_hash = hashValue.digest("hex");

          traits = { trait_key: trait_key_hash, trait_value: trait_value_hash };
        }
        break;
      default:
        console.log("\nERR: bid.type not found", bid);
        return;
    }

    return {
      _id: order_hash,
      addr_tkn,
      id_tkn,
      price,
      exp_time,
      addr_buyer,
      traits,
      type,
      bid,
    };
  };

  const _validateBid = async (bid) => {
    /// avoid surprises ///
    const protocol_address = ethers.getAddress(bid?.payload?.protocol_address);
    if (!db.ADDR_SEAPORT.has(protocol_address)) {
      //to avoid surprises
      console.log(
        "ERR: protocol_address!=SEAPORT:",
        protocol_address,
        "\nbid:",
        bid
      );
      return;
    }

    const addr_tkn = ethers.getAddress(
      bid.payload?.protocol_data?.parameters?.consideration[0]?.token
    );

    // if (addr_tkn === db.TEST_NFT) {
    //   console.log(JSON.stringify(bid, null, 2));
    //   process.exit(0);
    // }
    // return;
    /// only active subs ///
    if (!db.ACTIVE_SUBS.has(addr_tkn)) return;

    /// only basic have chain info & id ///
    let id_tkn = null;
    if (bid.event_type === EventType.ITEM_RECEIVED_BID) {
      if (bid.payload?.item?.chain?.name !== "ethereum") {
        // console.log("\nERR: non-ETH bid", JSON.stringify(bid, null, 2));
        // process.exit(0);
        return;
      }
      id_tkn =
        bid.payload?.protocol_data?.parameters?.consideration[0]
          ?.identifierOrCriteria;
    }

    /// only orderType 0 & 1 for criteria offers (itemType 4 & 5) to support 1x block ///
    if (
      (bid.event_type === EventType.COLLECTION_OFFER ||
        bid.event_type === EventType.TRAIT_OFFER) &&
      bid.payload?.protocol_data?.parameters?.orderType > 1
    ) {
      return;
    }

    //@todo implement osFees calc based on time (~1/100k bids can have that)
    let price = BigInt(bid.payload.base_price);
    for (const osFeeData of bid.payload?.protocol_data?.parameters
      .consideration) {
      if (osFeeData.itemType <= 1) {
        //0: ETH, 1: ERC20, 2: ERC721...
        if (osFeeData.startAmount !== osFeeData.endAmount) {
          console.log(
            "DETECTED start-end amount mismatch",
            JSON.stringify(bid, null, 2)
          );
        }
        price -= BigInt(osFeeData.startAmount);
      }
    }

    /// need to cover gas ///
    if (!db.TEST_MODE && price <= db.MIN_SELL_TO_PRICE) return; //2small
    return [addr_tkn, id_tkn, price.toString()];
  };

  try {
    const [addr_tkn, id_tkn, price] = (await _validateBid(bid)) || [];
    if (!addr_tkn) return;

    const formattedBid =
      (await _getFormattedBid(addr_tkn, id_tkn, price, bid)) || {};
    if (!formattedBid._id) return;

    //// usually it will be unique, so this is better
    //// true, @todo if we'll face performance issues, we can collect & insert in bulk (e.g. per 10 or 100 bids)
    try {
      const result = await db.BIDS.insertOne(formattedBid);
      // if (db.TEST_MODE) {
      //   console.log(`\nInserted BID`, JSON.stringify(result, null, 2));
      //   console.log(formattedBid);
      //   process.exit(0);
      // }
    } catch (error) {
      if (error.code !== 11000) {
        console.error("Error inserting document:", error);
      }
    } finally {
      return;
    }
  } catch (e) {
    console.error("\nERR: addToBidsDB:", e);
  } finally {
    return;
  }
};

(async function root() {
  try {
    await setup();
    subSubs();
    subBids();
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
