const fetch = require("node-fetch");
const ethers = require("ethers");

const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const mongoClient = new MongoClient(uri);

const wallet = new ethers.Wallet(process.env.PK_0)

/**
 * @todo
 * [ ] Remove Expired from:
 * 		[ ] BIDs (remove if exp_time>now)
 * 		[ ] SALES
 * 		    [x] ensure how sales work
 * 						!note
 * 							 * if newSalePrice<oldSalePrice, VALID (or valid after older expired)
 * 							 * if newSalePrice<oldSalePrice, INVALID
 * 							 * blurData returns only the lowest sale price, if provide diff price, then it returns the lowest active
 * 						!conclusion:
 *							 * All sales with same addr:id, should be merged & remain only lowest price
 * 							 * (todo later) if buyData returns ListingNotFound, then remove from SALES.
 *
 * 				////todo
 * 			  [ ] merge addr:id sales, remain only one with lowest price
 * 			  [ ] periodically get prices & update/remove in sales
 * 						[ ] do 1k prices/call, (getEachNftId() is old version of that), then update/del SALES
 * 		  	[ ] Prevention in subSalesBlur.js
 * 						[ ] if new SALE in db & newPrice < oldPrice upsert db, else dismiss.
 * 						[ ] listen to sold event (edit getData) & if sold, then remove from SALES
 */

const db = {
	AMT_TOTAL_SALES: 0,
	CATCHING_UP: false,
	PREV_SALES: new Set(),
	TEST_MODE: false,
	SUBS: mongoClient.db('BOT_NFT').collection('SUBS'),
	SALES: mongoClient.db('BOT_NFT').collection('SALES'),
	TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',
	TEST_NFT_ID: '877',
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
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({walletAddress: wallet.address}),
				},
				GET: {}, //in setup()
			},
		},
	}
};

const apiCall = async ({url, options}) => {
	let res;
	await fetch(url, options)
		.then((response) => response.json())
		.then((json) => (res = JSON.parse(JSON.stringify(json))))
		.catch((error) => console.error(error));
	return res;
};

const getData = async (prevCursor) => {
	const baseFilter = {
		count: 100, //or 50 or 25
		eventFilter: {
			orderCreated: {}, //@todo sub also sold items to delete from db
		},
	};

	const filters = prevCursor ? {cursor: prevCursor, ...baseFilter} : baseFilter;
	const url = `http://127.0.0.1:3000/v1/activity?filters=${encodeURIComponent(
		JSON.stringify(filters)
	)}`;
	const data = await apiCall({url: url, options: db.api.blur.options.GET});
	return data
};

const addToSubsDB = async (blurSales) => {
	try {
		const formattedSales = {};

		// 1. Extract all contractAddress and their ids that marketplace === 'BLUR'
		for (const sale of blurSales) {
			if (sale.marketplace === 'BLUR') {
				const { contractAddress, tokenId } = sale;
				const addr = ethers.getAddress(contractAddress);

				if (!formattedSales[addr]) {
					formattedSales[addr] = [tokenId];
				} else {
					formattedSales[addr].push(tokenId);
				}
			}
		}

		// 2. For each contractAddress, check if it exists in DB
		for (const [addr, ids] of Object.entries(formattedSales)) {
			if(ids.length == 0) continue;
			const existingDoc = await db.SUBS.findOne({ _id: addr });

			// 2.1 If exists, check if any new ids
			let result;
			if (existingDoc) {
				const newIds = ids.filter((id) => !existingDoc.id.includes(id));

				// 2.1.1 If new ids, add to DB
				if (newIds.length > 0) {
					result = await db.SUBS.updateOne(
						{ _id: addr },
						{ $push: { id: { $each: newIds } } }
					);

					if(db.TEST_MODE) console.log(`Inserted ${result.modifiedCount} into SUBS`);
				}
				// 2.2 If not exists, add to DB
			} else {
				result = await db.SUBS.insertOne({ _id: addr, id: ids });
				if(db.TEST_MODE) console.log(`Inserted 1 into SUBS`);
			}
		}
	} catch (err) {
		console.error('ERR: _addToSubsDB', err);
	}	finally {
		return
	}
};

