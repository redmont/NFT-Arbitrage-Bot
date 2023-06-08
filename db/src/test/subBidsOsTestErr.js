const { OpenSeaStreamClient, EventType } = require("@opensea/stream-js");
const { WebSocket } = require("ws");

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
};

(async function root() {
  try {
    osClient.onEvents("*", db.OS_SUB_EVENTS, async (event) => {
      // addToBidsDB(event);

      if (db.TEST_MODE) {
        process.stdout.write(
          `\r\x1b[38;5;39mSUBSCRIBE OS BIDS\x1b[0m: ${++db.AMT_BIDS}, date: ${new Date().toISOString()}`
        );
      }
    });
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
