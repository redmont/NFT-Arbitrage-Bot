const fetch = require("node-fetch");
const ethers = require("ethers");

const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const mongoClient = new MongoClient(uri);

const wallet = ethers.Wallet.createRandom();

const db = {
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
		// Get an array of all existing _id values in the collection
		const existingDocs = await db.SALES.find({}, { projection: { _id: 1 } }).toArray();
		const existingIds = existingDocs.map(doc => doc._id);

		// Filter out formattedSales that have an existing _id in the database
		const filteredSales = formattedSales.filter(sale => !existingIds.includes(sale._id));
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
		const filteredSales = await __getFilteredSales(formattedSales);
		if (filteredSales.length === 0) return; //can happen if all Blur sales already in DB

		const bulkOps = filteredSales.map(sale => ({
			updateOne: { //updateOne, not insertOne to prevent errors caused by race condition
				filter: { _id: sale._id },
				update: { $set: sale },
				upsert: true,
			},
		}));

		const result = await db.SALES.bulkWrite(bulkOps, { ordered: true });
		if(db.TEST_MODE){
			console.log(`\nInserted ${result.insertedCount} new BLUR SALES:`);
		}
	} catch (err) {
		console.error('ERR during bulkWrite:', err);
		// if(err.code !== 11000) console.error('ERR during bulkWrite:', err);
	} finally {
		return
	}
}

const subSalesBlur = async () => {
	console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE BLUR SALES\x1b[0m`);

	// (5/5)
	const _waitBasedOn = async (newOrdersLength) => {
		const toWait = Math.max(0, -10 * newOrdersLength + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
		return new Promise((resolve) => setTimeout(resolve, toWait));
	}

	const _addToDBs = async (newBlurSales) => {
		addToSalesDB(newBlurSales);
		addToSubsDB(newBlurSales);
	}

	// (2/5)
	const _getData = async (prevCursor) => {
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

	// (1/5)
	const _getNewBlurSales = async (sales) => {
		return sales.filter(order => !db.PREV_SALES.has(order.id)); //can't filter Blur only, cuz !detect amt of missed orders
	}

	// (0/5)
	let count = 0
	let loopCount = 0
	let start = performance.now()
	try {
		while(true){
			let data = await _getData();
			let newBlurSales = await _getNewBlurSales(data.activityItems);

			if(newBlurSales.length===0) {
				await _waitBasedOn(0);
				continue
			}

			_addToDBs(newBlurSales);

			while(newBlurSales.length%100==0 && db.PREV_SALES.size>0) {
				data = await _getData(data.cursor);
				process.stdout.write(`\rcount ${++count} current: ${data.activityItems[0].createdAt}, len: ${newBlurSales.length}`);
				const missedNewSales = await _getNewBlurSales(data.activityItems);
				_addToDBs(missedNewSales);
				newBlurSales = [...newBlurSales, ...missedNewSales];
			}

			///edit that
			// db.PREV_SALES = new Set([...db.PREV_SALES, ...arrA.slice(0, 4)]);
			db.PREV_SALES = new Set([...db.PREV_SALES, ...newBlurSales.slice(0, 1000).map((order) => order.id)].slice(-1000));
			// db.PREV_SALES = new Set([...db.PREV_SALES, ...newBlurSales.slice(-1000).map((order) => order.id)]);
			// db.PREV_SALES = new Set([...db.PREV_SALES, ...newBlurSales.map((order) => order.id)].slice(-1000)); //store 1k latest
			await _waitBasedOn(newBlurSales.length);

			if(++loopCount>=2){
				const end = performance.now()
				console.log(`\n${newBlurSales.length} new Blur sales added in ${(end - start) / 1000} seconds`);
				process.exit(0)
			}
		}
	} catch (e) {
		console.error("ERR: subSalesBlur", e);
		await subSalesBlur();
	}
};

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

	//1d of catching up: calls=938; len=60000; time=324.71s
	db.PREV_SALES = new Set(await db.SALES.find(
			{ type: "BLUR_SALE_SUB" },
			{ "obj.sale": 1 }
		)
		.sort({ "obj.sale.createdAt": -1 })
		.limit(100)
		.toArray()
		.then((res) => {
			switch (true) {
				case res.length === 0:
					return [];
				case res.length < 100:
					return [res[res.length - 1].sale.id];
				default:
					return [res[99].sale.id];
			}
		}));
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