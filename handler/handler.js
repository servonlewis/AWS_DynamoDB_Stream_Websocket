"use strict";

const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();

require("aws-sdk/clients/apigatewaymanagementapi");

const successfullResponse = {
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
  },
  body: "everything is alright"
};

const connectionHandler = (event, context, callback) => {
  console.log(event);

  if (event.requestContext.eventType === "CONNECT") {
    // Handle connection
    addConnection(event.requestContext.connectionId)
      .then(() => {
        callback(null, successfullResponse);
      })
      .catch(err => {
        console.log(err);
        callback(null, JSON.stringify(err));
      });
  } else if (event.requestContext.eventType === "DISCONNECT") {
    // Handle disconnection
    deleteConnection(event.requestContext.connectionId)
      .then(() => {
        callback(null, successfullResponse);
      })
      .catch(err => {
        console.log(err);
        callback(null, {
          statusCode: 500,
          body: "Failed to connect: " + JSON.stringify(err)
        });
      });
  }
};

// THIS ONE DOESNT DO ANYHTING
const defaultHandler = (event, context, callback) => {
  console.log("defaultHandler was called");
  console.log(event);

  callback(null, {
    statusCode: 200,
    body: "defaultHandler"
  });
};

const sendMessageHandler = (event, context, callback) => {
  console.log("EVENT", JSON.stringify(event));
  sendMessageToAllConnected(event)
    .then(() => {
      callback(null, successfullResponse);
    })
    .catch(err => {
      callback(null, JSON.stringify(err));
    });
};

const sendMessageToAllConnected = event =>
  getConnectionIds().then(connectionData =>
    connectionData.Items.map(connectionId =>
      send(event, connectionId.connectionId)
    )
  );

const getConnectionIds = () => {
  const params = {
    TableName: process.env.websocketIDTable,
    ProjectionExpression: "connectionId"
  };

  return dynamo.scan(params).promise();
};

const send = (event, connectionId) => {
  const body = JSON.parse(event.body);
  const postData = body.data;

  const endpoint =
    event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint
  });

  const params = {
    ConnectionId: connectionId,
    Data: postData
  };
  return apigwManagementApi.postToConnection(params).promise();
};

const addConnection = connectionId => {
  const params = {
    TableName: process.env.websocketIDTable,
    Item: {
      connectionId: connectionId
    }
  };

  return dynamo.put(params).promise();
};

const deleteConnection = connectionId => {
  const params = {
    TableName: process.env.websocketIDTable,
    Key: {
      connectionId: connectionId
    }
  };

  return dynamo.delete(params).promise();
};

module.exports.defaultHandler = defaultHandler;
module.exports.connectionHandler = connectionHandler;
module.exports.sendMessageHandler = sendMessageHandler;

module.exports.getConnectionIds = getConnectionIds;
