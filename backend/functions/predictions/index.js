const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const SERVICES_TABLE = process.env.SERVICES_TABLE;
const VEHICLES_TABLE = process.env.VEHICLES_TABLE;

// Service rules - mileage intervals and time intervals (in days)
const SERVICE_RULES = {
  oil_change: {
    mileageInterval: 5000,
    timeInterval: 180, // 6 months
    name: 'Oil Change'
  },
  brake_check: {
    mileageInterval: 15000,
    timeInterval: 365, // 1 year
    name: 'Brake Check'
  },
  tire_rotation: {
    mileageInterval: 7500,
    timeInterval: 180, // 6 months
    name: 'Tire Rotation'
  },
  air_filter: {
    mileageInterval: 15000,
    timeInterval: 365, // 1 year
    name: 'Air Filter Replacement'
  },
  battery_check: {
    mileageInterval: 0,
    timeInterval: 365, // 1 year
    name: 'Battery Check'
  },
  transmission_service: {
    mileageInterval: 30000,
    timeInterval: 730, // 2 years
    name: 'Transmission Service'
  },
  coolant_flush: {
    mileageInterval: 30000,
    timeInterval: 730, // 2 years
    name: 'Coolant Flush'
  }
};

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
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

// Calculate next service date based on rules
function calculateNextService(lastService, vehicle, serviceType) {
  const rule = SERVICE_RULES[serviceType];
  if (!rule) {
    return null;
  }

  const lastServiceDate = new Date(lastService.serviceDate);
  const lastServiceMileage = lastService.mileage || 0;
  const currentMileage = vehicle.currentMileage || 0;
  const now = new Date();

  // Calculate next service based on mileage
  let nextMileageDate = null;
  if (rule.mileageInterval > 0) {
    const milesSinceService = currentMileage - lastServiceMileage;
    const milesRemaining = rule.mileageInterval - milesSinceService;
    if (milesRemaining <= 0) {
      nextMileageDate = now; // Due now
    } else {
      // Estimate date based on average miles per day
      const daysSinceService = (now - lastServiceDate) / (1000 * 60 * 60 * 24);
      const avgMilesPerDay = daysSinceService > 0 ? milesSinceService / daysSinceService : 0;
      if (avgMilesPerDay > 0) {
        const daysUntilMileage = milesRemaining / avgMilesPerDay;
        nextMileageDate = new Date(now.getTime() + daysUntilMileage * 24 * 60 * 60 * 1000);
      }
    }
  }

  // Calculate next service based on time
  let nextTimeDate = null;
  if (rule.timeInterval > 0) {
    nextTimeDate = new Date(lastServiceDate.getTime() + rule.timeInterval * 24 * 60 * 60 * 1000);
  }

  // Return the earlier date (whichever comes first)
  let nextServiceDate = null;
  if (nextMileageDate && nextTimeDate) {
    nextServiceDate = nextMileageDate < nextTimeDate ? nextMileageDate : nextTimeDate;
  } else if (nextMileageDate) {
    nextServiceDate = nextMileageDate;
  } else if (nextTimeDate) {
    nextServiceDate = nextTimeDate;
  }

  if (!nextServiceDate) {
    return null;
  }

  const daysUntil = Math.ceil((nextServiceDate - now) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntil < 0;

  return {
    serviceType,
    serviceName: rule.name,
    nextServiceDate: nextServiceDate.toISOString(),
    daysUntil,
    isOverdue,
    lastServiceDate: lastService.serviceDate,
    lastServiceMileage,
    currentMileage,
    recommendedMileage: lastServiceMileage + rule.mileageInterval,
    recommendedTimeInterval: rule.timeInterval
  };
}

exports.handler = async (event) => {
  try {
    const userId = getUserId(event);
    const vehicleId = event.pathParameters?.vehicleId;

    if (!vehicleId) {
      return createResponse(400, { error: 'Vehicle ID is required' });
    }

    // Get vehicle
    const vehicleParams = {
      TableName: VEHICLES_TABLE,
      Key: { userId, vehicleId }
    };
    const vehicleResult = await dynamodb.get(vehicleParams).promise();
    
    if (!vehicleResult.Item) {
      return createResponse(404, { error: 'Vehicle not found' });
    }

    const vehicle = vehicleResult.Item;

    // Get all services for this vehicle
    const servicesParams = {
      TableName: SERVICES_TABLE,
      KeyConditionExpression: 'vehicleId = :vehicleId',
      ExpressionAttributeValues: {
        ':vehicleId': vehicleId
      }
    };
    const servicesResult = await dynamodb.query(servicesParams).promise();
    const services = servicesResult.Items || [];

    // Group services by type and get the most recent for each type
    const lastServicesByType = {};
    services.forEach(service => {
      const serviceType = service.serviceType;
      if (!lastServicesByType[serviceType] || 
          new Date(service.serviceDate) > new Date(lastServicesByType[serviceType].serviceDate)) {
        lastServicesByType[serviceType] = service;
      }
    });

    // Calculate predictions for all service types
    const predictions = [];
    Object.keys(SERVICE_RULES).forEach(serviceType => {
      const lastService = lastServicesByType[serviceType];
      
      if (lastService) {
        // Calculate based on last service
        const prediction = calculateNextService(lastService, vehicle, serviceType);
        if (prediction) {
          predictions.push(prediction);
        }
      } else {
        // No previous service - recommend based on current mileage and date
        const rule = SERVICE_RULES[serviceType];
        const now = new Date();
        const nextDate = new Date(now.getTime() + rule.timeInterval * 24 * 60 * 60 * 1000);
        
        predictions.push({
          serviceType,
          serviceName: rule.name,
          nextServiceDate: nextDate.toISOString(),
          daysUntil: rule.timeInterval,
          isOverdue: false,
          lastServiceDate: null,
          lastServiceMileage: null,
          currentMileage: vehicle.currentMileage || 0,
          recommendedMileage: (vehicle.currentMileage || 0) + rule.mileageInterval,
          recommendedTimeInterval: rule.timeInterval,
          isFirstService: true
        });
      }
    });

    // Sort by days until (overdue first, then soonest)
    predictions.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.daysUntil - b.daysUntil;
    });

    return createResponse(200, {
      vehicleId,
      predictions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return createResponse(500, { error: error.message });
  }
};

