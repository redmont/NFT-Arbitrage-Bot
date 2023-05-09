const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');
const ethers = require('ethers');

const provider = new ethers.AlchemyProvider("homestead", process.env.API_ALCHEMY);
const wallet = new ethers.Wallet(process.env.PK_0, provider);
const uri = 'mongodb://localhost:27017';

const mongoClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const TEST_MODE = true

const osClient = new OpenSeaStreamClient({
	token: process.env.API_OS,
	networkName: "mainnet",
	connectOptions: {
			transport: WebSocket,
	},
	onError: (error) => console.error("ERR: osClient", error),
	logLevel: 1,
});

const db = {
	var: {
		TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',
		TEST_NFT_ID: '877',

		STARTED: false,
		BLUR_AUTH_TKN: '',

		BLOCK_NUM: 0,
		INTERVAL_DB_DATA: 100,
		BUNDLE_MAX_BLOCK: 5,
		PREV_WALLET_BALANCE: 0n, //wallet balance (to buy blur)
		CURR_WALLET_BALANCE: 0n, //wallet balance (to buy blur)

		//fees
		FEE: {},
		VALIDATOR_FEE_BPS: 50n, //1bps = 0.01%
		EST_GAS_SWAP: (10n**6n)/2n, //edit later
		EST_GAS_APPROVE_NFT: 10n**5n,
		EST_GAS_WITHDRAW_WETH: 50000n,
		EST_GAS_COINBASE: 50000n,
		EST_GAS_FOR_ARB: (1n*(10n**6n)) + (10n**5n) + (10n**4n), //2x swaps + approveNFT + withdrawETH
		MIN_PROFIT: 0n,

		CONDUCIT_CODE_HASH: "0x023d904f2503c37127200ca07b976c3a53cc562623f67023115bf311f5805059",
	},
	addr: {
		COINBASE: "0xEcAfdDDcc85BCFa4a4aB8F72a543391c7474F35E",
		SEAPORT: "0x00000000000001ad428e4906aE43D8F9852d0dD6",
		CONDUCIT_CONTROLER: "0x00000000F9490004C11Cef243f5400493c00Ad63",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
	},
  api: {
		os: {
			bidData: {
				url: 'https://api.opensea.io/v2/offers/fulfillment_data',
				options: {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-API-KEY': process.env.API_OS
					},
					body: {},
				},
			},
		},
		blur: {
			url: {
				AUTH_GET: 'http://127.0.0.1:3000/auth/getToken',
				AUTH_SET: 'http://127.0.0.1:3000/auth/setToken',
				COLLECTIONS: 'http://127.0.0.1:3000/v1/collections/?filters=%7B%22sort%22%3A%22FLOOR_PRICE%22%2C%22order%22%3A%22DESC%22%7D',
			},
			options: {
				AUTH: {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({walletAddress: wallet.address}),
				},
				GET: {}, //in setup()
				POST: {} //in setup()
			},
		},
		builders: [ // @todo test/add more
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
		]
  },
	abi: {
		SEAPORT: [{"inputs":[{"internalType":"address","name":"conduitController","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"counter","type":"uint256"}],"internalType":"structOrderComponents[]","name":"orders","type":"tuple[]"}],"name":"cancel","outputs":[{"internalType":"bool","name":"cancelled","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"uint120","name":"numerator","type":"uint120"},{"internalType":"uint120","name":"denominator","type":"uint120"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"structAdvancedOrder","name":"advancedOrder","type":"tuple"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"enumSide","name":"side","type":"uint8"},{"internalType":"uint256","name":"index","type":"uint256"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"bytes32[]","name":"criteriaProof","type":"bytes32[]"}],"internalType":"structCriteriaResolver[]","name":"criteriaResolvers","type":"tuple[]"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"address","name":"recipient","type":"address"}],"name":"fulfillAdvancedOrder","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"uint120","name":"numerator","type":"uint120"},{"internalType":"uint120","name":"denominator","type":"uint120"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"structAdvancedOrder[]","name":"advancedOrders","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"enumSide","name":"side","type":"uint8"},{"internalType":"uint256","name":"index","type":"uint256"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"bytes32[]","name":"criteriaProof","type":"bytes32[]"}],"internalType":"structCriteriaResolver[]","name":"criteriaResolvers","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"offerFulfillments","type":"tuple[][]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"considerationFulfillments","type":"tuple[][]"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"maximumFulfilled","type":"uint256"}],"name":"fulfillAvailableAdvancedOrders","outputs":[{"internalType":"bool[]","name":"availableOrders","type":"bool[]"},{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder[]","name":"orders","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"offerFulfillments","type":"tuple[][]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"considerationFulfillments","type":"tuple[][]"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"uint256","name":"maximumFulfilled","type":"uint256"}],"name":"fulfillAvailableOrders","outputs":[{"internalType":"bool[]","name":"availableOrders","type":"bool[]"},{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"considerationToken","type":"address"},{"internalType":"uint256","name":"considerationIdentifier","type":"uint256"},{"internalType":"uint256","name":"considerationAmount","type":"uint256"},{"internalType":"addresspayable","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"internalType":"address","name":"offerToken","type":"address"},{"internalType":"uint256","name":"offerIdentifier","type":"uint256"},{"internalType":"uint256","name":"offerAmount","type":"uint256"},{"internalType":"enumBasicOrderType","name":"basicOrderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"offererConduitKey","type":"bytes32"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalAdditionalRecipients","type":"uint256"},{"components":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structAdditionalRecipient[]","name":"additionalRecipients","type":"tuple[]"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structBasicOrderParameters","name":"parameters","type":"tuple"}],"name":"fulfillBasicOrder","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"considerationToken","type":"address"},{"internalType":"uint256","name":"considerationIdentifier","type":"uint256"},{"internalType":"uint256","name":"considerationAmount","type":"uint256"},{"internalType":"addresspayable","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"internalType":"address","name":"offerToken","type":"address"},{"internalType":"uint256","name":"offerIdentifier","type":"uint256"},{"internalType":"uint256","name":"offerAmount","type":"uint256"},{"internalType":"enumBasicOrderType","name":"basicOrderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"offererConduitKey","type":"bytes32"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalAdditionalRecipients","type":"uint256"},{"components":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structAdditionalRecipient[]","name":"additionalRecipients","type":"tuple[]"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structBasicOrderParameters","name":"parameters","type":"tuple"}],"name":"fulfillBasicOrder_efficient_6GL6yc","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder","name":"order","type":"tuple"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"}],"name":"fulfillOrder","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"contractOfferer","type":"address"}],"name":"getContractOffererNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"offerer","type":"address"}],"name":"getCounter","outputs":[{"internalType":"uint256","name":"counter","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"counter","type":"uint256"}],"internalType":"structOrderComponents","name":"order","type":"tuple"}],"name":"getOrderHash","outputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"getOrderStatus","outputs":[{"internalType":"bool","name":"isValidated","type":"bool"},{"internalType":"bool","name":"isCancelled","type":"bool"},{"internalType":"uint256","name":"totalFilled","type":"uint256"},{"internalType":"uint256","name":"totalSize","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"incrementCounter","outputs":[{"internalType":"uint256","name":"newCounter","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"information","outputs":[{"internalType":"string","name":"version","type":"string"},{"internalType":"bytes32","name":"domainSeparator","type":"bytes32"},{"internalType":"address","name":"conduitController","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"uint120","name":"numerator","type":"uint120"},{"internalType":"uint120","name":"denominator","type":"uint120"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"structAdvancedOrder[]","name":"orders","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"enumSide","name":"side","type":"uint8"},{"internalType":"uint256","name":"index","type":"uint256"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"bytes32[]","name":"criteriaProof","type":"bytes32[]"}],"internalType":"structCriteriaResolver[]","name":"criteriaResolvers","type":"tuple[]"},{"components":[{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"offerComponents","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"considerationComponents","type":"tuple[]"}],"internalType":"structFulfillment[]","name":"fulfillments","type":"tuple[]"},{"internalType":"address","name":"recipient","type":"address"}],"name":"matchAdvancedOrders","outputs":[{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder[]","name":"orders","type":"tuple[]"},{"components":[{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"offerComponents","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"considerationComponents","type":"tuple[]"}],"internalType":"structFulfillment[]","name":"fulfillments","type":"tuple[]"}],"name":"matchOrders","outputs":[{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"contractName","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder[]","name":"orders","type":"tuple[]"}],"name":"validate","outputs":[{"internalType":"bool","name":"validated","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"BadContractSignature","type":"error"},{"inputs":[],"name":"BadFraction","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"BadReturnValueFromERC20OnTransfer","type":"error"},{"inputs":[{"internalType":"uint8","name":"v","type":"uint8"}],"name":"BadSignatureV","type":"error"},{"inputs":[],"name":"CannotCancelOrder","type":"error"},{"inputs":[],"name":"ConsiderationCriteriaResolverOutOfRange","type":"error"},{"inputs":[],"name":"ConsiderationLengthNotEqualToTotalOriginal","type":"error"},{"inputs":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"considerationIndex","type":"uint256"},{"internalType":"uint256","name":"shortfallAmount","type":"uint256"}],"name":"ConsiderationNotMet","type":"error"},{"inputs":[],"name":"CriteriaNotEnabledForItem","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"identifiers","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"ERC1155BatchTransferGenericFailure","type":"error"},{"inputs":[],"name":"InexactFraction","type":"error"},{"inputs":[],"name":"InsufficientNativeTokensSupplied","type":"error"},{"inputs":[],"name":"Invalid1155BatchTransferEncoding","type":"error"},{"inputs":[],"name":"InvalidBasicOrderParameterEncoding","type":"error"},{"inputs":[{"internalType":"address","name":"conduit","type":"address"}],"name":"InvalidCallToConduit","type":"error"},{"inputs":[{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"address","name":"conduit","type":"address"}],"name":"InvalidConduit","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"InvalidContractOrder","type":"error"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"InvalidERC721TransferAmount","type":"error"},{"inputs":[],"name":"InvalidFulfillmentComponentData","type":"error"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"InvalidMsgValue","type":"error"},{"inputs":[],"name":"InvalidNativeOfferItem","type":"error"},{"inputs":[],"name":"InvalidProof","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"InvalidRestrictedOrder","type":"error"},{"inputs":[],"name":"InvalidSignature","type":"error"},{"inputs":[],"name":"InvalidSigner","type":"error"},{"inputs":[{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"}],"name":"InvalidTime","type":"error"},{"inputs":[{"internalType":"uint256","name":"fulfillmentIndex","type":"uint256"}],"name":"MismatchedFulfillmentOfferAndConsiderationComponents","type":"error"},{"inputs":[{"internalType":"enumSide","name":"side","type":"uint8"}],"name":"MissingFulfillmentComponentOnAggregation","type":"error"},{"inputs":[],"name":"MissingItemAmount","type":"error"},{"inputs":[],"name":"MissingOriginalConsiderationItems","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"NativeTokenTransferGenericFailure","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"NoContract","type":"error"},{"inputs":[],"name":"NoReentrantCalls","type":"error"},{"inputs":[],"name":"NoSpecifiedOrdersAvailable","type":"error"},{"inputs":[],"name":"OfferAndConsiderationRequiredOnFulfillment","type":"error"},{"inputs":[],"name":"OfferCriteriaResolverOutOfRange","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"OrderAlreadyFilled","type":"error"},{"inputs":[{"internalType":"enumSide","name":"side","type":"uint8"}],"name":"OrderCriteriaResolverOutOfRange","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"OrderIsCancelled","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"OrderPartiallyFilled","type":"error"},{"inputs":[],"name":"PartialFillsNotEnabledForOrder","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenTransferGenericFailure","type":"error"},{"inputs":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"considerationIndex","type":"uint256"}],"name":"UnresolvedConsiderationCriteria","type":"error"},{"inputs":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"offerIndex","type":"uint256"}],"name":"UnresolvedOfferCriteria","type":"error"},{"inputs":[],"name":"UnusedItemParameters","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newCounter","type":"uint256"},{"indexed":true,"internalType":"address","name":"offerer","type":"address"}],"name":"CounterIncremented","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"offerer","type":"address"},{"indexed":true,"internalType":"address","name":"zone","type":"address"}],"name":"OrderCancelled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"offerer","type":"address"},{"indexed":true,"internalType":"address","name":"zone","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"indexed":false,"internalType":"structSpentItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"indexed":false,"internalType":"structReceivedItem[]","name":"consideration","type":"tuple[]"}],"name":"OrderFulfilled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"indexed":false,"internalType":"structOrderParameters","name":"orderParameters","type":"tuple"}],"name":"OrderValidated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32[]","name":"orderHashes","type":"bytes32[]"}],"name":"OrdersMatched","type":"event"}]
	},
	interface: {
		SEAPORT: new ethers.Interface([{"inputs":[{"internalType":"address","name":"conduitController","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"counter","type":"uint256"}],"internalType":"structOrderComponents[]","name":"orders","type":"tuple[]"}],"name":"cancel","outputs":[{"internalType":"bool","name":"cancelled","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"uint120","name":"numerator","type":"uint120"},{"internalType":"uint120","name":"denominator","type":"uint120"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"structAdvancedOrder","name":"advancedOrder","type":"tuple"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"enumSide","name":"side","type":"uint8"},{"internalType":"uint256","name":"index","type":"uint256"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"bytes32[]","name":"criteriaProof","type":"bytes32[]"}],"internalType":"structCriteriaResolver[]","name":"criteriaResolvers","type":"tuple[]"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"address","name":"recipient","type":"address"}],"name":"fulfillAdvancedOrder","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"uint120","name":"numerator","type":"uint120"},{"internalType":"uint120","name":"denominator","type":"uint120"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"structAdvancedOrder[]","name":"advancedOrders","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"enumSide","name":"side","type":"uint8"},{"internalType":"uint256","name":"index","type":"uint256"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"bytes32[]","name":"criteriaProof","type":"bytes32[]"}],"internalType":"structCriteriaResolver[]","name":"criteriaResolvers","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"offerFulfillments","type":"tuple[][]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"considerationFulfillments","type":"tuple[][]"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"maximumFulfilled","type":"uint256"}],"name":"fulfillAvailableAdvancedOrders","outputs":[{"internalType":"bool[]","name":"availableOrders","type":"bool[]"},{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder[]","name":"orders","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"offerFulfillments","type":"tuple[][]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[][]","name":"considerationFulfillments","type":"tuple[][]"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"uint256","name":"maximumFulfilled","type":"uint256"}],"name":"fulfillAvailableOrders","outputs":[{"internalType":"bool[]","name":"availableOrders","type":"bool[]"},{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"considerationToken","type":"address"},{"internalType":"uint256","name":"considerationIdentifier","type":"uint256"},{"internalType":"uint256","name":"considerationAmount","type":"uint256"},{"internalType":"addresspayable","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"internalType":"address","name":"offerToken","type":"address"},{"internalType":"uint256","name":"offerIdentifier","type":"uint256"},{"internalType":"uint256","name":"offerAmount","type":"uint256"},{"internalType":"enumBasicOrderType","name":"basicOrderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"offererConduitKey","type":"bytes32"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalAdditionalRecipients","type":"uint256"},{"components":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structAdditionalRecipient[]","name":"additionalRecipients","type":"tuple[]"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structBasicOrderParameters","name":"parameters","type":"tuple"}],"name":"fulfillBasicOrder","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"considerationToken","type":"address"},{"internalType":"uint256","name":"considerationIdentifier","type":"uint256"},{"internalType":"uint256","name":"considerationAmount","type":"uint256"},{"internalType":"addresspayable","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"internalType":"address","name":"offerToken","type":"address"},{"internalType":"uint256","name":"offerIdentifier","type":"uint256"},{"internalType":"uint256","name":"offerAmount","type":"uint256"},{"internalType":"enumBasicOrderType","name":"basicOrderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"offererConduitKey","type":"bytes32"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalAdditionalRecipients","type":"uint256"},{"components":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structAdditionalRecipient[]","name":"additionalRecipients","type":"tuple[]"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structBasicOrderParameters","name":"parameters","type":"tuple"}],"name":"fulfillBasicOrder_efficient_6GL6yc","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder","name":"order","type":"tuple"},{"internalType":"bytes32","name":"fulfillerConduitKey","type":"bytes32"}],"name":"fulfillOrder","outputs":[{"internalType":"bool","name":"fulfilled","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"contractOfferer","type":"address"}],"name":"getContractOffererNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"offerer","type":"address"}],"name":"getCounter","outputs":[{"internalType":"uint256","name":"counter","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"counter","type":"uint256"}],"internalType":"structOrderComponents","name":"order","type":"tuple"}],"name":"getOrderHash","outputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"getOrderStatus","outputs":[{"internalType":"bool","name":"isValidated","type":"bool"},{"internalType":"bool","name":"isCancelled","type":"bool"},{"internalType":"uint256","name":"totalFilled","type":"uint256"},{"internalType":"uint256","name":"totalSize","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"incrementCounter","outputs":[{"internalType":"uint256","name":"newCounter","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"information","outputs":[{"internalType":"string","name":"version","type":"string"},{"internalType":"bytes32","name":"domainSeparator","type":"bytes32"},{"internalType":"address","name":"conduitController","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"uint120","name":"numerator","type":"uint120"},{"internalType":"uint120","name":"denominator","type":"uint120"},{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"structAdvancedOrder[]","name":"orders","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"enumSide","name":"side","type":"uint8"},{"internalType":"uint256","name":"index","type":"uint256"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"bytes32[]","name":"criteriaProof","type":"bytes32[]"}],"internalType":"structCriteriaResolver[]","name":"criteriaResolvers","type":"tuple[]"},{"components":[{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"offerComponents","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"considerationComponents","type":"tuple[]"}],"internalType":"structFulfillment[]","name":"fulfillments","type":"tuple[]"},{"internalType":"address","name":"recipient","type":"address"}],"name":"matchAdvancedOrders","outputs":[{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder[]","name":"orders","type":"tuple[]"},{"components":[{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"offerComponents","type":"tuple[]"},{"components":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"itemIndex","type":"uint256"}],"internalType":"structFulfillmentComponent[]","name":"considerationComponents","type":"tuple[]"}],"internalType":"structFulfillment[]","name":"fulfillments","type":"tuple[]"}],"name":"matchOrders","outputs":[{"components":[{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structReceivedItem","name":"item","type":"tuple"},{"internalType":"address","name":"offerer","type":"address"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"}],"internalType":"structExecution[]","name":"executions","type":"tuple[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"contractName","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"internalType":"structOrderParameters","name":"parameters","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"structOrder[]","name":"orders","type":"tuple[]"}],"name":"validate","outputs":[{"internalType":"bool","name":"validated","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"BadContractSignature","type":"error"},{"inputs":[],"name":"BadFraction","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"BadReturnValueFromERC20OnTransfer","type":"error"},{"inputs":[{"internalType":"uint8","name":"v","type":"uint8"}],"name":"BadSignatureV","type":"error"},{"inputs":[],"name":"CannotCancelOrder","type":"error"},{"inputs":[],"name":"ConsiderationCriteriaResolverOutOfRange","type":"error"},{"inputs":[],"name":"ConsiderationLengthNotEqualToTotalOriginal","type":"error"},{"inputs":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"considerationIndex","type":"uint256"},{"internalType":"uint256","name":"shortfallAmount","type":"uint256"}],"name":"ConsiderationNotMet","type":"error"},{"inputs":[],"name":"CriteriaNotEnabledForItem","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"identifiers","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"ERC1155BatchTransferGenericFailure","type":"error"},{"inputs":[],"name":"InexactFraction","type":"error"},{"inputs":[],"name":"InsufficientNativeTokensSupplied","type":"error"},{"inputs":[],"name":"Invalid1155BatchTransferEncoding","type":"error"},{"inputs":[],"name":"InvalidBasicOrderParameterEncoding","type":"error"},{"inputs":[{"internalType":"address","name":"conduit","type":"address"}],"name":"InvalidCallToConduit","type":"error"},{"inputs":[{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"address","name":"conduit","type":"address"}],"name":"InvalidConduit","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"InvalidContractOrder","type":"error"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"InvalidERC721TransferAmount","type":"error"},{"inputs":[],"name":"InvalidFulfillmentComponentData","type":"error"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"InvalidMsgValue","type":"error"},{"inputs":[],"name":"InvalidNativeOfferItem","type":"error"},{"inputs":[],"name":"InvalidProof","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"InvalidRestrictedOrder","type":"error"},{"inputs":[],"name":"InvalidSignature","type":"error"},{"inputs":[],"name":"InvalidSigner","type":"error"},{"inputs":[{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"}],"name":"InvalidTime","type":"error"},{"inputs":[{"internalType":"uint256","name":"fulfillmentIndex","type":"uint256"}],"name":"MismatchedFulfillmentOfferAndConsiderationComponents","type":"error"},{"inputs":[{"internalType":"enumSide","name":"side","type":"uint8"}],"name":"MissingFulfillmentComponentOnAggregation","type":"error"},{"inputs":[],"name":"MissingItemAmount","type":"error"},{"inputs":[],"name":"MissingOriginalConsiderationItems","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"NativeTokenTransferGenericFailure","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"NoContract","type":"error"},{"inputs":[],"name":"NoReentrantCalls","type":"error"},{"inputs":[],"name":"NoSpecifiedOrdersAvailable","type":"error"},{"inputs":[],"name":"OfferAndConsiderationRequiredOnFulfillment","type":"error"},{"inputs":[],"name":"OfferCriteriaResolverOutOfRange","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"OrderAlreadyFilled","type":"error"},{"inputs":[{"internalType":"enumSide","name":"side","type":"uint8"}],"name":"OrderCriteriaResolverOutOfRange","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"OrderIsCancelled","type":"error"},{"inputs":[{"internalType":"bytes32","name":"orderHash","type":"bytes32"}],"name":"OrderPartiallyFilled","type":"error"},{"inputs":[],"name":"PartialFillsNotEnabledForOrder","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenTransferGenericFailure","type":"error"},{"inputs":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"considerationIndex","type":"uint256"}],"name":"UnresolvedConsiderationCriteria","type":"error"},{"inputs":[{"internalType":"uint256","name":"orderIndex","type":"uint256"},{"internalType":"uint256","name":"offerIndex","type":"uint256"}],"name":"UnresolvedOfferCriteria","type":"error"},{"inputs":[],"name":"UnusedItemParameters","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newCounter","type":"uint256"},{"indexed":true,"internalType":"address","name":"offerer","type":"address"}],"name":"CounterIncremented","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"offerer","type":"address"},{"indexed":true,"internalType":"address","name":"zone","type":"address"}],"name":"OrderCancelled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"offerer","type":"address"},{"indexed":true,"internalType":"address","name":"zone","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"indexed":false,"internalType":"structSpentItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifier","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"indexed":false,"internalType":"structReceivedItem[]","name":"consideration","type":"tuple[]"}],"name":"OrderFulfilled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"components":[{"internalType":"address","name":"offerer","type":"address"},{"internalType":"address","name":"zone","type":"address"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"}],"internalType":"structOfferItem[]","name":"offer","type":"tuple[]"},{"components":[{"internalType":"enumItemType","name":"itemType","type":"uint8"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"identifierOrCriteria","type":"uint256"},{"internalType":"uint256","name":"startAmount","type":"uint256"},{"internalType":"uint256","name":"endAmount","type":"uint256"},{"internalType":"addresspayable","name":"recipient","type":"address"}],"internalType":"structConsiderationItem[]","name":"consideration","type":"tuple[]"},{"internalType":"enumOrderType","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bytes32","name":"zoneHash","type":"bytes32"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes32","name":"conduitKey","type":"bytes32"},{"internalType":"uint256","name":"totalOriginalConsiderationItems","type":"uint256"}],"indexed":false,"internalType":"structOrderParameters","name":"orderParameters","type":"tuple"}],"name":"OrderValidated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32[]","name":"orderHashes","type":"bytes32[]"}],"name":"OrdersMatched","type":"event"}]),
		NFT: new ethers.Interface([{
			"constant": false,
			"inputs": [
				{ "internalType": "address", "name": "to", "type": "address" },
				{ "internalType": "bool", "name": "approved", "type": "bool" }
			],
			"name": "setApprovalForAll",
			"outputs": [],
			"payable": false,
			"stateMutability": "nonpayable",
			"type": "function"
		}]),
		WETH: new ethers.Interface([
			{
				"constant": false,
				"inputs": [{ "name": "wad", "type": "uint256" }],
				"name": "withdraw",
				"outputs": [],
				"payable": false,
				"stateMutability": "nonpayable",
				"type": "function"
			},
		]),
	}
}

