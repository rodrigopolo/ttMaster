#ttMaster

Twitter Follower Downloader and parser to MySQL


#Installing

First step, install the script, install commander (for the example.js):

```
npm install --from-git git://github.com/rodrigopolo/ttMaster.git
npm install commander
```

Move "example.js" and "my_sql.sql" from "node_project/node_modules/ttMaster" to your project folder "node_project" and then restore the MySQL database, replace HOST, USER and PASS with your settings:

```
mysql -h HOST -u USER -pPASS MySQLDB --default-character-set=utf8 < my_sql.sql
```

Second step: Get your Twitter app consumer_key, consumer_secret and modify "example.js" with your consumer_key, consumer_secret, MySQL host, user, password, database and save it.

Third step: Add as many Twitter accounts you need to the table "twitter_accounts" on MySQL with the twitter id, oauth_token and oauth_token_secret from your Twitter app (TODO: node code for getting this info).

Forth step: Run from the console the example script and enter a Twitter user:

```
node example.js -u TWITTER_SCREEN_NAME
```

You'll get your database fill with the data, notice that the var polyCountryGuate is the polygon data for Guatemala which this script was intended.