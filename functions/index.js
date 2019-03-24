"use strict";

const AWS = require("aws-sdk");

module.exports.handler = async (event, context) => {
    if (!event.ResourceProperties) throw new Error('Invalid Request: Expected ResourceProperties member.')
    if (!event.ResourceProperties.SourceBucketName) throw new Error('Invalid Request: Expected SourceBucketName member.')
    if (!event.ResourceProperties.TargetBucketName) throw new Error('Invalid Request: Expected TargetBucketName member.')

    var params = {
        SourceBucket: event.ResourceProperties.SourceBucketName,
        SourcePrefix: event.ResourceProperties.SourceBucketPrefix || '',
        TargetBucket : event.ResourceProperties.TargetBucketName,
        TargetPrefix : event.ResourceProperties.TargetBucketPrefix || '',
        Retain: event.ResourceProperties.Retain || false,
        ACL: event.ResourceProperties.ACL
    };

    if (event.RequestType == 'Delete') {
        if (params.Retain) {
            try {
                var targetBucket = new AWS.S3();
                const data = await targetBucket.listObjects({ "Bucket" : params.TargetBucket }).promise();
                var deleteTasks = [];
                for (var index in data.Contents) {
                    var file = data.Contents[index];
                    console.log("Deleting " + file.Key);
                    deleteTasks.push(new Promise((resolve, reject) => {
                            targetBucket.deleteObject({Bucket: params.TargetBucket, Key: file.Key}, (e,d) => {
                                if (e) reject();
                                resolve();
                            });
                    }));
                }
                console.log("Waiting for delete operations to complete...")
                await Promise.all(deleteTasks);
                console.log("Delete succeeeded.")
                sendResponse(event, context, "SUCCESS");
            } catch (exception) {
                console.error("Error:", exception);
                sendResponse(event, context, "FAILED");
            }    
        } else {
            sendResponse(event, context, "SUCCESS");
        }
        return;
    }

    if (params.SourcePrefix && !params.SourcePrefix.endsWith('/')) {
        params.SourcePrefix += '/';
    }
    if (params.TargetPrefix && !params.TargetPrefix.endsWith('/')) {
        params.TargetPrefix += '/';
    }
    
    var status = "FAILED";
    try {
        var sourceBucket = new AWS.S3({ "params": { "Bucket" : params.SourceBucket } });
        var targetBucket = new AWS.S3({ "params": { "Bucket" : params.TargetBucket } });
        console.log("Listing source objects...")
        const data = await sourceBucket.listObjects({Prefix: params.SourcePrefix}).promise();
        if (!data.Contents || !data.Contents.length) {
            console.error("Error: No objects found.");
            sendResponse(event, context, status, null, null);                
            return;
        };
        var copyTasks = [];
        for (var index in data.Contents) {
            var file = data.Contents[index];
            copyTasks.push(
                copyS3Object(params.SourceBucket, params.SourcePrefix, file, targetBucket, params.TargetPrefix, params.ACL)
            );
        }
        console.log("Waiting for copy operations to complete...")
        await Promise.all(copyTasks);
        console.log("Copy succeeded!")
        sendResponse(event, context, "SUCCESS", null, null);
    }
    catch (exception) {
        console.error("Error:", exception);
        sendResponse(event, context, "FAILED", null, null);        
    }
}

async function copyS3Object(sourceBucket, sourcePrefix, file, targetBucket, targetPrefix, acl) {
    var copyParams = {
            CopySource: sourceBucket + '/' + file.Key,
            Bucket: targetBucket.config.Bucket,
            Key: targetPrefix + file.Key.replace(sourcePrefix, ''),
            ACL: acl
        };
    return new Promise((resolve, reject) => {
        targetBucket.copyObject(copyParams, (err, data) => {
            if (err) {
                console.error("Copy error. Unable to copy " + copyParams.CopySource + ":", err)
                reject();
            } else {
                resolve();
            }
        });
    });
}

function sendResponse(event, context, status, data, err) {
  var reason = err ? err.message : '';
  var responseBody = {
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    PhysicalResourceId: context.logStreamName,
    Status: status,
    Reason: reason + " See details in CloudWatch Log: " + context.logStreamName,
    Data: data
  };
 
  console.log("RESPONSE:\n", responseBody);
  var json = JSON.stringify(responseBody);
 
  var https = require("https");
  var url = require("url");
 
  var parsedUrl = url.parse(event.ResponseURL);
  var options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "content-type": "",
      "content-length": json.length
    }
  };
 
  var request = https.request(options, function(response) {
    console.log("STATUS: " + response.statusCode);
    console.log("HEADERS: " + JSON.stringify(response.headers));
    context.done(null, data);
  });
 
  request.on("error", function(error) {
    console.log("sendResponse Error:\n", error);
    context.done(error);
  });
 
  request.on("end", function() {
    console.log("end");
  });
  request.write(json);
  request.end();
}