//4
const execArb = async (arbData) => {
	//(7/7)
	const _sendBundle = async bundle => {
		const __callBundle = async bundle => {
			const blockToSend = db.var.BLOCK_NUM+1
			const blockNumHash = '0x'+blockToSend.toString(16)

			const body = JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "eth_callBundle",
				params: [{
					txs: bundle,
					blockNumber: blockNumHash,
					stateBlockNumber: "latest"
				}]
			})

			const signature = `${wallet.address}:${(await wallet.signMessage(ethers.id(body)))}`
			const options = {
				method: 'POST',
				body: body,
				headers: {
					'Content-Type': 'application/json',
					"X-Flashbots-Signature": signature
				}
			};

			const data = await apiCall({url: "https://relay.flashbots.net", options: options})
			console.log('\n>>>Bundle call data:', data)
			console.log('\n>>>Result:', data.result)
		}

		if(TEST_MODE) {
			await __callBundle(bundle)
			return
		}
		console.log('bug in send')
		return
		for (const url of db.api.builders) {
			for(let i=1;i<db.var.BUNDLE_MAX_BLOCK;i++){
				const blockToSend = db.var.BLOCK_NUM+i
				const blockNumHash = '0x'+blockToSend.toString(16)

				const body = JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "eth_sendBundle",
					params: [{
						txs: bundle,
						blockNumber: blockNumHash
					}]
				})

				const signature = `${wallet.address}:${(await wallet.signMessage(ethers.id(body)))}`
				const options = {
					method: 'POST',
					body: body,
					headers: {
						'Content-Type': 'application/json',
						"X-Flashbots-Signature": signature
					}
				};

				apiCall({url, options: options}) //don't w8 4response
			}
		}

		await __callBundle(bundle)
	}

	//(6/7)
	const _getBundle = async (_buyBlurData, _sellOsData, _estProfitGross) => {
		const __getConduitAddr = _conduitKey => {
			const addr_in_hash = ethers.solidityPackedKeccak256(
				['bytes1', 'address', 'bytes32', 'bytes32'],
				[
					'0xff',
					db.addr.CONDUCIT_CONTROLER,
					_conduitKey,
					db.var.CONDUCIT_CODE_HASH
				]
			);

			const addr_conduict = ethers.getAddress(ethers.dataSlice(addr_in_hash, 12))
			return addr_conduict
		};

		const __signTx = async ({data, to, value, gasLimit, nonce}) => {
			return await wallet.signTransaction({
				to: to,
				data: data,
				value: value,
				nonce: nonce,
				gasLimit: gasLimit,
				type: 2,
				chainId: 1,
				maxFeePerGas: db.var.FEE.maxFeePerGas,
				maxPriorityFeePerGas: db.var.FEE.maxPriorityFeePerGas,
			})
		}

		console.log('\nPreparing unsigned TXs...')
		const nonce = await provider.getTransactionCount(wallet.address)
		const sell_os_params = _sellOsData?.transaction?.input_data?.parameters
		const addr_conduict = __getConduitAddr(sell_os_params.offererConduitKey)
		const tx1_to = _buyBlurData?.buys[0]?.txnData?.to

		//values
		const tx1_value = BigInt(_buyBlurData?.buys[0]?.txnData?.value?.hex)

		let tx4_amt_withdrawETH = tx1_value+_estProfitGross
		let tx5_value = (_estProfitGross * db.var.VALIDATOR_FEE_BPS) / 10000n

		if (TEST_MODE){
			tx4_amt_withdrawETH = tx1_value
			tx5_value = 7n
		}

		const estProfitNet = _estProfitGross - tx5_value

		if(!TEST_MODE && estProfitNet<=0n) {
			console.log('\n\x1b[38;5;202m Profit 2small: _getBundleType, estProfitNet<=0n\x1b[0m', ethers.formatEther(estProfitNet));
			return false
		}

		//calldata
		const tx1_calldata = _buyBlurData?.buys[0]?.txnData?.data
		const tx2_calldata = db.interface.NFT.encodeFunctionData('setApprovalForAll', [addr_conduict, true])
		const tx3_calldata = db.interface.SEAPORT.encodeFunctionData(_sellOsData?.transaction?.function, [sell_os_params])
		const tx4_calldata = db.interface.WETH.encodeFunctionData('withdraw', [tx4_amt_withdrawETH])

		const tx1_buyBlur = {
			to: tx1_to,
			data: tx1_calldata,
			value: tx1_value,
			gasLimit: db.var.EST_GAS_SWAP, //_buyBlurData.buys[0].gasEstimate+10000,
			nonce: nonce
		}

		const tx2_approveConduict = {
			to: sell_os_params.considerationToken, //check if same as b4
			data: tx2_calldata,
			value: 0,
			gasLimit: db.var.EST_GAS_APPROVE_NFT,
			nonce: nonce+1
		}

		const tx3_sellOs = {
			to: db.addr.SEAPORT, //hardcode to avoid surprises
			data: tx3_calldata,
			value: 0,
			gasLimit: db.var.EST_GAS_SWAP,
			nonce: nonce+2
		}

		const tx4_withdrawETH = {
			to: db.addr.WETH,
			data: tx4_calldata,
			value: 0,
			gasLimit: db.var.EST_GAS_WITHDRAW_WETH,
			nonce: nonce+3
		}

		let tx5_sendToCoinbase = null
		if(db.var.VALIDATOR_FEE_BPS > 0n) {
			tx5_sendToCoinbase = {
				to: db.addr.COINBASE,
				data: '0x',
				value: tx5_value,
				gasLimit: db.var.EST_GAS_COINBASE,
				nonce: nonce+4
			}
		}

		console.log('\nSigning TXs...')
		const signed_tx1_buyBlur = await __signTx(tx1_buyBlur)
		const signed_tx2_approveConduict = await __signTx(tx2_approveConduict)
		const signed_tx3_sellOs = await __signTx(tx3_sellOs)
		const signed_tx4_withdrawETH = await __signTx(tx4_withdrawETH)
		const signed_tx5_sendToCoinbase = tx5_sendToCoinbase ? await __signTx(tx5_sendToCoinbase) : null

		console.log('\nBundling TXs...')
		const bundle = [
			signed_tx1_buyBlur,
			signed_tx2_approveConduict,
			signed_tx3_sellOs,
			signed_tx4_withdrawETH,
		]

		if(signed_tx5_sendToCoinbase) bundle.push(signed_tx5_sendToCoinbase)

		const nft_addr = _buyBlurData?.buys[0]?.includedTokens[0]?.contractAddress
		const nft_id = _buyBlurData?.buys[0]?.includedTokens[0]?.tokenId
		console.log(`\n\n\x1b[32m
			Attempting to execute arb with estProfitNet: ${ethers.formatEther(estProfitNet)} ETH
			for: https://etherscan.io/nft/${nft_addr}/${nft_id}
			\x1b[0m`
		);
		return bundle
	}

	//(5/7)
	const _validateArb = async (sellTo, buyBlurData, sellOsData) => {
		const buyLowBlurPrice = BigInt(buyBlurData.buys[0].txnData.value.hex)

		// (if buyLowBlurPrice > db.var.MAX_NOT_WHITELISTED) check if collection whitelisted

		let sellHighOsPrice = BigInt(sellOsData.transaction.input_data.parameters.offerAmount) //re-check
		for(const osFee of sellOsData?.orders[0]?.parameters?.consideration){
			sellHighOsPrice -= BigInt(osFee.endAmount) //@todo for diff order type than basic, need to calc based on time
		}

		const estProfitGross = sellHighOsPrice - buyLowBlurPrice - db.var.MIN_PROFIT;

		if(!TEST_MODE && estProfitGross<=0n) {
			console.log('\n\x1b[38;5;202m Profit 2small: _validateArb, estProfitGross<=0n\x1b[0m', ethers.formatEther(estProfitGross));
			return false
		}

		//validate NFT addr
		if(
			(
				ethers.getAddress(sellTo.payload?.protocol_data?.parameters?.consideration[0]?.token)
				!==
				ethers.getAddress(sellOsData?.transaction?.input_data.parameters.considerationToken)
			)
				||
			(
				ethers.getAddress(sellOsData?.transaction?.input_data.parameters.considerationToken)
				!==
				ethers.getAddress(buyBlurData?.buys[0]?.includedTokens[0]?.contractAddress)
			)
		) {
			console.error(
				`\n\x1b[38;5;202mERR: _validateArb, NFT ADDR not same!
				\npayload: ${sellTo.payload}
				\nsellOsData: ${sellOsData}
				\nbuyBlurData: ${buyBlurData}\x1b[0m`
			);
			return false
		}

		//validate NFT id
		if(
			(
				sellTo.payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria
				!==
				sellOsData?.transaction?.input_data?.parameters?.considerationIdentifier
			)
				||
			(
				sellOsData?.transaction?.input_data?.parameters?.considerationIdentifier
				!==
				buyBlurData?.buys[0]?.includedTokens[0]?.tokenId
			)
		) {
			console.error(
				`\n\x1b[38;5;202mERR: _validateArb, NFT ID not same!
				\npayload: ${sellTo.payload}
				\nsellOsData: ${sellOsData}
				\nbuyBlurData: ${buyBlurData}\x1b[0m`
			);
			return false
		}

		//check os addr to
		if(ethers.getAddress(sellOsData?.transaction?.to) !== db.addr.SEAPORT) {
			console.error(
				`\n\x1b[38;5;202mERR: _validateArb, addrTo not to SEAPORT 1.4., instead: ${sellOsData?.transaction?.to}\x1b[0m`);
			return false
		}

		return estProfitGross
	}

	//(4/7)
	const _getSellOsData = async (addr, id, sellTo) => {
		console.log('Getting sell data from OS...')

		db.api.os.bidData.options.body = JSON.stringify({
			offer: {
				hash: sellTo.payload.order_hash,
				chain: 'ethereum', //sellTo.payload.item?.chain?.name,
				protocol_address: db.addr.SEAPORT //sellTo.payload?.protocol_address
			},
			fulfiller: {
				address: wallet?.address,
			},
			consideration: {
				asset_contract_address: addr,
				token_id: id
			}
		})

		console.time('sellOsData')
		const sellOsData = (await apiCall(db.api.os.bidData))?.fulfillment_data ?? false;
		console.timeEnd('sellOsData')
		// console.log('\nsellOsData', sellOsData)
		// console.log('\nsellOsData.transaction.input_data', sellOsData.transaction.input_data)
		// console.log('\nsellOsData.transaction.input_data.parameters.additionalRecipients', sellOsData.transaction.input_data.parameters.additionalRecipients)
		// console.log('\nsellOsData.transaction.input_data.parameters.additionalRecipients', sellOsData.transaction.input_data.parameters.additionalRecipients)
		// console.log('\nsellOsData.orders[0]', sellOsData.orders[0])
		// console.log('\nsellOsData.orders, consideration', sellOsData.orders[0].parameters.consideration)
		return sellOsData
	}

	//(3/7)
	const _getBuyBlurData = async (addr, id, buyFrom) => {
		const url = `http://127.0.0.1:3000/v1/buy/${addr.toLowerCase()}?fulldata=true`;

		db.api.blur.options.POST.body = JSON.stringify({
			tokenPrices: [
				{
					isSuspicious: false, //tknIdBlurData.token.isSuspicious,
					price: {
						amount: buyFrom.price.amount, //tknIdBlurData.token.price.amount,
						unit: "ETH", //tknIdBlurData.token.price.unit,
					},
					tokenId: id //tknIdBlurData.token.tokenId,
				},
			],
			userAddress: wallet.address,
		});

		console.log('\nGetting buy data from Blur...')
		console.time('buyFromBlurData')
		const buyFromBlurData = await apiCall({url, options: db.api.blur.options.POST})
		console.timeEnd('buyFromBlurData')
		return buyFromBlurData
	}

	// //(2/7) probably don't need cuz now getting full mplace data
	// const _getMarketplace = async (addr, id, buyFrom) => {
	// 	if (buyFrom.marketplace) return buyFrom.marketplace

	// 	console.log('\nMaking a call to get marketplace...')
	// 	const url = `http://127.0.0.1:3000/v1/collections/${addr.toLowerCase()}/tokens/${id}`
	// 	const data = await apiCall({ url, options: db.api.blur.options.GET });
	// 	console.log('\n...marketplace:', data?.token?.price?.marketplace)
	// 	return data?.token?.price?.marketplace
	// }

	//(1/7)
	const _preValidate = async (_arbData) => {
		const buyFrom = _arbData[0]
		const sellTo = _arbData[1]
		// buyFrom - 'xxx'
		// sellTo - {event_type: 'item_received_bid', payload: {...}, signature: null, priceNet: ''}
		const addr = ethers.getAddress(sellTo.payload?.protocol_data?.parameters?.consideration[0]?.token);
		const id = sellTo.payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;


		//@todo detect types of buyFrom (e.g. new sales, or getNFT check)
		const buyFromPrice = ethers.parseEther(buyFrom.price.amount)
		const sellToPrice = ethers.parseEther(sellTo.priceNet)

		if(buyFromPrice > db.var.CURR_WALLET_BALANCE) {
			return //can't afford to buy
		}

		const preEstProfitGross = sellToPrice - buyFromPrice - db.var.MIN_PROFIT;

		if(preEstProfitGross<=0n) {
			return //@todo add to queue & each when fees are low, check if can execute profitable (and delete once expired)
		}

		return [
			addr,
			id,
			buyFrom,
			sellTo
		]
	}

	//(0/7)
	for(let i = 0; i < arbData.length; i++) {
		const [ addr, id, buyFrom, sellTo] = await _preValidate(arbData[i]) ?? [];
		if (!addr) return

		//@todo update ↓↓↓ when dex-dex, probably don't need anymore, but ensure
		// const marketplace = await _getMarketplace(addr, id, buyFrom)
		// if(marketplace!=='BLUR') return

		const buyBlurData = await _getBuyBlurData(addr, id, buyFrom) ?? {};
		if(!buyBlurData) return

		const sellOsData = await _getSellOsData(addr, id, sellTo) ?? {};
		if(!sellOsData) return

		const estProfitGross = await _validateArb(sellTo, buyBlurData, sellOsData)
		if(!estProfitGross) return

		const bundle = await _getBundle(buyBlurData, sellOsData, estProfitGross) ?? {};
		if(!bundle) return

		await _sendBundle(bundle)
	}
}

