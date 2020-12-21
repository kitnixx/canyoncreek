const rimraf = require("rimraf");
const queue = require('queue');
const { fork } = require('child_process');
const uuidv4 = require("uuid/v4");
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const port = 80;

app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header('Content-Type', 'application/json');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

var q = queue();
q.autostart = true;
q.concurrency = 1;
q.timeout = 60*60*1000;  // 60 min timeout

let finishedIds = []
let queuedIds = [];
let childProcess;

q.on('timeout', function (next, job) {
    if(queuedIds[0] != null){
        console.log('Job timed out:', queuedIds[0]);
        finishedIds.push({
            id: queuedIds[0].id,
            startTime: queuedIds[0].startTime,
            endTime: (new Date(new Date().toUTCString())).toString(),
            params: queuedIds[0].params,
            status: "Timed Out"
        });
        if(childProcess != null){
            childProcess.kill('SIGINT');
        }
    }
    next();
})
// get notified when jobs complete
q.on('success', function (result, job) {
    if(queuedIds[0] != null){
        console.log('Job finished processing:', queuedIds[0]);
        finishedIds.push({
            id: queuedIds[0].id,
            startTime: queuedIds[0].startTime,
            endTime: (new Date(new Date().toUTCString())).toString(),
            params: queuedIds[0].params,
            status: "Finished",
            message: queuedIds[0].message
        });
        queuedIds.shift();
    }
})

var baseDir = process.cwd().replace('backend', '');
baseDir = baseDir.replace(/\\/g, "/");

app.post('/start', (req, res) => {    
    let id = uuidv4();

    let params = req.body;
    if(params.timeout > 0){
        if(params.timeout > 24*60)  // 24 hours max
            params.timeout = 24*60;
    } else {
        params.timeout = 1*60;  // default is 1 hour
    }
    params.timeout *= 60*1000;

    let jobDetails = {
    	id: id,
    	startTime: (new Date(new Date().toUTCString())).toString(),
        params: params,
        message: ""
    }
    queuedIds.push(jobDetails);

    let job = async function (cb) {
        await new Promise(function (resolve, reject) {
            let queuePos = queuedIds.map(item => item.id).indexOf(id);
            if(queuePos >= 0){
                console.log("----------------------------------------------");
                console.log("Starting Job:", id);
                console.log("----------------------------------------------");

                // fork another process
                childProcess = fork('./backgroundThread.js');         
                // send dataFolder to forked process
                childProcess.send(queuedIds[queuePos]);
                // listen for messages from forked process
                childProcess.on('message', async (message) => {
                    console.log(message);
                    queuedIds[queuePos].message = message;

                    console.log(`Child process completed`);

                    // delete the data directory
                    await new Promise(function(resolve, reject) {
                        rimraf(baseDir + queuedIds[queuePos].params.data + '/', function () {
                            console.log("Cleaned up data directory:", queuedIds[queuePos].params.data);
                            resolve();
                        });
                    });

                    resolve();
                });

                childProcess.on('close', async (code, signal) => {
                    console.log(`Child process terminated due to receipt of signal ${signal}`);

                    // delete the data directory
                    await new Promise(function(resolve, reject) {
                        rimraf(baseDir + queuedIds[queuePos].params.data + '/', function () {
                            console.log("Cleaned up data directory:", queuedIds[queuePos].params.data);
                            resolve();
                        });
                    });

                    // do this after ending childProcess b/c this block of code still depends on queuedIds params
                    queuedIds.shift();

                    resolve();
                });
            }
            else
                resolve();
        });
        cb();
    };
    console.log("TIMEOUT: " + params.timeout);
    job.timeout = params.timeout;
	q.push(job);

	jobDetails.queuePos = queuedIds.length-1
    res.send(jobDetails);
});

app.get('/status/:id', (req, res) => {
    let id = req.params.id;
    let finishedPos = finishedIds.map(item => item.id).indexOf(id);
    let queuePos = queuedIds.map(item => item.id).indexOf(id);

    let ret = {};

    if(finishedPos >= 0){
    	ret = finishedIds[finishedPos];
        ret.status = finishedIds[finishedPos].status;
    }
    else if(queuePos > 0){
    	ret = queuedIds[queuePos];
        ret.queuePos = queuePos;
        ret.status = "In Queue";
    }
    else if(queuePos == 0){
    	ret = queuedIds[queuePos];
        ret.queuePos = queuePos;
        ret.status = "Job is Running";
    }    
    else
        ret.status = "Unknown ID";

    res.send(ret);
});

app.delete('/cancel/:id', (req, res) => {  // TODO: remove from queue as well
    let id = req.params.id;
    let finishedPos = finishedIds.map(item => item.id).indexOf(id);
    let queuePos = queuedIds.map(item => item.id).indexOf(id);

    let ret = {};

    if(finishedPos >= 0){
    	ret = finishedIds[finishedPos];
    }
    else if(queuePos > 0){
    	ret = {
            id: queuedIds[queuePos].id,
            startTime: queuedIds[queuePos].startTime,
            endTime: (new Date(new Date().toUTCString())).toString(),
            params: queuedIds[queuePos].params,
            status: "Canceled"
        };
        finishedIds.push(ret);
        queuedIds.splice(queuePos, 1);        
    }
    else if(queuePos == 0){        
        ret = {
            id: queuedIds[queuePos].id,
            startTime: queuedIds[queuePos].startTime,
            endTime: (new Date(new Date().toUTCString())).toString(),
            params: queuedIds[queuePos].params,
            status: "Canceled"
        };
        finishedIds.push(ret);        
        if(childProcess != null){
            childProcess.kill('SIGINT');            
        }
    }
    else
        ret.status = "Unknown ID";

    res.send(ret);
});

app.listen(port, () => console.log(`App listening on http://localhost:${port}`));