const upload = require('../s3_upload/upload.js');
const shell = require("shelljs");
const fs = require('fs');
const rimraf = require("rimraf");

const JSON_FILE = "json.json"

exports.main = async (baseDir, params, id) => {
    if(baseDir != null && params != null){
    	console.log("----------------------------------------------");
    	console.log("Running Rscript for each LAS file...");
    	console.log("----------------------------------------------");

    	var dataDir = baseDir + params.data + '/';
        var folders = await getItems(dataDir);        

        for (var i=0; i<folders.length; i++) {
        	var folderPath = dataDir + folders[i] + '/';
            var items = await getItems(folderPath); 

			for(let i in items){
				if(items[i].endsWith('.las')){					
	                console.log(params);
	                var jsonLocation = baseDir+'ec2_batch/'+JSON_FILE;
	                await writeFile(jsonLocation, params);

                    // create outputs directory for current file
                    if (!fs.existsSync(folderPath+'outputs'))
                        fs.mkdirSync(folderPath+'outputs');

                    // run R script & upload to S3
	                try {
						await runRScript(
	                        baseDir,
	                        folderPath,
	                        items[i],
	                        jsonLocation
	                    );
                    } catch (e) {
                        console.log(`[batch.js] - Failed to run R script`);
                    }

                    try {
                    	await upload.main(baseDir, params.bucket, params.data, id, items[i].replace('.las',''));
                    } catch (e) {
                        console.log(`[batch.js] - Failed to upload outputs`);
                    }

                    // delete the outputs directory
                    await new Promise(function(resolve, reject) {
                        rimraf(folderPath+'outputs', function () {
                            console.log("Cleaned up outputs directory");
                            resolve();
                        });
                    });
				}				
			}
        }

        console.log("----------------------------------------------");
    } else {
        console.log("Pass in folder you want to work with!");
    }
}

function runRScript(baseDir, arg1, arg2, arg3){
    var script = baseDir+"ec2_batch/las_processing_CGG.R";

    if (
      shell.exec(`Rscript ${script} "${arg1}" "${arg2}" "${arg3}"`).code !== 0
    ) {
      shell.echo("Error: Rscript failed");
      shell.exit(1);
    }
}

function getItems(dir){
    return new Promise(function(resolve, reject) {
        fs.readdir(dir, function(err, items) {
            resolve(items);
        });
    });
}

function writeFile(fileName, content){
    return new Promise(function(resolve, reject) {
        fs.writeFile(fileName, JSON.stringify(content), function(err) {
            resolve();
        });
    });
}
