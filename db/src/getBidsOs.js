const fetch = require("node-fetch");
const ethers = require("ethers");

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

  AMT_CALLS: 0,
  PING_TOTAL: 0,
  MIN_PING: 1000,
  TEST_NFT_ID: "877",
  TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",

  MIN_SELL_TO_PRICE: 10n ** 16n,
  MAX_IDS_PER_CALL: 30,
  KEY_CALLS_PER_SEC: 2,

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
      `\x1b[38;5;12m Time:\x1b[0m ${new Date().toISOString()}`
    // `\x1b[38;5;12m runtime:\x1b[0m ${((end - db.START) / 1000).toFixed(2)}s` +
  );
  // }

  switch (true) {
    case !data || data?.orders?.length === 0:
      return [null, ping];

    case data?.orders?.length > 0:
      return [data, ping];

    case data.detail === "Request was throttled." && data.id === "1KQIYV":
      console.log("\nThrottled request with ID 1KQIYV");
      await new Promise((resolve) => setTimeout(resolve, 61000));
      return getData(url, key);

    case data.detail &&
      data.detail.includes("Request was throttled. Expected available in"):
      const seconds = data.detail.split("available in ")[1].split(" second")[0];
      console.log(`\nThrottled request, retry in ${seconds} seconds`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
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
      Date.now() -
      Math.floor(ping / 2) +
      Math.floor(1000 / db.KEY_CALLS_PER_SEC);
  }
};

