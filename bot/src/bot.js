const fetch = require("node-fetch");
const ethers = require("ethers");
const abi = require("./data/abi.json");

const provider = new ethers.AlchemyProvider(
  "homestead",
  process.env.API_ALCHEMY
);
const wallet = new ethers.Wallet(process.env.PK_0, provider);

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);

/**
 * @todo
 * [x] processQueue (instructions in function)
 * 		[x] arbBids & arbSales returns only 1x best element.
 * 			 [x] prevent api post limit (0.5ms delay for each exec)
 * 			 [x] prevent duplicates (remain in done in 10min or so)
 * 			 [x] segregate queue by highest profit
 * 			 [x] filter out expired bids
 * [x] TEST:
 * 		 [x] subSalesGetBids
 * 		 	  [x] sale via subSalesBlur (exec test via blur app, matching bid must already exist in BIDS, use TEST_NFT)
 * 		 [x] subBidsGetSales
 * 		 	  [x] bid via subBidsOs (exec test via os app, matching sale must already exist in SALES)
 * 		 	  [x] bid via getBidsOs (after subSaleBlur add new element to SUBS, getBidsOs finds the bid and return it in subBidsGetSales stream)
 * [ ] update db BIDS on vps to basic
 * [ ] import abis to bot vps
 * [x] Analytics
 * 		[x] add date to exec arb
 * 		[x] update logs buyFromBlurData ListingNotFound
 *    [x] update logs getOsData
 *    [x] add healthy check
 *    [x] err skip 2high
 *		[x] log in stringified format
 *		[x] ignore logs up to profit
 * [ ] ensure validate system is correct sellOSParams from sub & get, fro each order type, perhaps b4 add to db make universal
 * [ ] bribe system
 * 		[ ] get block time, arbTxs time, math it on that
 *		[ ] for next block include smaller bribe, for next higher
 * [ ] implement for collection & trait
 *    [ ] updated osFees based on elapsed time
 *    [ ] !validate id in _validateArb
 *
 * @l0ngt3rm
 * [ ] multi tx block, nonce update (send all bundle with nonce +10 permutations for each pack of txs)
 * [ ] support add to queue validate arb, so that i fees go lower, re-exec
 * [ ] todo function to log compressed data in validate
 * [ ] validate conduict
 */

const db = {
  TEST_MODE: true,

  QUEUE: [],
  SALES: mongoClient.db("BOT_NFT").collection("SALES"),
  BIDS: mongoClient.db("BOT_NFT").collection("BIDS"),

  var: {
    TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
    TEST_NFT_ID: "877",

    STARTED: false,
    BLUR_AUTH_TKN: "",

    BLOCK_NUM: 0,
    INTERVAL_DB_DATA: 100,
    BUNDLE_MAX_BLOCK: 5,
    PREV_WALLET_BALANCE: 0n, //wallet balance (to buy blur)
    CURR_WALLET_BALANCE: 0n, //wallet balance (to buy blur)

    //fees
    FEE: {},
    BRIBE_BPS: 1000n, //1bps = 0.01%
    EST_GAS_SWAP: 10n ** 6n / 2n, //edit later
    EST_GAS_APPROVE_NFT: 10n ** 5n,
    EST_GAS_WITHDRAW_WETH: 50000n,
    EST_GAS_COINBASE: 50000n,
    EST_GAS_FOR_ARB: 1n * 10n ** 6n + 10n ** 5n + 10n ** 4n, //2x swaps + approveNFT + withdrawETH
    MIN_PROFIT: 0n,

    CONDUCIT_CODE_HASH:
      "0x023d904f2503c37127200ca07b976c3a53cc562623f67023115bf311f5805059",
  },
  addr: {
    COINBASE: "0xEcAfdDDcc85BCFa4a4aB8F72a543391c7474F35E",
    CONDUCIT_CONTROLER: "0x00000000F9490004C11Cef243f5400493c00Ad63",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    SEAPORT: [
      "0x00000000006c3852cbEf3e08E8dF289169EdE581", //1.1
      "0x00000000000006c7676171937C444f6BDe3D6282", //1.2
      "0x0000000000000aD24e80fd803C6ac37206a45f15", //1.3
      "0x00000000000001ad428e4906aE43D8F9852d0dD6", //1.4
      "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", //1.5
    ],
  },
  api: {
    os: {
      bidData: {
        url: "https://api.opensea.io/v2/offers/fulfillment_data",
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": process.env.API_OS_0,
          },
          body: {},
        },
      },
    },
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
        POST: {}, //in setup()
      },
    },
    builders: [
      // @todo test/add more
      "https://relay.flashbots.net", //ok
      "https://api.edennetwork.io/v1/bundle", //ok
      "https://rpc.beaverbuild.org/", //ok, can only sendBundle
      "https://builder0x69.io", //ok
      "https://rsync-builder.xyz", //ok
      "https://api.blocknative.com/v1/auction", //ok
      // "https://eth-builder.com", //ok
      // "https://rpc.payload.de", //ok (forwards to fbots, usound, agnostic, ...)
      // "https://rpc.lightspeedbuilder.info/", //ok
      // "https://api.securerpc.com/v1", //ok (manifoldfinance)
      // "https://rpc.nfactorial.xyz/private", //ok
      // "https://BuildAI.net", //ok only sendBundle
      //	https://etherscan.io/address/0x473780deaf4a2ac070bbba936b0cdefe7f267dfc  ------- not
      //	https://etherscan.io/address/0xbaf6dc2e647aeb6f510f9e318856a1bcd66c5e19  	------- not
      //	Manta-builder
      //	https://etherscan.io/address/0xbd3afb0bb76683ecb4225f9dbc91f998713c3b01
      // "https://mev.api.blxrbdn.com", //!!! paid
      // "https://relay.ultrasound.money", //!!! not ok
      // "https://agnostic-relay.net/", ///!!! not ok
    ],
  },
  interface: {
    SEAPORT: new ethers.Interface(abi.SEAPORT),
    NFT: new ethers.Interface(abi.NFT),
    WETH: new ethers.Interface(abi.WETH),
  },
};

