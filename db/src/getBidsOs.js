const fetch = require("node-fetch");
const ethers = require("ethers");
const crypto = require("crypto");

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);
const { ensureIndexes } = require("../../utils/mongoIndexes");

const OS_KEYS = [process.env.API_OS_0, process.env.API_OS_1];

const db = {
  TEST_MODE: false,
  INITIATED: false,

  QUEUE: [],
  BIDS: mongoClient.db("BOT_NFT").collection("BIDS"),
  SUBS: mongoClient.db("BOT_NFT").collection("SUBS"),

  // (~) 75% bids are made within an hour, 25% hour older, 5% day older.
  // so run stream for 1h or one day for faster syncing, then getBidsOs
  CATCH_UP_START: false,
  // CATCH_UP_END: false,
  // CATCH_UP_START: "2023-06-04T18:04:54.398426",
  CATCH_UP_END: "2023-06-08T20:00:00.398426", //when started subBidsOs
  PROCESSED_FIRST_QUEUE: false,
  START: performance.now(),
  AMT_CALLS: 0,
  PING_TOTAL: 0,
  MIN_PING: 1000,
  WETH_ADDR: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  TEST_NFT_ID: "877",
  TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",

  MIN_SELL_TO_PRICE: 10n ** 16n,
  MAX_IDS_PER_CALL: 30,
  KEY_CALLS_PER_SEC: 1,

  KEYS: OS_KEYS,
  KEY_MANAGER: OS_KEYS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: {
        blocked: false,
        blockedUntil: 0,
        options: {
          method: "GET",
          headers: { accept: "application/json", "X-API-KEY": key },
        },
        // timestamps: [0,0], //potential for future 1x key burst calls.
      },
    }),
    {}
  ),
  URL_GET_OFFERS:
    "https://api.opensea.io/v2/orders/ethereum/seaport/offers?limit=50&order_by=eth_price&order_direction=desc&asset_contract_address=",
};

const apiCall = async ({ url, options }) => {
  let res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error("err", error));
  return res;
};

const getData = async (url, key) => {
  const start = performance.now();
  const data = await apiCall({ url, options: db.KEY_MANAGER[key].options });
  const end = performance.now();
  const ping = end - start;

  ping < db.MIN_PING ? (db.MIN_PING = ping) : null;
  db.AMT_CALLS == 0 ? (db.START = start) : null;
  db.PING_TOTAL += ping;

  // if(!db.PROCESSED_FIRST_QUEUE || db.TEST_MODE) {
  process.stdout.write(
    `\r\x1b[38;5;12m AMT calls:\x1b[0m ${++db.AMT_CALLS} ` +
      `\x1b[38;5;12m MIN ping:\x1b[0m ${db.MIN_PING.toFixed(2)} ms ` +
      `\x1b[38;5;12m AVG ping:\x1b[0m ${(db.PING_TOTAL / db.AMT_CALLS).toFixed(
        2
      )} ms ` +
      `\x1b[38;5;12m AVG call/s:\x1b[0m ${(
        (db.AMT_CALLS * 1000) /
        ((start + end) / 2 - db.START)
      ).toFixed(2)} ` +
      `\x1b[38;5;12m queue:\x1b[0m ${db.QUEUE.length} ` +
      `\x1b[38;5;12m queue:\x1b[0m RUNTIME ${(
        Math.floor(end - db.START) / 1000
      ).toFixed(2)}s ` +
      `\x1b[38;5;12m MEMORY:\x1b[0m ${(
        process.memoryUsage().heapUsed /
        1024 /
        1024
      ).toFixed(2)} MB `
    // `\x1b[38;5;12m Time:\x1b[0m ${new Date().toISOString()}`
    // `\x1b[38;5;12m runtime:\x1b[0m ${((end - db.START) / 1000).toFixed(2)}s` +
  );
  // }

  switch (true) {
    case !data || data?.offers?.length === 0:
      return [null, ping];

    case data?.offers?.length > 0:
      return [data, ping];

    case data.detail === "Request was throttled." && data.id === "1KQIYV":
      console.log("\nThrottled request with ID 1KQIYV");
      await new Promise((resolve) => setTimeout(resolve, 61000));
      return getData(url, key);

    case data.detail &&
      data.detail.includes("Request was throttled. Expected available in"):
      const seconds = data.detail.split("available in ")[1].split(" second")[0];
      // comment-out, cuz unknown limits for for getAllOrders endpoint & not >= 1s throttling for 1 call/s/key (~fastest)
      // console.log(`\nThrottled request, retry in ${seconds} seconds`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return getData(url, key);

    case data.success === false:
      console.log("\nERR get bids for slug", data);
      console.log("url", url);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return [null, ping];
      return getData(url, key);

    default:
      console.error("\nERR Unknown getData case:", data);
      await new Promise((resolve) => setTimeout(resolve, 61000 * 1000));
      return [null, ping];
  }
};

