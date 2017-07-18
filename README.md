# amazon-lex-bot-export
This script can be used to export the definition for an Amazon Lex bot.  It relies on the AWS SDK and the [Amazon Lex Model Building Service API](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/LexModelBuildingService.html).

The user must have [IAM permissions](http://docs.aws.amazon.com/lex/latest/dg/access-control-managing-permissions.html#access-policy-examples-aws-managed) to invoke the API functions (e.g., ``AmazonLexReadOnly``).

## To install
```bash
$ npm init
$ npm install aws-sdk  # if you don't have it installed globally
# copy this file as exportlexbot.js
```

## To use
```bash
$ node exportlexbot.js <BotName> <BotVersion>
# examples:
# node exportlexbot.js PressoBot "\$LATEST"
# node exportlexbot.js PressoBot "\$LATEST" | jq '.'
# node exportlexbot.js PressoBot "\$LATEST" | jq '.' > bot.json 
```
