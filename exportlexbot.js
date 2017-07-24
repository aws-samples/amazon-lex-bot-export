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
	# git clone ...
	# npm install

	To use:
	$ node exportlexbot.js <BotName>
*/

'use strict';

let AWS = require('aws-sdk');
let fs = require('fs');
let stringify = require('json-stable-stringify');

let programName = __filename.substring( __dirname.length + 1 );
let argvs = require( 'minimist' )( process.argv.slice( 2 ), {
		'alias' : { 'd' : 'dir', 'f' : 'file', 'help' : 'h', 'p' : 'pretty', 'v' : 'version' },
		'boolean' : [ 'pretty' ],
		'default' : { 'version' : '$LATEST' }
	} );

AWS.config.region = 'us-east-1'; // Region
let lexModels = new AWS.LexModelBuildingService();

function getSlotTypeDefinitions(intentDefinitions, callback) {

	// first let's get a list of the slot types we need to collect
	let slotTypes = [];
	let slotTypeDefinitions = [];
	intentDefinitions.forEach(function(intentDefinition) {

		intentDefinition.slots.forEach(function(slot) {

			if (slot.slotTypeVersion && slotTypes.findIndex( obj => obj.slotType == slot.slotType ) == -1) {

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

					// sort enumerationValues for consistency
					if ( slotTypeDefinition !== undefined && slotTypeDefinition.enumerationValues !== undefined )
						slotTypeDefinition.enumerationValues.sort( (a, b) => a.value.localeCompare( b.value ) );

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

				// Sort a few values for consistency before saving it
				if ( intentDefinition !== undefined && intentDefinition.sampleUtterances !== undefined )
					intentDefinition.sampleUtterances.sort( (a, b) => a.localeCompare( b ) );

				// console.log(`adding intent ${intentDefinition.name}`);
				intentDefinitions.push(intentDefinition);
				// callback if we have collected all the definitions we need
				if (intentDefinitions.length >= intents.length) {

					intentDefinitions.sort( (a, b) => a.name.localeCompare( b.name ) );
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

		} else if ( botDefinition !== undefined ) {

			// Sort the abortStatement messages, clarifcationPrompt messages, and intent names for consistency
			if ( botDefinition.abortStatement !== undefined )
				botDefinition.abortStatement.messages.sort( (a, b) => a.content.localeCompare( b.content ) );

			if ( botDefinition.clarificationPrompt !== undefined )
				botDefinition.clarificationPrompt.messages.sort( (a, b) => a.content.localeCompare( b.content ) );

			if ( botDefinition.intents !== undefined )
				botDefinition.intents.sort( (a, b) => a.intentName.localeCompare( b.intentName ) );

			if ( botDefinition.intents !== undefined )
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
			else
				callback(null, botDefinition);
		}
	});
}

function help() {
  let help = `Usage:  ${programName} [ --dir [.] --file [BotName.json] --pretty --version <BotVersion> ] <BotName>\n\n`;

  help += "    -d, --dir      Output directory for file (implies --file w/default file name of <BotName>.json), default is current directory\n";
  help += "    -f, --file     Output definition to file, if filename provided it overrides default of <BotName>.json\n";
  help += "    -p, --pretty   Output definition in a readable format with sorted entries\n";
  help += "    -v, --version  Output the version specified, or $LATEST by default\n\n";
  help += `    for example: '${programName} -v PressoBot' will output the $LATEST version of PressoBot to PressoBot.json in the current directory\n\n`;

  return help;
}

if ( argvs.help || argvs._.length == 0 ) {
	console.log( help() );
	process.exit(-1);
}

let myBotName = argvs._[0];
let myBotVersion = argvs.version;

getBotDefinition(myBotName, myBotVersion, function(err, botDefinition) {

	if ( err )
		console.log( err )
	else
	{
		let output = argvs[ 'pretty' ] ? stringify(botDefinition, {'space': '  '}) : JSON.stringify( botDefinition );

		if ( argvs[ 'file' ] || argvs[ 'dir' ] )
		{
			let dir = ( argvs[ 'dir' ] === undefined || argvs[ 'dir' ] == true ) ? '.' : argvs[ 'dir' ];
			let file = ( argvs[ 'file' ] === undefined || argvs[ 'file' ] == true ) ? ( myBotName + '.json' ) : argvs[ 'file' ];
			let fullName = dir + '/' + file;

			fs.writeFile(fullName, output, function( err ) { if ( err ) console.log( "Error : " + err ); });

			console.log( "\nDefinition saved to " + fullName + "\n" );
		}
		else
			console.log( output );
	}

});