const setKey = (key, status, ping) => {
  // key is "blocked b4 & unblocked after" response
  db.KEY_MANAGER[key].blocked = status;
  if (status === false) {
    // after response
    db.KEY_MANAGER[key].blockedUntil =
      Date.now() +
      // - Math.floor(ping / 2) +
      Math.floor(1000 / db.KEY_CALLS_PER_SEC);
  }
};

const getKey = async () => {
  while (true) {
    for (let i = 0; i < db.KEYS.length; i++) {
      const key = db.KEYS[i];
      if (
        !db.KEY_MANAGER[key].blocked &&
        db.KEY_MANAGER[key].blockedUntil <= Date.now()
      ) {
        return key; // Returns immediately when it finds the first unblocked key
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

// bid example
// {
//   "order_hash": "0xde2e7375b530bfee119df38b7d55eb4267a49f21f8b9fe72e17b16a48507ef5e",
//   "chain": "ethereum",
//   "criteria": null,
//   "protocol_data": {
//     "parameters": {
//       "offerer": "0xcdbbc4133c9098a3027620d2546f853e59417d1d",
//       "offer": [
//         {
//           "itemType": 1,
//           "token": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//           "identifierOrCriteria": "0",
//           "startAmount": "10000000000000000000",
//           "endAmount": "10000000000000000000"
//         }
//       ],
//       "consideration": [
//         {
//           "itemType": 2,
//           "token": "0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258",
//           "identifierOrCriteria": "68531",
//           "startAmount": "1",
//           "endAmount": "1",
//           "recipient": "0xcdBbc4133C9098a3027620d2546F853E59417d1d"
//         },
//         {
//           "itemType": 1,
//           "token": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//           "identifierOrCriteria": "0",
//           "startAmount": "250000000000000000",
//           "endAmount": "250000000000000000",
//           "recipient": "0x0000a26b00c1F0DF003000390027140000fAa719"
//         }
//       ],
//       "startTime": "1684440528",
//       "endTime": "1687118917",
//       "orderType": 0,
//       "zone": "0x004C00500000aD104D7DBd00e3ae0A5C00560C00",
//       "zoneHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
//       "salt": "0x360c6ebe00000000000000000000000000000000000000007900344e440126d2",
//       "conduitKey": "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
//       "totalOriginalConsiderationItems": 2,
//       "counter": 0
//     },
//     "signature": null
//   },
//   "protocol_address": "0x00000000000000adc04c56bf30ac9d3c0aaf14dc"
// },

const addToBidsDB = async (osBids) => {
  const _getFormattedBids = async (osBids) => {
    return osBids
      .map((bid) => {
        /// VALIDATE ///
        if (bid.chain !== "ethereum") return;
        if (bid.protocol_data?.parameters?.orderType > 1) return;

        //non-weth return
        if (
          ethers.getAddress(bid.protocol_data?.parameters?.offer[0]?.token) !==
          db.WETH_ADDR
        ) {
          return;
        }

        //@todo add support for start-endAmounts
        let price = BigInt(bid.protocol_data?.parameters?.offer[0]?.endAmount);
        for (const osFeeData of bid.protocol_data?.parameters?.consideration) {
          if (osFeeData.itemType <= 1) {
            //0: ETH, 1: ERC20, 2: ERC721... @todo check if are offers with ETH
            price -= BigInt(osFeeData.endAmount);
          }
        }
        if (!db.TEST_MODE && price <= db.MIN_SELL_TO_PRICE) return; //2small

        let type;
        let traits = null;
        const { trait } = bid.criteria ?? {};

        if (trait?.type && trait?.value) {
          const hashKey = crypto.createHash("md5");
          hashKey.update(trait.type.toString());
          const trait_key_hash = hashKey.digest("hex");

          const hashValue = crypto.createHash("md5"); //need to redeclare after digest
          hashValue.update(trait.value.toString()); // Ensure the value is a string
          const trait_value_hash = hashValue.digest("hex");

          traits = { trait_key: trait_key_hash, trait_value: trait_value_hash };
          type = "OS_BID_GET_TRAIT";
        } else if (bid.criteria) {
          type = "OS_BID_GET_COLLECTION";
        } else {
          type = "OS_BID_GET_BASIC";
        }

        price = price.toString();
        const order_hash = bid.order_hash.toLowerCase();
        const exp_time = new Date(
          Number(bid.protocol_data.parameters.endTime) * 1000
        );
        const addr_buyer = ethers.getAddress(
          bid.protocol_data.parameters.offerer
        );

        let id_tkn = null;
        if (type === "OS_BID_GET_BASIC") {
          id_tkn = bid.protocol_data.parameters.offer[0].identifierOrCriteria;
        }
        const addr_tkn = ethers.getAddress(
          bid.protocol_data.parameters.consideration[0].token
        );

        if (db.TEST_MODE && addr_tkn === db.TEST_NFT) {
          console.log(`\nDETECTED TEST NFT BID: ${order_hash}`);
        }

        return {
          _id: order_hash,
          addr_tkn,
          id_tkn,
          addr_buyer,
          exp_time,
          price,
          type,
          traits,
          bid,
        };
      })
      .filter(Boolean);
  };

  try {
    const formattedBids = await _getFormattedBids(osBids);
    if (formattedBids.length === 0) return; //if price 2small

    const bulkOps = formattedBids.map((bid) => ({
      updateOne: {
        filter: { _id: bid._id },
        update: { $set: bid },
        upsert: true,
      },
    }));

    const result = await db.BIDS.bulkWrite(bulkOps, { ordered: true });
    if (db.TEST_MODE) {
      console.log(`\nInserted new ${result} OS BIDS`);
    }
  } catch (err) {
    console.error("Error during bulkWrite:", err);
  } finally {
    return;
  }
};

//https://api.opensea.io/v2/offers/collection/yes-ser/all?limit=100
//https://api.opensea.io/v2/offers/collection/otherdeed/all?limit=100&next=cGs9OTU5NzIzNzc1NCZjcmVhdGVkX2RhdGU9MjAyMy0wNS0xOCsyMCUzQTAxJTNBMzYuODM0MTU4

const getBidsFor = async (slug) => {
  const _hasCatchUp = async (next) => {
    if (db.PROCESSED_FIRST_QUEUE || !db.CATCH_UP_END) {
      return false;
    }

    const decodedNext = Buffer.from(next, "base64").toString("ascii");
    const params = new URLSearchParams(decodedNext);
    const createdDateString = params.get("created_date");
    const createdDateFormatted = createdDateString
      .replace("+", "T")
      .replace("%3A", ":");

    const currentTime = new Date(createdDateFormatted).getTime();
    const toCatchTime = new Date(db.CATCH_UP_END).getTime();

    // console.log(`\n\nCreated date string: ${createdDateString}`);
    // console.log(`db.CATCH_UP_END: ${db.CATCH_UP_END}`);

    // console.log(
    //   `currentTime: ${currentTime}\ntoCatchTime: ${toCatchTime}\nms to catch: ${
    //     toCatchTime - currentTime
    //   }`
    // );
    // console.log("has catch up?: ", currentTime > toCatchTime);
    return currentTime > toCatchTime;
  };

  const _getEncodedNextPage = (date) => {
    const dateToConvert = new Date(date);

    // Format the date and time
    const year = dateToConvert.getUTCFullYear();
    const month = String(dateToConvert.getUTCMonth() + 1).padStart(2, "0"); // JS months are 0-indexed
    const day = String(dateToConvert.getUTCDate()).padStart(2, "0");
    const hour = String(dateToConvert.getUTCHours()).padStart(2, "0");
    const minutes = String(dateToConvert.getUTCMinutes()).padStart(2, "0");
    const seconds = String(dateToConvert.getUTCSeconds()).padStart(2, "0");
    const ms = String(dateToConvert.getUTCMilliseconds()).padStart(6, "0");

    // Concatenate and format the result
    const nextPage = `${year}-${month}-${day}+${hour}%3A${minutes}%3A${seconds}.${ms}`;
    const toEncode = `pk=0&created_date=${nextPage}`;
    const encoded = Buffer.from(toEncode).toString("base64");
    return encoded;
  };

  const _setUrl = (url, params, next) => {
    if (url === undefined) {
      url = new URL(`https://api.opensea.io/v2/offers/collection/${slug}/all`);
      params = new URLSearchParams({ limit: 100 });

      //@todo set synced === true in memory to catch whole history for recent sub
      if (db.CATCH_UP_START) {
        console.log("\n Setting CATCH_UP_START", db.CATCH_UP_START);
        next = _getEncodedNextPage(db.CATCH_UP_START);
      }
    }
    if (next !== undefined) params.set("next", next);
    url.search = params;
    return [url, params];
  };

  const bids = [];
  const [url, params] = _setUrl();

  while (true) {
    const availableKey = await getKey();

    setKey(availableKey, true, 0);
    const [data, ping] = await getData(url, availableKey);
    setKey(availableKey, false, ping);

    if (!data) break;
    bids.push(...data.offers);

    if (!data.next || (await _hasCatchUp(data.next))) break;
    _setUrl(url, params, data.next);
  }

  if (bids.length > 0) {
    addToBidsDB(bids); //todo add addr
  }

  // 4
  db.QUEUE.shift(); //remove processed addr
  if (db.QUEUE.length > 0) {
    getBidsFor(db.QUEUE[0]);
  } else if (!db.PROCESSED_FIRST_QUEUE) {
    console.log("\n\n\nPROCESSED_FIRST_QUEUE, DB IS READY FOR BOT.");
    console.log(
      "set db.INITIATED=true, in case will quickly restart getBidsOs in the future"
    );
    db.PROCESSED_FIRST_QUEUE = true;
  }
};

(async function root() {
  await ensureIndexes(mongoClient);

  try {
    if (!db.INITIATED) {
      const subs = await db.SUBS.find().toArray();
      db.QUEUE = subs.map((sub) => sub.slug);
      db.INITIATED = true;
      getBidsFor(db.QUEUE[0]);
    }

    db.streamSUBS = db.SUBS.watch().on("change", async (next) => {
      if (!next || !next.documentKey || !next.fullDocument) return;
      // const addr = next.fullDocument._id;
      const slug = next.fullDocument.slug;

      db.QUEUE.push(slug);

      if (db.QUEUE.length === 1) {
        getBidsFor(db.QUEUE[0]);
      } //else recursive
    });
  } catch (e) {
    console.error("\nERR: getBidsOs root:", e);
    await root();
  }
})();
