const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const SERVICES_TABLE = process.env.SERVICES_TABLE;
const VEHICLES_TABLE = process.env.VEHICLES_TABLE;

// Helper to get user ID from Cognito token
function getUserId(event) {
  const claims = event.requestContext.authorizer.claims;
  return claims.sub;
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

// Verify vehicle belongs to user
async function verifyVehicleOwnership(userId, vehicleId) {
  const params = {
    TableName: VEHICLES_TABLE,
    Key: { userId, vehicleId }
  };
  const result = await dynamodb.get(params).promise();
  return !!result.Item;
}

exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    const httpMethod = event.requestContext.http.method;
    const pathParameters = event.pathParameters || {};

    if (httpMethod === 'GET' && pathParameters.vehicleId) {
      // Get all services for a vehicle
      const vehicleId = pathParameters.vehicleId;
      
      // Verify ownership
      const ownsVehicle = await verifyVehicleOwnership(userId, vehicleId);
      if (!ownsVehicle) {
        return createResponse(403, { error: 'Access denied' });
      }

      const params = {
        TableName: SERVICES_TABLE,
        KeyConditionExpression: 'vehicleId = :vehicleId',
        ExpressionAttributeValues: {
          ':vehicleId': vehicleId
        },
        ScanIndexForward: false // Sort by date descending
      };

      const result = await dynamodb.query(params).promise();
      return createResponse(200, { services: result.Items });
    }

    if (httpMethod === 'POST' && pathParameters.vehicleId) {
      // Create service record
      const vehicleId = pathParameters.vehicleId;
      const body = JSON.parse(event.body || '{}');
      
      // Verify ownership
      const ownsVehicle = await verifyVehicleOwnership(userId, vehicleId);
      if (!ownsVehicle) {
        return createResponse(403, { error: 'Access denied' });
      }

      const serviceId = body.serviceId || `service-${Date.now()}`;
      const service = {
        vehicleId,
        serviceId,
        userId, // Store for GSI queries
        serviceType: body.serviceType, // e.g., 'oil_change', 'brake_check', 'tire_rotation'
        serviceDate: body.serviceDate || new Date().toISOString(),
        mileage: body.mileage || 0,
        description: body.description || '',
        cost: body.cost || 0,
        serviceProvider: body.serviceProvider || '',
        notes: body.notes || '',
        createdAt: new Date().toISOString()
      };

      const params = {
        TableName: SERVICES_TABLE,
        Item: service
      };

      await dynamodb.put(params).promise();
      return createResponse(201, service);
    }

    if (httpMethod === 'PUT' && pathParameters.serviceId) {
      // Update service record
      const serviceId = pathParameters.serviceId;
      const body = JSON.parse(event.body || '{}');

      // First, get the service to verify ownership
      const getParams = {
        TableName: SERVICES_TABLE,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'serviceId = :serviceId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':serviceId': serviceId
        }
      };

      const existing = await dynamodb.query(getParams).promise();
      if (!existing.Items || existing.Items.length === 0) {
        return createResponse(404, { error: 'Service not found' });
      }

      const service = existing.Items[0];
      const vehicleId = service.vehicleId;

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      if (body.serviceType) {
        updateExpression.push('#serviceType = :serviceType');
        expressionAttributeNames['#serviceType'] = 'serviceType';
        expressionAttributeValues[':serviceType'] = body.serviceType;
      }
      if (body.serviceDate) {
        updateExpression.push('#serviceDate = :serviceDate');
        expressionAttributeNames['#serviceDate'] = 'serviceDate';
        expressionAttributeValues[':serviceDate'] = body.serviceDate;
      }
      if (body.mileage !== undefined) {
        updateExpression.push('#mileage = :mileage');
        expressionAttributeNames['#mileage'] = 'mileage';
        expressionAttributeValues[':mileage'] = body.mileage;
      }
      if (body.description !== undefined) {
        updateExpression.push('#description = :description');
        expressionAttributeNames['#description'] = 'description';
        expressionAttributeValues[':description'] = body.description;
      }
      if (body.cost !== undefined) {
        updateExpression.push('#cost = :cost');
        expressionAttributeNames['#cost'] = 'cost';
        expressionAttributeValues[':cost'] = body.cost;
      }
      if (body.serviceProvider !== undefined) {
        updateExpression.push('#serviceProvider = :serviceProvider');
        expressionAttributeNames['#serviceProvider'] = 'serviceProvider';
        expressionAttributeValues[':serviceProvider'] = body.serviceProvider;
      }
      if (body.notes !== undefined) {
        updateExpression.push('#notes = :notes');
        expressionAttributeNames['#notes'] = 'notes';
        expressionAttributeValues[':notes'] = body.notes;
      }

      if (updateExpression.length === 0) {
        return createResponse(400, { error: 'No fields to update' });
      }

      const params = {
        TableName: SERVICES_TABLE,
        Key: { vehicleId, serviceId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };

      const result = await dynamodb.update(params).promise();
      return createResponse(200, result.Attributes);
    }

    if (httpMethod === 'DELETE' && pathParameters.serviceId) {
      // Delete service record
      const serviceId = pathParameters.serviceId;

      // First, get the service to verify ownership and get vehicleId
      const getParams = {
        TableName: SERVICES_TABLE,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'serviceId = :serviceId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':serviceId': serviceId
        }
      };

      const existing = await dynamodb.query(getParams).promise();
      if (!existing.Items || existing.Items.length === 0) {
        return createResponse(404, { error: 'Service not found' });
      }

      const service = existing.Items[0];
      const params = {
        TableName: SERVICES_TABLE,
        Key: {
          vehicleId: service.vehicleId,
          serviceId
        }
      };

      await dynamodb.delete(params).promise();
      return createResponse(200, { message: 'Service deleted successfully' });
    }

    return createResponse(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return createResponse(500, { error: error.message });
  }
};

