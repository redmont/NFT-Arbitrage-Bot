const fetch = require('node-fetch');
const ethers = require('ethers');
const wallet = ethers.Wallet.createRandom()

/**
 * @todo add to ioredis db:
 * 		1. all nfts collections
 * 		2. each collection all ids
 */
const db = {
	var: {
		BLUR_AUTH_TKN: '',
		PROGRESS_GET_ID_PERCENT: 0,
	},
  api: {
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
			},
		},
  },
	nft: {}
}

const apiCall = async ({url, options}) => {
	let res;
	await fetch(url, options)
		.then((response) => response.json())
		.then(json => (res = JSON.parse(JSON.stringify(json))))
		.catch((error) => console.error(error));
	return res
};

const getAllNftsBlur = async () => {
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

	let count = 0 //test
	const _getAllNfts = async () => {
		try {
			const data = await apiCall({url: db.api.blur.url.COLLECTIONS, options: db.api.blur.options.GET})
			if(!data || data?.collections?.length === 0) return

			for (nft of data?.collections) {
				await _updateDb(nft)
			}

			if(count++ > 2) return //test
			await _setNewPage(data)
			await _getAllNfts()
		} catch(e) {
			console.error('ERR: getAllNftsBlur:', e)
			await _getAllNfts()
		}
	};

	//→→→ STARTS HERE ←←←
	console.time('getAllNftsBlur')
	console.log('\x1b[95m%s\x1b[0m', '\n STARTED COLLECTING NFTs');
	await _getAllNfts()
	console.log('\x1b[95m%s\x1b[0m', '\n FINISHED COLLECTING NFTs, amt:', Object.keys(db.nft).length);
	console.timeEnd('getAllNftsBlur')
}

const getEachNftIdBlur = async () => {
	const _updateDb = async _data => {
		if(!_data.nftPrices) return
		for (const { tokenId, price } of _data.nftPrices) {
			const addr = ethers.getAddress(_data.contractAddress);
			const nft = db.nft[addr]?.id?.[tokenId] ?? {DEX: ''}; //read or assign "{}"
			nft.PRICE = ethers.parseEther(price.amount); //set price (reason for try, cuz inputs incorrect)
			db.nft[addr].id[tokenId] = nft; //update or assign
		}
	}

	const _setURL = async (data, slug) => {
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


	//→→→ STARTS HERE ←←←
	console.time('getEachNftIdBlur')
	console.log('\x1b[33m%s\x1b[0m', '\nSTARTED COLLECTING EACH NFT ID PRICE');

	try {
		for (const { SLUG } of Object.values(db.nft)) {
			console.log('SLUG', SLUG)
			let data = {}
			let countPages = 0 //for collections > 1k

			do {
				const url = await _setURL(data, SLUG)
				data = await apiCall({ url, options: db.api.blur.options.GET })
				await _updateDb(data)
				countPages += data?.nftPrices?.length
			} while (countPages < data.totalCount)
		}
	} catch (e) {
		console.error('\nERR: getEachNftIdBlur', e)
		console.log('\nERROR_SLUG:', SLUG)
		// db.var.ERROR_SLUG = SLUG
		await getEachNftIdBlur()
	}

	console.log('\x1b[33m%s\x1b[0m', '\nCOMPLETED COLLECTING EACH NFT ID PRICE');
	console.timeEnd('getEachNftIdBlur')
}

const setup = async () => {
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
}

;(async() => {
	await setup()
	await getAllNftsBlur() //<1m
	// console.log('\ndb after all nfts', db.nft)
	await getEachNftIdBlur() //~1h
	// console.log('\ndb after all ids', db.nft)
	//@todo same from os
})()