//6: buy low from blur sale, sell high to os bid
const execArb = async (buyFrom, sellTo) => {
  //(6/6)
  const _sendBundle = async (bundle) => {
    const __callBundle = async (bundle) => {
      const blockToSend = db.var.BLOCK_NUM + 1;
      const blockNumHash = "0x" + blockToSend.toString(16);

      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_callBundle",
        params: [
          {
            txs: bundle,
            blockNumber: blockNumHash,
            stateBlockNumber: "latest",
          },
        ],
      });

      const signature = `${wallet.address}:${await wallet.signMessage(
        ethers.id(body)
      )}`;

      const data = await apiCall({
        url: "https://relay.flashbots.net",
        options: {
          method: "POST",
          body: body,
          headers: {
            "Content-Type": "application/json",
            "X-Flashbots-Signature": signature,
          },
        },
      });

      console.log("\n>>>Bundle call result:", JSON.stringify(data, null, 2));
    };

    const __sendBundleRequest = async (url, blockNum) => {
      const blockNumHash = "0x" + blockNum.toString(16);

      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendBundle",
        params: [
          {
            txs: bundle,
            blockNumber: blockNumHash,
          },
        ],
      });

      const signature = `${wallet.address}:${await wallet.signMessage(
        ethers.id(body)
      )}`;

      apiCall({
        url,
        options: {
          method: "POST",
          body: body,
          headers: {
            "Content-Type": "application/json",
            "X-Flashbots-Signature": signature,
          },
        },
      });
    };

    if (db.TEST_MODE) {
      await __callBundle(bundle);
      return;
    }

    for (const url of db.api.builders) {
      const blocksToSend = Array.from(
        { length: db.var.BUNDLE_MAX_BLOCK },
        (_, i) => db.var.BLOCK_NUM + i + 1
      );
      blocksToSend.forEach((blockNum) => __sendBundleRequest(url, blockNum));
    }

    __callBundle(bundle);
  };

  const _getBundle = async (buyBlurData, sellOsData, profitGross) => {
    const __getConduitAddr = (_conduitKey) =>
      ethers.getAddress(
        ethers.dataSlice(
          ethers.solidityPackedKeccak256(
            ["bytes1", "address", "bytes32", "bytes32"],
            [
              "0xff",
              db.addr.CONDUCIT_CONTROLER,
              _conduitKey,
              db.var.CONDUCIT_CODE_HASH,
            ]
          ),
          12
        )
      );

    const __signTx = async (tx) =>
      await wallet.signTransaction({
        ...tx,
        type: 2,
        chainId: 1,
        maxFeePerGas: db.var.FEE.maxFeePerGas,
        maxPriorityFeePerGas: db.var.FEE.maxPriorityFeePerGas,
      });

    console.log("\nPreparing unsigned TXs...");

    const nonce = await provider.getTransactionCount(wallet.address);
    const sellParams = sellOsData?.transaction?.input_data?.parameters;
    const conduitAddr = __getConduitAddr(sellParams.offererConduitKey);

    let withdrawAmount =
      BigInt(buyBlurData?.buys[0]?.txnData?.value?.hex) + profitGross;
    let coinbaseValue = (profitGross * db.var.BRIBE_BPS) / 10000n;

    if (db.TEST_MODE) {
      withdrawAmount = BigInt(buyBlurData?.buys[0]?.txnData?.value?.hex);
      coinbaseValue = 7n;
    }

    const estProfitNet = profitGross - coinbaseValue;

    if (!db.TEST_MODE && estProfitNet <= 0n) {
      console.log("\n>>>EstProfitNet is too low, skipping...", estProfitNet);
      return false;
    }

    const unsigned_txs = [
      {
        to: buyBlurData?.buys[0]?.txnData?.to,
        data: buyBlurData?.buys[0]?.txnData?.data,
        value: BigInt(buyBlurData?.buys[0]?.txnData?.value?.hex),
        gasLimit: db.var.EST_GAS_SWAP,
        nonce: nonce,
      },
      {
        to: sellParams.considerationToken,
        data: db.interface.NFT.encodeFunctionData("setApprovalForAll", [
          conduitAddr,
          true,
        ]),
        value: 0,
        gasLimit: db.var.EST_GAS_APPROVE_NFT,
        nonce: nonce + 1,
      },
      {
        to: sellOsData?.transaction?.to,
        data: db.interface.SEAPORT.encodeFunctionData(
          sellOsData?.transaction?.function,
          [sellParams]
        ),
        value: 0,
        gasLimit: db.var.EST_GAS_SWAP,
        nonce: nonce + 2,
      },
      {
        to: db.addr.WETH,
        data: db.interface.WETH.encodeFunctionData("withdraw", [
          withdrawAmount,
        ]),
        value: 0,
        gasLimit: db.var.EST_GAS_WITHDRAW_WETH,
        nonce: nonce + 3,
      },
      {
        to: db.addr.COINBASE,
        data: "0x",
        value: coinbaseValue,
        gasLimit: db.var.EST_GAS_COINBASE,
        nonce: nonce + 4,
      },
    ];

    console.log("\nSigning TXs...");
    const signedTxs = await Promise.all(unsigned_txs.map(__signTx));

    const nftAddr = buyBlurData?.buys[0]?.includedTokens[0]?.contractAddress;
    const nftId = buyBlurData?.buys[0]?.includedTokens[0]?.tokenId;

    console.log(
      `\n\n\x1b[32mAttempting to execute arb with estProfitNet: ${ethers.formatEther(
        estProfitNet
      )} ETH for: https://etherscan.io/nft/${nftAddr}/${nftId}\x1b[0m`
    );

    return signedTxs; //aka bundle
  };

  //(4/6)
  const _validateArb = async (buyFrom, sellTo, buyBlurData, sellOsData) => {
    const buyPrice = BigInt(buyBlurData.buys[0].txnData.value.hex);
    let sellPrice = BigInt(
      sellOsData.transaction.input_data.parameters.offerAmount
    );

    sellPrice = sellOsData?.orders[0]?.parameters?.consideration.reduce(
      (total, fee) => total - BigInt(fee.endAmount),
      sellPrice
    );

    const estProfitGross = sellPrice - buyPrice - db.var.MIN_PROFIT;
    const buyFromAddr = ethers.getAddress(buyFrom.addr_tkn);
    const sellOsAddr = ethers.getAddress(
      sellOsData?.transaction?.input_data.parameters.considerationToken
    );
    const buyBlurAddr = ethers.getAddress(
      buyBlurData?.buys[0]?.includedTokens[0]?.contractAddress
    );
    const buyFromId = buyFrom.id_tkn;
    const sellOsId =
      sellOsData?.transaction?.input_data?.parameters?.considerationIdentifier;
    const buyBlurId = buyBlurData?.buys[0]?.includedTokens[0]?.tokenId;
    const target = ethers.getAddress(sellOsData?.transaction?.to);

    // Validate profit
    if (!db.TEST_MODE && estProfitGross <= 0n) {
      return false;
    }

    console.log(
      JSON.stringify(
        {
          info: "POTENTIAL ARB",
          date: new Date().toLocaleString(),
          block: db.var.BLOCK_NUM,
          estProfitGross: ethers.formatEther(estProfitGross),
          buyFrom,
          sellTo,
          buyBlurData,
          sellOsData,
        },
        null,
        2
      )
    );

    // Validate NFT addr
    if (buyFromAddr !== sellOsAddr || sellOsAddr !== buyBlurAddr) {
      console.error("NFT ADDR not same");
      return false;
    }

    // Validate NFT id
    if (buyFromId !== sellOsId || sellOsId !== buyBlurId) {
      console.error("NFT ID not same");
      return false;
    }

    // Check os addr to
    if (!db.addr.SEAPORT.includes(target)) {
      console.error("UNKNOWN SEAPORT ADDR");
      return false;
    }

    return estProfitGross;
  };

  //(3/6)
  const _getSellOsData = async (sellTo) => {
    // console.log("\nGetting sell data from OS...");
    db.api.os.bidData.options.body = JSON.stringify({
      offer: {
        hash: sellTo._id,
        chain: "ethereum", //sellTo.payload.item?.chain?.name,
        //sellTo.payload?.protocol_address
        protocol_address:
          sellTo.type === "OS_BID_GET"
            ? sellTo.bid.protocol_address
            : sellTo.bid.payload.protocol_address,
      },
      fulfiller: {
        address: wallet.address,
      },
      consideration: {
        asset_contract_address: sellTo.addr_tkn,
        token_id: sellTo.id_tkn,
      },
    });

    // console.time("sellOsData");
    const data = await apiCall(db.api.os.bidData);
    // console.timeEnd("sellOsData");
    // console.log("\nos data", data);

    if (data?.fulfillment_data) {
      return data.fulfillment_data;
    }

    if (
      data?.errors &&
      data?.errors[0]?.message === "Error when generating fulfillment data"
    ) {
      console.log(
        "\nUnknown error while getting sell data from OS",
        JSON.stringify(data, null, 2)
      );
    }

    return false;
  };

  //(2/6)
  const _getBuyBlurData = async (buyFrom) => {
    const url = `http://127.0.0.1:3000/v1/buy/${buyFrom.addr_tkn.toLowerCase()}?fulldata=true`;

    db.api.blur.options.POST.body = JSON.stringify({
      tokenPrices: [
        {
          isSuspicious: false, //tknIdBlurData.token.isSuspicious,
          price: {
            amount: buyFrom.sale.price.amount, //tknIdBlurData.token.price.amount,
            unit: "ETH", //sale.sale.price.unit
          },
          tokenId: buyFrom.id_tkn, //tknIdBlurData.token.tokenId,
        },
      ],
      userAddress: wallet.address,
    });

    // console.log("\nGetting buy data from Blur...");
    // console.time("buyFromBlurData");
    const buyFromBlurData = await apiCall({
      url,
      options: db.api.blur.options.POST,
    });
    // console.timeEnd("buyFromBlurData");
    // console.log("\nbuyFromBlurData", buyFromBlurData);

    //ignore if listing not found, log new, unknown, others
    switch (true) {
      case buyFromBlurData?.buys?.length > 0:
        return buyFromBlurData;

      case buyFromBlurData?.cancelReasons?.length > 0 &&
        buyFromBlurData?.cancelReasons?.[0]?.reason === "ListingNotFound":
        return false;
      //todo, should delete from db

      default:
        console.log("\nUNKNOWN buyFromBlurData", buyFromBlurData);
        return false;
    }
  };

  //(1/6)
  const _preValidate = async (buyFrom, sellTo) => {
    if (BigInt(buyFrom.price) > db.var.CURR_WALLET_BALANCE) {
      console.log("\nSALE PRICE TOO HIGH, SKIPPING...");
      console.log("sale.price", sellTo.price);
      console.log("db.var.CURR_WALLET_BALANCE", db.var.CURR_WALLET_BALANCE);
      console.log(
        `https://etherscan.io/nft/${buyFrom.addr_tkn}/${buyFrom.id_tkn}`
      );
      return false; //can't afford to buy
    }
    return true;
  };

  //(0/6)
  try {
    //(1/6)
    if (!(await _preValidate(buyFrom, sellTo))) return;

    //(2/6)
    const buyBlurData = (await _getBuyBlurData(buyFrom)) ?? {};
    if (!buyBlurData) return;

    //(3/6)
    const sellOsData = (await _getSellOsData(sellTo)) ?? {};
    if (!sellOsData) return;

    //(4/6)
    const estProfitGross = await _validateArb(
      buyFrom,
      sellTo,
      buyBlurData,
      sellOsData
    );
    if (!estProfitGross) return;

    //(5/6)
    const bundle =
      (await _getBundle(buyBlurData, sellOsData, estProfitGross)) ?? {};
    if (!bundle) return;

    //(6/6)
    await _sendBundle(bundle);
  } catch (e) {
    console.error("\nERR, execArb", e);
  } finally {
    return;
  }
};

