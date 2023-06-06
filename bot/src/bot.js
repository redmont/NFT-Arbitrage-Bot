const fetch = require("node-fetch");
const ethers = require("ethers");
const abi = require("./data/abi.json");

require("dotenv").config();

const provider = new ethers.AlchemyProvider(
  "homestead",
  process.env.API_ALCHEMY
);
const wallet = new ethers.Wallet(process.env.PK_0, provider);

const { MongoClient } = require("mongodb");
const uri = "mongodb://localhost:27017";
const mongoClient = new MongoClient(uri);
const { ensureIndexes } = require("../../utils/mongoIndexes");

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
 * [x] import abis to bot vps
 * [x] Analytics
 * [x] ensure validate system is correct sellOSParams from sub & get, fro each order type, perhaps b4 add to db make universal
 * [ ] implement 4criteria
 *    [ ] db
 *       [ ] subBidsOs
 *          [ ] format, extract price for 2x & traits for TRAIT, & add to db
 *       [ ] getBidsOs, run script to get all bids for all blur slugs (later)
 *    [ ] bot
 *       [ ] subBidsGetSales, each case for each criteria
 *       [ ] exec arb based on provided values
 *       [ ] if trait or collection, then do additional call to get id & payload via puppeteer
 *       [ ] do parallel calls when possible
 *       [ ] run tests
 *
 * @l0ngt3rm
 * [ ] update db BIDS on vps to basic on vps
 * [ ] bribe system, based on osBid & time to block
 * [ ] multi tx block, nonce update (send all bundle with nonce +10 permutations for each pack of txs)
 * [ ] support add to queue validate arb, so that i fees go lower, re-exec
 * [ ] todo function to log compressed data in validate
 * [ ] validate conduict
 */

