const fetch = require("node-fetch");
const ethers = require("ethers");
const crypto = require("crypto");

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);
const { ensureIndexes } = require("../../utils/mongoIndexes");

const wallet = ethers.Wallet.createRandom();
// const wallet = new ethers.Wallet(process.env.PK_7);

const db = {
  /// TO SETUP ///
  TEST_NFT_ID: "1703",
  TEST_NFT_ADDR: "0x5B11Fe58a893F8Afea6e8b1640B2A4432827726c",
  TEST_MODE: process.env.TEST_MODE ? true : false, //true locally, false on VPS
  AMT_BATCH_CALL: 5, //in subSales to get sales with addr, id & traits
  DB_OPS_LIMIT: 10000, //prevent memory issues while syncing & upserting many elements to DB
  CALL_TIMEOUT: 10000, //after 10s, retry api call
  MIN_TO_WAIT_FOR_PRICE_UPDATER: 0,

  //info
  AMT_CALL_RETRY: 10,
  AMT_TOTAL_SALES: 0,
  AMT_SEND: 0,
  AMT_RESPONSE: 0,
  TIME_START: 0,
  DATE_TO_CATCH: 0,
  START_CATCHING_UP: 0,
  CATCHING_UP: true,

  SUBS: mongoClient.db("BOT_NFT").collection("SUBS"),
  SALES: mongoClient.db("BOT_NFT").collection("SALES"),

  ACTIVE_SUBS: new Map(), //~13k elements
  ACTIVE_SALES: new Map(), //~1M elements (~700 MB)
  PREV_SALES: new Set(), //stores last 1k sales to don't miss new sales in case if in 1x call amtNewSales>100

  //nft addrs that in os != blur (usually cuz nft is upgradable and os have 2x addrs, and blur 1x)
  BLUR_OS_ADDR_MISMATCH: new Set([
    //just to prevent errors, collected in blur orders last week

    //osAddr, slug, blurAddr
    "0x4D7d2e237D64d1484660b55c0A4cC092fa5e6716",
    "0x0a78c052BBBF4Ed294C273Cbe06255D7D94A7340",
    "0x2B4BB904Cfde74Ec423cC534Ef08579ee1c79148", //killabearsxl //exists...
    "0xFBeef911Dc5821886e1dda71586d90eD28174B7d", //known-origin  //0xabb3738f04dc2ec20f4ae4462c3d069d02ae045b
    "0x3248e8bA90FAcC4fdD3814518c14F8Cc4D980E4B", //3landers //0xb4d06d46a8285f4ec79fd294f78a881799d8ced9
    "0x46541c7c9904112E5e62847BeBb148051F71bAFA", //beepboopbotz //0xfe58fc763ba915013aee93c6f0890bfddbe03608
    "0xb0640E8B5F24beDC63c33d371923D68fDe020303", //supernormalbyzipcy //0xd532b88607B1877Fe20c181CBa2550E3BbD6B31C
    "0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270", //art-blocks
    "0xE428C901568aB6116F4E5Ffa11fdAFe008e51B6B", //async-blueprints //0xc143bbfcDBdBEd6d454803804752a064A622C1F3
    "0x495f947276749Ce646f68AC8c248420045cb7b5e", //os-shared-storefront-collection
    "0x458aed4f6f2Af40De88856e414Cf5b49514cbD78", //mintech //0x3acdb27a3c9673338b27a31ca17f2fb76b79ef92
    "0xFab34fD377F0CFE9703e2D84477076B64B42B845", //diamond-exhibition-day-one-pass //0x94d7ee989e4ac2b8dcd7066de6f94c9426e5a0ca
    "0x13135b229c95D7f0b61462e95332D34173841e38", //air-smoke-zero-limited //0x52d8a9825fb8b90ea45136eddb103b4ccc0c7940
    "0xf0e4f54F864D81D56a4C1B272c02D8B62458FA95", //thewalkingdead-degen //0x0769be0967108c711e758baa6e44fa33e26a5f23
    "0xB24BaB1732D34cAD0A7C7035C3539aEC553bF3a0", //miladystation //0xe03480e9196003d9b4106c56595a1429f7d00f87
    "0xD7bEA2b69C7a1015aAdAA134e564eEe6d34149C0", //the-association-nft //0x9b8b9c7c02be0bd0aa4d669bf6a1f6003424c6dc
  ]),

  BLUR_AUTH_TKN: "",
  api: {
    blur: {
      url: {
        AUTH_GET: "http://127.0.0.1:3000/auth/getToken",
        AUTH_SET: "http://127.0.0.1:3000/auth/setToken",
      },
      options: {
        AUTH: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet.address }),
        },
        GET: {}, //in setup()
        POST: {}, //in setup(), for testing
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
  if (!db.CATCHING_UP) {
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    process.stdout.write(
      `\r\x1b[38;5;12mAMT calls:\x1b[0m ${db.AMT_SEND} ` +
        `\x1b[38;5;12mAMT responses:\x1b[0m ${db.AMT_RESPONSE} ` +
        `\x1b[38;5;12mAMT_TOTAL_SALES:\x1b[0m ${db.AMT_TOTAL_SALES} ` +
        `\x1b[38;5;12mRAM:\x1b[0m ${Math.round(memory * 100) / 100} MB ` +
        `\x1b[38;5;12mTIME:\x1b[0m ${(
          (performance.now() - db.TIME_START) /
          1000
        ).toFixed(2)}s`
    );
  }
};

