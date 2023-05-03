const {InitializeDB} = require("./mongo");
const fetch = require("node-fetch");
const ethers = require("ethers");

const wallet = ethers.Wallet.createRandom();

const db = {
	var: {
		TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',
		TEST_NFT_ID: '877',
		BLUR_AUTH_TKN: "",
	},
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

const subSalesBlur = async () => {
	console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE BLUR SALES\x1b[0m`);
	var prevOrders = new Set(); //needs that, cuz Blur returns "currOrders" in semi-random order.

	// (5/5)
	const _waitBasedOn = async (newOrdersLength) => {
		const toWait = Math.max(0, -10 * newOrdersLength + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
		return new Promise((resolve) => setTimeout(resolve, toWait));
	}

	// (4/5)
	const _addToSubsDB = async (blurSales) => {
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
		const collection = db.mongoDB.collection('SUBS');

		for (const [addr, ids] of Object.entries(formattedSales)) {
			const existingDoc = await collection.findOne({ _id: addr });

			// 2.1 If exists, check if any new ids
			if (existingDoc) {
				const newIds = ids.filter((id) => !existingDoc.id.includes(id));

				// 2.1.1 If new ids, add to DB
				if (newIds.length > 0) {
					console.log('should add to DB addr:', addr, 'newIds:', newIds.length)
					await collection.updateOne(
						{ _id: addr },
						{ $push: { id: { $each: newIds } } }
					);
				}
			}
			// 2.2 If not exists, add to DB
			else {
				console.log('should add to DB addr:', addr, 'allIds:', ids.length)
				await collection.insertOne({ _id: addr, id: ids });
			}
		}

	};

	// (3/5)
	const _addToSalesDB = async (newBlurSales) => {
		const formattedSales = newBlurSales
			.map(sale => {
				const marketplace = sale.marketplace;
				if (marketplace !== 'BLUR') return null //only Blur

				const price = ethers.parseEther(sale.price.amount).toString();
				const owner_addr = ethers.getAddress(sale.fromTrader.address);
				const tkn_addr = ethers.getAddress(sale.contractAddress);
				const tkn_id = sale.tokenId;
				const listed_date_timestamp = Math.floor(Date.parse(sale.createdAt));
				const type = 'BLUR_SALE_SUB'

				const order_hash = ethers.solidityPackedKeccak256(
					['address', 'uint256', 'address', 'uint256', 'uint256'],
					[tkn_addr, tkn_id, owner_addr, price, listed_date_timestamp]
				);

				return {
					_id: order_hash,
					tkn_addr,
					tkn_id,
					owner_addr,
					price,
					type,
					sale
				};
			})
			.filter(Boolean);

		if (formattedSales.length === 0) return; //can happen if 0 Blur sales

    const collection = db.mongoDB.collection('SALES');
    const bulkOps = formattedSales.map(sale => ({
      updateOne: {
        filter: { _id: sale._id }, // Use _id instead of order_hash
        update: { $set: sale },
        upsert: true
      }
    }));

    try {
      const result = await collection.bulkWrite(bulkOps, { ordered: true });
      console.log(`
        Inserted new BLUR SALES SUB:
        - upsertedCount: ${result.upsertedCount}
        - matchedCount: ${result.matchedCount}
        - modifiedCount: ${result.modifiedCount}
        - insertedCount: ${result.insertedCount}
      `);
    } catch (err) {
      console.error('Error during bulkWrite:', err);
    }
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
		return sales.filter(order => !prevOrders.has(order.id)); //can't filter Blur only, cuz !detect amt of missed orders
	}

	// (0/5)
	try {
		while(true){ //@todo when got time, create _getBlurSales() and call it here
			let data = await _getData();
			let newBlurSales = await _getNewBlurSales(data.activityItems);

			if(newBlurSales.length===0) {
				await _waitBasedOn(0);
				continue
			}

			while(newBlurSales.length%100==0 && prevOrders.size>0) {
				data = await _getData(data.cursor);
				const missedNewSales = await _getNewBlurSales(data.activityItems);
				newBlurSales = [...newBlurSales, ...missedNewSales];
			}

			prevOrders = new Set([...prevOrders, ...newBlurSales.map((order) => order.id)].slice(-1000)); //store 1k latest
			_addToSalesDB(newBlurSales);
			_addToSubsDB(newBlurSales);
			await _waitBasedOn(newBlurSales.length);
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

	//!!! @todo validate that (here use random wallet, but keep in mind) !!!
	dataToSign.signature = await wallet.signMessage(dataToSign.message);
	db.api.blur.options.AUTH.body = JSON.stringify(dataToSign);
	db.var.BLUR_AUTH_TKN = (
		await apiCall({url: db.api.blur.url.AUTH_SET, options: db.api.blur.options.AUTH})
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

	// DB CLIENT
	db.mongoDB = await InitializeDB();
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