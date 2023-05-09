const fetch = require("node-fetch");
const ethers = require("ethers");
const fs = require("fs");

const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const mongoClient = new MongoClient(uri);

const OS_KEYS = [process.env.API_OS_0, process.env.API_OS_1]

const db = {
  MIN_PING: 1000,
  PING_TOTAL: 0,
  AMT_CALLS: 0,
  TEST_MODE: true,
  TEST_NFT_ID: '877',
  TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',

  QUEUE: [],
  BIDS: mongoClient.db('BOT_NFT').collection('BIDS'),
  SUBS: mongoClient.db('BOT_NFT').collection('SUBS'),

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
        options: {method: "GET", headers: {accept: "application/json", "X-API-KEY": key}}
        // timestamps: [0,0], //potential for future 1x key burst calls.
      },
    }),
    {}
  ),
  URL_GET_OFFERS: "https://api.opensea.io/v2/orders/ethereum/seaport/offers?limit=50&order_by=eth_price&order_direction=desc&asset_contract_address=",
};

const apiCall = async ({url, options}) => {
  let res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error('err', error));
  return res;
};

const getData = async (url, key) => {
  const start = performance.now();
  const data = await apiCall({url, options: db.KEY_MANAGER[key].options});
  const end = performance.now();
  const ping = end-start;

  ping < db.MIN_PING ? db.MIN_PING = ping : null;
  db.AMT_CALLS==0 ? db.START = start : null;
  db.PING_TOTAL += ping;

  if(db.TEST_MODE) {
    process.stdout.write(
      `\r\x1b[38;5;12m AMT calls:\x1b[0m ${++db.AMT_CALLS} ` +
      `\x1b[38;5;12m MIN ping:\x1b[0m ${(db.MIN_PING).toFixed(2)} ms ` +
      `\x1b[38;5;12m AVG ping:\x1b[0m ${(db.PING_TOTAL / db.AMT_CALLS).toFixed(2)} ms ` +
      `\x1b[38;5;12m AVG call/s:\x1b[0m ${((db.AMT_CALLS * 1000) / (((start + end) / 2) - db.START)).toFixed(2)} ` +
      `\x1b[38;5;12m queue:\x1b[0m ${db.QUEUE.length} ` +
      `\x1b[38;5;12m runtime:\x1b[0m ${((end - db.START) / 1000).toFixed(2)}s`
    );
  }

  switch (true) {
    case !data || (data?.orders?.length === 0):
      return [null, ping];

    case data?.orders?.length > 0:
      return [data, ping];

    case data.detail === 'Request was throttled.' && data.id === '1KQIYV':
      console.log('\nThrottled request with ID 1KQIYV');
      await new Promise((resolve) => setTimeout(resolve, 61000));
      return getData(url, key);

    case data.detail && data.detail.includes('Request was throttled. Expected available in'):
      const seconds = data.detail.split('available in ')[1].split(' second')[0];
      console.log(`\nThrottled request, retry in ${seconds} seconds`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return getData(url, key);

    default:
      console.error('\nERR Unknown getData case:', data);
      return [null, ping];
  }
}

const setKey = (key, status, ping) => {
  // key is "blocked b4 & unblocked after" response
  db.KEY_MANAGER[key].blocked = status;
  if(status === false) { // after response
    db.KEY_MANAGER[key].blockedUntil = Date.now() - Math.floor(ping/2) + Math.floor(1000/db.KEY_CALLS_PER_SEC)
  }
};

const getKeys = async () => {
  while (true) {
    const unblockedKeys = db.KEYS.filter((key) =>
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
    // Get an array of all existing _id values in the collection
    const existingDocs = await db.BIDS.find({}, { projection: { _id: 1 } }).toArray();
    const existingIds = existingDocs.map(doc => doc._id);

    // Filter out formattedBids that have an existing _id in the database
    const filteredBids = formattedBids.filter(bid => !existingIds.includes(bid._id));
    return filteredBids;
  }

  const _getFormattedBids = async (osBids) => {
    console.log('\nosBids', osBids);
    return osBids
    .map(bid => {
      console.log('\n--bid', bid)
      let price = BigInt(bid.current_price);
      for (const osFeeData of bid.protocol_data?.parameters?.consideration) {
        if (osFeeData.itemType <= 1) { //0: ETH, 1: ERC20, 2: ERC721...
          price -= BigInt(osFeeData.endAmount);
        }
      }
      if (!db.TEST_MODE && price <= db.MIN_SELL_TO_PRICE) return; //2small

      price = price.toString();
      const order_hash = bid.order_hash.toLowerCase();
      const exp_time = bid.expiration_time;
      const addr_buyer = ethers.getAddress(bid.protocol_data.parameters.offerer);
      const id_tkn = bid.taker_asset_bundle.assets[0].token_id;
      const addr_tkn = addr;
      const type = "OS_BID_GET";

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
  }

  const formattedBids = await _getFormattedBids(osBids);
  if(formattedBids.length === 0) return; //if price 2small

  const filteredBids = await _getFilteredBids(formattedBids);
  if(filteredBids.length === 0) return; //if all bids already in db

  const bulkOps = filteredBids.map(bid => ({
    insertOne: { document: bid }
  }));

  try {
    const result = await db.BIDS.bulkWrite(bulkOps, { ordered: true });
    console.log(`
      Inserted new OS BIDS:
      - insertedCount: ${result.insertedCount}
    `);
  } catch (err) {
    console.error('Error during bulkWrite:', err);
  }
};

const processQueue = async ({addr, tknIds}) => {
  // const [addr, tknIds] = Object.entries(data)[0];

  // 1
  const _getBatches = async (addr, tknIds) => {
    const batches = [];
    const baseURL = db.URL_GET_OFFERS+addr+'&';
    for (let i = 0; i < tknIds.length; i += db.MAX_IDS_PER_CALL) {
      const batch = tknIds.slice(i, i + db.MAX_IDS_PER_CALL);
      const batchUrl = baseURL + batch.map(tokenId => `token_ids=${tokenId}`).join('&');
      batches.push(batchUrl);
    }
    return batches;
  }

  // 2
  const _processBatches = async (batches) => {
		//// 2.1
		const __processBatch = async (batchCurrKey, batchCurrUrl) => {
			// !NOTE: No point of calling this function in parallel as
      //        the next potential call depends on previous call
      //        and will happen only if "data.next" / amtBids>50.
			const batchResult = []

      while(true) {
        setKey(batchCurrKey, true, 0);
        const [data, ping] = await getData(batchCurrUrl, batchCurrKey);
        setKey(batchCurrKey, false, ping);
        if(!data) break

        batchResult.push(...data.orders);
        if(!data.next) break

        batchCurrUrl += '&cursor=' + data.next;
				batchCurrKey = (await getKeys())[0];
			}

      return batchResult
		}

		//// 2.0
		const batchesResults = [];

    while (batches.length > 0) {
			const availableKeys = await getKeys();
      const parallelBatches = Math.min(availableKeys.length, batches.length);

			const promises = availableKeys.slice(0, parallelBatches).map((key, index) => {
				return __processBatch(key, batches[index]);
			});

      const parallelBatchesResult = await Promise.all(promises);
      parallelBatchesResult.forEach(result => {
        if (Object.keys(result).length > 0) {
          batchesResults.push(result);
        }
      });
      batches.splice(0, parallelBatches);
    }

    return batchesResults;
  }

  // 3
	const _mergeIdsByAddrInQueue = () => {
		queueLengthBefore = db.QUEUE.length;

		// Group elements by their addr key and concatenate ids
		const groupedById = {};
		db.QUEUE.forEach((obj) => {
			const { addr, ids } = obj;
			if (!groupedById[addr]) {
				groupedById[addr] = [...new Set(ids)];
			} else {
				groupedById[addr] = [...new Set([...groupedById[addr], ...ids])];
			}
		});

		// Modify original queue with updated elements
		db.QUEUE = Object.entries(groupedById).map(([addr, ids]) => ({
			addr,
			ids,
		}));

    if(db.QUEUE.length !== queueLengthBefore ) {
      // console.log(`\nQueue length: ${queueLengthBefore} -> ${db.QUEUE.length}`);
    }
	};

  //0
  const batches = await _getBatches(addr, tknIds);
  const batchesResults = await _processBatches(batches) ?? null;

  // if(!batchesResults) return
  // addToBidsDB(addr, batchesResults);

  // 4 Remove from processed from queue, merge, and execute next item if available
  db.QUEUE.shift();
  if (db.QUEUE.length > 0) {
    // _mergeIdsByAddrInQueue();
    // console.log('<-Finished queue.\n -> Processing next element, queue length: ', db.QUEUE.length + '....');
    processQueue(db.QUEUE[0]);
  } else {
    console.log('\nPROCESSED ALL QUEUES.');
  }
}

const extractData = async (next) => {
  if (!next || !next.documentKey) return;
  //also can extract db name and collection from: "next.ns: { db: 'BOT_NFT', coll: 'SUBS' }"
  try{
    const addr = next.documentKey._id;
    var newTknIDs = [];

    switch(next.operationType) {
      case 'insert':
        newTknIDs = next.fullDocument.id;
        break;
      case 'update':
        newTknIDs = Object.values(next.updateDescription?.updatedFields);
        break;
    }

    if(!addr || !newTknIDs || newTknIDs.length === 0) return;
    // console.log(`\nAddress: ${addr} updated with IDs: ${newTknIDs}`);
    return {[addr]: newTknIDs};
  } catch (error) {
    console.error('\nERR extractData: ', error);
    return;
  }
}

;(async function root() {
  try{
    const subs = JSON.parse(fs.readFileSync('./subs.json', 'utf8'));
    subs.forEach((obj) => {
      const addr = obj._id;
      const tknIds = obj.id;
      db.QUEUE.push({ addr, tknIds });
    })

    processQueue(db.QUEUE[0]);
  } catch (error) {
    console.error('\nERR root: ', error);
    process.exit(0);
    // await root();
  }

  // try {
  //   db.streamSUBS = db.SUBS.watch().on('change', async (next) => {
  //     const data = await extractData(next);
  //     if(!data) return;

  //     db.QUEUE.push(data);
  //     // console.log('QUEUE:', db.QUEUE.length)
  //     // console.log('QUEUE:', db.QUEUE)
  //     if(db.QUEUE.length === 1) {
  //       // console.time('start')
  //       processQueue(db.QUEUE[0]);
  //       // console.timeEnd('start')
  //     } //else exec in processQueue
  //   });

  // } catch (e) {
  //   console.error("\nERR: getBidsOs root:", e);
  //   await root();
  // }
})();
