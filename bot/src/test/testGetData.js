//from 0x7 get full data via api
const fetch = require("node-fetch");
const ethers = require("ethers");

const provider = new ethers.AlchemyProvider(
  "homestead",
  process.env.API_ALCHEMY
);
const wallet = new ethers.Wallet(process.env.PK_7, provider);

const db = {
  TEST_MODE: false,

  QUEUE: [],
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
    VALIDATOR_FEE_BPS: 1000n, //1bps = 0.01%
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
  abi: {
    SEAPORT: [
      {
        inputs: [
          {
            internalType: "address",
            name: "conduitController",
            type: "address",
          },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        inputs: [
          {
            components: [
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "address", name: "zone", type: "address" },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                ],
                internalType: "structOfferItem[]",
                name: "offer",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structConsiderationItem[]",
                name: "consideration",
                type: "tuple[]",
              },
              {
                internalType: "enumOrderType",
                name: "orderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
              { internalType: "uint256", name: "counter", type: "uint256" },
            ],
            internalType: "structOrderComponents[]",
            name: "orders",
            type: "tuple[]",
          },
        ],
        name: "cancel",
        outputs: [{ internalType: "bool", name: "cancelled", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "uint120", name: "numerator", type: "uint120" },
              { internalType: "uint120", name: "denominator", type: "uint120" },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "bytes", name: "extraData", type: "bytes" },
            ],
            internalType: "structAdvancedOrder",
            name: "advancedOrder",
            type: "tuple",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "enumSide", name: "side", type: "uint8" },
              { internalType: "uint256", name: "index", type: "uint256" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              {
                internalType: "bytes32[]",
                name: "criteriaProof",
                type: "bytes32[]",
              },
            ],
            internalType: "structCriteriaResolver[]",
            name: "criteriaResolvers",
            type: "tuple[]",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
          { internalType: "address", name: "recipient", type: "address" },
        ],
        name: "fulfillAdvancedOrder",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "uint120", name: "numerator", type: "uint120" },
              { internalType: "uint120", name: "denominator", type: "uint120" },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "bytes", name: "extraData", type: "bytes" },
            ],
            internalType: "structAdvancedOrder[]",
            name: "advancedOrders",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "enumSide", name: "side", type: "uint8" },
              { internalType: "uint256", name: "index", type: "uint256" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              {
                internalType: "bytes32[]",
                name: "criteriaProof",
                type: "bytes32[]",
              },
            ],
            internalType: "structCriteriaResolver[]",
            name: "criteriaResolvers",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "offerFulfillments",
            type: "tuple[][]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "considerationFulfillments",
            type: "tuple[][]",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
          { internalType: "address", name: "recipient", type: "address" },
          {
            internalType: "uint256",
            name: "maximumFulfilled",
            type: "uint256",
          },
        ],
        name: "fulfillAvailableAdvancedOrders",
        outputs: [
          { internalType: "bool[]", name: "availableOrders", type: "bool[]" },
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder[]",
            name: "orders",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "offerFulfillments",
            type: "tuple[][]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "considerationFulfillments",
            type: "tuple[][]",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "maximumFulfilled",
            type: "uint256",
          },
        ],
        name: "fulfillAvailableOrders",
        outputs: [
          { internalType: "bool[]", name: "availableOrders", type: "bool[]" },
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "address",
                name: "considerationToken",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "considerationIdentifier",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "considerationAmount",
                type: "uint256",
              },
              {
                internalType: "addresspayable",
                name: "offerer",
                type: "address",
              },
              { internalType: "address", name: "zone", type: "address" },
              { internalType: "address", name: "offerToken", type: "address" },
              {
                internalType: "uint256",
                name: "offerIdentifier",
                type: "uint256",
              },
              { internalType: "uint256", name: "offerAmount", type: "uint256" },
              {
                internalType: "enumBasicOrderType",
                name: "basicOrderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              {
                internalType: "bytes32",
                name: "offererConduitKey",
                type: "bytes32",
              },
              {
                internalType: "bytes32",
                name: "fulfillerConduitKey",
                type: "bytes32",
              },
              {
                internalType: "uint256",
                name: "totalOriginalAdditionalRecipients",
                type: "uint256",
              },
              {
                components: [
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structAdditionalRecipient[]",
                name: "additionalRecipients",
                type: "tuple[]",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structBasicOrderParameters",
            name: "parameters",
            type: "tuple",
          },
        ],
        name: "fulfillBasicOrder",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "address",
                name: "considerationToken",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "considerationIdentifier",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "considerationAmount",
                type: "uint256",
              },
              {
                internalType: "addresspayable",
                name: "offerer",
                type: "address",
              },
              { internalType: "address", name: "zone", type: "address" },
              { internalType: "address", name: "offerToken", type: "address" },
              {
                internalType: "uint256",
                name: "offerIdentifier",
                type: "uint256",
              },
              { internalType: "uint256", name: "offerAmount", type: "uint256" },
              {
                internalType: "enumBasicOrderType",
                name: "basicOrderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              {
                internalType: "bytes32",
                name: "offererConduitKey",
                type: "bytes32",
              },
              {
                internalType: "bytes32",
                name: "fulfillerConduitKey",
                type: "bytes32",
              },
              {
                internalType: "uint256",
                name: "totalOriginalAdditionalRecipients",
                type: "uint256",
              },
              {
                components: [
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structAdditionalRecipient[]",
                name: "additionalRecipients",
                type: "tuple[]",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structBasicOrderParameters",
            name: "parameters",
            type: "tuple",
          },
        ],
        name: "fulfillBasicOrder_efficient_6GL6yc",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder",
            name: "order",
            type: "tuple",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
        ],
        name: "fulfillOrder",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "contractOfferer", type: "address" },
        ],
        name: "getContractOffererNonce",
        outputs: [{ internalType: "uint256", name: "nonce", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "offerer", type: "address" }],
        name: "getCounter",
        outputs: [
          { internalType: "uint256", name: "counter", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "address", name: "zone", type: "address" },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                ],
                internalType: "structOfferItem[]",
                name: "offer",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structConsiderationItem[]",
                name: "consideration",
                type: "tuple[]",
              },
              {
                internalType: "enumOrderType",
                name: "orderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
              { internalType: "uint256", name: "counter", type: "uint256" },
            ],
            internalType: "structOrderComponents",
            name: "order",
            type: "tuple",
          },
        ],
        name: "getOrderHash",
        outputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "getOrderStatus",
        outputs: [
          { internalType: "bool", name: "isValidated", type: "bool" },
          { internalType: "bool", name: "isCancelled", type: "bool" },
          { internalType: "uint256", name: "totalFilled", type: "uint256" },
          { internalType: "uint256", name: "totalSize", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "incrementCounter",
        outputs: [
          { internalType: "uint256", name: "newCounter", type: "uint256" },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "information",
        outputs: [
          { internalType: "string", name: "version", type: "string" },
          { internalType: "bytes32", name: "domainSeparator", type: "bytes32" },
          {
            internalType: "address",
            name: "conduitController",
            type: "address",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "uint120", name: "numerator", type: "uint120" },
              { internalType: "uint120", name: "denominator", type: "uint120" },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "bytes", name: "extraData", type: "bytes" },
            ],
            internalType: "structAdvancedOrder[]",
            name: "orders",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "enumSide", name: "side", type: "uint8" },
              { internalType: "uint256", name: "index", type: "uint256" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              {
                internalType: "bytes32[]",
                name: "criteriaProof",
                type: "bytes32[]",
              },
            ],
            internalType: "structCriteriaResolver[]",
            name: "criteriaResolvers",
            type: "tuple[]",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "offerComponents",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "considerationComponents",
                type: "tuple[]",
              },
            ],
            internalType: "structFulfillment[]",
            name: "fulfillments",
            type: "tuple[]",
          },
          { internalType: "address", name: "recipient", type: "address" },
        ],
        name: "matchAdvancedOrders",
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder[]",
            name: "orders",
            type: "tuple[]",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "offerComponents",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "considerationComponents",
                type: "tuple[]",
              },
            ],
            internalType: "structFulfillment[]",
            name: "fulfillments",
            type: "tuple[]",
          },
        ],
        name: "matchOrders",
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [],
        name: "name",
        outputs: [
          { internalType: "string", name: "contractName", type: "string" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder[]",
            name: "orders",
            type: "tuple[]",
          },
        ],
        name: "validate",
        outputs: [{ internalType: "bool", name: "validated", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      { inputs: [], name: "BadContractSignature", type: "error" },
      { inputs: [], name: "BadFraction", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "BadReturnValueFromERC20OnTransfer",
        type: "error",
      },
      {
        inputs: [{ internalType: "uint8", name: "v", type: "uint8" }],
        name: "BadSignatureV",
        type: "error",
      },
      { inputs: [], name: "CannotCancelOrder", type: "error" },
      {
        inputs: [],
        name: "ConsiderationCriteriaResolverOutOfRange",
        type: "error",
      },
      {
        inputs: [],
        name: "ConsiderationLengthNotEqualToTotalOriginal",
        type: "error",
      },
      {
        inputs: [
          { internalType: "uint256", name: "orderIndex", type: "uint256" },
          {
            internalType: "uint256",
            name: "considerationIndex",
            type: "uint256",
          },
          { internalType: "uint256", name: "shortfallAmount", type: "uint256" },
        ],
        name: "ConsiderationNotMet",
        type: "error",
      },
      { inputs: [], name: "CriteriaNotEnabledForItem", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256[]", name: "identifiers", type: "uint256[]" },
          { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
        ],
        name: "ERC1155BatchTransferGenericFailure",
        type: "error",
      },
      { inputs: [], name: "InexactFraction", type: "error" },
      { inputs: [], name: "InsufficientNativeTokensSupplied", type: "error" },
      { inputs: [], name: "Invalid1155BatchTransferEncoding", type: "error" },
      { inputs: [], name: "InvalidBasicOrderParameterEncoding", type: "error" },
      {
        inputs: [{ internalType: "address", name: "conduit", type: "address" }],
        name: "InvalidCallToConduit",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
          { internalType: "address", name: "conduit", type: "address" },
        ],
        name: "InvalidConduit",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "InvalidContractOrder",
        type: "error",
      },
      {
        inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
        name: "InvalidERC721TransferAmount",
        type: "error",
      },
      { inputs: [], name: "InvalidFulfillmentComponentData", type: "error" },
      {
        inputs: [{ internalType: "uint256", name: "value", type: "uint256" }],
        name: "InvalidMsgValue",
        type: "error",
      },
      { inputs: [], name: "InvalidNativeOfferItem", type: "error" },
      { inputs: [], name: "InvalidProof", type: "error" },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "InvalidRestrictedOrder",
        type: "error",
      },
      { inputs: [], name: "InvalidSignature", type: "error" },
      { inputs: [], name: "InvalidSigner", type: "error" },
      {
        inputs: [
          { internalType: "uint256", name: "startTime", type: "uint256" },
          { internalType: "uint256", name: "endTime", type: "uint256" },
        ],
        name: "InvalidTime",
        type: "error",
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "fulfillmentIndex",
            type: "uint256",
          },
        ],
        name: "MismatchedFulfillmentOfferAndConsiderationComponents",
        type: "error",
      },
      {
        inputs: [{ internalType: "enumSide", name: "side", type: "uint8" }],
        name: "MissingFulfillmentComponentOnAggregation",
        type: "error",
      },
      { inputs: [], name: "MissingItemAmount", type: "error" },
      { inputs: [], name: "MissingOriginalConsiderationItems", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "NativeTokenTransferGenericFailure",
        type: "error",
      },
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "NoContract",
        type: "error",
      },
      { inputs: [], name: "NoReentrantCalls", type: "error" },
      { inputs: [], name: "NoSpecifiedOrdersAvailable", type: "error" },
      {
        inputs: [],
        name: "OfferAndConsiderationRequiredOnFulfillment",
        type: "error",
      },
      { inputs: [], name: "OfferCriteriaResolverOutOfRange", type: "error" },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "OrderAlreadyFilled",
        type: "error",
      },
      {
        inputs: [{ internalType: "enumSide", name: "side", type: "uint8" }],
        name: "OrderCriteriaResolverOutOfRange",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "OrderIsCancelled",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "OrderPartiallyFilled",
        type: "error",
      },
      { inputs: [], name: "PartialFillsNotEnabledForOrder", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "identifier", type: "uint256" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "TokenTransferGenericFailure",
        type: "error",
      },
      {
        inputs: [
          { internalType: "uint256", name: "orderIndex", type: "uint256" },
          {
            internalType: "uint256",
            name: "considerationIndex",
            type: "uint256",
          },
        ],
        name: "UnresolvedConsiderationCriteria",
        type: "error",
      },
      {
        inputs: [
          { internalType: "uint256", name: "orderIndex", type: "uint256" },
          { internalType: "uint256", name: "offerIndex", type: "uint256" },
        ],
        name: "UnresolvedOfferCriteria",
        type: "error",
      },
      { inputs: [], name: "UnusedItemParameters", type: "error" },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "uint256",
            name: "newCounter",
            type: "uint256",
          },
          {
            indexed: true,
            internalType: "address",
            name: "offerer",
            type: "address",
          },
        ],
        name: "CounterIncremented",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32",
            name: "orderHash",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "offerer",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "zone",
            type: "address",
          },
        ],
        name: "OrderCancelled",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32",
            name: "orderHash",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "offerer",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "zone",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "recipient",
            type: "address",
          },
          {
            components: [
              { internalType: "enumItemType", name: "itemType", type: "uint8" },
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            indexed: false,
            internalType: "structSpentItem[]",
            name: "offer",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "enumItemType", name: "itemType", type: "uint8" },
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              { internalType: "uint256", name: "amount", type: "uint256" },
              {
                internalType: "addresspayable",
                name: "recipient",
                type: "address",
              },
            ],
            indexed: false,
            internalType: "structReceivedItem[]",
            name: "consideration",
            type: "tuple[]",
          },
        ],
        name: "OrderFulfilled",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32",
            name: "orderHash",
            type: "bytes32",
          },
          {
            components: [
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "address", name: "zone", type: "address" },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                ],
                internalType: "structOfferItem[]",
                name: "offer",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structConsiderationItem[]",
                name: "consideration",
                type: "tuple[]",
              },
              {
                internalType: "enumOrderType",
                name: "orderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
              {
                internalType: "uint256",
                name: "totalOriginalConsiderationItems",
                type: "uint256",
              },
            ],
            indexed: false,
            internalType: "structOrderParameters",
            name: "orderParameters",
            type: "tuple",
          },
        ],
        name: "OrderValidated",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32[]",
            name: "orderHashes",
            type: "bytes32[]",
          },
        ],
        name: "OrdersMatched",
        type: "event",
      },
    ],
  },
  interface: {
    SEAPORT: new ethers.Interface([
      {
        inputs: [
          {
            internalType: "address",
            name: "conduitController",
            type: "address",
          },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        inputs: [
          {
            components: [
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "address", name: "zone", type: "address" },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                ],
                internalType: "structOfferItem[]",
                name: "offer",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structConsiderationItem[]",
                name: "consideration",
                type: "tuple[]",
              },
              {
                internalType: "enumOrderType",
                name: "orderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
              { internalType: "uint256", name: "counter", type: "uint256" },
            ],
            internalType: "structOrderComponents[]",
            name: "orders",
            type: "tuple[]",
          },
        ],
        name: "cancel",
        outputs: [{ internalType: "bool", name: "cancelled", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "uint120", name: "numerator", type: "uint120" },
              { internalType: "uint120", name: "denominator", type: "uint120" },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "bytes", name: "extraData", type: "bytes" },
            ],
            internalType: "structAdvancedOrder",
            name: "advancedOrder",
            type: "tuple",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "enumSide", name: "side", type: "uint8" },
              { internalType: "uint256", name: "index", type: "uint256" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              {
                internalType: "bytes32[]",
                name: "criteriaProof",
                type: "bytes32[]",
              },
            ],
            internalType: "structCriteriaResolver[]",
            name: "criteriaResolvers",
            type: "tuple[]",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
          { internalType: "address", name: "recipient", type: "address" },
        ],
        name: "fulfillAdvancedOrder",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "uint120", name: "numerator", type: "uint120" },
              { internalType: "uint120", name: "denominator", type: "uint120" },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "bytes", name: "extraData", type: "bytes" },
            ],
            internalType: "structAdvancedOrder[]",
            name: "advancedOrders",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "enumSide", name: "side", type: "uint8" },
              { internalType: "uint256", name: "index", type: "uint256" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              {
                internalType: "bytes32[]",
                name: "criteriaProof",
                type: "bytes32[]",
              },
            ],
            internalType: "structCriteriaResolver[]",
            name: "criteriaResolvers",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "offerFulfillments",
            type: "tuple[][]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "considerationFulfillments",
            type: "tuple[][]",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
          { internalType: "address", name: "recipient", type: "address" },
          {
            internalType: "uint256",
            name: "maximumFulfilled",
            type: "uint256",
          },
        ],
        name: "fulfillAvailableAdvancedOrders",
        outputs: [
          { internalType: "bool[]", name: "availableOrders", type: "bool[]" },
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder[]",
            name: "orders",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "offerFulfillments",
            type: "tuple[][]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "uint256", name: "itemIndex", type: "uint256" },
            ],
            internalType: "structFulfillmentComponent[][]",
            name: "considerationFulfillments",
            type: "tuple[][]",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "maximumFulfilled",
            type: "uint256",
          },
        ],
        name: "fulfillAvailableOrders",
        outputs: [
          { internalType: "bool[]", name: "availableOrders", type: "bool[]" },
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "address",
                name: "considerationToken",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "considerationIdentifier",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "considerationAmount",
                type: "uint256",
              },
              {
                internalType: "addresspayable",
                name: "offerer",
                type: "address",
              },
              { internalType: "address", name: "zone", type: "address" },
              { internalType: "address", name: "offerToken", type: "address" },
              {
                internalType: "uint256",
                name: "offerIdentifier",
                type: "uint256",
              },
              { internalType: "uint256", name: "offerAmount", type: "uint256" },
              {
                internalType: "enumBasicOrderType",
                name: "basicOrderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              {
                internalType: "bytes32",
                name: "offererConduitKey",
                type: "bytes32",
              },
              {
                internalType: "bytes32",
                name: "fulfillerConduitKey",
                type: "bytes32",
              },
              {
                internalType: "uint256",
                name: "totalOriginalAdditionalRecipients",
                type: "uint256",
              },
              {
                components: [
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structAdditionalRecipient[]",
                name: "additionalRecipients",
                type: "tuple[]",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structBasicOrderParameters",
            name: "parameters",
            type: "tuple",
          },
        ],
        name: "fulfillBasicOrder",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "address",
                name: "considerationToken",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "considerationIdentifier",
                type: "uint256",
              },
              {
                internalType: "uint256",
                name: "considerationAmount",
                type: "uint256",
              },
              {
                internalType: "addresspayable",
                name: "offerer",
                type: "address",
              },
              { internalType: "address", name: "zone", type: "address" },
              { internalType: "address", name: "offerToken", type: "address" },
              {
                internalType: "uint256",
                name: "offerIdentifier",
                type: "uint256",
              },
              { internalType: "uint256", name: "offerAmount", type: "uint256" },
              {
                internalType: "enumBasicOrderType",
                name: "basicOrderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              {
                internalType: "bytes32",
                name: "offererConduitKey",
                type: "bytes32",
              },
              {
                internalType: "bytes32",
                name: "fulfillerConduitKey",
                type: "bytes32",
              },
              {
                internalType: "uint256",
                name: "totalOriginalAdditionalRecipients",
                type: "uint256",
              },
              {
                components: [
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structAdditionalRecipient[]",
                name: "additionalRecipients",
                type: "tuple[]",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structBasicOrderParameters",
            name: "parameters",
            type: "tuple",
          },
        ],
        name: "fulfillBasicOrder_efficient_6GL6yc",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder",
            name: "order",
            type: "tuple",
          },
          {
            internalType: "bytes32",
            name: "fulfillerConduitKey",
            type: "bytes32",
          },
        ],
        name: "fulfillOrder",
        outputs: [{ internalType: "bool", name: "fulfilled", type: "bool" }],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "contractOfferer", type: "address" },
        ],
        name: "getContractOffererNonce",
        outputs: [{ internalType: "uint256", name: "nonce", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "offerer", type: "address" }],
        name: "getCounter",
        outputs: [
          { internalType: "uint256", name: "counter", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "address", name: "zone", type: "address" },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                ],
                internalType: "structOfferItem[]",
                name: "offer",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structConsiderationItem[]",
                name: "consideration",
                type: "tuple[]",
              },
              {
                internalType: "enumOrderType",
                name: "orderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
              { internalType: "uint256", name: "counter", type: "uint256" },
            ],
            internalType: "structOrderComponents",
            name: "order",
            type: "tuple",
          },
        ],
        name: "getOrderHash",
        outputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "getOrderStatus",
        outputs: [
          { internalType: "bool", name: "isValidated", type: "bool" },
          { internalType: "bool", name: "isCancelled", type: "bool" },
          { internalType: "uint256", name: "totalFilled", type: "uint256" },
          { internalType: "uint256", name: "totalSize", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "incrementCounter",
        outputs: [
          { internalType: "uint256", name: "newCounter", type: "uint256" },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "information",
        outputs: [
          { internalType: "string", name: "version", type: "string" },
          { internalType: "bytes32", name: "domainSeparator", type: "bytes32" },
          {
            internalType: "address",
            name: "conduitController",
            type: "address",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "uint120", name: "numerator", type: "uint120" },
              { internalType: "uint120", name: "denominator", type: "uint120" },
              { internalType: "bytes", name: "signature", type: "bytes" },
              { internalType: "bytes", name: "extraData", type: "bytes" },
            ],
            internalType: "structAdvancedOrder[]",
            name: "orders",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "uint256", name: "orderIndex", type: "uint256" },
              { internalType: "enumSide", name: "side", type: "uint8" },
              { internalType: "uint256", name: "index", type: "uint256" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              {
                internalType: "bytes32[]",
                name: "criteriaProof",
                type: "bytes32[]",
              },
            ],
            internalType: "structCriteriaResolver[]",
            name: "criteriaResolvers",
            type: "tuple[]",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "offerComponents",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "considerationComponents",
                type: "tuple[]",
              },
            ],
            internalType: "structFulfillment[]",
            name: "fulfillments",
            type: "tuple[]",
          },
          { internalType: "address", name: "recipient", type: "address" },
        ],
        name: "matchAdvancedOrders",
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder[]",
            name: "orders",
            type: "tuple[]",
          },
          {
            components: [
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "offerComponents",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "orderIndex",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "itemIndex",
                    type: "uint256",
                  },
                ],
                internalType: "structFulfillmentComponent[]",
                name: "considerationComponents",
                type: "tuple[]",
              },
            ],
            internalType: "structFulfillment[]",
            name: "fulfillments",
            type: "tuple[]",
          },
        ],
        name: "matchOrders",
        outputs: [
          {
            components: [
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifier",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "amount", type: "uint256" },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structReceivedItem",
                name: "item",
                type: "tuple",
              },
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
            ],
            internalType: "structExecution[]",
            name: "executions",
            type: "tuple[]",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [],
        name: "name",
        outputs: [
          { internalType: "string", name: "contractName", type: "string" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { internalType: "address", name: "offerer", type: "address" },
                  { internalType: "address", name: "zone", type: "address" },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "structOfferItem[]",
                    name: "offer",
                    type: "tuple[]",
                  },
                  {
                    components: [
                      {
                        internalType: "enumItemType",
                        name: "itemType",
                        type: "uint8",
                      },
                      {
                        internalType: "address",
                        name: "token",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "identifierOrCriteria",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "startAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "endAmount",
                        type: "uint256",
                      },
                      {
                        internalType: "addresspayable",
                        name: "recipient",
                        type: "address",
                      },
                    ],
                    internalType: "structConsiderationItem[]",
                    name: "consideration",
                    type: "tuple[]",
                  },
                  {
                    internalType: "enumOrderType",
                    name: "orderType",
                    type: "uint8",
                  },
                  {
                    internalType: "uint256",
                    name: "startTime",
                    type: "uint256",
                  },
                  { internalType: "uint256", name: "endTime", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "zoneHash",
                    type: "bytes32",
                  },
                  { internalType: "uint256", name: "salt", type: "uint256" },
                  {
                    internalType: "bytes32",
                    name: "conduitKey",
                    type: "bytes32",
                  },
                  {
                    internalType: "uint256",
                    name: "totalOriginalConsiderationItems",
                    type: "uint256",
                  },
                ],
                internalType: "structOrderParameters",
                name: "parameters",
                type: "tuple",
              },
              { internalType: "bytes", name: "signature", type: "bytes" },
            ],
            internalType: "structOrder[]",
            name: "orders",
            type: "tuple[]",
          },
        ],
        name: "validate",
        outputs: [{ internalType: "bool", name: "validated", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      { inputs: [], name: "BadContractSignature", type: "error" },
      { inputs: [], name: "BadFraction", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "BadReturnValueFromERC20OnTransfer",
        type: "error",
      },
      {
        inputs: [{ internalType: "uint8", name: "v", type: "uint8" }],
        name: "BadSignatureV",
        type: "error",
      },
      { inputs: [], name: "CannotCancelOrder", type: "error" },
      {
        inputs: [],
        name: "ConsiderationCriteriaResolverOutOfRange",
        type: "error",
      },
      {
        inputs: [],
        name: "ConsiderationLengthNotEqualToTotalOriginal",
        type: "error",
      },
      {
        inputs: [
          { internalType: "uint256", name: "orderIndex", type: "uint256" },
          {
            internalType: "uint256",
            name: "considerationIndex",
            type: "uint256",
          },
          { internalType: "uint256", name: "shortfallAmount", type: "uint256" },
        ],
        name: "ConsiderationNotMet",
        type: "error",
      },
      { inputs: [], name: "CriteriaNotEnabledForItem", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256[]", name: "identifiers", type: "uint256[]" },
          { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
        ],
        name: "ERC1155BatchTransferGenericFailure",
        type: "error",
      },
      { inputs: [], name: "InexactFraction", type: "error" },
      { inputs: [], name: "InsufficientNativeTokensSupplied", type: "error" },
      { inputs: [], name: "Invalid1155BatchTransferEncoding", type: "error" },
      { inputs: [], name: "InvalidBasicOrderParameterEncoding", type: "error" },
      {
        inputs: [{ internalType: "address", name: "conduit", type: "address" }],
        name: "InvalidCallToConduit",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
          { internalType: "address", name: "conduit", type: "address" },
        ],
        name: "InvalidConduit",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "InvalidContractOrder",
        type: "error",
      },
      {
        inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
        name: "InvalidERC721TransferAmount",
        type: "error",
      },
      { inputs: [], name: "InvalidFulfillmentComponentData", type: "error" },
      {
        inputs: [{ internalType: "uint256", name: "value", type: "uint256" }],
        name: "InvalidMsgValue",
        type: "error",
      },
      { inputs: [], name: "InvalidNativeOfferItem", type: "error" },
      { inputs: [], name: "InvalidProof", type: "error" },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "InvalidRestrictedOrder",
        type: "error",
      },
      { inputs: [], name: "InvalidSignature", type: "error" },
      { inputs: [], name: "InvalidSigner", type: "error" },
      {
        inputs: [
          { internalType: "uint256", name: "startTime", type: "uint256" },
          { internalType: "uint256", name: "endTime", type: "uint256" },
        ],
        name: "InvalidTime",
        type: "error",
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "fulfillmentIndex",
            type: "uint256",
          },
        ],
        name: "MismatchedFulfillmentOfferAndConsiderationComponents",
        type: "error",
      },
      {
        inputs: [{ internalType: "enumSide", name: "side", type: "uint8" }],
        name: "MissingFulfillmentComponentOnAggregation",
        type: "error",
      },
      { inputs: [], name: "MissingItemAmount", type: "error" },
      { inputs: [], name: "MissingOriginalConsiderationItems", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "NativeTokenTransferGenericFailure",
        type: "error",
      },
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "NoContract",
        type: "error",
      },
      { inputs: [], name: "NoReentrantCalls", type: "error" },
      { inputs: [], name: "NoSpecifiedOrdersAvailable", type: "error" },
      {
        inputs: [],
        name: "OfferAndConsiderationRequiredOnFulfillment",
        type: "error",
      },
      { inputs: [], name: "OfferCriteriaResolverOutOfRange", type: "error" },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "OrderAlreadyFilled",
        type: "error",
      },
      {
        inputs: [{ internalType: "enumSide", name: "side", type: "uint8" }],
        name: "OrderCriteriaResolverOutOfRange",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "OrderIsCancelled",
        type: "error",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "orderHash", type: "bytes32" },
        ],
        name: "OrderPartiallyFilled",
        type: "error",
      },
      { inputs: [], name: "PartialFillsNotEnabledForOrder", type: "error" },
      {
        inputs: [
          { internalType: "address", name: "token", type: "address" },
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "identifier", type: "uint256" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "TokenTransferGenericFailure",
        type: "error",
      },
      {
        inputs: [
          { internalType: "uint256", name: "orderIndex", type: "uint256" },
          {
            internalType: "uint256",
            name: "considerationIndex",
            type: "uint256",
          },
        ],
        name: "UnresolvedConsiderationCriteria",
        type: "error",
      },
      {
        inputs: [
          { internalType: "uint256", name: "orderIndex", type: "uint256" },
          { internalType: "uint256", name: "offerIndex", type: "uint256" },
        ],
        name: "UnresolvedOfferCriteria",
        type: "error",
      },
      { inputs: [], name: "UnusedItemParameters", type: "error" },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "uint256",
            name: "newCounter",
            type: "uint256",
          },
          {
            indexed: true,
            internalType: "address",
            name: "offerer",
            type: "address",
          },
        ],
        name: "CounterIncremented",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32",
            name: "orderHash",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "offerer",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "zone",
            type: "address",
          },
        ],
        name: "OrderCancelled",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32",
            name: "orderHash",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "offerer",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "zone",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "recipient",
            type: "address",
          },
          {
            components: [
              { internalType: "enumItemType", name: "itemType", type: "uint8" },
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            indexed: false,
            internalType: "structSpentItem[]",
            name: "offer",
            type: "tuple[]",
          },
          {
            components: [
              { internalType: "enumItemType", name: "itemType", type: "uint8" },
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "identifier", type: "uint256" },
              { internalType: "uint256", name: "amount", type: "uint256" },
              {
                internalType: "addresspayable",
                name: "recipient",
                type: "address",
              },
            ],
            indexed: false,
            internalType: "structReceivedItem[]",
            name: "consideration",
            type: "tuple[]",
          },
        ],
        name: "OrderFulfilled",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32",
            name: "orderHash",
            type: "bytes32",
          },
          {
            components: [
              { internalType: "address", name: "offerer", type: "address" },
              { internalType: "address", name: "zone", type: "address" },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                ],
                internalType: "structOfferItem[]",
                name: "offer",
                type: "tuple[]",
              },
              {
                components: [
                  {
                    internalType: "enumItemType",
                    name: "itemType",
                    type: "uint8",
                  },
                  { internalType: "address", name: "token", type: "address" },
                  {
                    internalType: "uint256",
                    name: "identifierOrCriteria",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "startAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "uint256",
                    name: "endAmount",
                    type: "uint256",
                  },
                  {
                    internalType: "addresspayable",
                    name: "recipient",
                    type: "address",
                  },
                ],
                internalType: "structConsiderationItem[]",
                name: "consideration",
                type: "tuple[]",
              },
              {
                internalType: "enumOrderType",
                name: "orderType",
                type: "uint8",
              },
              { internalType: "uint256", name: "startTime", type: "uint256" },
              { internalType: "uint256", name: "endTime", type: "uint256" },
              { internalType: "bytes32", name: "zoneHash", type: "bytes32" },
              { internalType: "uint256", name: "salt", type: "uint256" },
              { internalType: "bytes32", name: "conduitKey", type: "bytes32" },
              {
                internalType: "uint256",
                name: "totalOriginalConsiderationItems",
                type: "uint256",
              },
            ],
            indexed: false,
            internalType: "structOrderParameters",
            name: "orderParameters",
            type: "tuple",
          },
        ],
        name: "OrderValidated",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "bytes32[]",
            name: "orderHashes",
            type: "bytes32[]",
          },
        ],
        name: "OrdersMatched",
        type: "event",
      },
    ]),
    NFT: new ethers.Interface([
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "bool", name: "approved", type: "bool" },
        ],
        name: "setApprovalForAll",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ]),
    WETH: new ethers.Interface([
      {
        constant: false,
        inputs: [{ name: "wad", type: "uint256" }],
        name: "withdraw",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ]),
  },
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

