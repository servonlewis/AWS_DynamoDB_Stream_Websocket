"use strict";

const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();
const { getConnectionIds } = require("./handler");
require("aws-sdk/clients/apigatewaymanagementapi");

const successfullResponse = {
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
  },
  body: "everything is alright"
};

const sendStream = (event, connectionId) => {
  const endpoint = "le5k4lhjo6.execute-api.us-east-1.amazonaws.com/dev";
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint
  });

  const params = {
    ConnectionId: connectionId,
    Data: JSON.stringify(event)
  };
  const test = apigwManagementApi.postToConnection(params).promise();

  console.log(test);
};

const sendMessageHandlerStream = (event, context, callback) => {
  console.log("EVENT", JSON.stringify(event));
  sendMessageToAllConnectedStream(event)
    .then(() => {
      callback(null, successfullResponse);
    })
    .catch(err => {
      callback(null, JSON.stringify(err));
    });
};

const sendMessageToAllConnectedStream = event =>
  getConnectionIds().then(connectionData =>
    connectionData.Items.map(connectionId =>
      sendStream(event, connectionId.connectionId)
    )
  );

const getStream = (event, context, callback) => {
  const params = {
    TableName: process.env.demoTable
  };

  console.log("EVENT", JSON.stringify(event));

  dynamo.scan(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      callback(new Error("Error scanning db"));
      return;
    }

    console.log("STREAM RESULT", JSON.stringify(result));
    console.log("STREAM WHAT CHANGED", JSON.stringify(event.Records));
    // create a response

    sendMessageHandlerStream(
      { dynamoTable: result.Items, whatChanged: event.Records[0] },
      context,
      callback
    );
  });
};

module.exports.getStream = getStream;