const getKeys = async () => {
  while (true) {
    const unblockedKeys = db.KEYS.filter(
      (key) =>
        !db.KEY_MANAGER[key].blocked &&
        db.KEY_MANAGER[key].blockedUntil <= Date.now()
    );

    if (unblockedKeys.length > 0) {
      return unblockedKeys;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const addToBidsDB = async (addr, osBids) => {
  const _getFilteredBids = async (formattedBids) => {
    // Get all _ids from formattedBids
    const formattedBidsIds = formattedBids.map((sale) => sale._id);

    // Find existing documents that match the _ids from formattedBids
    const existingDocs = await db.BIDS.find(
      { _id: { $in: formattedBidsIds } },
      { projection: { _id: 1 } }
    ).toArray();

    // Extract the _ids from the existing documents
    const existingIds = existingDocs.map((doc) => doc._id);

    // Filter out formattedBids that have an existing _id in the database
    const filteredBids = formattedBids.filter(
      (sale) => !existingIds.includes(sale._id)
    );
    return filteredBids;
  };

  const _getFormattedBids = async (osBids) => {
    return osBids
      .map((bid) => {
        let price = BigInt(bid.current_price);
        for (const osFeeData of bid.protocol_data?.parameters?.consideration) {
          if (osFeeData.itemType <= 1) {
            //0: ETH, 1: ERC20, 2: ERC721...
            price -= BigInt(osFeeData.endAmount);
          }
        }
        if (!db.TEST_MODE && price <= db.MIN_SELL_TO_PRICE) return; //2small

        price = price.toString();
        const order_hash = bid.order_hash.toLowerCase();
        const exp_time = bid.expiration_time;
        const addr_buyer = ethers.getAddress(
          bid.protocol_data.parameters.offerer
        );
        const id_tkn = bid.taker_asset_bundle.assets[0].token_id;
        const addr_tkn = addr;
        const type = "OS_BID_GET_BASIC";

        if (addr_tkn === db.TEST_NFT && id_tkn === db.TEST_NFT_ID) {
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
          bid,
        };
      })
      .filter(Boolean);
  };

  try {
    const formattedBids = await _getFormattedBids(osBids);
    if (formattedBids.length === 0) return; //if price 2small

    let bulkOps = formattedBids.map((bid) => ({
      updateOne: {
        filter: { _id: bid._id },
        update: { $set: bid },
        upsert: true,
      },
    }));

    // } else {
    // const filteredBids = await _getFilteredBids(formattedBids);
    // if(filteredBids.length === 0) return; //if all bids already in db
    // bulkOps = filteredBids.map(bid => ({
    //   insertOne: { document: bid }
    // }));
    // }

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

const getBidsFor = async ({ addr, ids }) => {
  // 1
  const _getUrlBatches = () => {
    const batches = [];
    const baseURL = db.URL_GET_OFFERS + addr + "&";
    for (let i = 0; i < ids.length; i += db.MAX_IDS_PER_CALL) {
      const batch = ids.slice(i, i + db.MAX_IDS_PER_CALL);
      const batchUrl =
        baseURL + batch.map((tokenId) => `token_ids=${tokenId}`).join("&");
      batches.push(batchUrl);
    }
    return batches;
  };

  // 2
  const _fetchAndStoreBids = async (urlBatches) => {
    //// 2.1
    const __fetchAndStoreBids = async (batchCurrUrl, batchCurrKey) => {
      // !NOTE: No point of calling "batchCurrUrl" in parallel as
      //        the next "potential" call depends on previous call
      //        and will happen only if "data.next" / amtBids>50.
      const bids = [];

      while (true) {
        setKey(batchCurrKey, true, 0);
        const [data, ping] = await getData(batchCurrUrl, batchCurrKey);
        setKey(batchCurrKey, false, ping);
        if (!data) break;

        bids.push(...data.orders);
        if (!data.next) break;

        batchCurrUrl += "&cursor=" + data.next;
        batchCurrKey = (await getKeys())[0];
      }

      if (bids.length > 0) {
        addToBidsDB(addr, bids);
      }
    };

    //// 2.0 divide batches for parallel processing
    while (urlBatches.length > 0) {
      const availableKeys = await getKeys();
      const parallelBatches = Math.min(availableKeys.length, urlBatches.length);

      const promises = availableKeys
        .slice(0, parallelBatches)
        .map((key, index) => {
          return __fetchAndStoreBids(urlBatches[index], key);
        });

      await Promise.all(promises);
      urlBatches.splice(0, parallelBatches);
    }
  };

  // 3
  const _mergeQueueItemsByAddr = async () => {
    db.QUEUE = db.QUEUE.reduce((accumulator, obj) => {
      const { addr, ids } = obj;
      const existing = accumulator.find((item) => item.addr === addr);

      if (existing) {
        existing.ids = [...new Set([...existing.ids, ...ids])];
      } else {
        accumulator.push({ addr, ids: [...new Set(ids)] });
      }

      return accumulator;
    }, []);
  };

  //0
  const urlBatches = _getUrlBatches(); // 1
  await _fetchAndStoreBids(urlBatches); // 2 (w8 to !exceed API limit)

  // 4
  db.QUEUE.shift(); //remove processed addr
  if (db.QUEUE.length > 0) {
    await _mergeQueueItemsByAddr(); //e.g. if new ids added to same addr during subSales
    getBidsFor(db.QUEUE[0]);
  } else if (!db.PROCESSED_FIRST_QUEUE) {
    console.log("\n\n\nPROCESSED_FIRST_QUEUE, DB IS READY FOR BOT.");
    db.PROCESSED_FIRST_QUEUE = true;
  }
};

const extractData = async (next) => {
  if (!next || !next.documentKey) return;
  //also can extract db name and collection from: "next.ns: { db: 'BOT_NFT', coll: 'SUBS' }"
  try {
    const addr = next.documentKey._id;
    var ids = [];

    switch (next.operationType) {
      case "insert":
        ids = next.fullDocument.id;
        break;
      case "update":
        ids = Object.values(next.updateDescription?.updatedFields);
        break;
    }

    if (!addr || !ids || ids?.length === 0) return;
    return { addr, ids };
  } catch (err) {
    console.error("\nERR extractData: ", err);
    return;
  }
};

(async function root() {
  await ensureIndexes(mongoClient);
  try {
    if (!db.INITIATED) {
      const subsArray = await db.SUBS.find().toArray();
      db.QUEUE.push(
        ...subsArray.map((doc) => ({ addr: doc._id, ids: doc.id }))
      );
      db.INITIATED = true;
      getBidsFor(db.QUEUE[0]);
    }

    db.streamSUBS = db.SUBS.watch().on("change", async (next) => {
      const data = await extractData(next);
      if (!data) return;

      db.QUEUE.push(data);

      if (db.QUEUE.length === 1) {
        getBidsFor(db.QUEUE[0]);
      } //else recursive
    });
  } catch (e) {
    console.error("\nERR: getBidsOs root:", e);
    await root();
  }
})();