const addToSalesDB = async (newBlurSales) => {
	const __getFilteredSales = async (formattedSales) => {
		// Get all _ids from formattedSales
		const formattedSaleIds = formattedSales.map((sale) => sale._id);

		// Find existing documents that match the _ids from formattedSales
		const existingDocs = await db.SALES.find({_id: {$in: formattedSaleIds}}, {projection: {_id: 1}}).toArray();

		// Extract the _ids from the existing documents
		const existingIds = existingDocs.map((doc) => doc._id);

		// Filter out formattedSales that have an existing _id in the database
		const filteredSales = formattedSales.filter((sale) => !existingIds.includes(sale._id));
		return filteredSales;
	}

	const __getFormattedSales = async (newBlurSales) => {
		return newBlurSales
			.map(sale => {
				const marketplace = sale.marketplace;
				if (marketplace !== 'BLUR') return null

				const price = ethers.parseEther(sale.price.amount).toString();
				const addr_seller = ethers.getAddress(sale.fromTrader.address);
				const addr_tkn = ethers.getAddress(sale.contractAddress);
				const id_tkn = sale.tokenId;
				const listed_date_timestamp = Math.floor(Date.parse(sale.createdAt));
				const type = 'BLUR_SALE_SUB'

				if(addr_tkn == db.TEST_NFT && id_tkn==db.TEST_NFT_ID) {
					console.log(`\nDETECTED TEST_NFT ${addr_tkn} ${id_tkn} ${price} ${addr_seller} ${listed_date_timestamp}`);
				}

				const order_hash = ethers.solidityPackedKeccak256(
					['address', 'uint256', 'address', 'uint256', 'uint256'],
					[addr_tkn, id_tkn, addr_seller, price, listed_date_timestamp]
				);

				return {
					_id: order_hash,
					addr_tkn,
					id_tkn,
					addr_seller,
					price,
					type,
					sale
				};
			})
			.filter(Boolean);
	}

	//start
	try {
		const formattedSales = await __getFormattedSales(newBlurSales);
		if (formattedSales.length === 0) return; //can happen if amt of Blur Sales = 0

		// const filteredSales = await __getFilteredSales(formattedSales);
		// if (filteredSales.length === 0) return; //can happen if all Blur sales already in DB

		const bulkOps = formattedSales.map(sale => ({
			// insertOne: {
			// 	document: sale,
			// },
			updateOne: {
				filter: { _id: sale._id },
				update: { $set: sale },
				upsert: true,
			},
		}));

		const result = await db.SALES.bulkWrite(bulkOps, { ordered: true });
		if(db.TEST_MODE){
			console.log(`\nInserted ${result.insertedCount} into SALES`);
		}
	} catch (err) {
		// console.error('ERR during bulkWrite:', err);
		if(err.code !== 11000) console.error('ERR during bulkWrite:', err);
	} finally {
		return
	}
}