//3
const getArbDataFromDB_full = async () => {
	// if(db.var.STARTED) return false //4test interval
	// db.var.STARTED = true
	try {
		await mongoClient.connect();
		console.log('Connected to MongoDB');

		const dbBids = mongoClient.db('BOT_NFT').collection('BIDS');

		const streamSales = dbSales.watch();

		const dbSales = mongoClient.db('BOT_NFT').collection('SALES');
		const streamBids = dbBids.watch();

		streamSales.on('change', async (sale) => {
			const matchingBids = await dbBids.find({
				$and: [
					{ id: sale.fullDocument?.tokenId },
					{ id: db.var.TEST_NFT_ID },
					{
						addr: {
							$regex: sale.fullDocument?.contractAddress,
							$options: 'i', // Case-insensitive flag
						},
					},
					{
						addr: {
							$regex: db.var.TEST_NFT,
							$options: 'i', // Case-insensitive flag
						},
					},
				],
			}).toArray();

			const salePriceBigInt = BigInt(sale.fullDocument.price);
			const filteredBids = matchingBids.filter(bid => {
				const bidPriceBigInt = BigInt(bid.priceNet);
				return bidPriceBigInt > salePriceBigInt;
			});

			// If matching documents are found in the dbBids collection, log the sale and process them
			if (filteredBids.length > 0) {
				console.log('\nFound matching bids in streamSales:', sale);
				filteredBids.forEach(matchingBid => {
					// Process each matching bid here
					console.log('Matching bid:', matchingBid);
				});
			}
		});

		streamBids.on('change', async (bid) => {
			const matchingSales = await dbSales.find({
				$and: [
					{ tokenId: bid.fullDocument?.id },
					{ tokenId: db.var.TEST_NFT_ID },
					{
						contractAddress: {
							$regex: bid.fullDocument?.addr,
							$options: 'i', // Case-insensitive flag
						},
					},
					{
						contractAddress: {
							$regex: db.var.TEST_NFT,
							$options: 'i', // Case-insensitive flag
						},
					},
				],
			}).toArray();

			const bidPriceBigInt = BigInt(bid.fullDocument.priceNet);
			const filteredSales = matchingSales.filter(sale => {
				const salePriceBigInt = BigInt(sale.price);
				return salePriceBigInt < bidPriceBigInt;
			});

			if (filteredSales.length > 0) {
				console.log('\nFound matching sales in streamBids:', bid);
				filteredSales.forEach(matchingSale => {
					console.log('Matching sale:', matchingSale);
				});
			}
		}
	);

	} catch (err) {
		console.error('Failed to connect to MongoDB', err);
	}
}

