const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const collection = client.db('BOT_NFT').collection('SUBS');

//@todo will be used for getBidOs

const subscribe = async () => {
  await client.connect();
  const changeStream = collection.watch();

  changeStream.on('change', (next) => {
		console.log('\nchange')
		if (!next || !next.documentKey._id) return;
		//also can extract db name and collection from: ns: { db: 'BOT_NFT', coll: 'SUBS' },

		const address = next.documentKey._id;
		var updatedIDs = [];

		switch(next.operationType) {
			case 'insert':
				updatedIDs = next.fullDocument.id;
				break;
			case 'update':
				updatedIDs = Object.values(next.updateDescription?.updatedFields);
				break;
		}

		// console.log(`Address: ${address} updated with IDs: ${updatedIDs}`);
		//log each id in new line
		console.log(`Address: ${address} updated with IDs: \n${updatedIDs.join('\n')} \n`);
	});
};


;(async () => {
	subscribe(collection);
})();
