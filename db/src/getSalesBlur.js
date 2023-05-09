const fetch = require("node-fetch");
const ethers = require("ethers");
const fs = require("fs");

const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const mongoClient = new MongoClient(uri);

const wallet = ethers.Wallet.createRandom();
const TEST_MODE = false;

const db = {
  TO_SAVE: {},
  SLUGS: [],
  SUBS: mongoClient.db('BOT_NFT').collection('SUBS'),
  SALES: mongoClient.db('BOT_NFT').collection('SALES'),
  var: {
    BLUR_AUTH_TKN: "",
    PROGRESS_GET_ID: 0,
    START_TIME_GET_SALES_AND_BIDS: Math.floor(Date.now() / 1000),
    NFT_COUNT: 0,
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

const getSlugsBlur = async () => {
  const _setNewPage = async (data) => {
    const lastCollection = data.collections[data.collections.length - 1];
    const floorPrice = lastCollection.floorPrice?.amount && lastCollection.floorPrice.amount;

    const filters = {
      cursor: {
        contractAddress: lastCollection.contractAddress,
        floorPrice: floorPrice || null,
      },
      sort: "FLOOR_PRICE",
      order: "DESC",
    };

    const filtersURLencoded = encodeURIComponent(JSON.stringify(filters));
    db.api.blur.url.COLLECTIONS = "http://127.0.0.1:3000/v1/collections/" + "?filters=" + filtersURLencoded;
  };

  const _getSlugsBlur = async () => {
    try {
      let data = await apiCall({
        url: db.api.blur.url.COLLECTIONS,
        options: db.api.blur.options.GET,
      });

      if (!data || data?.collections?.length === 0) return;

      if (TEST_MODE) {
        data.collections = data.collections.slice(0, 3);
      }

      data?.collections?.forEach(nft => db.SLUGS.push(nft.collectionSlug));

      if (TEST_MODE && db.var.NFT_COUNT++ > 2) return;

      await _setNewPage(data);
      await _getSlugsBlur();
    } catch (e) {
      console.error("ERR: getAllNftsBlur:", e);
      await _getSlugsBlur();
    }
  };

  // STARTS HERE
  console.time("getBlurSlugs");
  console.log("\x1b[95m%s\x1b[0m", "\n STARTED COLLECTING BLUR SLUGS");
  await _getSlugsBlur();
  console.log(
    "\x1b[95m%s\x1b[0m",
    "\n FINISHED COLLECTING NFTs, amt:",
    db.SLUGS.length
  );
  console.timeEnd("getBlurSlugs");
};

const getSalesBlur = async () => {
  const _addToSubsDB = async (addr, blurSales) => {
    const ids = blurSales
      .filter(sale => sale.price.marketplace === "BLUR")
      .map(sale => sale.tokenId);

    const existingDoc = await db.SUBS.findOne({ _id: addr }, { projection: { id: 1 } });

    if (existingDoc) {
      const newIds = ids.filter((id) => !existingDoc.id.includes(id));
      if (newIds.length > 0) {
        await db.SUBS.updateOne(
          { _id: addr },
          { $push: { id: { $each: newIds } } }
        );
      }
    } else {
      await db.SUBS.insertOne({ _id: addr, id: ids });
    }
  };

  // (4/6)
  const _addToSalesDB = async (slug, addr, blurSales) => {
    const __getFilteredSales = async (formattedSales) => {
      // Get an array of all existing _id values in the collection
      const existingDocs = await db.SALES.find({}, { projection: { _id: 1 } }).toArray();
      const existingIds = existingDocs.map(doc => doc._id);

      // Filter out formattedSales that have an existing _id in the database
      const filteredSales = formattedSales.filter(sale => !existingIds.includes(sale._id));
      return filteredSales;
    }

    const __getFormattedSales = async (addr, blurSales) => {
      return blurSales
        .map(sale => {
          const marketplace = sale.price.marketplace;
          if (marketplace !== 'BLUR') return null

          const price = ethers.parseEther(sale.price.amount).toString();
          const addr_seller = ethers.getAddress(sale.owner.address);
          const addr_tkn = ethers.getAddress(addr);
          const id_tkn = sale.tokenId;
          const time_start = Math.floor(Date.parse(sale.price.listedAt));
          const type = 'BLUR_SALE_GET'

          const order_hash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'address', 'uint256', 'uint256'],
            [addr_tkn, id_tkn, addr_seller, price, time_start]
          );

          return {
            _id: order_hash,
            addr_tkn,
            id_tkn,
            addr_seller,
            price,
            type,
            sale
          };
        })
        .filter(Boolean);
    }

    //start
    const formattedSales = await __getFormattedSales(addr, blurSales);
    if(formattedSales.length === 0) return;
    const filteredSales = await __getFilteredSales(formattedSales);
    if(filteredSales.length === 0) return;

    const bulkOps = filteredSales.map(sale => ({
      insertOne: { document: sale }
    }));

    try {
      const result = await db.SALES.bulkWrite(bulkOps, { ordered: true });
      // console.log(`
      //   Inserted new BLUR SALES for ${slug}:
      //   - insertedCount: ${result.insertedCount}
      // `);
    } catch (err) {
      console.error('Error during bulkWrite:', err);
      return
    }
    return
  };

  // (3/6)
  const _setURL = async (data, slug) => {
    // https://core-api.prod.blur.io/v1/collections/azuki/tokens?filters={"traits":[],"hasAsks":true}
    const baseFilter = {traits: [], hasAsks: true};
    const tkns = data?.tokens || [];

    // {"cursor":{"price":{"unit":"ETH","time":"2023-04-26T14:48:44.000Z","amount":"16.8"},"tokenId":"5599"},"traits":[],"hasAsks":true}
    const filters =
      tkns.length === 0
        ? baseFilter
        : {
          cursor: {
            price: tkns[tkns.length - 1].price,
            tokenId: tkns[tkns.length - 1].tokenId,
          },
          ...baseFilter,
        };

    const url = `http://127.0.0.1:3000/v1/collections/${slug}/tokens?filters=${encodeURIComponent(
      JSON.stringify(filters)
    )}`;
    return url;
  };

  // (2/6)
  const _getSalesBlur = async (slug) => {
    let data = {};
    let tkns = [];
    let countPages = 0; //for collections > 100

    try{
      do {
        const url = await _setURL(data, slug);
        data = await apiCall({url, options: db.api.blur.options.GET});
        if (!data) {
          console.error("ERR: getBlurSalesAndOsBids, Blur, no data, slug:", slug);
          continue;
        }
        tkns = tkns.concat(data.tokens);
        countPages += data?.tokens?.length;
      } while (countPages < data.totalCount);

      return [tkns, ethers.getAddress(data.contractAddress)]
    } catch (error) {
      console.error('\nERR _getSalesBlur: ', error);
    }
  }

  // (1/6)
  const _updateProgress = (slug) => {
    var percent = Math.round((++db.var.PROGRESS_GET_ID / db.SLUGS.length * 100));
    if (percent > 100) percent = 100;

    const currTime = Math.floor(Date.now() / 1000);
    const timeDiff = currTime - db.var.START_TIME_GET_SALES_AND_BIDS;
    const timeDiffStr = new Date(timeDiff * 1000).toISOString().substr(11, 8);

    process.stdout.write(`\r\x1B[2K ID progress: ${percent}%;  time: ${timeDiffStr};  ${slug}`);
    return
  };

  // (0/6)
  console.log("\x1b[33m%s\x1b[0m", "\nSTARTED COLLECTING BLUR SALES");
  for (const slug of db.SLUGS) {
    try {
      _updateProgress(slug);
      const [blurSales, addrTkn] = await _getSalesBlur(slug);
      if(!blurSales) continue
      _addToSalesDB(slug, addrTkn, blurSales);
      _addToSubsDB(addrTkn, blurSales)
    } catch (e) {
      console.error("\nERR: getBlurSalesAndOsBids", e);
      continue
    }
  }

  console.log("\x1b[33m%s\x1b[0m", "\nFINISHED COLLECTING BLUR SALES");
};