//5
const processQueue = async (orders) => {
  try {
    execArb(orders.sale, orders.bid);
    await new Promise((resolve) => setTimeout(resolve, 500)); //prevent POST limit

    const currQueueElem = db.QUEUE[0]; //store to prevent potential re-execution
    db.QUEUE.shift(); //delete current

    if (db.QUEUE.length > 1) {
      // remove potential duplicates
      db.QUEUE = Array.from(
        new Set(db.QUEUE.map((item) => JSON.stringify(item)))
      ).map((item) => JSON.parse(item));

      // prevent potential re-execution
      if (currQueueElem in db.QUEUE) {
        db.QUEUE = db.QUEUE.filter(
          (item) => JSON.stringify(item) !== JSON.stringify(currElem)
        );
      }

      if (db.QUEUE.length === 0) return;

      // sort by highest profit
      if (db.QUEUE.length > 1) {
        db.QUEUE.sort((a, b) => {
          const profitA = BigInt(a.bid.price) - BigInt(a.sale.price);
          const profitB = BigInt(b.bid.price) - BigInt(b.sale.price);
          return profitA < profitB ? 1 : -1;
        });
      }
    }

    if (db.QUEUE.length > 0) {
      processQueue(db.QUEUE[0]);
    }
  } catch (e) {
    console.error("\nERR, processQueue", e);
  } finally {
    return;
  }
};

