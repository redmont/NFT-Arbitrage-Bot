# NFT MEV :robot:

...to extract it, starting with ar₿$.

## To-do :clipboard:

- [x] `subSalesBlur` (get & save to `SALES` & `SUBS`)
- [x] `getSalesBlur` (get & save to `SALES` & `SUBS`)
- [x] `subBidsOs` (get, if in `SUBS`, save to `BIDS`)
- [x] `getBidsOs` (listen `SUBS` stream, get & save to `BIDS`)
- [ ] VPS setup
  - [ ] setup systemctl
- [ ] Cleaner
  - [ ] Remove expired data from db
- [ ] Remember: if sends 2x sets of txs, then increment nonce (send all txs with permutations of nonces)

## Project Diagram 🔧

![Project Diagram](https://i.gyazo.com/791201f3bd138f3ee8ffb15d9c177451.png)

📁 [Google Drive](https://drive.google.com/file/d/1Ks5DKz6f9DdRpffOGzYu5gjKxD21WbCk/view?usp=sharing)

🚀 [App](https://app.diagrams.net/#G1Ks5DKz6f9DdRpffOGzYu5gjKxD21WbCk)

## To-do DB Initialization :floppy_disk:
  - [ ] 1. `subSalesBlur`
  - [ ] 2. `getSalesBlur`
  - (after getSalesBlur done)
  - [ ] 3. `subBidsOs`
  - [ ] 4. `getBidsOs`

## Commands :
1st terminal inside bot-nft/api-blur:
```
yarn rebuild && node .
```

2nd terminal, run Mongo (with stream support):
```
sudo mongod --port 27017 --dbpath /var/lib/mongodb --replSet rs0 --bind_ip localhost
```

3rd terminal, Mongodb UI:
```
robo3t
```

#### DB VPS commands:

Enter mongo terminal
```
mongosh
```

Connect to DB
```
use BOT_NFT
```

Print each collection name, count and size:
```
db.getCollectionNames().forEach(function(collName) {
    var coll = db.getCollection(collName);
    var stats = coll.stats();
    var count = coll.count();
    var sizeInMB = stats.size / (1024 * 1024);
    print(collName + " (" + count + " elements): " + sizeInMB.toFixed(2) + " MB");
});
```


## Git Commit Types :construction_worker:

- :sparkles: `feat`: A new feature
- :bug: `fix`: A bug fix
- :books: `docs`: Documentation changes
- :art: `style`: Changes that do not affect the meaning of the code (e.g. formatting, missing semi-colons, etc.)
- :recycle: `refactor`: Code changes that neither fix a bug nor add a feature
- :arrow_up: `chore`: Changes to the build process, dependencies, or other non-code related changes
- :white_check_mark: `test`: Adding or modifying tests
- :globe_with_meridians: `i18n`: Internationalization/localization changes
- :construction: `WIP`: Work in progress (not intended for the final release)
- :x: `revert`: Reverting a previous commit

Let's go! :muscle:

Provide command to collect all "addr_tkn" and "id_tkn" fields from "SALES" collection, and then add it to a new collection "SUBS1" in such format:
{
  _id: "addr_tkn":
  id: [
    "id_tkn",
    ...
  ]
}

if "SALES" will have same "addr_tkn" and same "id_tkn", take only first one and ignore rest.
if "SALES" will have same "addr_tkn" and different "id_tkn", then merge id_tkn with existing addr_tkn.