const getSellOsData = async (sellTo) => {
  console.log("\nGetting sell data from OS...");

  // const body = {
  //   offer: {
  //     hash: sellTo.hash,
  //     chain: "ethereum",
  //     protocol_address: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  //   },
  //   fulfiller: {
  //     address: "0x77777484802D14b8346D04FD506A1dC897800b41",
  //   },
  //   consideration: {
  //     asset_contract_address: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
  //     token_id: "877",
  //   },
  // };

  const body = {
    offer: {
      hash: "0xdab05e6fb0a21f61b9fa1b5b8d2c4f5a3c228ad9fd00dc7e928c851930484f0b",
      // hash: "0xfd68ebd9ada1e9d5b8b36ffdfb398688c21bb72300d9bd0af72c4ca1ba96271f",
      chain: "ethereum",
      protocol_address: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
    },
    fulfiller: {
      address: "0x22BD5AB79379aAfB8C5227993a6C9cbfE490D9C9",
    },
    consideration: {
      asset_contract_address: "0x26437d312fB36BdD7AC9F322A6D4cCFe0c4FA313",
      token_id: "7997",
    },
  };

  db.api.os.bidData.options.body = JSON.stringify(body);

  console.time("sellOsData");
  const data = await apiCall(db.api.os.bidData);
  console.timeEnd("sellOsData");

  console.log("\nos data", JSON.stringify(data, null, 2));
  return;
};