//4
const subBidsGetSales = async () => {
  const _getArbSaleBasic = async (bid) => {
    const salesToFind = {};

    salesToFind["addr_tkn"] = bid.addr_tkn;

    // if (bid.type === "OS_BID_SUB_BASIC" || bid.type === "OS_BID_GET_BASIC") {
    salesToFind["id_tkn"] = bid.id_tkn;
    // }

    // @todo if ...TRAIT, then get all sales with specific trait

    // Get all matching sales
    const matchingSalesCursor = db.SALES.find(salesToFind);
    const matchingSales = await matchingSalesCursor.toArray();
    if (matchingSales.length === 0) return;

    if (db.TEST_MODE && bid.addr_tkn === db.var.TEST_NFT) {
      console.log("\nDETECTED TEST bid");
    }

    // Get sale with lowest price
    let lowestSale = matchingSales[0];
    let lowestPrice = BigInt(matchingSales[0].price);

    for (let i = 1; i < matchingSales.length; i++) {
      const currentPrice = BigInt(matchingSales[i].price);

      if (currentPrice < lowestPrice) {
        lowestPrice = currentPrice;
        lowestSale = matchingSales[i];
      }
    }

    if (lowestPrice > BigInt(bid.price)) {
      return null;
    }

    return lowestSale;
  };

  const _getArbSaleCollection = async (bid) => {
    //@todo will to get multiple sales that salePrice < bidPrice
  };

  const _getArbSaleTrait = async (bid) => {
    //@todo will to get multiple sales that salePrice < bidPrice
  };

  try {
    db.streamBIDS.on("change", async (raw_bid) => {
      if (
        !raw_bid ||
        raw_bid.operationType !== "insert" ||
        !raw_bid.fullDocument
      )
        return;

      const bid = raw_bid.fullDocument;

      let sales = null;

      switch (true) {
        case bid.type === "OS_BID_SUB_BASIC" || bid.type === "OS_BID_GET_BASIC":
          sales = await _getArbSaleBasic(bid); //1x only
          break;
        case bid.type === "OS_BID_SUB_COLLECTION" ||
          bid.type === "OS_BID_GET_COLLECTION":
          sales = await _getArbSaleCollection(bid); //multi
          break;
        case bid.type === "OS_BID_SUB_TRAIT" || bid.type === "OS_BID_GET_TRAIT":
          sales = await _getArbSaleTrait(bid); //multi
          break;
        default:
          console.log("\nbRR: bid.type not found", bid);
          return;
      }

      if (!sales || sales.length === 0) return;

      for (let i = 0; i < sales.length; i++) {
        const sale = sales[i];
        db.QUEUE.push({ sale, bid });

        if (db.QUEUE.length === 1) {
          processQueue(db.QUEUE[0]);
        }
      }
    });
  } catch (err) {
    console.error("ERR: subSalesGetBids", err);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await subBidsGetSales();
  }
};

