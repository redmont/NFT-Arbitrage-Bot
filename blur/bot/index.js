const {OpenSeaStreamClient, EventType} = require('@opensea/stream-js');
const fetch = require('node-fetch');
const {WebSocket} = require('ws');
const ethers = require('ethers');

const provider = new ethers.AlchemyProvider("homestead", process.env.API_ALCHEMY);
const wallet = new ethers.Wallet(process.env.PK_0, provider);
const osClient = new OpenSeaStreamClient({
  token: process.env.API_OS,
	networkName: 'mainnet',
  connectOptions: {
    transport: WebSocket
  }
});

const TEST_MODE = true;

/****
 *** @t0d0: Bot: Blur low, Sell OS high.
 * 		[x] DB (for all ids)
 * 				[x] subscribe block
 * 				[x] getSells (blur)
 * 				[x] getBuys (os, only basic type orders)
 * 		    [x] getFloors (all)
 * 				[x] getAllIds (all)
 * 		[x] Exec:
 * 				[x] Get buyBlur, sellOs payloads
 * 			  [x] Bundle
 * 						[x] get unsigned tx
 * 								[ ] if NFT already approved, don't approve
 * 								[ ] if WETH amt small, don't withdraw
 * 								[ ] if insufficient funds4 VALIDATOR fee, do tx5 & via contract coinbase.tx
 *            [x] Sign TXs
 * 						[x] Send bundle
 * 						[x] add more builders into db.api.builders[]
 *
 *** @l0ngt3rm:
 *    [ ] separate db
 * 		[ ] subOs "collection" & "trait" offers
 * 		[ ] if blur price change, check os bids
 * 		[ ] Listen to sales on OS
 * 		[ ] New Marketplaces DEX-DEX (Sudo, Rare ...)
 * 		[ ] Get sales data from pro.opensea.com API
 * 		[ ] conisder sending via type0
 *
 *** @t0t3st:
 * 		[x] TestCase ():
 * 				[ ] run the bot
 * 				[ ] from 0x7, manually create sell low on blur for 0.002 ETH
 * 						link: https://blur.io/portfolio
 * 				[ ] from 0xf, manually create buy high on os for 0.003 ETH
 * 					  link: https://opensea.io/assets/ethereum/0xa7f551feab03d1f34138c900e7c08821f3c3d1d0/877
 * 				[ ] from 0x0, bot will buy from 0x7, sell to 0xf
 * 		[ ] Check if Blur payment token can be diff than ETH (periodically).
 * 		[ ] Exploiting bundle (what can be done in setApproveForAll, partially bundle exec, cuz silent stop on OS)
 * 		[ ] Check if can pass to bid diff. params to OS bid. (addrTo, conduict, etc.)
 *
 *** 1d34$:
 * 		[ ] Bot version (v1.0.0+: Blur-DEX; v2.0.0+: DEX-DEX)
 * 		[ ] Check if NFTs is in ERC20 DEXs
 * 		[ ] MEV for: https://blur.io/collection/uniswap-v3-positions
 * 		[ ] API from: https://support.opensea.pro/which-marketplaces-does-opensea-pro-support
 */

