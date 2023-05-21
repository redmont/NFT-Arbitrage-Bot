const { OpenSeaStreamClient, EventType } = require("@opensea/stream-js");
const { WebSocket } = require("ws");
const ethers = require("ethers");
const readline = require("readline");

const osClient = new OpenSeaStreamClient({
  token: process.env.API_OS_1,
  networkName: "mainnet",
  connectOptions: {
    transport: WebSocket,
  },
  onError: (error) => console.error("ERR: osClient", error),
  logLevel: 1,
});

const db = {
  START: performance.now(),
  TYPE: {
    BASIC: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    COLLECTION: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    TRAIT: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  },
  TEST_MODE: false,

  AMT_BIDS: 0,
  TEST_NFT_ID: "877",
  TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
  MIN_SELL_TO_PRICE: 10n ** 16n,
  OS_SUB_EVENTS: [
    EventType.ITEM_RECEIVED_BID,
    EventType.COLLECTION_OFFER,
    EventType.TRAIT_OFFER,
    EventType.ITEM_LISTED,
  ],
  ADDR_SEAPORT: [
    "0x00000000006c3852cbEf3e08E8dF289169EdE581", //1.1
    "0x00000000000006c7676171937C444f6BDe3D6282", //1.2
    "0x0000000000000aD24e80fd803C6ac37206a45f15", //1.3
    "0x00000000000001ad428e4906aE43D8F9852d0dD6", //1.4
    "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", //1.5
  ],
};

function logAndUpdate() {
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);

  process.stdout.write(
    `\r\x1b[38;5;12m BASIC: ${JSON.stringify(db.TYPE.BASIC, null, 2)} \n\n` +
      `\x1b[38;5;12m COLLECTION: ${JSON.stringify(
        db.TYPE.COLLECTION,
        null,
        2
      )}\x1b[0m \n\n` +
      `\x1b[38;5;12m TRAIT: ${JSON.stringify(
        db.TYPE.TRAIT,
        null,
        2
      )}\x1b[0m \n\n` +
      `\x1b[38;5;12m AMT_BIDS: ${++db.AMT_BIDS}\x1b[0m \n` +
      `\x1b[38;5;12m RUNTIME: ${((performance.now() - db.START) / 1000).toFixed(
        2
      )}\x1b[0m`
  );
}

(async function root() {
  try {
    osClient.onEvents("*", db.OS_SUB_EVENTS, async (event) => {
      switch (event.event_type) {
        case EventType.ITEM_RECEIVED_BID:
          db.TYPE.BASIC[event.payload.protocol_data.parameters.orderType]++;
          break;

        case EventType.COLLECTION_OFFER:
          db.TYPE.COLLECTION[
            event.payload.protocol_data.parameters.orderType
          ]++;
          break;

        case EventType.TRAIT_OFFER:
          db.TYPE.TRAIT[event.payload.protocol_data.parameters.orderType]++;
          break;
      }

      if (
        event.event_type == EventType.TRAIT_OFFER &&
        // event.payload.protocol_data.parameters.orderType <= 1 &&
        // event.payload.protocol_data.parameters.zone ===
        //   "0x000000e7ec00e7b300774b00001314b8610022b8" &&
        // event.payload.protocol_data.parameters.consideration[0].itemType <= 3
        true
      ) {
        console.log("\n GOT!", JSON.stringify(event, null, 2));
      }
      // logAndUpdate();
    });
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
