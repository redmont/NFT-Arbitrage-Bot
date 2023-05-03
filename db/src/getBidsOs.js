const fetch = require("node-fetch");
const ethers = require("ethers");

const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const mongoClient = new MongoClient(uri);

const db = {
  BIDS: mongoClient.db('BOT_NFT').collection('BIDS'),
  SUBS: mongoClient.db('BOT_NFT').collection('SUBS'),
  var: {
    MIN_SELL_TO_PRICE: 10n ** 16n,
    ADDR_SEAPORT: [
      '0x00000000006c3852cbEf3e08E8dF289169EdE581', //1.1
      '0x00000000000006c7676171937C444f6BDe3D6282', //1.2
      '0x0000000000000aD24e80fd803C6ac37206a45f15', //1.3
      '0x00000000000001ad428e4906aE43D8F9852d0dD6', //1.4
      '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC', //1.5
    ]
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
  const _getFilteredBids = async (osBids) => {
    // Get an array of all existing _id values in the collection
    const existingDocs = await db.BIDS.find({}, { projection: { _id: 1 } }).toArray();
    const existingIds = existingDocs.map(doc => doc._id);

    // Filter out formattedBids that have an existing _id in the database
    const filteredBids = formattedBids.filter(bid => !existingIds.includes(bid._id));
    return filteredBids;

  }

  const _getFormattedBids = async (osBids) => {
    return osBids
    .map(bid => {
      const protocol_address = ethers.getAddress(bid.protocol_address);
      if(!db.var.ADDR_SEAPORT.includes(protocol_address)) { //to avoid surprises
        console.log('ERR: protocol_address!=SeaPort:', protocol_address, '\nbid:', bid);
        return;
      }

      let price = BigInt(bid.current_price);
      for (const osFeeData of bid.protocol_data?.parameters?.consideration) {
        if (osFeeData.itemType <= 1) { //0: ETH, 1: ERC20, 2: ERC721...
          price -= BigInt(osFeeData.endAmount);
        }
      }
      if (price <= db.var.MIN_SELL_TO_PRICE) return; //2small

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

const getBidsOs = async (addr, tknIds) => {
  const _fetchAllBids = async (url) => {
    const batchBids = [];

    const ___fetchBids = async (currUrl) => {
      while (true) {
        try {
          const data = await apiCall({ url: currUrl, options: db.api.os.options.GET });
          if (data.detail) {
            //'Request was throttled. Expected available in 1 second.'
            //Request was throttled.
            console.log('api err limit: ', data)
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
    const baseURL = `https://api.opensea.io/v2/orders/ethereum/seaport/offers?limit=50&order_by=eth_price&order_direction=desc&asset_contract_address=${addr}&`;

    for (let i = 0; i < tknIds.length; i += batchSize) {
      const batchTknIds = tknIds.slice(i, i + batchSize);
      const url = baseURL + batchTknIds.map(tokenId => `token_ids=${tokenId}`).join('&');
      const batchBids = await _fetchAllBids(url);
      bids.push(...batchBids);
    }

    return bids
  } catch (error) {
    console.error('\nERR getBidsOs: ', error);
    return null;
  }
};

const extractData = async (next) => {
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

    console.log(`\nAddress: ${addr} updated with IDs: ${newTknIDs}`);
    return [addr, newTknIDs];
  } catch (error) {
    console.error('\nERR extractData: ', error);
    return [null, null];
  }
}

;(async function root() {
  try {
    db.stream = db.SUBS.watch();

    db.stream.on('change', async (next) => {
      if (!next || !next.documentKey) return;

      const [addr, newTknIDs] = await extractData(next);
      if(!addr || !newTknIDs || newTknIDs.length === 0) return;

      const bids = await getBidsOs(addr, newTknIDs); //@todo (current 1x key)
      if(!bids || bids.length === 0) return;

      addToBidsDB(addr, bids) //should work
    });

  } catch (e) {
    console.error("\nERR: getBidsOs root:", e);
    await root();
  }
})();