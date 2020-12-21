const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const fs = require('fs');

exports.main = async (baseDir, bucket, dataFolder, mainFolder='defaultMainFolder', subFolder='defaultSubFolder') => {
    if(baseDir != null && bucket != null && dataFolder != null){
        console.log("----------------------------------------------");
        console.log("Uploading files from Local to S3...");
        console.log("----------------------------------------------");

        var dataDir = baseDir + dataFolder + '/';
        var folders = await getItems(dataDir);

        for (var i=0; i<folders.length; i++) {
            var folderPath = dataDir + folders[i] + '/outputs/';
            var items = await getItems(folderPath); 
            var outputDir = dataFolder+'/'+mainFolder+'/'+folders[i]+'/'+subFolder+'/';

            for(let i in items){
                await uploadFiles(bucket, outputDir, folderPath, items[i]);
            }
        }
        console.log("----------------------------------------------");
    } else {
        console.log("Pass in bucket and folder you want to work with!");
    }
}

async function uploadFiles(bucket, outputDir, folderPath, item){
    await new Promise(async function(resolve, reject) {
        let data = folderPath + item;
        const fileContent = fs.readFileSync(data);
        const params = {
            Bucket: bucket,
            Key: outputDir + item, // File name you want to save as in S3
            Body: fileContent
        };

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

function getItems(dir){
    return new Promise(function(resolve, reject) {
        fs.readdir(dir, function(err, items) {
            resolve(items);
        });
    });
}