//3
const subSalesGetBids = async () => {
  const _getArbBids = async (sale) => {
    // get all matching bids
    const matchingBidsCursor = db.BIDS.find({
      addr_tkn: sale.addr_tkn,
      id_tkn: sale.id_tkn,
    }); //can't price cuz string=>BigInt

    // console.log('\nGOT matchingBidsCursor', matchingBidsCursor)
    if (sale.addr_tkn == db.var.TEST_NFT && sale.id_tkn == db.var.TEST_NFT_ID) {
      console.log("\nDETECTED TEST arb sale:", sale);
    }

    // filter bids that are lower than sale price
    let arbBids = (await matchingBidsCursor.toArray()).filter((bid) => {
      const bidPrice = BigInt(bid.price);
      const salePrice = BigInt(sale.price);

      return bidPrice > salePrice;
    });

    if (db.TEST_MODE) {
      console.log("\n\narbBids length after price filter", arbBids.length);
    }

    //filter expires
    arbBids = arbBids.filter((bid) => {
      return bid.exp_time > Math.floor(Date.now() / 1000);
    });

    if (db.TEST_MODE) {
      console.log("arbBids length after expires filter", arbBids.length);
    }

    // delete bids that have the same owner and price as another bid
    arbBids.forEach((bid, i) => {
      arbBids.forEach((bid2, i2) => {
        if (
          bid.addr_buyer === bid2.addr_buyer &&
          bid.price === bid2.price &&
          i !== i2
        ) {
          arbBids.splice(i, 1);
        }
      });
    });

    if (db.TEST_MODE) {
      console.log("arbBids length after owner filter", arbBids);
    }

    // sort bids by highest (to sell) price
    arbBids.sort((a, b) => {
      //need that, cuz string=>BigInt
      const aPrice = BigInt(a.price);
      const bPrice = BigInt(b.price);
      if (aPrice < bPrice) return 1;
      if (aPrice > bPrice) return -1;
      return 0;
    });

    if (db.TEST_MODE) {
      console.log("arbBids after price sort", arbBids);
    }

    //prevent potential spam by returning top 5 arb bids
    return arbBids.slice(0, 5);
  };

  try {
    db.streamSALES.on("change", async (raw_sale) => {
      if (
        !raw_sale ||
        raw_sale.operationType !== "insert" ||
        !raw_sale.fullDocument
      )
        return;

      const sale = raw_sale.fullDocument;
      const bids = await _getArbBids(sale);
      if (!bids || bids.length === 0) return;

      //append to queue each pair of sale and bid
      for (let i = 0; i < bids.length; i++) {
        db.QUEUE.push({ sale, bid: bids[i] });

        if (db.QUEUE.length === 1) {
          processQueue(db.QUEUE[0]);
        }
      }
    });
  } catch (err) {
    console.error("ERR: subSalesGetBids", err);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await subSalesGetBids();
  }
};