const db = {
	var: {
		TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',
		TEST_NFT_ID: '877',
		FEE: {},
		BLOCK_NUM: 0,
		BLUR_AUTH_TKN: '',
		ERROR_SLUG: '', //to not loop over all nft ids
		BUNDLE_MAX_BLOCK: 5,
		VALIDATOR_FEE_BPS: 50n, //1bps = 0.01%
		EST_GAS_SWAP: (10n**6n)/2n, //edit later
		EST_GAS_APPROVE_NFT: 10n**5n,
		EST_GAS_WITHDRAW_WETH: 50000n,
		EST_GAS_COINBASE: 50000n,
		EST_GAS_FOR_ARB: (1n*(10n**6n)) + (10n**5n) + (10n**4n), //2x swaps + approveNFT + withdrawETH
		INTERVAL_BLUR_SELL: 100, // 4/sec
		PROGRESS_GET_ID: 0,
		PROGRESS_GET_ID_PERCENT: 0,
		PROGRESS_GET_COLLECTION: 0,
		PROGRESS_GET_COLLECTION_PERCENT: 0,
		OS_BIDS_AMT: 0,
		PREV_WALLET_BALANCE: 0n, //wallet balance (to buy blur)
		CURR_WALLET_BALANCE: 0n, //wallet balance (to buy blur)
		MAX_AMT_NEW_BLUR_SELL_ORDERS: 0, //change new sell orders if blur returns also for os
		MIN_PROFIT: 0n, //@todo setup based on curr gas fees & execData
		CONDUCIT_CODE_HASH: "0x023d904f2503c37127200ca07b976c3a53cc562623f67023115bf311f5805059",
		CONTRACT_COINBASE_BYTECODE: "0x608060405234801561001057600080fd5b5060f68061001f6000396000f3fe608060405236607b5760004173ffffffffffffffffffffffffffffffffffffffff1634604051602c9060ad565b60006040518083038185875af1925050503d80600081146067576040519150601f19603f3d011682016040523d82523d6000602084013e606c565b606091505b5050905080607957600080fd5b005b600080fd5b600081905092915050565b50565b600060996000836080565b915060a282608b565b600082019050919050565b600060b682608e565b915081905091905056fea2646970667358221220b318324f57eb7368bfaa4820006ee407ba10e313a6098cb2304cbf63878d23ed64736f6c63430008130033",
		OS_SUB_EVENTS: [
			EventType.ITEM_RECEIVED_BID,
			// EventType.COLLECTION_OFFER,
			// EventType.TRAIT_OFFER,
		]
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
			bids: {
				url: "https://api.opensea.io/v2/orders/ethereum/seaport/offers?order_by=created_date&order_direction=desc",
				options: {
					method: 'GET',
					headers: {accept: 'application/json', 'X-API-KEY': process.env.API_OS}
				}
			}
		},
		blur: {
			url: {
				AUTH_GET: 'http://127.0.0.1:3000/auth/getToken',
				AUTH_SET: 'http://127.0.0.1:3000/auth/setToken',
				ACTIVITY: `http://127.0.0.1:3000/v1/activity`,
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
	},
	nft: {
		// '0x0': {
		// 	SLUG: 'otherdeed',
		// 	FLOOR: 100,
		// 	DEX: 'BLUR',
		// 	id: {
		// 		'1': {
		// 			PRICE: 100,
		// 			DEX: 'BLUR'
		// 		},
		// 		'2': {
		// 			PRICE: 200,
		// 			DEX: 'OS'
		// 		}
		// 	}
		// },
		// '0x1': ...
	}
}

//////////////////////////////////////
///       SUB-MAIN FUNCTIONS    	 ↓↓↓
//////////////////////////////////////

const apiCall = async ({url, options}) => {
	let res;
	await fetch(url, options)
		.then((response) => response.json())
		.then(json => (res = JSON.parse(JSON.stringify(json))))
		.catch((error) => console.error(error));
	return res
};

const signTx = async ({data, to, value, gasLimit, nonce}) => {
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

const callBundle = async bundle => { //4test
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

const sendBundle = async bundle => {
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
}

////////////////////////////////////////
///          MAIN FUNCTIONS          ↓↓↓
////////////////////////////////////////

const getEachNftId = async () => {
	//↓↓↓ STARTS BELOW ↓↓↓
	const _updateProgress = () => {
		const percent = Math.round((++db.var.PROGRESS_GET_ID / Object.values(db.nft).length) * 100);
		if(percent > 100) percent = 100
		if(percent > db.var.PROGRESS_GET_ID_PERCENT){
			console.log(`\ngetEachNftId completed in ${percent}%`);
		}
		db.var.PROGRESS_GET_ID_PERCENT = percent
	}

	//↓↓↓ STARTS BELOW ↓↓↓
	const _updateDb = async _data => {
		if(!_data.nftPrices) return
		for (const { tokenId, price } of _data.nftPrices) {
			if (price.unit != 'ETH' && price.unit != 'WETH') {
				console.log('\nDetected non ETH/WETH price unit on BLUR!', price.unit)
				console.log('\ndata:', _data)
			}
			const addr = ethers.getAddress(_data.contractAddress);
			const nft = db.nft[addr]?.id?.[tokenId] ?? {DEX: ''}; //read or assign "{}"
			nft.PRICE = ethers.parseEther(price.amount); //set price (reason for try, cuz inputs incorrect)
			db.nft[addr].id[tokenId] = nft; //update or assign
		}
	}

	//↓↓↓ STARTS BELOW ↓↓↓
	const _setUrl = async (data, slug) => {
		const hasAsksFilter = { hasAsks: true };
		const nftPrices = data?.nftPrices || [];

		const filters = nftPrices.length === 0 ? hasAsksFilter : {
			cursor: {
				tokenId: nftPrices[nftPrices.length - 1].tokenId,
				price: { ...nftPrices[nftPrices.length - 1].price },
			},
			...hasAsksFilter
		};

		const url = `http://127.0.0.1:3000/v1/collections/${slug}/prices?filters=${encodeURIComponent(JSON.stringify(filters))}`;
		return url;
	};

	const _validateSlug = async slug => {
		if(!slug)  {
			console.log('found undefined slug')
			return false //cuz new collection was added via subSells that don't have Slug data
		}

		if(db.var.ERROR_SLUG){ //Prevent looping over all again if there is an error (quick fix)
			if (db.var.ERROR_SLUG != slug) return false //loop until find error one
			db.var.ERROR_SLUG = '' //reset
			console.log('reseted slug')
			return false //skip error one
		}
		return true
	}

	//→→→ STARTS HERE ←←←
	console.time('getEachNftId')
	console.log('\x1b[33m%s\x1b[0m', '\nSTARTED COLLECTING EACH NFT ID PRICE');

	try {
		for (const { SLUG } of Object.values(db.nft)) {
			if(!await _validateSlug(SLUG)) continue

			let data = {}
			let countPages = 0 //for collections > 1k

			do {
				const url = await _setUrl(data, SLUG)
				data = await apiCall({ url, options: db.api.blur.options.GET })
				await _updateDb(data)
				countPages += data?.nftPrices?.length
			} while (countPages < data.totalCount)

			_updateProgress()
		}
	} catch (e) {
		console.error('\nERR: getEachNftId', e)
		console.log('\nERROR_SLUG:', SLUG)
		// db.var.ERROR_SLUG = SLUG
		await getEachNftId()
	}

	console.log('\x1b[33m%s\x1b[0m', '\nCOMPLETED COLLECTING EACH NFT ID PRICE');
	console.timeEnd('getEachNftId')
}

const getAllNfts = async () => {
	//↓↓↓ STARTS BELOW ↓↓↓
	const _updateProgress = data => {
		db.var.PROGRESS_GET_COLLECTION+=100
		const percent = Math.round((db.var.PROGRESS_GET_COLLECTION / data.totalCount) * 100);
		percent > 100 ? db.var.PROGRESS_GET_COLLECTION_PERCENT = 100 : db.var.PROGRESS_GET_COLLECTION_PERCENT = percent;
		// if (db.var.PROGRESS_GET_COLLECTION % 1000 === 0) {
		// 	const percent = Math.round((db.var.PROGRESS_GET_COLLECTION / data.totalCount) * 100);
		// 	process.stdout.write(`\n\x1b[95m[38;5;216m\rgetAllNfts completed in ${percent}%\x1b[0m`);
		// }
	}

	//↓↓↓ STARTS BELOW ↓↓↓
	const _updateDb = async nft => {
		const addr = ethers.getAddress(nft?.contractAddress);
		const price = nft?.floorPrice ? ethers.parseEther(nft.floorPrice.amount) : null;

		if (db.nft[addr]) { //update
			db.nft[addr].FLOOR = price;
			db.nft[addr].SLUG = nft.collectionSlug;
		} else if (!db.nft[addr]) { //add new
			db.nft[addr] = {
				SLUG: nft.collectionSlug,
				FLOOR: price,
				DEX: '',
				id: {}, //same as above
			};
		}
	}

	//↓↓↓ STARTS BELOW ↓↓↓
	const _setNewPage = async data => {
		const lastCollection = data.collections[data.collections.length - 1];
		const floorPrice = lastCollection.floorPrice?.amount && lastCollection.floorPrice.amount;

		const filters = {
			cursor: {
				contractAddress: lastCollection.contractAddress,
				floorPrice: floorPrice || null,
			},
			sort: 'FLOOR_PRICE',
			order: 'DESC',
		};

		const filtersURLencoded = encodeURIComponent(JSON.stringify(filters));
		db.api.blur.url.COLLECTIONS = 'http://127.0.0.1:3000/v1/collections/' + '?filters=' + filtersURLencoded
	}

	//↓↓↓ STARTS BELOW ↓↓↓
	const _getAllNfts = async () => {
		try {
			const data = await apiCall({url: db.api.blur.url.COLLECTIONS, options: db.api.blur.options.GET})
			if(!data || data?.collections?.length === 0) return
			_updateProgress(data)

			for (nft of data?.collections) {
				await _updateDb(nft)
			}

			await _setNewPage(data)
			await _getAllNfts()
		} catch(e) {
			console.error('ERR: getAllNfts:', e)
			await _getAllNfts()
		}
	};

	//→→→ STARTS HERE ←←←
	console.time('getAllNfts')
	console.log('\x1b[95m%s\x1b[0m', '\n STARTED COLLECTING NFTs');

	await _getAllNfts()

	console.log('\x1b[95m%s\x1b[0m', '\n FINISHED COLLECTING NFTs, amt:', Object.keys(db.nft).length);
	console.timeEnd('getAllNfts')
}

const subscribeBuys = async () => {
  console.log('\n\x1b[33m Starting OS events subscription...\x1b[0m\n');

	//↓↓↓ STARTS BELOW ↓↓↓
	const _getConduitAddr = _conduitKey => {
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

	//↓↓↓ STARTS BELOW ↓↓↓
	const _preValidateArb = async payload => {
		if (payload?.item?.chain?.name !== 'ethereum') return;

		const addr = ethers.getAddress(payload?.protocol_data?.parameters?.consideration[0]?.token);
		const id = payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;

		if(TEST_MODE) {
			if (addr !== db.var.TEST_NFT || id !== db.var.TEST_NFT_ID) {
				return
			}
			console.log('\n\n\x1b[32m---DETECTED BID_ENTERED---\x1b[0m');
		}

		const nft = db.nft[addr];
		if (!nft?.id[id]) return; //@todo cuz not in db, but if opp high enough can re-check

		const { PRICE: buyLowPrice, DEX } = nft.id[id];
		if(DEX !== 'BLUR' && DEX !== '') return //dismiss for other than Blur and unknown

		let sellHighPrice = BigInt(payload.base_price);

		for (const osFeeData of payload?.protocol_data?.parameters.consideration) {
			if(osFeeData.itemType <= 1) { //0: ETH, 1: ERC20, 2: ERC721...
				sellHighPrice -= BigInt(osFeeData.startAmount)
			}
		}

		const preEstProfitGross = sellHighPrice - buyLowPrice - db.var.MIN_PROFIT;
		if(!TEST_MODE && preEstProfitGross<=0n) return
		console.log('\n---found BASIC arb--- preEstProfitGross:', ethers.formatEther(preEstProfitGross))

		if(!TEST_MODE && db.var.CURR_WALLET_BALANCE < buyLowPrice) {
			console.log('\n..but insufficient balance.')
			console.log(`https://etherscan.io/nft/${addr}/${id}`)
			return //can't afford to buy from blur
		}

		return [
			addr,
			id,
			buyLowPrice
		]
	}

	const _getMarketplace = async (addr, id) => {
		if (db.nft[addr]?.id[id]?.DEX) return db.nft[addr].id[id].DEX;
		console.log('\nMaking a call to get marketplace...')
		const url = `http://127.0.0.1:3000/v1/collections/${addr.toLowerCase()}/tokens/${id}`
		const data = await apiCall({ url, options: db.api.blur.options.GET });
		console.log('\n...marketplace:', data?.token?.price?.marketplace)
		return data?.token?.price?.marketplace
	}

	//↓↓↓ STARTS BELOW ↓↓↓
	const _getBuyBlurData = async (addr, id, price) => { //4now here
		const url = `http://127.0.0.1:3000/v1/buy/${addr.toLowerCase()}?fulldata=true`;

		db.api.blur.options.POST.body = JSON.stringify({
			tokenPrices: [
				{
					isSuspicious: false, //tknIdBlurData.token.isSuspicious,
					price: {
						amount: ethers.formatEther(price), //tknIdBlurData.token.price.amount,
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

	//↓↓↓ STARTS BELOW ↓↓↓
	const _getSellOsData = async (addr, id, payload) => {
		console.log('Getting sell data from OS...')

		db.api.os.bidData.options.body = JSON.stringify({
			offer: {
				hash: payload.order_hash,
				chain: 'ethereum', //payload.item?.chain?.name,
				protocol_address: db.addr.SEAPORT //payload?.protocol_address
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

	//↓↓↓ STARTS BELOW ↓↓↓
	const _validateArb = async (payload, buyBlurData, sellOsData) => {
		const buyLowBlurPrice = BigInt(buyBlurData.buys[0].txnData.value.hex)

		// (if buyLowBlurPrice > db.var.MAX_NOT_WHITELISTED) check if collection whitelisted

		let sellHighOsPrice = BigInt(sellOsData.transaction.input_data.parameters.offerAmount)

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
				ethers.getAddress(payload?.protocol_data?.parameters?.consideration[0]?.token)
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
				\npayload: ${payload}
				\nsellOsData: ${sellOsData}
				\nbuyBlurData: ${buyBlurData}\x1b[0m`
			);
			return false
		}

		//validate NFT id
		if(
			(
				payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria
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
				\npayload: ${payload}
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

	//↓↓↓ STARTS BELOW ↓↓↓
	const _getBundle = async (_buyBlurData, _sellOsData, _estProfitGross) => {
		console.log('\nPreparing unsigned TXs...')
		const nonce = await provider.getTransactionCount(wallet.address)
		const sell_os_params = _sellOsData?.transaction?.input_data?.parameters
		const addr_conduict = _getConduitAddr(sell_os_params.offererConduitKey)
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
		const signed_tx1_buyBlur = await signTx(tx1_buyBlur)
		const signed_tx2_approveConduict = await signTx(tx2_approveConduict)
		const signed_tx3_sellOs = await signTx(tx3_sellOs)
		const signed_tx4_withdrawETH = await signTx(tx4_withdrawETH)
		const signed_tx5_sendToCoinbase = tx5_sendToCoinbase ? await signTx(tx5_sendToCoinbase) : null

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

	//↓↓↓ STARTS BELOW ↓↓↓
  const handleBasicOffer = async ({payload}) => {
		try {
			const [ addr, id, buyLowPrice ] = await _preValidateArb(payload) ?? [];
			if (!addr) return

			const marketplace = await _getMarketplace(addr, id)
			if(marketplace!=='BLUR') return

			const buyBlurData = await _getBuyBlurData(addr, id, buyLowPrice) ?? {};
			if(!buyBlurData) return

			const sellOsData = await _getSellOsData(addr, id, payload) ?? {};
			if(!sellOsData) return

			const estProfitGross = await _validateArb(payload, buyBlurData, sellOsData)
			if(!estProfitGross) return

			const bundle = await _getBundle(buyBlurData, sellOsData, estProfitGross) ?? {};
			if(!bundle) return

			if(!TEST_MODE) {
				console.log('\nSending bundle...')
				await sendBundle(bundle)
			}
			console.log('\nCalling bundle...')
			await callBundle(bundle)
		} catch (e) {
			console.error('ERR, handleBasicOffer:', e)
		}
  };

	//↓↓↓ STARTS BELOW ↓↓↓ @todo
	const handleCollectionOffer = async ({payload}) => {
		// return //@todo
		const addr = payload?.protocol_data?.parameters?.consideration[0]?.token;
		const id = payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;

    const nft = db.nft[ethers.getAddress(addr)];
    if (!nft[addr]) return;
    const { FLOOR } = nft.id[id];
    const bidPrice = BigInt(payload.base_price);
    const profit = bidPrice - FLOOR - db.MIN_PROFIT;
		if(profit <= 0n) return
		console.log('\x1b[32m\n---found COLLECTION_OFFER arb---, profit:', ethers.formatEther(profit), '\x1b[0m');
		return //@todo

		db.api.os.bidData.options.body = JSON.stringify({
			offer: {
				hash: payload?.order_hash,
				chain: 'ethereum',
				protocol_address: payload?.protocol_address
			},
			fulfiller: {
				"address": wallet?.address,
			},
			consideration: {
				"asset_contract_address": addr,
				"token_id": id
			}
		})

		// const fulfillment_data = (await apiCall(db.api.os.bidData)).fulfillment_data
		console.log('fulfillment_data input', fulfillment_data.transaction.input_data.parameters)
		// console.log('fulfillment_data orders', fulfillment_data.orders[0].parameters)
  };

	//↓↓↓ STARTS BELOW ↓↓↓ @todo
  const handleTraitOffer = async ({payload}) => {
		// return // @todo
		const addr = payload?.protocol_data?.parameters?.consideration[0]?.token;
		const id = payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;
    const nft = db.nft[ethers.getAddress(addr)];
		if (!nft[addr]) return;
    const profit = BigInt(base_price) - nft.FLOOR;
		if(profit <= 0n) return
    console.log('\x1b[32m\n---found TRAIT_OFFER arb, profit:', ethers.formatEther(profit), '\x1b[0m');
		return //@todo
  };

	//→→→ STARTS HERE ←←←
	try{
		osClient.onEvents('*', db.var.OS_SUB_EVENTS, async event => {
			switch (event.event_type) {
				case EventType.ITEM_RECEIVED_BID:
					handleBasicOffer(event);
					break;
				case EventType.COLLECTION_OFFER:
					handleCollectionOffer(event);
					break;
				case EventType.TRAIT_OFFER:
					handleTraitOffer(event);
					break;
			}

			//4vps
			if(++db.var.OS_BIDS_AMT % 100000 === 0) {
				console.log('\n\n\x1b[32m---BIDS AMT---\x1b[0m', db.var.OS_BIDS_AMT)
				console.log('\x1b[32m---NFT AMT---\x1b[0m', Object.keys(db.nft).length)
				console.log('\x1b[32m---BLOCK NUM---\x1b[0m', db.var.BLOCK_NUM)
				console.log('\x1b[32m---MAX_AMT_NEW_BLUR_SELL_ORDERS---\x1b[0m', db.var.MAX_AMT_NEW_BLUR_SELL_ORDERS)
				console.log('\x1b[32m---MIN_PROFIT---\x1b[0m', Number(ethers.formatEther(db.var.MIN_PROFIT)).toFixed(2))
			}

			//4local
			// process.stdout.write(
			// 	`\r` +
			// 	`osBidsAmt: ${"\x1b[38;5;33m"}${++db.var.OS_BIDS_AMT}${"\x1b[0m"}` +
			// 	` | ` +
			// 	`nftAmt: ${Object.keys(db.nft).length}` +
			// 	` | ` +
			// 	`currBlock: ${db.var.BLOCK_NUM}` +
			// 	` | ` +
			// 	`maxDiffSellBlur: ${"\x1b[38;5;208m"}${db.var.MAX_AMT_NEW_BLUR_SELL_ORDERS}${"\x1b[0m"}` +
			// 	` | ` +
			// 	`minProfit: ${Number(ethers.formatEther(db.var.MIN_PROFIT)).toFixed(2)}` +
			// 	` | ` +
			// 	`NFTs completed: ${db.var.PROGRESS_GET_COLLECTION_PERCENT}%` +
			// 	` | ` +
			// 	`NFT IDs completed: ${db.var.PROGRESS_GET_ID_PERCENT}%` +
			// 	`\x1b[0m`
			// );
		});
	} catch (e) {
		console.error('ERR: subscribeSells', e)
		await subscribeSells()
	}
};

const subscribeSells = async () => {
	console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE BLUR SELL ORDERS\x1b[0m`);
	let prevOrders = new Set(); //needs that, cuz Blur returns "currOrders" in semi-random order.

	//↓↓↓ STARTS BELOW ↓↓↓
	const _handleNewOrder = async order => { //@todo in future might check bids & compare
		const addr = ethers.getAddress(order.contractAddress)
		const price = ethers.parseEther(order.price.amount)

		//4test
		if (TEST_MODE && addr == db.var.TEST_NFT && order.tokenId == db.var.TEST_NFT_ID) {
			console.log('\n DETECTED Blur sell!')
		}

		switch (true) {
			case !db.nft[addr]: //if collection not in db, add.
				db.nft[addr] = {
					SLUG: '', //to add in getAllNfts or other call
					FLOOR: price,
					DEX: order.marketplace,
					id: {
						[order.tokenId]: {
							PRICE: price,
							DEX: order.marketplace
						}
					}
				};
				break;
			case price < db.nft[addr].FLOOR: //update collection floor (if lowest), then...
				db.nft[addr].FLOOR = price;
				db.nft[addr].DEX = order.marketplace;
			case !db.nft[addr].id[order.tokenId]: //if id not in db, add.
				db.nft[addr].id[order.tokenId] = {
					PRICE: price,
					DEX: order.marketplace
				};
				break
			default: //if id in db, update.
				db.nft[addr].id[order.tokenId].PRICE = price
				break;
		}

		if (TEST_MODE && addr == db.var.TEST_NFT && order.tokenId == db.var.TEST_NFT_ID) {
			console.log('\n db collection after ', db.nft[addr])
			console.log('\n db id after', db.nft[addr].id[order.tokenId])
		}
	}

	//→→→ STARTS HERE ←←←
	try {
		while (true){
			const currOrders = (await apiCall({ url: db.api.blur.url.ACTIVITY, options: db.api.blur.options.GET })).activityItems || [];
			const newOrders = currOrders.filter(order => !prevOrders.has(order.id));

			if (newOrders.length > db.var.MAX_AMT_NEW_BLUR_SELL_ORDERS && prevOrders.size > 0) {
				db.var.MAX_AMT_NEW_BLUR_SELL_ORDERS = newOrders.length
				console.log(`\x1b[38;5;202m  NEW MAX_AMT_NEW_BLUR_SELL_ORDERS: ${db.var.MAX_AMT_NEW_BLUR_SELL_ORDERS}\x1b[0m`);
			}

			newOrders.forEach(order => _handleNewOrder(order));
			prevOrders = new Set(currOrders.map(order => order.id));

			const toWait = Math.max(0, -10 * newOrders.length + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
			await new Promise(resolve => setTimeout(resolve, toWait));
		}
	} catch (e) {
		console.error('\nERR: subscribeSells', e)
		await subscribeSells();
	}
}

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
}

////////////////////////////////////////
///              START               ↓↓↓
////////////////////////////////////////

(async function root() {
	try {
		await setup() //1-time

		subscribeBlocks() //to get curr. fees, balance, blockNum
		subscribeSells() //to buy low on blur & add new 4sale NFTs
		subscribeBuys() //to sell high on os (only here exec arb)

		await getAllNfts() //1-time (~1m)
		await getEachNftId() //1-time (~1h)
	} catch (e) {
		console.error('\nERR: root:', e)
		await root()
	}
})();