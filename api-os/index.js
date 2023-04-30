const ethers = require('ethers');
const fetch = require('node-fetch');

const provider = new ethers.AlchemyProvider("homestead", process.env.API_ALCHEMY);
const wallet = new ethers.Wallet(process.env.PK_0, provider);


const apiCall = async ({url, options}) => {
	var res;
	await fetch(url, options)
		.then((response) => response.json())
		// .then(response => console.log(response))
		.then(json => (res = JSON.parse(JSON.stringify(json))))
		.catch((error) => console.error(error));
	return res
};


const getOsBids = async () => {
	const queryParams = new URLSearchParams({
		chain: "ETHEREUM",
		count: "20"
		// event_types: "OFFER_ENTERED"
	});

	const options = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	};

	var url = 'http://127.0.0.1:3001/v1/allorders?' + queryParams
	// var url = 'http://127.0.0.1:3001/v1/allorders'
	const bids_os = await apiCall({url: url, options: options})
	return bids_os
}

const auth = async () => {
	const options = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		// chain: "ETHEREUM",
		// walletAddress: wallet.address
	};

	var url = `http://127.0.0.1:3001/auth/getToken`;

	const authTkn = await apiCall({url: url, options: options})
	return authTkn
}

const getPayload = async (authTkn, variables) => {
	// console.log(authTkn)
	const options = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"authtkn": authTkn,
			"variables": JSON.stringify(variables)
		},
	};

	var url = `http://127.0.0.1:3001/v1/getPayload`;
	const payload = await apiCall({url: url, options: options})
	return payload
}

const getSell = async (authTkn) => {
	const collection = '0x5b11fe58a893f8afea6e8b1640b2a4432827726c'
	const id = '1033'

	const queryParams = new URLSearchParams({
		chain: "ETHEREUM",
		collection: collection,
		tokenID: id
	});

	const options = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"authtoken": authTkn,
			"walletaddress": "0xffFFF8F8122eb53e503A535ba0eD63D35906F52f"
		},
	};

	const url = `http://127.0.0.1:3001/v1/${collection}/${id}/sell?` + queryParams
	const payload = await apiCall({url: url, options: options})
	console.log('payload', payload)
}

;(async () => {
	//auth from 0x00
	const authTkn = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiVlhObGNsUjVjR1U2TkRFME5EYzVORGs9IiwidXNlcm5hbWUiOiJfX09TX19weXhFcEJCc0c2ZVVrVmVJSkg0NUVuY3ZNVUFNMm1YNnd1TXZXUEs3cEpEZGxjNVJwS2FFWmVLQUFvOVdLVEhYIiwiYWRkcmVzcyI6IjB4MDAwMDBlOGM3OGU0NjE2NzhlNDU1YjFmNjg3OGJiMGNlNTBjZTU4NyIsImlzcyI6Ik9wZW5TZWEiLCJleHAiOjE2ODA2ODkxODgsIm9yaWdJYXQiOjE2ODA2MDI3ODgsImFwaUFjY2VzcyI6Im5vbmUifQ.gFJeK2RcOCvekhMAFcheT20sheX5XaOkBZbrlgutej4'
	// await getSell(authTkn)

	//sell from 0xff
	const variables = {
		"orderId": "T3JkZXJWMlR5cGU6ODcwMDUyMjE1Mg==", //to get this need to make 2nd call
		"itemFillAmount": "1",
		"takerAssetsForCriteria": {
			"assetContractAddress": "0x5b11fe58a893f8afea6e8b1640b2a4432827726c",
			"tokenId": "1033",
			"chain": "ETHEREUM"
		},
		"giftRecipientAddress": null,
		"optionalCreatorFeeBasisPoints": 0
	}

	const payload = await getPayload(authTkn, variables)
	console.log('payload', payload)
	// console.log('payload', payload.data.order.fulfill.actions)

	// const _bids = await getOsBids()
	// const bids = _bids.data.eventActivity.edges

	// for (const bid of bids) {
	// 	const nftId = bid.node.item.tokenId;
	// 	const nftAddr = ethers.getAddress(bid.node.item.assetContract.address);
	// 	console.log('\nbid:', bid)
	// }

	// const addr_nft = "0x862c9b564fbdd34983ed3655aa9f68e0ed86c620"
	// const id_nft = "2617"
	// const id_order = 'T3JkZXJWMlR5cGU6ODY1MjYyNjMwNQ=='
	// const payload = await getPayload(addr_nft, id_nft, id_order)
	// console.log('payload:', payload.data.order.fulfill.actions)
})();