const subBidsOs = async () => {
	const handleBasicOffer = async (event) => {
			if (event.payload?.item?.chain?.name !== "ethereum") return;

			const addr = ethers.getAddress(
					event.payload?.protocol_data?.parameters?.consideration[0]?.token
			);
			const id = event.payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;

			if(TEST_MODE){
					if (addr !== db.var.TEST_NFT || id !== db.var.TEST_NFT_ID) return
					console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE OS BIDS\x1b[0m`)
			}

			let sellToPrice = BigInt(event.payload.base_price);

			for (const osFeeData of event.payload?.protocol_data?.parameters.consideration) {
					if (osFeeData.itemType <= 1) {
							//0: ETH, 1: ERC20, 2: ERC721...
							sellToPrice -= BigInt(osFeeData.startAmount);
					}
			}

			if(!TEST_MODE && sellToPrice <= db.var.MIN_SELL_TO_PRICE) return; //2small

			//@todo: get data from db about blur sale, check price & exec arb
			const matchingSales = db.var.SALES.find(sale => {
					return sale.tkn_addr === addr && sale.tkn_id === id;
			}).sort((a, b) => {
					return BigInt(a.price) - BigInt(b.price);
			})


			if(!matchingSales.length) return; //2no matching sales
			// const filteredSales = matchingSales.filter(sale => {
			// 	const salePriceBigInt = BigInt(sale.price);
			// 	return salePriceBigInt < sellToPrice;
			// });

			// if(!filteredSales.length) return; //2no matching sales

			// console.log(`\n\x1b[38;5;202mFOUND MATCHING SALES\x1b[0m: ${filteredSales}`)
			// for (const sale of filteredSales) {
			// 	await execArb(sale, event);
			// }
	};

	const handleCollectionOffer = async (event) => {
			//@todo add to db
	};

	const handleTraitOffer = async (event) => {
			//@todo add to db
	};

	const handleItemListed = async (event) => {
			//@todo add to db
	};

	//→→→ STARTS HERE ←←←
	try {
			osClient.onEvents("*", db.var.OS_SUB_EVENTS, async event => {
					process.stdout.write(`\r\x1b[38;5;12mSUBSCRIBE OS BIDS\x1b[0m: ${++db.var.count}`);

					switch (event.event_type) {
							case EventType.ITEM_RECEIVED_BID:
									handleBasicOffer(event);
									break;
							// case EventType.COLLECTION_OFFER:
							//     handleCollectionOffer(event);
							//     break;
							// case EventType.TRAIT_OFFER:
							//     handleTraitOffer(event);
							//     break;
							// case EventType.ITEM_LISTED:
							//     handleItemListed(event);
							//     break;
					}
			});
	} catch (e) {
			console.error("ERR: subscribeSells", e);
			await subBidsOs();
	}
};

//2
const subscribeBlocks = async () => {
	try{
		provider.on('block', async blockNum => { //for next
			db.var.BLOCK_NUM = blockNum
			db.var.FEE = await provider.getFeeData()
			db.var.CURR_WALLET_BALANCE = await provider.getBalance(wallet.address)
			db.var.MIN_PROFIT = db.var.EST_GAS_FOR_ARB * (db.var.FEE.maxFeePerGas + db.var.FEE.maxPriorityFeePerGas)

			if (db.var.CURR_WALLET_BALANCE < db.var.PREV_WALLET_BALANCE) {
				console.error(
					`\n\x1b[38;5;202mBALANCE DECREASED\x1b[0m` +
					'from', ethers.formatEther(db.var.PREV_WALLET_BALANCE)+
					'to', ethers.formatEther(db.var.CURR_WALLET_BALANCE),
					'\n'
				)
				process.exit()
			}
			db.var.PREV_WALLET_BALANCE = db.var.CURR_WALLET_BALANCE
		})
	} catch (e) {
		console.error('\nERR: subscribeBlocks', e)
		await subscribeBlocks();
	}
}

//1
const setup = async () => {
	/// SETUP BLOCK DATA ///
	db.var.BLOCK_NUM = await provider.getBlockNumber()
	db.var.FEE = await provider.getFeeData()
	db.var.CURR_WALLET_BALANCE = await provider.getBalance(wallet.address)
	db.var.MIN_PROFIT = db.var.EST_GAS_FOR_ARB * (db.var.FEE.maxFeePerGas + db.var.FEE.maxPriorityFeePerGas)

	/// SETUP BLUR AUTH TKN ///
	const dataToSign = await apiCall({url: db.api.blur.url.AUTH_GET, options: db.api.blur.options.AUTH})
	dataToSign.signature = await wallet.signMessage(dataToSign.message)
	db.api.blur.options.AUTH.body = JSON.stringify(dataToSign)
	db.var.BLUR_AUTH_TKN = (await apiCall({url: db.api.blur.url.AUTH_SET, options: db.api.blur.options.AUTH})).accessToken

	/// SETUP BLUR API OPTIONS ///
  db.api.blur.options.GET = {
    method: 'GET',
    headers: {
      authToken: db.var.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
			"content-type": "application/json"
    },
  };

  db.api.blur.options.POST = {
    method: 'POST',
    headers: {
			redirect: 'follow',
      authToken: db.var.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
			"content-type": "application/json",
			body: {}, //pass buy data
    },
  };

	await mongoClient.connect();
	db.var.SALES = mongoClient.db('BOT_NFT').collection('SALES');
}

//0
const apiCall = async ({url, options}) => {
	let res;
	await fetch(url, options)
		.then((response) => response.json())
		.then(json => (res = JSON.parse(JSON.stringify(json))))
		.catch((error) => console.error(error));
	return res
};

;(async function root() {
	try {
		await setup() //1-time
		subscribeBlocks()
		//sub os bids here, then for each new read sale from db, check arb & exec

		//\/ get new sale/bid, get sale/bid from db, check arb, exec
		await getArbDataFromDB_full()
	} catch (e) {
		console.error('\nERR: root:', e)
		await root()
	}
})();