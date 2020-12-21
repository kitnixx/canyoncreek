const fs = require('fs');
const download = require('../s3_download/download.js');
const batch = require('../ec2_batch/batch.js');
const upload = require('../s3_upload/upload.js');
var baseDir = process.cwd().replace('backend', '');
baseDir = baseDir.replace(/\\/g, "/");

function writeFile(fileName, content){
    return new Promise(function(resolve, reject) {
        fs.writeFile(fileName, JSON.stringify(content), function(err) {
            resolve();
        });
    });
}

async function batch_process(msg){
	let id = msg.id;
	let params = msg.params;
	
	try{
		await download.main(baseDir, params.bucket, params.data);
	} catch(e){
		console.log(e);
		return "Failed to download or ran out of memory. Check Cloudwatch logs for more information.";
	}

	try{
		await batch.main(baseDir, params, id);
	} catch(e){
		console.log(e);
		return "Failed do processing. Check Cloudwatch logs for more information.";
	}

	// upload jobParams details
  	try{
  		// create outputs directory for current file
  		if (!fs.existsSync(baseDir + params.data + '/request/'))
	        fs.mkdirSync(baseDir + params.data + '/request/');
	    if (!fs.existsSync(baseDir + params.data + '/request/outputs/'))
	        fs.mkdirSync(baseDir + params.data + '/request/outputs/');

	  	msg.endTime = (new Date(new Date().toUTCString())).toString();
	  	msg.message = "Successfully ran";
		await writeFile(baseDir + params.data + '/request/outputs/jobParams.json', msg);
		await upload.main(baseDir, params.bucket, params.data, id, 'jobParams');
 	} catch(e){
 		console.log(e);
		return "Failed to upload jobParams. Check Cloudwatch logs for more information.";
	}

	return "Successfully ran";
}

// receive message from master process
process.on('message', async (msg) => {
  	let message = await batch_process(msg);  

  	// send response to master process
  	process.send(message);
});