const {OpenSeaStreamClient, EventType} = require("@opensea/stream-js");
const {InitializeDB} = require("./mongo");
const fetch = require("node-fetch");
const {WebSocket} = require("ws");
const ethers = require("ethers");

const TEST_MODE = false

const osClient = new OpenSeaStreamClient({
  token: process.env.API_OS,
  networkName: "mainnet",
  connectOptions: {
    transport: WebSocket,
  },
  onError: (error) => console.error("ERR: osClient", error),
  logLevel: 1,
});

const db = {
  var: {
    TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',
    TEST_NFT_ID: '877',
    MIN_SELL_TO_PRICE: 10n**16n,
    OS_SUB_EVENTS: [
      EventType.ITEM_RECEIVED_BID,
      // EventType.COLLECTION_OFFER,
      // EventType.TRAIT_OFFER,
      // EventType.ITEM_LISTED,
    ],
  },
  api: {
    os: {
      url: {},
      options: {
        GET: {
          method: "GET",
          headers: {accept: "application/json", "X-API-KEY": process.env.API_OS},
        },
      }
    },
  },
  nft: {},
};

const subBidsOs = async () => {
  const handleBasicOffer = async (event) => {
    if (event.payload?.item?.chain?.name !== "ethereum") return;

    const addr = ethers.getAddress(
      event.payload?.protocol_data?.parameters?.consideration[0]?.token
    );
    const id = event.payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;

    if(TEST_MODE){
      if (addr !== db.var.TEST_NFT || id !== db.var.TEST_NFT_ID) return
      console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE OS BIDS\x1b[0m`)
    }

    let _sellToPrice = BigInt(event.payload.base_price);

    for (const osFeeData of event.payload?.protocol_data?.parameters.consideration) {
      if (osFeeData.itemType <= 1) {
        //0: ETH, 1: ERC20, 2: ERC721...
        _sellToPrice -= BigInt(osFeeData.startAmount);
      }
    }

    if(_sellToPrice <= db.var.MIN_SELL_TO_PRICE) return; //2small
    event.priceNet = _sellToPrice.toString();
    event.addr = addr;
    event.id = id;
    event.type = 'BID'

    //add to mongodb
    const collection = db.mongoDB.collection("BIDS");
    // const insertResult = await collection.insertOne(event);
    // console.log("Inserted OS BIDS:", insertResult);
    //@todo add to db only if correspoding SALE exists
    return;
  };

  const handleCollectionOffer = async (event) => {
    //@todo add to db
  };

  const handleTraitOffer = async (event) => {
    //@todo add to db
  };

  const handleItemListed = async (event) => {
    //@todo add to db
  };

  //→→→ STARTS HERE ←←←
  try {
    osClient.onEvents("*", db.var.OS_SUB_EVENTS, async event => {
      process.stdout.write(`\r\x1b[38;5;12mSUBSCRIBE OS BIDS\x1b[0m: ${++db.var.count}`);

      switch (event.event_type) {
        case EventType.ITEM_RECEIVED_BID:
          handleBasicOffer(event);
          break;
        // case EventType.COLLECTION_OFFER:
        //     handleCollectionOffer(event);
        //     break;
        // case EventType.TRAIT_OFFER:
        //     handleTraitOffer(event);
        //     break;
        // case EventType.ITEM_LISTED:
        //     handleItemListed(event);
        //     break;
      }
    });
  } catch (e) {
    console.error("ERR: subscribeSells", e);
    await subBidsOs();
  }
};

(async function root() {
  try {
    db.mongoDB = await InitializeDB();
    subBidsOs();
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();