//2
const subBlocks = async () => {
  try {
    provider.on("block", async (blockNum) => {
      // if (blockNum % 1 === 0) {
      process.stdout.write(
        "\r\x1b[38;5;10m 🟢 block: \x1b[0m" +
          blockNum +
          " | " +
          "\x1b[38;5;10mdate: \x1b[0m" +
          new Date().toISOString() +
          " 🟢"
      );
      // }

      //for next
      db.var.BLOCK_NUM = blockNum;
      db.var.FEE = await provider.getFeeData();
      db.var.CURR_WALLET_BALANCE = await provider.getBalance(wallet.address);
      db.var.MIN_PROFIT =
        db.var.EST_GAS_FOR_ARB *
        (db.var.FEE.maxFeePerGas + db.var.FEE.maxPriorityFeePerGas);

      if (db.var.CURR_WALLET_BALANCE < db.var.PREV_WALLET_BALANCE) {
        console.error(
          `\n\x1b[38;5;202mBALANCE DECREASED\x1b[0m` + "from",
          ethers.formatEther(db.var.PREV_WALLET_BALANCE) + "to",
          ethers.formatEther(db.var.CURR_WALLET_BALANCE),
          "\n"
        );
        process.exit();
      }
      db.var.PREV_WALLET_BALANCE = db.var.CURR_WALLET_BALANCE;
    });
  } catch (e) {
    console.error("\nERR: subscribeBlocks", e);
    await subscribeBlocks();
  }
};