const db = {
  TEST_MODE: process.env.TEST_MODE || false,

  QUEUE: [],
  SALES: mongoClient.db("BOT_NFT").collection("SALES"),
  BIDS: mongoClient.db("BOT_NFT").collection("BIDS"),

  var: {
    TEST_NFT: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
    TEST_NFT_ID: "4171",
    TEST_BUYER: "0x00000E8C78e461678E455b1f6878Bb0ce50ce587",

    STARTED: false,
    BLUR_AUTH_TKN: "",
    GRAPHQL_AUTH_TKN: "",

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
    graphql: {
      url: {
        AUTH_GET: "http://127.0.0.1:3001/auth/getToken",
        AUTH_SET: "http://127.0.0.1:3001/auth/setToken",
        PAYLOAD: "http://127.0.0.1:3001/v1/getPayload",
      },
      options: {
        AUTH: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet.address }),
        },
      },
    },
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

    const osSellTxData = sellOsData?.transaction?.function
      ? db.interface.SEAPORT.encodeFunctionData(
          sellOsData?.transaction?.function,
          [sellParams]
        )
      : sellOsData?.method?.data;

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
        data: osSellTxData,
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

    console.log({
      info: "POTENTIAL ARB",
      date: new Date().toLocaleString(),
      block: db.var.BLOCK_NUM,
      estProfitGross: ethers.formatEther(estProfitGross),
      buyFrom,
      sellTo,
      buyBlurData,
      sellOsData,
    });

    // Validate NFT addr
    if (buyFromAddr != sellOsAddr || sellOsAddr != buyBlurAddr) {
      console.error("NFT ADDR not same");
      return false;
    }

    // Validate NFT id
    if (buyFromId != sellOsId || sellOsId != buyBlurId) {
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
  const _getSellOsDataFromAPI = async (sellTo) => {
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

  const _getSellOsDataFromGraphql = async (sellTo) => {
    const getCriteriaBids = async (
      addr_tkn,
      id_tkn,
      cursor,
      count,
      makerAddr
    ) => {
      const options = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      var url = `http://127.0.0.1:3001/v1/${addr_tkn}/${id_tkn}/criteriaOrders?`;
      cursor && (url += `&cursor=${cursor}`);
      count && (url += `&count=${count}`);
      makerAddr && (url += `&maker=${makerAddr}`);

      const msg = await apiCall({ url: url, options: options });
      return msg;
    };

    const getOfferPayload = async (
      criteriaBid,
      assetContractAddress,
      tokenId
    ) => {
      const variables = {
        orderId: criteriaBid.node?.id,
        itemFillAmount: "1",
        takerAssetsForCriteria: {
          assetContractAddress: assetContractAddress,
          tokenId: tokenId,
          chain: "ETHEREUM",
        },
        giftRecipientAddress: null,
        optionalCreatorFeeBasisPoints: 0,
      };

      const options = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authtkn: db.var.GRAPHQL_AUTH_TKN,
          variables: JSON.stringify(variables),
        },
      };

      var url = db.api.graphql.url.PAYLOAD;
      const payload = await apiCall({ url: url, options: options });
      return payload;
    };
    const { addr_tkn, id_tkn } = buyFrom;

    let exitLoop = false;
    let cursor = null;
    let criteriaOffer;

    // Filter out only corresponding bid from OS bid sub
    const makerAddr = sellTo.addr_buyer;
    const priceInETH = ethers.formatEther(sellTo.bid.payload.base_price);
    const bidPriceOS = ethers.parseEther(priceInETH);

    while (!exitLoop) {
      const criteriaBids = await getCriteriaBids(
        addr_tkn,
        id_tkn,
        cursor,
        32,
        makerAddr
      );

      if (criteriaBids.error) {
        console.log(addr_tkn, id_tkn, "criteriaBids error", criteriaBids.error);
        return false;
      }
      if (criteriaBids.data?.orders?.edges?.length === 0) {
        console.log(addr_tkn, id_tkn, "criteriaBids empty");
        return false;
      }

      criteriaBids.data?.orders?.edges?.every((order) => {
        // if this is a trait bid, but the current order is not a trait bid, skip
        // is there a way to only fetch trait bids from graphql ?
        if (
          sellTo.bid?.payload?.trait_criteria &&
          order.node?.criteria?.trait == null
        ) {
          return true;
        }

        const currentBidPriceGraphQL = ethers.parseEther(
          order.node?.perUnitPriceType?.eth
        );
        // console.log("bidPriceOS", bidPriceOS);
        // console.log("currentBidPriceGraphQL", currentBidPriceGraphQL);
        // console.log(currentBidPriceGraphQL == bidPriceOS);

        if (currentBidPriceGraphQL == bidPriceOS) {
          exitLoop = true;
          criteriaOffer = order;
          return false;
        }

        if (currentBidPriceGraphQL < bidPriceOS) {
          exitLoop = true;
          return false;
        }
        return true;
      });

      if (criteriaBids.data?.orders?.pageInfo?.hasNextPage) {
        cursor = criteriaBids.data?.orders?.pageInfo?.endCursor;
      }
      if (!cursor) {
        exitLoop = true;
      }
    }

    if (!criteriaOffer) {
      console.log(
        "\nNo matching bids found from OS graphql: ",
        addr_tkn,
        id_tkn,
        makerAddr,
        priceInETH
      );
      return false;
    }
    //console.log("criteriaOffer", criteriaOffer);

    const payload = await getOfferPayload(criteriaOffer, addr_tkn, id_tkn);
    if (payload?.data?.order?.fulfill?.actions?.length > 0) {
      let data = payload.data.order.fulfill.actions;

      if (Array.isArray(data) && data.length > 0) {
        data = data[data.length - 1];
        _formatGraphqlDataToAPI(data);
        return data;
      }
    }
    console.log(
      "\nError while getting sell data from OS graphql",
      addr_tkn,
      id_tkn,
      criteriaOffer?.node?.id,
      JSON.stringify(payload, null, 2)
    );
    return false;
  };

  const _getSellOsData = async (sellTo) => {
    let sellOsData = null;
    switch (true) {
      case sellTo.type === "OS_BID_SUB_BASIC" ||
        sellTo.type === "OS_BID_GET_BASIC":
        sellOsData = (await _getSellOsDataFromAPI(sellTo)) ?? {};
        break;
      case sellTo.type === "OS_BID_SUB_COLLECTION" ||
        sellTo.type === "OS_BID_GET_COLLECTION":
        sellOsData = (await _getSellOsDataFromGraphql(sellTo)) ?? {};
        break;
      case sellTo.type === "OS_BID_SUB_TRAIT" ||
        sellTo.type === "OS_BID_GET_TRAIT":
        sellOsData = (await _getSellOsDataFromGraphql(sellTo)) ?? {};
        break;
      default:
        console.log("\nbRR: bid.type not found", bid);
        return;
    }
    return sellOsData;
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

    //ignore if listing not found, log new, unknown, others
    switch (true) {
      case buyFromBlurData?.buys?.length > 0:
        return buyFromBlurData;

      case buyFromBlurData?.cancelReasons?.length > 0 &&
        buyFromBlurData?.cancelReasons?.[0]?.reason === "ListingNotFound":
        return false;
      //todo, should delete from db

      default:
        console.log(
          "\nnUNKNOWN buyFromBlurData",
          url,
          buyFrom.id_tkn,
          buyFromBlurData
        );
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

  // todo: There is probably a better way to do this via ABI
  const _formatGraphqlDataToAPI = (sellOsData) => {
    //decode sellOsData tx data based on abi
    const iface = db.interface.SEAPORT;
    let decodedData = iface.parseTransaction({
      data: sellOsData.method.data,
      value: sellOsData.method.value,
    });

    const ordersData = decodedData.args[0];

    sellOsData.orders = ordersData.map(
      ([parameters, numerator, denominator, signature, extraData]) => ({
        parameters: {
          offerer: parameters[0],
          zone: parameters[1],
          offer: parameters[2].map(
            ([
              itemType,
              token,
              identifierOrCriteria,
              startAmount,
              endAmount,
            ]) => ({
              itemType: Number(itemType),
              token,
              identifierOrCriteria: BigInt(identifierOrCriteria),
              startAmount: BigInt(startAmount),
              endAmount: BigInt(endAmount),
            })
          ),
          consideration: parameters[3].map(
            ([
              itemType,
              token,
              identifierOrCriteria,
              startAmount,
              endAmount,
              recipient,
            ]) => ({
              itemType: Number(itemType),
              token,
              identifierOrCriteria: BigInt(identifierOrCriteria),
              startAmount: BigInt(startAmount),
              endAmount: BigInt(endAmount),
              recipient,
            })
          ),
          orderType: Number(parameters[4]),
          startTime: BigInt(parameters[5]),
          endTime: BigInt(parameters[6]),
          zoneHash: parameters[7],
          salt: BigInt(parameters[8]),
          conduitKey: parameters[9],
          totalOriginalConsiderationItems: BigInt(parameters[10]),
        },
        numerator: BigInt(numerator),
        denominator: BigInt(denominator),
        signature,
        extraData,
      })
    );
    sellOsData.transaction = {
      to: sellOsData.method.destination.value,
      input_data: {
        parameters: {
          offererConduitKey: sellOsData.orders[0].parameters.conduitKey,
          offerAmount: sellOsData.orders[0].parameters.offer[0].endAmount,
          considerationToken: sellOsData.orders[1].parameters.offer[0].token,
          considerationIdentifier:
            sellOsData.orders[1].parameters.offer[0].identifierOrCriteria,
        },
      },
    };
  };
  //(0/6)
  try {
    console.log("\nexecArb", buyFrom, sellTo);
    //(1/6)
    if (!(await _preValidate(buyFrom, sellTo))) return;

    //(2/6)
    const buyBlurData = (await _getBuyBlurData(buyFrom)) ?? {};
    if (!buyBlurData) return;

    //(3/6)
    let sellOsData = (await _getSellOsData(sellTo)) ?? {};
    if (!sellOsData) return;

    if (db.TEST_MODE) {
      console.log("sellOsData:", sellOsData);
    }

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

    if (db.TEST_MODE) {
      console.log("\nBundle:", bundle);
    }

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

    // Get only one matching sales in ascending order of price
    // todo: add index to price field

    const matchingSalesCursor = db.SALES.find(salesToFind)
      .sort({ price: 1 })
      .collation({ locale: "en_US", numericOrdering: true })
      .limit(1);
    const matchingSales = await matchingSalesCursor.toArray();
    if (matchingSales.length === 0) return;

    // Get sale with lowest price
    let lowestSale = matchingSales[0];
    let lowestPrice = BigInt(matchingSales[0].price);

    if (lowestPrice > BigInt(bid.price)) {
      return null;
    }

    return lowestSale;
  };

  const _getArbSalesCollection = async (bid) => {
    //@todo will to get multiple sales that salePrice < bidPrice

    const salesToFind = {};

    salesToFind["addr_tkn"] = bid.addr_tkn;

    // Get all matching sales in increasing order of price
    // todo: add index to price field
    const matchingSalesCursor = db.SALES.find(salesToFind)
      .sort({ price: 1 })
      .collation({ locale: "en_US", numericOrdering: true });
    let matchingSales = await matchingSalesCursor.toArray();
    if (matchingSales.length === 0) return;

    // Filter out sales with price < bid.price
    matchingSales = matchingSales.filter((sale) => {
      return sale.price < BigInt(bid.price);
    });

    return matchingSales;
  };

  const _getArbSaleTrait = async (bid) => {
    const salesToFind = {};

    salesToFind["addr_tkn"] = bid.addr_tkn;
    salesToFind[`traits.$.trait_type`] = bid.trait_type;
    salesToFind[`traits.$.trait_name`] = bid.trait_name;

    // Get all matching sales in increasing order of price
    const matchingSalesCursor = db.SALES.find(salesToFind)
      .sort({ price: 1 })
      .collation({ locale: "en_US", numericOrdering: true });

    let matchingSales = await matchingSalesCursor.toArray();
    if (matchingSales.length === 0) return;

    // Filter out sales with price < bid.price
    matchingSales = matchingSales.filter((sale) => {
      return sale.price < BigInt(bid.price);
    });

    return matchingSales;
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

      if (db.TEST_MODE) {
        if (
          bid.addr_tkn !== db.var.TEST_NFT ||
          bid.addr_buyer !== db.var.TEST_BUYER
        ) {
          return;
        }
        console.log("\nDETECTED TEST bid");
      }

      let sales = null;

      switch (true) {
        case bid.type === "OS_BID_SUB_BASIC" || bid.type === "OS_BID_GET_BASIC":
          sales = await _getArbSaleBasic(bid); //1x only
          break;
        case bid.type === "OS_BID_SUB_COLLECTION" ||
          bid.type === "OS_BID_GET_COLLECTION":
          sales = await _getArbSalesCollection(bid); //multi
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
    const currentTime = Math.floor(Date.now() / 1000).toString();

    // Find all types of bids that match the blur sale

    const queryBasicBid = {
      addr_tkn: sale.addr_tkn,
      id_tkn: sale.id_tkn,
      type: "OS_BID_GET_BASIC",
    };
    const queryCollectionBid = {
      addr_tkn: sale.addr_tkn,
      type: "OS_BID_SUB_COLLECTION",
    };
    const queryTraitsBid = {
      addr_tkn: sale.addr_tkn,
      type: "OS_BID_SUB_TRAIT",
    };

    // get all matching bids
    const matchingBidsCursor = db.BIDS.find({
      $and: [
        // find basic or collection or traits bids
        { $or: [queryBasicBid, queryCollectionBid, queryTraitsBid] },
        // filter out expired bids
        // filter bids that are lower than sale price
        { exp_time: { $gt: currentTime }, price: { $gt: sale.price } },
      ],
    }).collation({ locale: "en_US", numericOrdering: true });

    // console.log('\nGOT matchingBidsCursor', matchingBidsCursor)
    if (sale.addr_tkn == db.var.TEST_NFT && sale.id_tkn == db.var.TEST_NFT_ID) {
      console.log("\nDETECTED TEST arb sale:", sale);
    }

    let arbBids = await matchingBidsCursor.toArray();

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
  if (db.TEST_MODE) {
    console.log("Running in TEST MODE");
  }
  const _validateOs = async (msgToSign) => {
    // Checking if the required fields are present
    if (
      !msgToSign ||
      !msgToSign.data ||
      !msgToSign.data.auth ||
      !msgToSign.data.auth.loginMessage
    ) {
      return false;
    }

    const loginMessage = msgToSign.data.auth.loginMessage;

    // Checking the format of the loginMessage
    const expectedMessageStart =
      "Welcome to OpenSea!\n\nClick to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nYour authentication status will reset after 24 hours.\n\nWallet address:\n";
    const expectedMessageEnd = "\n\nNonce:\n";

    // Verifying the wallet address and nonce
    const messageParts = loginMessage.split(expectedMessageEnd);
    const messageStartAndAddress = messageParts[0].split(expectedMessageStart);
    const walletAddress = ethers.getAddress(messageStartAndAddress[1]);
    const nonce = messageParts[1];

    // Validate the structure of the loginMessage
    if (messageStartAndAddress[0] !== "" || messageParts.length !== 2) {
      return false;
    }

    // Additional validation for nonce (UUID format)
    const uuidRegex =
      /^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$/;

    if (!uuidRegex.test(nonce)) {
      return false;
    }

    if (walletAddress !== wallet.address) {
      return false;
    }

    return loginMessage;
  };

  function _validateBlur(dataToSign) {
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

  ////////////////////////
  /// SETUP BLOCK DATA ///
  ////////////////////////

  db.var.BLOCK_NUM = await provider.getBlockNumber();
  db.var.FEE = await provider.getFeeData();
  db.var.CURR_WALLET_BALANCE = await provider.getBalance(wallet.address);
  db.var.MIN_PROFIT =
    db.var.EST_GAS_FOR_ARB *
    (db.var.FEE.maxFeePerGas + db.var.FEE.maxPriorityFeePerGas);

  /////////////////////////////////
  /// SETUP OS GRAPHQL AUTH TKN ///
  /////////////////////////////////

  const msgToSign = await apiCall({
    url: db.api.graphql.url.AUTH_GET,
    options: db.api.graphql.options.AUTH,
  });

  const loginMsg = await _validateOs(msgToSign);
  if (!loginMsg) {
    console.error("\nERR: _validateOs", JSON.stringify(msgToSign, null, 2));
    return;
  }

  const sign = await wallet.signMessage(loginMsg);
  db.api.graphql.options.AUTH.body = JSON.stringify({
    address: wallet.address,
    message: loginMsg,
    signature: sign,
    chain: "ETHEREUM",
  });

  db.var.GRAPHQL_AUTH_TKN = (
    await apiCall({
      url: db.api.graphql.url.AUTH_SET,
      options: db.api.graphql.options.AUTH, //can reuse
    })
  ).data.auth.login.token;

  console.log("\n\x1b[34mGRAPHQL_AUTH_TKN\x1b[0m", db.var.GRAPHQL_AUTH_TKN);

  ///////////////////////////
  /// SETUP BLUR AUTH TKN ///
  ///////////////////////////

  const dataToSign = await apiCall({
    url: db.api.blur.url.AUTH_GET,
    options: db.api.blur.options.AUTH,
  });

  if (!_validateBlur(dataToSign)) {
    //in case if proxy provider is malicious
    console.error("\nERR: _validateBlur", dataToSign);
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

  console.log("\n\x1b[38;5;202mBLUR_AUTH_TKN\x1b[0m", db.var.BLUR_AUTH_TKN);

  //////////////////////////////
  /// SETUP BLUR API OPTIONS ///
  //////////////////////////////

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

  //todo setup graphql options
  db.streamSALES = db.SALES.watch();
  db.streamBIDS = db.BIDS.watch();

  await ensureIndexes(mongoClient);
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
    subSalesGetBids();
    subBidsGetSales();
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
