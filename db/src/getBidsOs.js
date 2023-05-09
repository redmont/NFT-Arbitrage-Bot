/// old versions, just keep for reference ///

const fetch = require("node-fetch");
const ethers = require("ethers");

const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const mongoClient = new MongoClient(uri);

const db = {
  AMT_CALLS: 0,
  TEST_MODE: true,
  TEST_NFT_ID: '877',
  TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',

  QUEUE: [],
  BIDS: mongoClient.db('BOT_NFT').collection('BIDS'),
  SUBS: mongoClient.db('BOT_NFT').collection('SUBS'),

  MAX_IDS_PER_CALL: 30,
  MIN_SELL_TO_PRICE: 10n ** 16n,
  LIMIT_FOUR_CALLS_PER_SEC: 1000,

  KEYS: process.env.API_OS.split(','),
  KEY_MANAGER: process.env.API_OS.split(',').reduce(
    (acc, key) => ({
      ...acc,
      [key]: {
        available: true,
        lastFourTimestamps: [0,0,0,0],
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
    .catch((error) => console.error(error));
  return res;
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

const processQueue = async (data) => {
  const [addr, tknIds] = Object.entries(data)[0];

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
		// 1.3
		const __updateKeyManager = (key, status) => {
			// !NOTE: Need to use both, the "available" & the "lastFourTimestamps",
			//        due to the unknown latency of the getData function.
			//
			//        Key can't be available until the getData function is done.
			//        Key can   be available if in the last 4 calls, the first call is older than 1s.

			db.KEY_MANAGER[key].available = status; //false after send the call, true after receive the data.

			if(status === true) { // after receiving the data
				db.KEY_MANAGER[key].lastFourTimestamps.shift(); //delete oldest
				db.KEY_MANAGER[key].lastFourTimestamps.push(Date.now()); //add newest
			} // else is unavailable until receives the data.
		}

    // 1.2
		const __getAvailableKeys = async () => {
			while (true) {
				const availableKeys =
					db.KEYS.filter(
						(key) =>
						db.KEY_MANAGER[key].available &&
						db.KEY_MANAGER[key].lastFourTimestamps[0]+db.LIMIT_FOUR_CALLS_PER_SEC <= Date.now()
					);

				if (availableKeys.length > 0) {
					return availableKeys;
				}

        await new Promise((resolve) => setTimeout(resolve, 50)); //w8 for key
			}
		};

		// 1.1
		const __processBatch = async (batchCurrKey, batchCurrUrl) => {
      // 1.1.0
      const ___getData = async (url, key) => {
        if(db.AMT_CALLS === 0) {
          db.START = performance.now();
        }

        const start = performance.now();
        const data = await apiCall(
          {
            url,
            options: {
              method: "GET",
              headers: {accept: "application/json", "X-API-KEY": key}
            },
          }
        );
        const end = performance.now();
        process.stdout.write(`\r\x1b[38;5;12mAMT_CALLS:\x1b[0m: ${++db.AMT_CALLS}, get data ping ${end-start} ms}`);

        if(data.detail){
          console.log('\nERR LIMIT: ', data)
          db.END = performance.now();
          const timeDiff = db.END - db.START;
          console.log(`\nRESULT:\n${db.AMT_CALLS} calls in ${(timeDiff).toFixed(0)} ms, ${(timeDiff/(db.AMT_CALLS*100)).toFixed(2)} call/s.`);
          process.exit(0)
        }

        if(!data || data.orders.length === 0) return
        return data
      }

      // call get data & append result to batchResults
			// while result>50, call getData & append result to batchResults
			// each time set used key delay to dateNow + 250ms
			// get next available key if available, wait 50ms for the next available key

			// !NOTE: No point of calling this function in parallel as the next potential call
			//        is dependent on the result of the previous call.
			const batchResult = []

      var count = 0
      while(true) {
        // if(++count) console.log('add call...')
				__updateKeyManager(batchCurrKey, false);
        const data = await ___getData(batchCurrUrl, batchCurrKey);
        __updateKeyManager(batchCurrKey, true);
        if(!data) break

        // batchResult.push(...data.orders);
        if(!data.next) break

        batchCurrUrl += '&cursor=' + data.next;
				batchCurrKey = (await __getAvailableKeys())[0];
			}

      return batchResult
		}

		// 1.0
		const batchesResults = [];

    while (batches.length > 0) {
			const availableKeys = await __getAvailableKeys();
      const parallelBatches = Math.min(availableKeys.length, batches.length);

			const promises = availableKeys.slice(0, parallelBatches).map((key, index) => {
				return __processBatch(key, batches[index]);
			});

      const parallelBatchesResult = await Promise.all(promises);
      // console.log('parallelBatchesResult', parallelBatchesResult)
      parallelBatchesResult.forEach(result => {
        if (Object.keys(result).length > 0) {
          batchesResults.push(result);
        }
      });
      batches.splice(0, parallelBatches);
    }

    // console.log('batchesResults', batchesResults)
    // process.exit(0)
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
  // console.log('batches: ', batches.length)
  const batchesResults = await _processBatches(batches) ?? null;

  // if(!batchesResults) return
  // addToBidsDB(addr, batchesResults);

  // 4 Remove from processed from queue, merge, and execute next item if available
  db.QUEUE.shift();
  if (db.QUEUE.length > 0) {
    // _mergeIdsByAddrInQueue();
    console.log('<-Finished queue.\n -> Processing next element, queue length: ', db.QUEUE.length + '....');
    processQueue(db.QUEUE[0]);
  } else {
    console.log('\nPROCESSED ALL QUEUES.');
    db.END = performance.now();
    const timeDiff = db.END - db.START;
    console.log(`\nRESULT:\n${db.AMT_CALLS} calls in ${(timeDiff).toFixed(0)} ms, ${(timeDiff/(db.AMT_CALLS*100)).toFixed(2)} call/s.`);
    // process.exit(0);
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
  process.exit()
  try {
    db.streamSUBS = db.SUBS.watch().on('change', async (next) => {
      const data = await extractData(next);
      if(!data) return;

      db.QUEUE.push(data);
      // console.log('QUEUE:', db.QUEUE.length)
      // console.log('QUEUE:', db.QUEUE)
      if(db.QUEUE.length === 1) {
        // console.time('start')
        processQueue(db.QUEUE[0]);
        // console.timeEnd('start')
      } //else exec in processQueue
    });

  } catch (e) {
    console.error("\nERR: getBidsOs root:", e);
    await root();
  }
})();