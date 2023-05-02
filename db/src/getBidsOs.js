const fetch = require("node-fetch");
const ethers = require("ethers");

const {InitializeDB} = require("./mongo");

const TEST_MODE = false;

const db = {
  var: {
    BLUR_AUTH_TKN: "",
    PROGRESS_GET_ID_PERCENT: 0,
    PROGRESS_GET_ID: 0,
    START_TIME_GET_SALES_AND_BIDS: 0,
    NFT_COUNT: 0,
    MIN_SELL_TO_PRICE: 10n ** 16n,
  },
  api: {
    blur: {
      url: {
        AUTH_GET: "http://127.0.0.1:3000/auth/getToken",
        AUTH_SET: "http://127.0.0.1:3000/auth/setToken",
        COLLECTIONS:
          "http://127.0.0.1:3000/v1/collections/?filters=%7B%22sort%22%3A%22FLOOR_PRICE%22%2C%22order%22%3A%22DESC%22%7D",
      },
      options: {
        AUTH: {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({walletAddress: wallet.address}),
        },
        GET: {}, //in setup()
      },
    },
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
  SLUGS: [],
};

const apiCall = async ({url, options}) => {
  let res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error(error));
  return res;
};

const getBidsOs = async (collectionsSales) => {
  // (2/2)
  const _addOsBidsToDb = async (addr, osBids) => { //will upsert
    const formattedOsBids = osBids
      .map(bid => {
      const price_net = BigInt(bid.current_price) - BigInt(
        bid.protocol_data.parameters.consideration
        .filter(osFeeData => osFeeData.itemType <= 1)
        .reduce((sum, osFeeData) => sum + osFeeData.startAmount, 0)
      );

      if (price_net <= BigInt(db.var.MIN_SELL_TO_PRICE)) return null;

      const order_hash = bid.order_hash.toLowerCase();
      const expiration_time = bid.expiration_time;
      const offerer_address = ethers.getAddress(bid.protocol_data.parameters.offerer);
      const tkn_id = bid.taker_asset_bundle.assets[0].token_id;
      const tkn_addr = addr
      const type = "OS_BID_GET"

      return {
        order_hash,
        price_net: price_net.toString(),
        tkn_id,
        tkn_addr,
        exp_time: expiration_time,
        owner_addr: offerer_address,
        type,
        raw_bid: bid
      };
      })
      .filter(Boolean);

    const collection = db.mongoDB.collection("BIDS");
    const bulkOps = formattedOsBids.map(bid => ({
      updateOne: {
      filter: { order_hash: bid.order_hash },
      update: { $set: bid },
      upsert: true
      }
    }));

    try {
      const result = await collection.bulkWrite(bulkOps, { ordered: true });
      console.log(`
        Inserted new OS BIDS:
        - upsertedCount: ${result.upsertedCount}
        - matchedCount: ${result.matchedCount}
        - modifiedCount: ${result.modifiedCount}
        - insertedCount: ${result.insertedCount}
      `);
    } catch (err) {
      if (err instanceof MongoBulkWriteError) {
      	console.log('Inserted new bids, err?', err.result.insertedCount);
      } else {
      	console.error('Error during bulkWrite:', err);
      }
    }

    try {
      await collection.createIndex({ order_hash: 1 }, { unique: true });
    } catch (err) {
      console.error('Error during createIndex:', err);
    }
  };

  // (1/2)
  const _getOsBids = async (addr, blurSales) => {
    const __fetchAllBids = async (url) => {
      const batchBids = [];

      const ___fetchBids = async (currUrl) => {
        while (true) {
          try {
            const data = await apiCall({ url: currUrl, options: db.api.os.options.GET });
            if (data.detail) {//'Request was throttled. Expected available in 1 second.'
              // console.log('data.detail:', data.detail)
              console.log('api err limit: ', data)
              //Request was throttled.
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue
            }
            return data;
          } catch (error) {
            console.error('ERR ___fetchBids: ', error, '\nurl: ', currUrl);
            return null;
          }
        }
      };

      let nextUrl = url;
      while (nextUrl) {
        const data = await ___fetchBids(nextUrl);
        if (!data || data.orders.length === 0) break

        const { next, previous, orders } = data;
        batchBids.push(...orders);
        nextUrl = next ? url + '&cursor=' + next : null; //if ordersInBatch>50, nextUrl exists
      }

      return batchBids;
    };

    try{
      let bids = [];
      const batchSize = 30; //tknsIds/call limit
      const tknIds = blurSales.map((tkn) => tkn.tokenId);

      const baseURL = `https://api.opensea.io/v2/orders/ethereum/seaport/offers?limit=50&order_by=eth_price&order_direction=desc&asset_contract_address=${addr}&`;

      for (let i = 0; i < tknIds.length; i += batchSize) {
        const batchTknIds = tknIds.slice(i, i + batchSize);
        const url = baseURL + batchTknIds.map(tokenId => `token_ids=${tokenId}`).join('&');
        const batchBids = await __fetchAllBids(url);
        bids.push(...batchBids);
      }

      return bids
    } catch (error) {
      console.error('\nERR _getAndAddOsBidsToDb: ', error);
    }
  };

  // (0/2)
  console.log("\x1b[33m%s\x1b[0m", "\nSTARTED COLLECTING OS BIDS");
  try {
    for (const collectionSales of collectionsSales) {
      const osBids = await _getOsBids(collectionSales.addr, collectionSales.ids); //@todo consider via puppeteer to !w8
      if(!osBids) continue
      _addOsBidsToDb(SLUG, nftAddr, osBids);
    }
  } catch (e) {
    console.error("\nERR: getBidsOs", e);
    process.exit();
  }

  console.log("\x1b[33m%s\x1b[0m", "\nCOMPLETED COLLECTING EACH NFT ID PRICE");
};

;(async function root() {
  try {
		//@todo via sub, get new blur sales (then filter out ids with "false" - not checked for bids yet)
		const collectionsSales = 'todo'
    getBidsOs(collectionsSales); //then loop to get all bids using multiple keys
  } catch (e) {
    console.error("\nERR: getBidsOs root:", e);
    await root();
  }
})();