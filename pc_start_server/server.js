const AWS = require("aws-sdk");
AWS.config.update({region:'us-east-1'});
const ec2 = new AWS.EC2();

const node_ssh = require('node-ssh');
const ssh = new node_ssh();

const myArgs = process.argv.slice(2);
const DATA_DIR = myArgs[0];

main();

async function main(){
    if(myArgs[0] != null){
    	var params = {
    		InstanceIds: [
    			"i-097196d37382b256d"
    	 	]
    	};

    	console.log("---------------------------------");
    	console.log("Starting instance...");
    	await ec2.startInstances(params).promise()
    		.then((err, data) => {
    		  	if(err)
    		  		console.log(err);
    		  	else{
    		  		console.log(data);
    			}
    			return;
    		});

    	console.log("---------------------------------");
    	console.log("Waiting for instance to start...");
    	await ec2.waitFor("instanceRunning", params).promise()
    		.then((err, data) => {
    			if(err)
    				console.log(err);
    			else{
    				console.log(data);
    			}
    			return;
    		});

    	console.log("---------------------------------");
    	console.log("SSH-ing to EC2 instance...")
    	await ssh.connect({
    		host: 'ec2-54-91-186-10.compute-1.amazonaws.com',
    		username: 'ec2-user',
    		privateKey: '../key.pem'
    	})
    	.then(async function() {
    		console.log("---------------------------------");
    		console.log("Connected to instance!");
    		// Command
    		console.log("---------------------------------");

            /*await ssh.exec(`node download.js ${DATA_DIR}`, [''], {
    			cwd:'/home/ubuntu/s3_download',
    			onStdout(chunk) {
    		    	console.log(chunk.toString('utf8'));
    		    },
    		    onStderr(chunk) {
    		      	console.log('stderrChunk', chunk.toString('utf8'));
    		    },
    		});*/

    		/*await ssh.exec(`node batch.js ${DATA_DIR}`, [''], {
    			cwd:'/home/ubuntu/ec2_batch',
    			onStdout(chunk) {
    		    	console.log(chunk.toString('utf8'));
    		    },
    		    onStderr(chunk) {
    		      	console.log('stderrChunk', chunk.toString('utf8'));
    		    },
    		});*/

    		/*await ssh.exec(`node s3_upload.js ${DATA_DIR}`, [''], {
    			cwd:'/home/ubuntu/s3_upload',
    			onStdout(chunk) {
    		    	console.log(chunk.toString('utf8'));
    		    },
    		    onStderr(chunk) {
    		      	console.log('stderrChunk', chunk.toString('utf8'));
    		    },
    		});*/
    	})
    	.catch(function(e) {
		 	console.log(e);
		});

    	/*console.log("---------------------------------");
    	console.log("Stopping instance...");
    	await ec2.stopInstances(params).promise()
    		.then(async (err, data) => {
    		  	if(err)
    		  		console.log(err);
    		  	else{
    		  		console.log(data);
    			}
    			return;
    		});

    	console.log("---------------------------------");
    	console.log("Waiting for instance to stop...");
    	await ec2.waitFor("instanceStopped", params).promise()
    		.then(async (err, data) => {
    			if(err)
    				console.log(err);
    			else{
    				console.log(data);
    			}
    			return;
    		});*/
    	
    	console.log("---------------------------------");
        console.log("Exiting now.");
    	process.exit();	// Force exit b/c node-ssh  doesn't provide any way to disconnect
    } else {
        console.log("Pass in folder you want to work with!");
    }
}
