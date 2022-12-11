const AWS = require('aws-sdk');

const stepFunctions = new AWS.StepFunctions({});

let bodyMessage = null;

function parseSqsBodyMessage(sqsRecord) {
    const body = sqsRecord.body;
    let result = {};
    try {
        result = JSON.parse(JSON.stringify(body));
    } catch (ex) {
        console.error('Error parsing sqs message body: ', ex);
    }

    return result;
}

exports.handler = function (event) {
    const records = event['Records'] || [];

    const errorRecords = records.filter((record) => {
        bodyMessage = parseSqsBodyMessage(record);
        return bodyMessage === null || bodyMessage.type === 'ERROR';
    });

    if (errorRecords.length > 0) {
        throw new Error('Received error from SQS message body');
    }

    console.log('SQS Records: ', JSON.stringify(records, null, 4));

    const params = {
        stateMachineArn: process.env.statemachine_arn,
        input: JSON.stringify({bodyMessage})
    };

    stepFunctions.startExecution(params, (err, data) => {
        if (err) {
            console.log(err);
            const response = {
                statusCode: 500,
                body: JSON.stringify({
                    message: 'There was an error'
                })
            };
            callback(null, response);
        } else {
            console.log(data);
            const response = {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Step function worked'
                })
            };
            callback(null, response);
        }
    });
}