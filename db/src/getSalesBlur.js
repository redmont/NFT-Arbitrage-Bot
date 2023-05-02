const fetch = require("node-fetch");
const ethers = require("ethers");

const wallet = ethers.Wallet.createRandom();
const {InitializeDB} = require("./mongo");

const TEST_MODE = false;

const db = {
  var: {
    BLUR_AUTH_TKN: "",
    PROGRESS_GET_ID_PERCENT: 0,
    PROGRESS_GET_ID: 0,
    START_TIME_GET_SALES_AND_BIDS: 0,
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
  nft: {},
  SLUGS: []
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
  // (4/6)
  const _addBlurSalesToDb = async (slug, addr, blurSales) => {
    const formattedSales = blurSales
      .map(sale => {
        const marketplace = sale.price.marketplace;
        if (marketplace !== 'BLUR') return null

        const price = ethers.parseEther(sale.price.amount).toString();
        const owner_addr = ethers.getAddress(sale.owner.address);
        const tkn_addr = ethers.getAddress(addr);
        const tkn_id = sale.tokenId;
        const listed_date_timestamp = Math.floor(Date.parse(sale.price.listedAt));
        const type = 'BLUR_SALE_ID'

        const order_hash = ethers.solidityPackedKeccak256(
          ['address', 'uint256', 'address', 'uint256', 'uint256'],
          [tkn_addr, tkn_id, owner_addr, price, listed_date_timestamp]
        );

        return {
          order_hash,
          price,
          owner_addr,
          tkn_addr,
          tkn_id,
          type,
          raw_sale: sale
        };
      })
      .filter(Boolean);

    const collection = db.mongoDB.collection('SALES');
    const bulkOps = formattedSales.map(sale => ({
      updateOne: {
        filter: { order_hash: sale.order_hash },
        update: { $set: sale },
        upsert: true
      }
    }));

    try {
      const result = await collection.bulkWrite(bulkOps, { ordered: true });
      console.log(`
        Inserted new BLUR SALES for ${slug}:
        - upsertedCount: ${result.upsertedCount}
        - matchedCount: ${result.matchedCount}
        - modifiedCount: ${result.modifiedCount}
        - insertedCount: ${result.insertedCount}
      `);
    } catch (err) {
      if (err instanceof MongoBulkWriteError) {
        console.log('Inserted new sales, err', err.result.insertedCount);
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
          console.log("ERR: getBlurSalesAndOsBids, Blur, no data, slug:", slug);
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
    let percent = Math.round((++db.var.PROGRESS_GET_ID / db.SLUGS.length * 100));
    if (percent > 100) percent = 100;

    const currTime = Math.floor(Date.now() / 1000);
    const timeDiff = currTime - db.var.START_TIME_GET_SALES_AND_BIDS;
    const timeDiffStr = new Date(timeDiff * 1000).toISOString().substr(11, 8);

    process.stdout.write(`\r\x1B[2K ID progress: ${percent}%;  time: ${timeDiffStr};  ${slug}`);
    db.var.PROGRESS_GET_ID_PERCENT = percent;
  };

  // (0/6)
  console.log("\x1b[33m%s\x1b[0m", "\nSTARTED COLLECTING BLUR SALES");
  try {
    for (const SLUG of db.SLUGS) {
      _updateProgress(SLUG);

      const [blurSales, nftAddr] = await _getSalesBlur(SLUG);
      if(!blurSales) continue
      _addBlurSalesToDb(SLUG, nftAddr, blurSales);
    }
  } catch (e) {
    console.error("\nERR: getBlurSalesAndOsBids", e);
    process.exit();
    // await getBlurSalesAndOsBids(); //@todo to reset need to save err slug to !loop over all again
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

  // DB CLIENT
  db.mongoDB = await InitializeDB();
};

(async function root() {
  try {
    await setup();
    // await getSlugsBlur(); //don't separate cuz <1m

    db.SLUGS = ['otherdeed', 'proof-moonbirds', 'mutant-ape-yacht-club'] //4test, 1st 344 ids; 2nd 2865 ids, 3rd 875 ids
    getSalesBlur();
  } catch (e) {
    console.error("\nERR: getSalesBlur root:", e);
    await root();
  }
})();