//1
const setup = async () => {
  function _isValidDataToSign(dataToSign) {
    // Check if dataToSign has all required properties
    if (
      !dataToSign.hasOwnProperty("message") ||
      !dataToSign.hasOwnProperty("walletAddress") ||
      !dataToSign.hasOwnProperty("expiresOn") ||
      !dataToSign.hasOwnProperty("hmac")
    ) {
      return false;
    }

    // Check if the message starts with 'Sign in to Blur'
    if (!dataToSign.message.startsWith("Sign in to Blur")) {
      return false;
    }

    // Check if the wallet address is valid
    try {
      ethers.getAddress(dataToSign.walletAddress) == wallet.address;
    } catch (error) {
      return false;
    }

    // Check if expiresOn is a valid ISO 8601 string
    if (isNaN(Date.parse(dataToSign.expiresOn))) {
      return false;
    }

    // Check if hmac is a valid 64-character hexadecimal string
    if (!/^([A-Fa-f0-9]{64})$/.test(dataToSign.hmac)) {
      return false;
    }

    return true;
  }
  /// SETUP BLOCK DATA ///
  db.var.BLOCK_NUM = await provider.getBlockNumber();
  db.var.FEE = await provider.getFeeData();
  db.var.CURR_WALLET_BALANCE = await provider.getBalance(wallet.address);
  db.var.MIN_PROFIT =
    db.var.EST_GAS_FOR_ARB *
    (db.var.FEE.maxFeePerGas + db.var.FEE.maxPriorityFeePerGas);

  /// SETUP BLUR AUTH TKN ///
  const dataToSign = await apiCall({
    url: db.api.blur.url.AUTH_GET,
    options: db.api.blur.options.AUTH,
  });

  if (!_isValidDataToSign(dataToSign)) {
    //in case if proxy provider is malicious
    console.error("\nERR: _isValidDataToSign", dataToSign);
    process.exit();
  }

  dataToSign.signature = await wallet.signMessage(dataToSign.message);
  db.api.blur.options.AUTH.body = JSON.stringify(dataToSign);
  db.var.BLUR_AUTH_TKN = (
    await apiCall({
      url: db.api.blur.url.AUTH_SET,
      options: db.api.blur.options.AUTH,
    })
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

  db.api.blur.options.POST = {
    method: "POST",
    headers: {
      redirect: "follow",
      authToken: db.var.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
      "content-type": "application/json",
      body: {}, //pass buy data
    },
  };

  db.streamSALES = db.SALES.watch();
  db.streamBIDS = db.BIDS.watch();
};

//0
const apiCall = async ({ url, options }) => {
  let res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error(error));
  return res;
};

(async function root() {
  try {
    await setup();
    subBlocks();
    return;
    subSalesGetBids();
    subBidsGetSales();
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
