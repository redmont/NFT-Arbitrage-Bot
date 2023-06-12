const fetch = require("node-fetch");
const ethers = require("ethers");

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);
const { ensureIndexes } = require("../../../utils/mongoIndexes");

const wallet = ethers.Wallet.createRandom();

const db = {
  TIME_START: 0,
  TEST_MODE: false,
  SLUGS: [],
  TO_SAVE: {},

  SUBS: mongoClient.db("BOT_NFT").collection("SUBS"),

  NFT_COUNT: 0,
  BLUR_AUTH_TKN: "",
  AMT_RESPONSE: 0,
  AMT_SEND: 0,
  START_TIME: Math.floor(Date.now() / 1000),
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet.address }),
        },
        GET: {}, //in setup()
      },
    },
  },
};

const apiCall = async ({ url, options }) => {
  db.AMT_SEND++;
  let res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error(error));

  const memory = process.memoryUsage().heapUsed / 1024 / 1024;
  process.stdout.write(
    `\r\x1b[38;5;12mAMT calls:\x1b[0m ${db.AMT_SEND} ` +
      `\x1b[38;5;12mAMT responses:\x1b[0m ${++db.AMT_RESPONSE} ` +
      `\x1b[38;5;12mRAM:\x1b[0m ${Math.round(memory * 100) / 100} MB ` +
      `\x1b[38;5;12mRUNTIME:\x1b[0m ${(
        (performance.now() - db.TIME_START) /
        1000
      ).toFixed(2)}s ` +
      `\x1b[38;5;12mTIME:\x1b[0m ${new Date().toLocaleTimeString()}`
  );

  // await new Promise((resolve) => setTimeout(resolve, 100));
  return res;
};

const setup = async () => {
  const dataToSign = await apiCall({
    url: db.api.blur.url.AUTH_GET,
    options: db.api.blur.options.AUTH,
  });

  dataToSign.signature = await wallet.signMessage(dataToSign.message);
  db.api.blur.options.AUTH.body = JSON.stringify(dataToSign);
  db.BLUR_AUTH_TKN = (
    await apiCall({
      url: db.api.blur.url.AUTH_SET,
      options: db.api.blur.options.AUTH,
    })
  ).accessToken;

  /// SETUP BLUR API OPTIONS ///
  db.api.blur.options.GET = {
    method: "GET",
    headers: {
      authToken: db.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
      "content-type": "application/json",
    },
  };

  await ensureIndexes(mongoClient);

  await db.SUBS.updateOne(
    { _id: "info" },
    {
      $set: {
        get_subs_start: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
  // await db.SUBS.deleteMany({}); //clear db
};

const addToSubsDB = async (slug, addr) => {
  try {
    await db.SUBS.updateOne(
      { _id: addr },
      { $set: { slug: slug } },
      { upsert: true }
    );
  } catch (e) {
    console.error("ERR: addToSubsDB:", e);
  } finally {
    return;
  }
};

const getSubsBlur = async () => {
  const _setNewPage = async (data) => {
    const lastCollection = data.collections[data.collections.length - 1];
    const floorPrice =
      lastCollection.floorPrice?.amount && lastCollection.floorPrice.amount;

    const filters = {
      cursor: {
        contractAddress: lastCollection.contractAddress,
        floorPrice: floorPrice || null,
      },
      sort: "FLOOR_PRICE",
      order: "DESC",
    };

    const filtersURLencoded = encodeURIComponent(JSON.stringify(filters));
    db.api.blur.url.COLLECTIONS =
      "http://127.0.0.1:3000/v1/collections/" + "?filters=" + filtersURLencoded;
  };

  const _getSlugsBlur = async () => {
    try {
      let data = await apiCall({
        url: db.api.blur.url.COLLECTIONS,
        options: db.api.blur.options.GET,
      });

      if (!data || data?.collections?.length === 0) return;

      if (db.TEST_MODE) {
        data.collections = data.collections.slice(0, 3);
      }

      data?.collections?.forEach((nft) =>
        addToSubsDB(nft.collectionSlug, ethers.getAddress(nft.contractAddress))
      );

      if (db.TEST_MODE && db.NFT_COUNT++ > 2) return;

      await _setNewPage(data);
      await _getSlugsBlur();
    } catch (e) {
      console.error("ERR: getAllNftsBlur:", e);
      await _getSlugsBlur();
    }
  };

  // STARTS HERE
  await _getSlugsBlur();
};

const addEndInfoToSalesDB = async () => {
  //get sales count
  await db.SUBS.updateOne(
    { _id: "info" },
    {
      $set: {
        get_subs_end: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
};

(async function root() {
  try {
    await setup();
    await getSubsBlur(); //!separated cuz <1m
    amtOfSubs = await db.SUBS.countDocuments();
    console.log("\nFINISHED, amt of SUBS", amtOfSubs);

    await addEndInfoToSalesDB();
    process.exit(0);
  } catch (e) {
    console.error("\nERR: getSubsBlur root:", e);
    await root();
  }
})();
