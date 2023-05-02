const { MongoClient } = require('mongodb');
const readline = require('readline');
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const collection = client.db('botNftData').collection('SUBS');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  try {
    await client.connect();

    const addrA = '0xa';
    const idA = ['a1', 'a2', 'a3'];

    await upsertIds(collection, addrA, idA);
    console.log('added init, launch stream')

    const answer0 = await questionAsync();
    if (answer0 === 'y') {
      console.log('continuing...');
    } else {
      console.log('Exiting...');
    }

    console.log('Adding same, should not log anything')
    await upsertIds(collection, addrA, idA);

    const answer1 = await questionAsync();
    if (answer1 === 'y') {
      console.log('continuing...');
    } else {
      console.log('Exiting...');
    }

    console.log('Adding last, should log b2, b3')
		const idB = ['a1', 'b2', 'b3'];
    await upsertIds(collection, addrA, idB);
  } catch (error) {
    console.error(error);
  }
  // finally {
  //   await client.close();
  // }
}

const questionAsync = () => {
  return new Promise((resolve) => {
    rl.question('Continue? (y/n) ', (answer) => {
      resolve(answer);
    });
  });
};

async function upsertIds(collection, addr, ids) {
  const existingDoc = await collection.findOne({ _id: addr });

  if (existingDoc) {
    const newIds = ids.filter((id) => !existingDoc.id.includes(id));
    if (newIds.length > 0) {
      await collection.updateOne(
        { _id: addr },
        { $push: { id: { $each: newIds } } }
      );
    }
  } else {
    await collection.insertOne({ _id: addr, id: ids });
  }
}


;(async () => {
	await main();
})();
