const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const fs = require('fs');
const BUCKET = 'canyon-creek-bucket-0';

var baseDir = process.cwd().replace('pc_to_s3', '');
baseDir = baseDir.replace(/\\/g, "/");
if(!baseDir.endsWith('/'))
	baseDir += '/';

const myArgs = process.argv.slice(2);

//console.log(baseDir)

main(baseDir, myArgs[0]);

async function main(baseDir, dataFolder) {
    if(baseDir != null && dataFolder != null){
        console.log("----------------------------------------------");
        console.log("Uploading files from Local to S3...");
        console.log("----------------------------------------------");

        //console.log(baseDir);
        //console.log(dataFolder);

        var dataDir = baseDir + dataFolder + '/';
        var folders = await getItems(dataDir);

        for (var i=0; i<folders.length; i++) {
            var folderPath = dataDir + folders[i] + '/';
            var items = await getItems(folderPath); 
            var outputDir = dataFolder+'/'+folders[i]+'/';

            for(let i in items){
            	console.log(items[i])
                await uploadFiles(outputDir, folderPath, items[i]);
            }
        }
        console.log("----------------------------------------------");
    } else {
        console.log("Pass in folder you want to work with!");
    }
}

async function uploadFiles(outputDir, folderPath, item){
	if(item.endsWith('.las')){
	    await new Promise(async function(resolve, reject) {	    	
	        let data = folderPath + item;
	        const fileContent = fs.readFileSync(data);
	        const params = {
	            Bucket: BUCKET,
	            Key: outputDir + item, // File name you want to save as in S3
	            Body: fileContent
	        };

	        //console.log(params);

	        console.log(`Uploading ${data}`);

	        var lastProgress = 0;        
	        s3.putObject(params)
	            .on('httpUploadProgress', function(evt) {   // TOOD: upload progress only callbacks when reached to 100%
	                var progress = Math.round(evt.loaded / evt.total * 100);
	                if(lastProgress != progress){
	                    lastProgress = progress;
	                    console.log(`File upload: ${progress}% - ${params.Key}`)
	                }
	            })
	            .send(function(err, data) {
	                if(err)
	                    console.log(err);
	                else
	                    console.log("File uploaded successfully to:", params.Key);
	                resolve();
	            });
	    });
	}
}

function getItems(dir){
    return new Promise(function(resolve, reject) {
        fs.readdir(dir, function(err, items) {
            resolve(items);
        });
    });
}
