/*
	Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

	Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in
	compliance with the License. A copy of the License is located at
		http://aws.amazon.com/apache2.0/
	or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
	specific language governing permissions and limitations under the License.


	exportlexbot
	------------
	This script can be used to export the definition for an Amazon Lex bot.  It relies on the
	AWS SDK and the Amazon Lex Model Building Service API.
	http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/LexModelBuildingService.html

	The user must have IAM permissions to invoke the API functions (e.g., AmazonLexReadOnly)
	http://docs.aws.amazon.com/lex/latest/dg/access-control-managing-permissions.html#access-policy-examples-aws-managed

	To install:
	$ npm init
	$ npm install aws-sdk  # if you don't have it installed globally
	# copy this file as exportlexbot.js

	To use:
	$ node exportlexbot.js <BotName> <BotVersion>
	# e.g., node exportlexbot.js PressoBot "\$LATEST"
	# e.g., node exportlexbot.js PressoBot "\$LATEST" | jq '.'
*/

'use strict';

let AWS = require('aws-sdk');

AWS.config.region = 'us-east-1'; // Region
let lexModels = new AWS.LexModelBuildingService();

function getSlotTypeDefinitions(intentDefinitions, callback) {

	// first let's get a list of the slot types we need to collect
	let slotTypes = [];
	let slotTypeDefinitions = [];
	intentDefinitions.forEach(function(intentDefinition) {

		intentDefinition.slots.forEach(function(slot) {

			if (slot.slotTypeVersion) {

				// we only want custom slot types
				slotTypes.push({
					slotType: slot.slotType,
					slotTypeVersion: slot.slotTypeVersion
				});
			}
		});
	});

	if (slotTypes.length > 0) {
		// now let's get the slotTypes we need
		slotTypes.forEach(function(slotType) {

			let params = {
				name: slotType.slotType,
				version: slotType.slotTypeVersion
			};
			lexModels.getSlotType(params, function(err, slotTypeDefinition) {

				if (err) {
					console.error(err);
					callback(err, null);

				} else {

					slotTypeDefinitions.push(slotTypeDefinition);
					// callback if we have collected all the definitions we need
					if (slotTypeDefinitions.length >= slotTypes.length) {
						callback(null, slotTypeDefinitions);
					}
				}
			});
		});
	} else {
		callback(null, []);
	}
}

function getIntentDefinitions(intents, callback) {

	let intentDefinitions = [];
	intents.forEach(function(intent) {

		let params = {
			name: intent.intentName,
			version: intent.intentVersion
		};
		lexModels.getIntent(params, function(err, intentDefinition) {

			if (err) {
				callback(err, null);

			} else {

				// console.log(`adding intent ${intentDefinition.name}`);
				intentDefinitions.push(intentDefinition);
				// callback if we have collected all the definitions we need
				if (intentDefinitions.length >= intents.length) {

					callback(null, intentDefinitions);
				}
			}
		});
	});
}

function getBotDefinition(myBotName, myBotVersion, callback) {

	let params = {
		name: myBotName,
		versionOrAlias: myBotVersion
	};

	lexModels.getBot(params, function(err, botDefinition) {

		if (err) {
			callback(err, null);

		} else {

			getIntentDefinitions(botDefinition.intents, function(err, intentDefinitions) {

				if (err) {
					console.log(err);
					callback(err, null);

				} else {
					botDefinition.dependencies = {};
					botDefinition.dependencies.intents = intentDefinitions;
					getSlotTypeDefinitions(botDefinition.dependencies.intents, function(err, slotTypeDefinitions) {

						if (err) {
							console.log(err);
							callback(err, null);

						} else {
							botDefinition.dependencies.slotTypes = slotTypeDefinitions;
							callback(null, botDefinition);
						}
					});
				}
			});
		}
	});
}

if (process.argv.length != 4) {

	console.log(`Usage:  ${__filename} <BotName> <BotVersion>`);
	console.log(`    for example:  ${__filename}  PressoBot "\\$LATEST"`)
	process.exit(-1);
}

let myBotName = process.argv[2];
let myBotVersion = process.argv[3];

getBotDefinition(myBotName, myBotVersion, function(err, botDefinition) {

	console.log(JSON.stringify(botDefinition));
});
