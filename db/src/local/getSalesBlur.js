const fetch = require("node-fetch");
const ethers = require("ethers");

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);
const { ensureIndexes } = require("../../../utils/mongoIndexes");

const wallet = ethers.Wallet.createRandom();

const db = {
  CALL_TIMEOUT: 10000, //10s
  TIME_START: 0,
  TEST_MODE: false,
  SLUGS: [],
  TO_SAVE: {},

  SUBS: mongoClient.db("BOT_NFT").collection("SUBS"),
  SALES: mongoClient.db("BOT_NFT").collection("SALES"),

  AMT_PROCESSED_SLUGS: 0,
  AMT_BATCH_SIZE: 5,
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

const timeout = (ms) => {
  return new Promise((resolve, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
};

const logProgress = () => {
  const memory = process.memoryUsage().heapUsed / 1024 / 1024;
  const now = performance.now();
  process.stdout.write(
    `\r\x1b[38;5;12mAMT calls:\x1b[0m ${db.AMT_SEND} ` +
      `\x1b[38;5;12mAMT responses:\x1b[0m ${++db.AMT_RESPONSE} ` +
      `\x1b[38;5;12mAMT_PROCESSED_SLUGS:\x1b[0m ${db.AMT_PROCESSED_SLUGS} / ${db.SLUGS.length} ` +
      `\x1b[38;5;12mMEMORY:\x1b[0m ${Math.round(memory)} MB ` +
      `\x1b[38;5;12mTIME:\x1b[0m ${((now - db.TIME_START) / 1000).toFixed(2)}s`
  );
};

const apiCall = async ({ url, options }) => {
  let res;
  try {
    db.AMT_SEND++;
    await Promise.race([
      fetch(url, options)
        .then((response) => response.json())
        .then((json) => {
          res = JSON.parse(JSON.stringify(json));
        }),
      timeout(db.CALL_TIMEOUT),
    ]);
  } catch (error) {
    if (error.message === "timeout") {
      console.log("Request timed out, retrying...");
      return apiCall({ url, options });
    } else {
      console.error(error);
    }
  }

  logProgress();
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

  const subs = await db.SUBS.find({}).toArray();
  db.SLUGS = subs.map((sub) => sub.slug);
  console.log("amt slugs", db.SLUGS.length);
  db.TIME_START = performance.now();
};

const addToSalesDB = async (addr, blurSales) => {
  const __getFormattedSales = async (addr, blurSales) => {
    return blurSales
      .map((sale) => {
        // const marketplace = sale.price.marketplace;
        // if (marketplace !== "BLUR") return null;

        const addr_tkn = ethers.getAddress(addr);
        const id_tkn = sale.tokenId;
        const notify = true;
        const price = ethers.parseEther(sale.price.amount).toString();
        const traits = [];

        for (let key in sale.traits) {
          traits.push({ trait_type: key, trait_name: sale.traits[key] });
        }

        return {
          _id: addr_tkn + "-" + id_tkn,
          addr_tkn,
          id_tkn,
          notify,
          price,
          traits,
        };
      })
      .filter(Boolean);
  };

  //start
  try {
    const formattedSales = await __getFormattedSales(addr, blurSales);
    if (formattedSales.length === 0) return;

    const bulkOps = formattedSales.map((sale) => ({
      updateOne: {
        filter: { _id: sale._id },
        update: { $set: sale },
        upsert: true,
      },
    }));

    const result = await db.SALES.bulkWrite(bulkOps, { ordered: true });
    if (db.TEST_MODE) {
      console.log(`Inserted new ${result.insertedCount} BLUR SALES`);
    }
  } catch (err) {
    if (err.code !== 11000) {
      console.error("Error during bulkWrite:", err);
      console.log("\nformatted", JSON.stringify(formattedSales, null, 2));
    }
  } finally {
    return;
  }
};

const getSalesBlur = async () => {
  // (3/3)
  const _setURL = async (data, slug) => {
    // https://core-api.prod.blur.io/v1/collections/azuki/tokens?filters={"traits":[],"hasAsks":true}
    const baseFilter = { traits: [], hasAsks: true };
    const tkns = data?.tokens || [];

    // {"cursor":{"price":{"unit":"ETH","time":"2023-04-26T14:48:44.000Z","amount":"16.8"},"tokenId":"5599"},"traits":[],"hasAsks":true}
    const filters =
      tkns.length === 0
        ? baseFilter
        : {
            cursor: {
              price: tkns[tkns.length - 1]?.price,
              tokenId: tkns[tkns.length - 1]?.tokenId,
            },
            ...baseFilter,
          };

    const url = `http://127.0.0.1:3000/v1/collections/${slug}/tokens?filters=${encodeURIComponent(
      JSON.stringify(filters)
    )}`;
    return url;
  };

  // (2/3)
  const _getSalesBlur = async (slug) => {
    let data = {};
    let tkns = [];
    let countPages = 0; //for collections > 100
    let url;

    try {
      do {
        url = await _setURL(data, slug);
        data = await apiCall({ url, options: db.api.blur.options.GET });

        if (!data || !data.contractAddress || !data.tokens) {
          console.error("\n!data, re-exec...", JSON.stringify(data, null, 2));
          return await _getSalesBlur(slug);
        }

        tkns = tkns.concat(data?.tokens);
      } while ((countPages += data?.tokens?.length) < data?.totalCount);
      return [tkns, ethers.getAddress(data.contractAddress)];
    } catch (err) {
      console.error("\nERR re-exec...", err);
      return await _getSalesBlur(slug);
    }
  };

  // (0/3)
  console.log("\x1b[33m%s\x1b[0m", "\nSTARTED COLLECTING BLUR SALES");
  for (let i = 0; i < db.SLUGS.length; i += db.AMT_BATCH_SIZE) {
    const tmp_slugs = db.SLUGS.slice(i, i + db.AMT_BATCH_SIZE);

    const responses = await Promise.all(
      tmp_slugs.map(async (slug) => {
        return await _getSalesBlur(slug);
      })
    );

    for (const response of responses) {
      const [blurSales, addrTkn] = response;
      if (!blurSales) return;
      addToSalesDB(addrTkn, blurSales);
    }

    db.AMT_PROCESSED_SLUGS += tmp_slugs.length;
  }

  console.log("\x1b[33m%s\x1b[0m", "\nFINISHED COLLECTING BLUR SALES");
};

(async function root() {
  try {
    await setup();

    // const lastSuccessfulSlug = "rengoku-legends-samurai";
    // console.log("db.SLUGS before", db.SLUGS.length);
    // db.SLUGS = db.SLUGS.slice(db.SLUGS.indexOf(lastSuccessfulSlug));
    // console.log("db.SLUGS after", db.SLUGS.length);

    await getSalesBlur();
  } catch (e) {
    console.error("\nERR: getSalesBlur root:", e);
    // await root();
  }
})();
