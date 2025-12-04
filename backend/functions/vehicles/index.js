const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const VEHICLES_TABLE = process.env.VEHICLES_TABLE;

// Helper to get user ID from Cognito token
function getUserId(event) {
  const claims = event.requestContext.authorizer.claims;
  return claims.sub; // Cognito user ID
}

// Helper to create response
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

// GET /vehicles - Get all vehicles for user
exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    const httpMethod = event.requestContext.http.method;

    if (httpMethod === 'GET' && !event.pathParameters) {
      // Get all vehicles
      const params = {
        TableName: VEHICLES_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      };

      const result = await dynamodb.query(params).promise();
      return createResponse(200, { vehicles: result.Items });
    }

    if (httpMethod === 'GET' && event.pathParameters?.vehicleId) {
      // Get single vehicle
      const vehicleId = event.pathParameters.vehicleId;
      const params = {
        TableName: VEHICLES_TABLE,
        Key: {
          userId,
          vehicleId
        }
      };

      const result = await dynamodb.get(params).promise();
      if (!result.Item) {
        return createResponse(404, { error: 'Vehicle not found' });
      }
      return createResponse(200, result.Item);
    }

    if (httpMethod === 'POST') {
      // Create vehicle
      const body = JSON.parse(event.body || '{}');
      const vehicleId = body.vehicleId || `vehicle-${Date.now()}`;
      
      const vehicle = {
        userId,
        vehicleId,
        make: body.make,
        model: body.model,
        year: body.year,
        vin: body.vin || '',
        currentMileage: body.currentMileage || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const params = {
        TableName: VEHICLES_TABLE,
        Item: vehicle
      };

      await dynamodb.put(params).promise();
      return createResponse(201, vehicle);
    }

    if (httpMethod === 'PUT' && event.pathParameters?.vehicleId) {
      // Update vehicle
      const vehicleId = event.pathParameters.vehicleId;
      const body = JSON.parse(event.body || '{}');
      
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      if (body.make) {
        updateExpression.push('#make = :make');
        expressionAttributeNames['#make'] = 'make';
        expressionAttributeValues[':make'] = body.make;
      }
      if (body.model) {
        updateExpression.push('#model = :model');
        expressionAttributeNames['#model'] = 'model';
        expressionAttributeValues[':model'] = body.model;
      }
      if (body.year) {
        updateExpression.push('#year = :year');
        expressionAttributeNames['#year'] = 'year';
        expressionAttributeValues[':year'] = body.year;
      }
      if (body.vin !== undefined) {
        updateExpression.push('#vin = :vin');
        expressionAttributeNames['#vin'] = 'vin';
        expressionAttributeValues[':vin'] = body.vin;
      }
      if (body.currentMileage !== undefined) {
        updateExpression.push('#currentMileage = :currentMileage');
        expressionAttributeNames['#currentMileage'] = 'currentMileage';
        expressionAttributeValues[':currentMileage'] = body.currentMileage;
      }

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const params = {
        TableName: VEHICLES_TABLE,
        Key: { userId, vehicleId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };

      const result = await dynamodb.update(params).promise();
      return createResponse(200, result.Attributes);
    }

    if (httpMethod === 'DELETE' && event.pathParameters?.vehicleId) {
      // Delete vehicle
      const vehicleId = event.pathParameters.vehicleId;
      const params = {
        TableName: VEHICLES_TABLE,
        Key: { userId, vehicleId }
      };

      await dynamodb.delete(params).promise();
      return createResponse(200, { message: 'Vehicle deleted successfully' });
    }

    return createResponse(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return createResponse(500, { error: error.message });
  }
};