const apiCall = async ({ url, options }, amtRetry) => {
  if (amtRetry === undefined) amtRetry = db.AMT_RETRY;

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
    ++db.AMT_RESPONSE;
  } catch (err) {
    if (err.message === "timeout") {
      console.log(" Request timed out, retrying...");
      --db.AMT_SEND;
      return apiCall({ url, options }, amtRetry);
    } else {
      console.error(err);
    }
  }

  // sometimes in 1st calls returns "Unauthorized" even though it's not
  if (res?.message === "Unauthorized") {
    --db.AMT_SEND;
    return apiCall({ url, options }, amtRetry--);
  }

  logProgress();
  return res;
};

const setup = async () => {
  await ensureIndexes(mongoClient);

  ///////// SETUP BLUR AUTH TKN /////////
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

  ///////// SETUP BLUR API OPTIONS /////////
  db.api.blur.options.GET = {
    method: "GET",
    headers: {
      authToken: db.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
      "content-type": "application/json",
    },
  };

  db.api.blur.options.POST = {
    method: "POST",
    headers: {
      redirect: "follow",
      authToken: db.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
      "content-type": "application/json",
      body: {}, //pass buy data
    },
  };

  ///////// SETUP DB /////////
  await ensureIndexes(mongoClient);

  // '0x4df60a38D8c6b30bBaAA733Aa4DE1431bf9014f7' => 'slug_name'
  const info_subs = await db.SUBS.findOne({ _id: "info" });
  if (!db.TEST_MODE && !info_subs) {
    console.log(
      "\nERR, in !TEST_MODE, collect subs before sales via getSalesBlur."
    ); //to avoid spam
    process.exit(1);
  }

  const SUBS = await db.SUBS.find({}, { _id: 1 }).toArray();
  for (const sub of SUBS) {
    if (sub._id === "info") continue;
    if (!db.ACTIVE_SUBS.has(sub._id)) {
      db.ACTIVE_SUBS.set(sub._id, sub.slug);
    }
  }

  // '0x4df60a38D8c6b30bBaAA733Aa4DE1431bf9014f7-773' => '600000000000000000' (price)
  const SALES = await db.SALES.find({}, { _id: 1 }).toArray();
  for (const sale of SALES) {
    if (sale._id === "info") continue;
    if (!db.ACTIVE_SALES.has(sale._id)) {
      db.ACTIVE_SALES.set(sale._id, BigInt(sale.price));
    }
  }

  const info = await db.SALES.findOne({ _id: "info" });
  if (!db.TEST_MODE && !info) {
    console.log("\nERR, in !TEST_MODE, collect sales via getSalesBlur."); //to avoid spam
    process.exit(1);
  }

  if (!info?.sub_sales_last) {
    db.DATE_TO_CATCH = new Date(info_subs.get_subs_start);
  } else {
    db.DATE_TO_CATCH = new Date(info.sub_sales_last);
  }

  await db.SALES.updateOne(
    { _id: "info" },
    {
      $set: {
        sub_sales_start: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  minToCatch = Math.round((new Date() - db.DATE_TO_CATCH) / 1000 / 60);

  console.log(
    `Setup amount: ${db.ACTIVE_SUBS.size} subscriptions;
    ${db.ACTIVE_SALES.size} sales;
    Date to catch: ${db.DATE_TO_CATCH};
    ${minToCatch} minutes to catch.`
  );

  ///////// SETUP SALE TO CATCH (based on "db.MINUTES_TO_CATCH_UP") /////////
  // const date = new Date();
  // date.setMinutes(date.getMinutes() - db.MINUTES_TO_CATCH_UP);
  const toDecode = { beforeDate: db.DATE_TO_CATCH, id: "10000000000" };
  const decoded = Buffer.from(JSON.stringify(toDecode)).toString("base64");

  const sale_to_catch = (await getData(decoded)).activityItems[0];
  const id_to_catch = sale_to_catch.id;
  // db.DATE_TO_CATCH = new Date(sale_to_catch.createdAt);
  db.PREV_SALES = new Set([id_to_catch]);
  db.TIME_START = performance.now();
};

// used in subSalesBlur & updatePrices
const updateCheaperSales = async (cheaperSales) => {
  try {
    const bulkOps = cheaperSales.map((obj) => ({
      updateOne: {
        filter: { _id: obj[0] },
        update: { $set: { price: obj[1] } },
        upsert: true,
      },
    }));

    for (let i = 0; i < bulkOps.length; i += db.DB_OPS_LIMIT) {
      const result = await db.SALES.bulkWrite(
        bulkOps.slice(i, i + db.DB_OPS_LIMIT),
        { ordered: true }
      );
      if (db.TEST_MODE) {
        console.log(
          "\nUPDATE SALES bulkWrite result:",
          JSON.stringify(result, null, 2)
        );
        console.log("\nupdateCheaperSales result:", result.upsertedCount);
      }
    }
  } catch (err) {
    if (err.code !== 11000) console.error("ERR during bulkWrite:", err);
  } finally {
    return;
  }
};

// used in subSalesBlur & updatePrices
const getData = async (prevCursor) => {
  const baseFilter = {
    count: 100, //or 50 or 25
    eventFilter: {
      orderCreated: {}, //@todo sub also sold items to delete from db
      // sale: {},
    },
  };

  // v1/activity/global?filters={"count":100,"eventTypes":["ORDER_CREATED","SALE"],"contractAddresses":[],"cursor":"eyJhZnRlcklkIjoiMjIzNDEwMzU2In0="}
  const filters = prevCursor
    ? { cursor: prevCursor, ...baseFilter }
    : baseFilter;
  const url = `http://127.0.0.1:3000/v1/activity?filters=${encodeURIComponent(
    JSON.stringify(filters)
  )}`;

  const data = await apiCall({
    url: url,
    options: db.api.blur.options.GET,
  });

  return data;
};

// used in subSalesBlur
const upsertDB = async (newBlurSales) => {
  // (4.1/4.1)
  const _addToSalesDB = async (salesWithTraits) => {
    try {
      const bulkOps = salesWithTraits.map((sale) => ({
        updateOne: {
          filter: { _id: sale._id },
          update: { $set: sale },
          upsert: true,
        },
      }));

      bulkOps.push({
        updateOne: {
          filter: { _id: "info" },
          update: {
            $set: {
              sub_sales_last: new Date().toISOString(),
            },
          },
          upsert: true,
        },
      });

      for (let i = 0; i < bulkOps.length; i += db.DB_OPS_LIMIT) {
        const res = await db.SALES.bulkWrite(
          bulkOps.slice(i, i + db.DB_OPS_LIMIT),
          { ordered: true }
        );

        if (db.TEST_MODE) {
          // console.log(
          //   `\nADD to SALES ${i + db.DB_OPS_LIMIT} of ${bulkOps.length}, res: ${
          //     res.upsertedCount
          //   }`
          // );
        }
      }
    } catch (err) {
      if (err.code !== 11000) console.error("ERR during bulkWrite:", err);
    } finally {
      return;
    }
  };

  // (4.0/4.1)
  const _getSalesWithTraits = async (traitsToGet) => {
    const __getFormattedSales = async (salesWithTraits) => {
      return salesWithTraits
        .map((res) => {
          if (
            !res?.success ||
            !res?.token ||
            !res?.token?.tokenId ||
            !res?.token?.contractAddress
          ) {
            console.log(
              "\n _getSalesWithTraits Wrong sale tkn addr or id",
              JSON.stringify(res, null, 2)
            );
            return;
          }

          const sale = res.token;
          const addr_tkn = ethers.getAddress(sale.contractAddress);
          const id_tkn = sale.tokenId;
          const key = addr_tkn + "-" + id_tkn;
          const price =
            !sale.price || !sale.price.amount
              ? "0"
              : ethers.parseEther(sale.price.amount).toString();

          const notify = price === "0" ? false : true;

          let traits = [];
          if (sale.traits) {
            for (const [trait_key, trait_value] of Object.entries(
              sale.traits
            )) {
              if (
                trait_key === null ||
                trait_value === null ||
                trait_key === "" ||
                trait_value === "" ||
                trait_key === undefined ||
                trait_value === undefined
              ) {
                continue;
              }

              const hashKey = crypto.createHash("md5");
              hashKey.update(trait_key.toString());
              const trait_key_hash = hashKey.digest("hex");

              const hashValue = crypto.createHash("md5"); //need to redeclare after digest
              hashValue.update(trait_value.toString()); // Ensure the value is a string
              const trait_value_hash = hashValue.digest("hex");

              traits.push({
                trait_key: trait_key_hash,
                trait_value: trait_value_hash,
              });
            }
          }

          if (traits.length === 0) traits = null;
          db.ACTIVE_SALES.set(key, BigInt(price));

          return {
            _id: key,
            addr_tkn,
            id_tkn,
            notify,
            price,
            traits,
          };
        })
        .filter(Boolean);
    };

    const allSales = [];

    for (let i = 0; i < traitsToGet.length; i += db.AMT_BATCH_CALL) {
      const traitsBatch = traitsToGet.slice(i, i + db.AMT_BATCH_CALL);
      const promises = traitsBatch
        .map((addr_id) => {
          const [addr, id] = addr_id.split("-");
          if (db.BLUR_OS_ADDR_MISMATCH.has(addr)) return;
          return apiCall({
            url: `http://127.0.0.1:3000/v1/collections/${addr.toLowerCase()}/tokens/${id}`,
            options: db.api.blur.options.GET,
          });
        })
        .filter(Boolean);

      const results = await Promise.all(promises);
      const formattedSales = await __getFormattedSales(results);

      allSales.push(...formattedSales);

      if (db.TEST_MODE) {
        console.log(`\nTRAITS executed batch ${i} of ${traitsToGet.length}`);
        // console.log("promises length", promises.length);
        // console.log("result length", results.length);
        // console.log("formattedSales length", formattedSales.length);
        // console.log("allSales", allSales.length);
      }
    }

    return allSales;
  };

  // (3.1/4.1)
  const _addToSubsDB = async (collections) => {
    try {
      const bulkOps = collections.map((collection) => ({
        updateOne: {
          filter: { _id: ethers.getAddress(collection.contractAddress) },
          update: { $set: { slug: collection.collectionSlug } },
          upsert: true,
        },
      }));

      bulkOps.push({
        updateOne: {
          filter: { _id: "info" },
          update: {
            $set: {
              sub_subs_last: new Date().toISOString(),
            },
          },
          upsert: true,
        },
      });

      const result = await db.SUBS.bulkWrite(bulkOps);
      // if (db.TEST_MODE) {
      console.log("\nADD NEW SUBS, result:", result);
      // }
    } catch (e) {
      if (e.code !== 11000) console.error("ERR: addToSubsDB:", e);
    } finally {
      return;
    }
  };

  // (3.0/4.1)
  const _getNewSubs = async (subsToGet) => {
    const newSubs = [];

    //subs to get should be > 100 cuz already has in db
    const promises = subsToGet.map((addr) =>
      apiCall({
        url: `http://127.0.0.1:3000/v1/collections/${addr.toLowerCase()}`,
        options: db.api.blur.options.GET,
      })
    );

    const responses = await Promise.all(promises);

    for (const res of responses) {
      if (!res.success) {
        // console.log(`\nNEW SUB ADDR MISMATCH: ${JSON.stringify(res, null, 2)}`);
        const mismatched_addr = ethers.getAddress(
          res.message.match(/0x[a-fA-F0-9]{40}/)[0]
        );
        if (db.BLUR_OS_ADDR_MISMATCH.has(mismatched_addr)) continue;
        console.log("\nAdd to db.BLUR_OS_ADDR_MISMATCH addr:", mismatched_addr);
        db.BLUR_OS_ADDR_MISMATCH.add(mismatched_addr);
        continue;
      }

      newSubs.push(res.collection);
      db.ACTIVE_SUBS.set(
        ethers.getAddress(res.collection.contractAddress),
        res.collection.collectionSlug
      );
    }

    if (db.TEST_MODE) {
      // console.log("\nSUBS promises length", promises.length);
      // console.log("responses length", responses.length);
      // console.log("newSubs amt", newSubs.length);
    }

    return newSubs;
  };

  // (1.0/4.1)
  const _getDataToUpsert = async (newBlurSales) => {
    const subsToGet = new Set();
    const traitsToGet = new Set();
    const cheaperSales = new Map();

    for (const sale of newBlurSales) {
      const addr = ethers.getAddress(sale.contractAddress);
      const id = sale.tokenId;
      const key = `${addr}-${id}`;

      if (db.BLUR_OS_ADDR_MISMATCH.has(addr)) {
        //todo add support for it (perhaps by adding to new collection & creating separate scripts)
        continue;
      }

      switch (true) {
        case !db.ACTIVE_SUBS.has(addr) && !subsToGet.has(addr):
          subsToGet.add(addr); //↓↓↓

        // add only new addr:id
        case !db.ACTIVE_SALES.has(key) && !traitsToGet.has(key):
          traitsToGet.add(key);
          break;

        // add only if curr add:id sale is cheaper
        case db.ACTIVE_SALES.has(key):
          const oldPrice = db.ACTIVE_SALES.get(key) ?? 0n;
          const newPrice = ethers.parseEther(sale?.price?.amount) ?? 0n;

          if (newPrice < oldPrice || oldPrice === 0n) {
            cheaperSales.set(key, newPrice.toString());
            db.ACTIVE_SALES.set(key, newPrice);
          }
          break;
      }
    }

    if (db.TEST_MODE) {
      console.log("\nsubsToGet", subsToGet.size);
      console.log("traitsToGet", traitsToGet.size);
      console.log("cheaperSales", cheaperSales.size);
    }

    return [
      Array.from(subsToGet),
      Array.from(traitsToGet),
      Array.from(cheaperSales),
    ];
  };

  // (0.0/4.1)
  try {
    const [subsToGet, traitsToGet, cheaperSales] = await _getDataToUpsert(
      newBlurSales
    );

    if (db.TEST_MODE) console.log("\nSetting cheaper sales...");
    if (cheaperSales.length > 0) await updateCheaperSales(cheaperSales);

    if (db.TEST_MODE) console.log("\nGetting new subs...");
    const newSubs = await _getNewSubs(subsToGet);
    if (newSubs.length > 0) await _addToSubsDB(newSubs);

    if (db.TEST_MODE) console.log("\nGetting new traits...");
    const saleIdsWithTraits = await _getSalesWithTraits(traitsToGet);
    if (saleIdsWithTraits.length > 0) await _addToSalesDB(saleIdsWithTraits);
  } catch (err) {
    console.error("\nERR during upsertDB:", err);
  } finally {
    return;
  }
};

const subSalesBlur = async () => {
  console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE BLUR SALES\x1b[0m`);

  // (3/3)
  const _waitBasedOn = async (newOrdersLength) => {
    const toWait = Math.max(0, -10 * newOrdersLength + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
    return new Promise((resolve) => setTimeout(resolve, toWait));
  };

  // (2/3)
  const _getNewBlurSales = async (sales) => {
    return sales.filter((order) => !db.PREV_SALES.has(order.id)); //can't filter Blur only, cuz !detect amt of missed orders
  };

  // (1/3)
  const _logCatchingUpInfo = async (currDate, data) => {
    const memoryUsage = process.memoryUsage();

    //add date to catch
    process.stdout.write(
      `\r\x1b[38;5;12m TO CATCH LEFT:\x1b[0m ${
        ((db.DATE_TO_CATCH - currDate).toFixed(2) / 1000 / 60).toFixed(2) * -1
      } min ` +
        `\x1b[38;5;12m MEMORY:\x1b[0m ${(memoryUsage.rss / 1024 / 1024).toFixed(
          2
        )} MB ` +
        `\x1b[38;5;12m TIME:\x1b[0m ${(
          (performance.now() - db.TIME_START) /
          1000
        ).toFixed(2)} s`
    );
  };

  // (0/3)
  try {
    while (true) {
      let data = await getData(); // (1/4)
      if (!data || !data.activityItems) {
        await _waitBasedOn(0);
        continue;
      }

      let newBlurSales = await _getNewBlurSales(data.activityItems);
      if (newBlurSales.length === 0) {
        await _waitBasedOn(0);
        continue;
      }

      while (newBlurSales.length % 100 == 0) {
        data = await getData(data.cursor);
        if (!data || !data.activityItems) {
          if (db.TEST_MODE) {
            console.log(
              "\n !data || !data.activityItems inside 2nd subSale while loop" +
                JSON.stringify(data, null, 2)
            );
          }
          break;
        }

        const missedNewSales = await _getNewBlurSales(data.activityItems);
        newBlurSales = [...newBlurSales, ...missedNewSales];

        if (db.CATCHING_UP) {
          const currDate = new Date(data.activityItems[0].createdAt);
          _logCatchingUpInfo(currDate, data);
          if (currDate - 300000 < db.DATE_TO_CATCH) {
            console.log(`\n\n\x1b[38;5;202mFINISHING CATCHING-UP...\x1b[0m\n`);
            break;
          }
        }
      }

      db.AMT_TOTAL_SALES += newBlurSales.length;
      db.PREV_SALES = new Set(
        [
          ...db.PREV_SALES,
          ...newBlurSales.slice(0, 1000).map((order) => order.id),
        ].slice(-1000)
      );

      await upsertDB(newBlurSales);

      if (db.CATCHING_UP) {
        db.CATCHING_UP = false;
        updatePrices();
      }
      await _waitBasedOn(newBlurSales.length);
    }
  } catch (e) {
    console.error("ERR: subSalesBlur", e);
    await subSalesBlur();
  }
};

const updatePrices = async () => {
  // console.log("updatePrices, prevent adding sales with key & price only");
  // process.exit(0);
  const _getCheaperSales = async (addr, newPrices) => {
    const cheaperSales = [];

    for (const { tokenId, price } of newPrices) {
      const key = `${addr}-${tokenId}`;
      if (!db.ACTIVE_SALES.has(key)) {
        //shouldn't happen if synced properly
        console.log(
          `\nWARN, updatePrices found sale before getSaleWithTraits, key: ${key}` +
            `\nif this will occur often & getSaleWithTraits will not catch these SALES,` +
            `\nthen upsert updated prices with addr & id to support basic & collection bids in bot.js getArbSales();`
        );
        continue;
      }

      const oldPrice = db.ACTIVE_SALES.get(key);
      const newPrice = ethers.parseEther(price.amount) ?? 0n;

      if (newPrice < oldPrice || oldPrice === 0n) {
        cheaperSales.push([key, newPrice.toString()]);
        // db.ACTIVE_SALES.set(key, newPrice);
      }
    }

    return cheaperSales;
  };

  const _setUrl = async (data, slug) => {
    const hasAsksFilter = { hasAsks: true };
    const nftPrices = data?.nftPrices || [];

    const filters =
      nftPrices.length === 0
        ? hasAsksFilter
        : {
            cursor: {
              tokenId: nftPrices[nftPrices.length - 1].tokenId,
              price: { ...nftPrices[nftPrices.length - 1].price },
            },
            ...hasAsksFilter,
          };

    const url = `http://127.0.0.1:3000/v1/collections/${slug}/prices?filters=${encodeURIComponent(
      JSON.stringify(filters)
    )}`;

    return url;
  };

  //→→→ STARTS HERE ←←←
  await new Promise((resolve) =>
    setTimeout(resolve, db.MIN_TO_WAIT_FOR_PRICE_UPDATER * 60 * 1000)
  );

  let amtLoop = 0;
  const startLoop = performance.now();

  while (true) {
    if (db.TEST_MODE) {
      console.log(
        "\x1b[33m%s\x1b[0m",
        "\nStarted updatePrices loop nr:",
        ++amtLoop
      );
    }

    for (const [addr, slug] of db.ACTIVE_SUBS) {
      var newPrices = [];
      var data = {};

      try {
        do {
          const url = await _setUrl(data, slug);
          data = await apiCall({ url, options: db.api.blur.options.GET });
          await new Promise((resolve) => setTimeout(resolve, 500)); //for 13k sales, loop takes ~1.5h
          if (!data || !data.nftPrices) break;

          newPrices = [...newPrices, ...data?.nftPrices];
        } while (newPrices.length < data.totalCount);

        if (!data) continue;

        const cheaperSales = await _getCheaperSales(addr, newPrices);
        if (cheaperSales.length > 0) updateCheaperSales(cheaperSales);
      } catch (e) {
        console.error("\nERR: updatePrices", e);
        console.log("slug", slug);
        console.log("addr", addr);
        console.log("data", JSON.stringify(data, null, 2));
        continue;
      }
    }

    if (db.TEST_MODE) {
      console.log(
        "\x1b[33m%s\x1b[0m",
        "\nFinished updatePrices loop nr: ",
        amtLoop,
        " in",
        (performance.now() - startLoop) / 1000,
        "s"
      );
    }
  }
};

(async function root() {
  try {
    await setup();
    subSalesBlur();
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
