const { OpenSeaStreamClient, EventType } = require("@opensea/stream-js");
const { WebSocket } = require("ws");
const ethers = require("ethers");

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);

const osClient = new OpenSeaStreamClient({
  token: process.env.API_OS_0,
  networkName: "mainnet",
  connectOptions: {
    transport: WebSocket,
  },
  onError: (error) => console.error("ERR: osClient", error),
  logLevel: 1,
});

const db = {
  TEST_MODE: true,

  SUBS: mongoClient.db("BOT_NFT").collection("SUBS"),
  BIDS: mongoClient.db("BOT_NFT").collection("BIDS"),

  AMT_BIDS: 0,
  TEST_NFT_ID: "877",
  TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
  MIN_SELL_TO_PRICE: 10n ** 16n,
  OS_SUB_EVENTS: [
    EventType.ITEM_RECEIVED_BID,
    EventType.COLLECTION_OFFER,
    EventType.TRAIT_OFFER,
    // EventType.ITEM_LISTED,
  ],
  ADDR_SEAPORT: [
    "0x00000000006c3852cbEf3e08E8dF289169EdE581", //1.1
    "0x00000000000006c7676171937C444f6BDe3D6282", //1.2
    "0x0000000000000aD24e80fd803C6ac37206a45f15", //1.3
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", //1.4
    "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", //1.5
  ],
};

const addToBidsDB = async (bid) => {
  const _getFormattedBid = async (addr_tkn, id_tkn, price, bid) => {
    const order_hash = bid.payload.order_hash.toLowerCase();
    const exp_time = bid.payload.protocol_data.parameters.endTime;
    const addr_buyer = ethers.getAddress(bid.payload.maker.address);

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
        break;
      default:
        console.log("\nbRR: bid.type not found", bid);
        return;
    }

    return {
      _id: order_hash,
      addr_tkn,
      id_tkn,
      addr_buyer,
      price,
      exp_time,
      type,
      bid,
    };
  };

  const _validateBid = async (bid) => {
    //chain if addr to approve
    const protocol_address = ethers.getAddress(bid.payload.protocol_address);
    if (!db.ADDR_SEAPORT.includes(protocol_address)) {
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

    let id_tkn = null;

    switch (bid.event_type) {
      case EventType.ITEM_RECEIVED_BID:
        //check chain only for non criteria bids
        if (bid.payload?.item?.chain?.name !== "ethereum") return;

        id_tkn =
          bid.payload?.protocol_data?.parameters?.consideration[0]
            ?.identifierOrCriteria;
        //validate
        if (
          !(await db.SUBS.findOne(
            { _id: addr_tkn, id: { $elemMatch: { $eq: id_tkn } } },
            { projection: { _id: 1 } }
          ))
        ) {
          return;
        }
        break;

      case EventType.COLLECTION_OFFER:
        //@todo check if addr in subs
        //validate
        if (
          !(await db.SUBS.findOne(
            { _id: addr_tkn },
            { projection: { _id: 1 } }
          ))
        ) {
          return;
        }
        break;

      case EventType.TRAIT_OFFER:
        //@todo check if addr in subs
        //@todo should also check if trait in subs?
        //@todo SALES_BLUR_SUB does not have traits
        //@todo SALES_BLUR_GET does have traits
        //event.payload.trait_criteria
        // "trait_criteria": {
        //   "trait_name": "Deceiver Staff",
        //   "trait_type": "Weapon"
        // }

        //then if there are sales with price < than this bid, send call to get by criteria & check if exists in db, if so exec

        //will need to edit subSalesBlur, so that if new sale, make call to get criteria
        //if old, then just check if db & lower price
        break;
    }

    if (db.TEST_MODE) {
      console.log(`DETECTED TEST NFT: ${db.TEST_NFT} @ ${db.TEST_NFT_ID}`);
    }

    //check if there's a matching blur sale
    //check if potential profit higher than fees
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

    if (
      price <= db.MIN_SELL_TO_PRICE &&
      addr_tkn !== db.TEST_NFT &&
      id_tkn !== db.TEST_NFT_ID
    )
      return; //2small
    price = price.toString();

    return [addr_tkn, id_tkn, price];
  };

  try {
    const [addr_tkn, id_tkn, price] = (await _validateBid(bid)) || [];
    if (!addr_tkn) return;

    const formattedBid =
      (await _getFormattedBid(addr_tkn, id_tkn, price, bid)) || {};
    console.log(formattedBid);
    if (!formattedBid._id) return;

    //// better in case of many duplicates
    // const existingBid = await db.BIDS.findOne({ _id: formattedBid._id });
    // if (existingBid) return
    // await db.BIDS.insertOne(formattedBid);

    //// usually it will be unique, so this is better
    try {
      await db.BIDS.insertOne(formattedBid);
      if (db.TEST_MODE) console.log(`\nInserted BID`);
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
    osClient.onEvents("*", db.OS_SUB_EVENTS, async (event) => {
      // if(db.TEST_MODE){
      if (++db.AMT_BIDS % 1000 == 0) {
        process.stdout.write(
          `\r\x1b[38;5;39mSUBSCRIBE OS BIDS\x1b[0m: ${
            db.AMT_BIDS
          }, date: ${new Date().toISOString()}`
        );
      }
      // process.stdout.write(`\r\x1b[38;5;12mSUBSCRIBE OS BIDS\x1b[0m: ${++db.AMT_BIDS}`);
      // }

      switch (event.event_type) {
        case EventType.ITEM_RECEIVED_BID:
          //addToBidsDB(event);
          break;
        case EventType.COLLECTION_OFFER:
          addToBidsDB(event); //perhaps initially use addCollectionToSalesDB
          break;
        case EventType.TRAIT_OFFER:
          return;
          addToBidsDB(event); //perhaps initially use addTraitToSalesDB
          break;
        // case EventType.ITEM_LISTED:
        //   handleItemListed(event);
        //   break;
      }
    });
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