const subSalesBlur = async () => {
	console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE BLUR SALES\x1b[0m`);

	// (4/4)
	const _waitBasedOn = async (newOrdersLength) => {
		const toWait = Math.max(0, -10 * newOrdersLength + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
		return new Promise((resolve) => setTimeout(resolve, toWait));
	}

	// (3/4)
	const _addToDBs = async (newBlurSales) => {
		return
		addToSalesDB(newBlurSales);
		addToSubsDB(newBlurSales);
		return
	}

	// (2/4)
	const _getNewBlurSales = async (sales) => {
		return sales.filter(order => !db.PREV_SALES.has(order.id)); //can't filter Blur only, cuz !detect amt of missed orders
	}

	// (0/4)
	try {
		while(true){
			let data = await getData(); // (1/4)
			let newBlurSales = await _getNewBlurSales(data.activityItems);

			if(newBlurSales.length===0) {
				await _waitBasedOn(0);
				continue
			}

			_addToDBs(newBlurSales);

			while(newBlurSales.length%100==0 && db.PREV_SALES.size>0) {
				data = await getData(data.cursor);

				const missedNewSales = await _getNewBlurSales(data.activityItems);
				_addToDBs(missedNewSales);
				newBlurSales = [...newBlurSales, ...missedNewSales];

				if(db.CATCHING_UP) {
					const currDate = new Date(data.activityItems[0].createdAt);
					const memoryUsage = process.memoryUsage();

					process.stdout.write(
						`\r\x1b[38;5;12m Current date:\x1b[0m ${currDate} ` +
						`\x1b[38;5;12m Memory usage:\x1b[0m ${(memoryUsage.rss/1024/1024).toFixed(2)} MB ` +
						`\x1b[38;5;12m Runtime:\x1b[0m ${((Date.now()-db.CATCHING_UP_START)/1000).toFixed(2)}} s `
					);

					if(currDate < db.CATCHING_UP_DATE+60000) { //1m left
						console.log(`\n\x1b[38;5;202mFINISHING CATCHING-UP...\x1b[0m`);
						db.CATCHING_UP = false;
					}
				}
			}

			process.stdout.write(`\r\x1b[38;5;202m AMT OF COLLECTED BLUR SALES:\x1b[0m ${db.AMT_TOTAL_SALES+=newBlurSales.length} `);

			db.PREV_SALES = new Set([...db.PREV_SALES, ...newBlurSales.slice(0, 1000).map((order) => order.id)].slice(-1000));
			await _waitBasedOn(newBlurSales.length);
		}
	} catch (e) {
		console.error("ERR: subSalesBlur", e);
		await subSalesBlur();
	}
};


/////////////////////////

const getCurrSale = async (addr, id) => {
	// if (db.nft[addr]?.id[id]?.DEX) return db.nft[addr].id[id].DEX;
	console.log('\nMaking a call to get marketplace...')
	const url = `http://127.0.0.1:3000/v1/collections/${addr.toLowerCase()}/tokens/${id}`
	const data = await apiCall({ url, options: db.api.blur.options.GET });
	return data
}

const getBuyBlurData = async (addr, id, amt) => {
	const url = `http://127.0.0.1:3000/v1/buy/${addr.toLowerCase()}?fulldata=true`;

	db.api.blur.options.POST.body = JSON.stringify({
		tokenPrices: [
			{
				isSuspicious: false, //tknIdBlurData.token.isSuspicious,
				price: {
					amount: amt, //tknIdBlurData.token.price.amount,
					unit: "ETH", //sale.sale.price.unit
				},
				tokenId: id //tknIdBlurData.token.tokenId,
			},
		],
		userAddress: wallet.address,
	});

	console.log('\nGetting buy data from Blur...')
	console.log('db.api.blur.options.POST.body', db.api.blur.options.POST.body)
	console.time('buyFromBlurData')
	const buyFromBlurData = await apiCall({url, options: db.api.blur.options.POST})
	console.timeEnd('buyFromBlurData')
	return buyFromBlurData
}

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
			let toTest = 0
			if(!await _validateSlug(SLUG)) continue

			let data = {}
			let countPages = 0 //for collections > 1k

			do {
				if(toTest++>=100) {
					console.log('ERR: smth wrong with 2nd loop in get each id')
					console.log('SLUG', SLUG)
					break
				}
				const url = await _setUrl(data, SLUG)
				data = await apiCall({ url, options: db.api.blur.options.GET })
				await _updateDb(data)
				countPages += data?.nftPrices?.length
			} while (countPages <= data.totalCount)

			_updateProgress()
		}
	} catch (e) {
		console.error('\nERR: getEachNftId', e)
		console.log('\nERROR_SLUG:', SLUG)
		db.var.ERROR_SLUG = SLUG
		await getEachNftId()
	}

	console.log('\x1b[33m%s\x1b[0m', '\nCOMPLETED COLLECTING EACH NFT ID PRICE');
	console.timeEnd('getEachNftId')
}

const setup = async () => {
	/// SETUP BLUR AUTH TKN ///
	const dataToSign = await apiCall({
		url: db.api.blur.url.AUTH_GET,
		options: db.api.blur.options.AUTH,
	});

	dataToSign.signature = await wallet.signMessage(dataToSign.message);
	db.api.blur.options.AUTH.body = JSON.stringify(dataToSign);
	db.BLUR_AUTH_TKN = (
		await apiCall({url: db.api.blur.url.AUTH_SET, options: db.api.blur.options.AUTH})
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

	db.api.blur.options.POST = {
    method: 'POST',
    headers: {
			redirect: 'follow',
      authToken: db.BLUR_AUTH_TKN,
      walletAddress: wallet.address,
			"content-type": "application/json",
			body: {}, //pass buy data
    },
  };

	//1d of catching up: calls=938; len=60000; time=324.71s
	let latestSale = await db.SALES.findOne(
		{ type: "BLUR_SALE_SUB" },
		{
			sort: { "sale.createdAt": -1 },
			projection: { sale: 1, _id: 0 }
		}
	);

	db.PREV_SALES = new Set([latestSale.sale.id]);

	const currSaleDate = new Date((await getData()).activityItems[0].createdAt);
	const prevSaleDate = new Date(latestSale.sale.createdAt)
	const diffInSec = (currSaleDate - prevSaleDate)/1000;

	console.log(`
	Need to catch up missed Blur Sales from:
	${currSaleDate}
	to:
	${prevSaleDate}
	~ ${(diffInSec / (60*60)).toFixed(2)} hours
	`);

	db.CATCHING_UP = true;
	db.CATCHING_UP_START = Date.now();
	db.CATCHING_UP_DATE = prevSaleDate;
};

(async function root() {
	console.log('wallet.address', wallet.address)
	try {
		await setup();
		//get recent sale for specific token
		const data = await getCurrSale(db.TEST_NFT, '7');
		console.log('\ndata', data)
		const amt = '0.002'
		const buyFromBlurData = await getBuyBlurData(db.TEST_NFT, '7', amt);
		console.log('\nbuyFromBlurData', buyFromBlurData)
		console.log('\nbuyFromBlurData', buyFromBlurData.buys[0])
		console.log('\namt', BigInt(buyFromBlurData.buys[0].txnData.value.hex))
		// subSalesBlur();
	} catch (e) {
		console.error("\nERR: root:", e);
		await root();
	}
})();