(async function root() {
  try {
    // const url = 'https://api.opensea.io/v2/orders/ethereum/seaport/offers?asset_contract_address=0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0&token_ids=877&order_by=created_date&order_direction=desc'
    // const options = {
    // 	method: 'GET',
    // 	headers: {
    // 		'X-API-KEY': process.env.API_OS_OLD,
    // 		'Content-Type': 'application/json',
    // 	},
    // }
    // const data = await apiCall({url, options})

    // console.log('data', data)
    const bid = {
      order_hash:
        "0x7b63d7a2f919383edb619b27dd9b4831c18f8efe5caad249e01d4811eee35a86",
      chain: "ethereum",
      criteria: {
        collection: {
          slug: "yes-ser",
        },
        contract: {
          address: "0xa7f551feab03d1f34138c900e7c08821f3c3d1d0",
        },
        trait: null,
      },
      protocol_data: {
        parameters: {
          offerer: "0xfffff8f8122eb53e503a535ba0ed63d35906f52f",
          offer: [
            {
              itemType: 1,
              token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
              identifierOrCriteria: "0",
              startAmount: "3900000000000000",
              endAmount: "3900000000000000",
            },
          ],
          consideration: [
            {
              itemType: 4,
              token: "0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0",
              identifierOrCriteria:
                "28534348834214963374123923506473097992398575933390137419535798362903968925132",
              startAmount: "1",
              endAmount: "1",
              recipient: "0xffFFF8F8122eb53e503A535ba0eD63D35906F52f",
            },
            {
              itemType: 1,
              token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
              identifierOrCriteria: "0",
              startAmount: "97500000000000",
              endAmount: "97500000000000",
              recipient: "0x0000a26b00c1F0DF003000390027140000fAa719",
            },
          ],
          startTime: "1684239287",
          endTime: "1684325672",
          orderType: 2,
          zone: "0x000000e7Ec00e7B300774b00001314B8610022b8",
          zoneHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          salt: "0x360c6ebe00000000000000000000000000000000000000008263477db8fd18dc",
          conduitKey:
            "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
          totalOriginalConsiderationItems: 2,
          counter: 0,
        },
        signature: null,
      },
      protocol_address: "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
    };

    const sellTo = {
      hash: bid.order_hash, //'0xd51ccee69fb204e94445c7385e99c1c78b3b0d9d71909343fdb3813bcdb91f36',// bid.order_hash,
      addr_tkn: db.TEST_NFT,
      id_tkn: db.TEST_NFT_ID,
    };

    const sellOsData = await getSellOsData(sellTo);
    // console.log('sellOsData', sellOsData.transaction.input_data)
  } catch (e) {
    console.error("\nERR: root:", e);
    await root();
  }
})();