const setup = async () => {
  const dataToSign = await apiCall({
    url: db.api.blur.url.AUTH_GET,
    options: db.api.blur.options.AUTH,
  });

  dataToSign.signature = await wallet.signMessage(dataToSign.message);
  db.api.blur.options.AUTH.body = JSON.stringify(dataToSign);
  db.var.BLUR_AUTH_TKN = (
    await apiCall({url: db.api.blur.url.AUTH_SET, options: db.api.blur.options.AUTH})
  ).accessToken;

  /// SETUP BLUR API OPTIONS ///
  db.api.blur.options.GET = {
    method: "GET",
    headers: {
      authToken: db.var.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
      "content-type": "application/json",
    },
  };
};

(async function root() {
  try {
    // await db.SUBS.deleteMany({}); //clear db
    await setup();
    await getSlugsBlur(); //don't separate cuz <1m

    // db.SLUGS = ['otherdeed'] //4test: (~) 1st 344 ids; 2nd 2865 ids, 3rd 875 ids
    // db.SLUGS = ['yes-ser'] //testcase
    // db.SLUGS = ['otherdeed'] //~350 ids
    // console.time('start')
    //save SLUGS to ./slugs.json

    // db.SLUGS = ['proof-moonbirds', 'mutant-ape-yacht-club', 'otherdeed'] //4test: (~) 1st 344 ids; 2nd 2865 ids, 3rd 875 ids
    const start = performance.now();
    //delete all slugs until finds window-exe
    console.log('slugs legth before:', db.SLUGS.length)
    db.SLUGS = db.SLUGS.slice(db.SLUGS.indexOf('degendwarfs')) //last slug b4 err
    console.log('slugs legth after:', db.SLUGS.length)
    // return
    await getSalesBlur();
    // slugsJson = JSON.stringify(db.SLUGS, null, 2)
    // fs.writeFileSync('./slugs.json', slugsJson)
    // return
    const end = performance.now();
    console.log('time:', (end - start), 'ms')
    // console.timeEnd('start')
  } catch (e) {
    console.error("\nERR: getSalesBlur root:", e);
    await root();
  }
})();