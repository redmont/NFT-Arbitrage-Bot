const Redis = require('ioredis');

//@todo implement ioredis, below just a template.

;(async() => {
	// Create a Redis client instance
	const redis = new Redis({
		host: 'localhost',
		port: 6379,
		password: 'your_password_here'
	});

	// Set a value in Redis
	redis.set('mykey', 'Hello Redis!', (err, result) => {
		if (err) {
			console.error(err);
			return;
		}

		console.log(result); // Output: OK
	});

	// Retrieve a value from Redis
	redis.get('mykey', (err, result) => {
		if (err) {
			console.error(err);
			return;
		}

		console.log(result); // Output: Hello Redis!
	});

	// Increment a value in Redis
	redis.incr('mycounter', (err, result) => {
		if (err) {
			console.error(err);
			return;
		}

		console.log(result); // Output: 1
	});

	// Decrement a value in Redis
	redis.decr('mycounter', (err, result) => {
		if (err) {
			console.error(err);
			return;
		}

		console.log(result); // Output: 0
	});

	// Subscribe to a Redis channel
	const subscriber = new Redis({
		host: 'localhost',
		port: 6379,
		password: 'your_password_here'
	});

	subscriber.subscribe('mychannel', (err, count) => {
		if (err) {
			console.error(err);
			return;
		}

		console.log(`Subscribed to ${count} channel(s)`);
	});

	subscriber.on('message', (channel, message) => {
		console.log(`Received message on channel ${channel}: ${message}`);
	});

	// Publish a message to a Redis channel
	const publisher = new Redis({
		host: 'localhost',
		port: 6379,
		password: 'your_password_here'
	});

	publisher.publish('mychannel', 'Hello subscribers!');


})()