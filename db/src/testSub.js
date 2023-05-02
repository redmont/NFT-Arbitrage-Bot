const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const collection = client.db('botNftData').collection('SUBS');

//@todo will be used for getBidOs

const subscribe = async () => {
	await client.connect();
	const changeStream = collection.watch();
	changeStream.on('change', (next) => {
		if (next.fullDocument) {
			console.log('New document added:', next.fullDocument);
		} else {
			console.log('Change detected, but no fullDocument available:', next);
		}
	});
}

;(async () => {
	subscribe(collection);
})();
