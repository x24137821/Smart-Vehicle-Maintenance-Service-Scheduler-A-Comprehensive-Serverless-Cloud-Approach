const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const SERVICES_TABLE = process.env.SERVICES_TABLE;
const VEHICLES_TABLE = process.env.VEHICLES_TABLE;
const REMINDERS_TOPIC_ARN = process.env.REMINDERS_TOPIC_ARN || '';

// Service rules (same as predictions function)
const SERVICE_RULES = {
  oil_change: { mileageInterval: 5000, timeInterval: 180, name: 'Oil Change' },
  brake_check: { mileageInterval: 15000, timeInterval: 365, name: 'Brake Check' },
  tire_rotation: { mileageInterval: 7500, timeInterval: 180, name: 'Tire Rotation' },
  air_filter: { mileageInterval: 15000, timeInterval: 365, name: 'Air Filter Replacement' },
  battery_check: { mileageInterval: 0, timeInterval: 365, name: 'Battery Check' },
  transmission_service: { mileageInterval: 30000, timeInterval: 730, name: 'Transmission Service' },
  coolant_flush: { mileageInterval: 30000, timeInterval: 730, name: 'Coolant Flush' }
};

// Calculate if service is due soon (within 7 days or overdue)
function isServiceDueSoon(prediction) {
  return prediction.daysUntil <= 7;
}

// Get all users and their vehicles
async function getAllUsersAndVehicles() {
  // Note: This is a simplified approach. In production, you'd want to maintain
  // a separate user index or use a different approach.
  // For now, we'll scan vehicles table (not ideal for large scale, but works for learning)
  
  const params = {
    TableName: VEHICLES_TABLE
  };
  
  const result = await dynamodb.scan(params).promise();
  return result.Items || [];
}

// Get services for a vehicle
async function getVehicleServices(vehicleId) {
  const params = {
    TableName: SERVICES_TABLE,
    KeyConditionExpression: 'vehicleId = :vehicleId',
    ExpressionAttributeValues: {
      ':vehicleId': vehicleId
    }
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items || [];
}

// Calculate predictions (similar to predictions function)
function calculateNextService(lastService, vehicle, serviceType) {
  const rule = SERVICE_RULES[serviceType];
  if (!rule) return null;

  const lastServiceDate = new Date(lastService.serviceDate);
  const lastServiceMileage = lastService.mileage || 0;
  const currentMileage = vehicle.currentMileage || 0;
  const now = new Date();

  let nextMileageDate = null;
  if (rule.mileageInterval > 0) {
    const milesSinceService = currentMileage - lastServiceMileage;
    const milesRemaining = rule.mileageInterval - milesSinceService;
    if (milesRemaining <= 0) {
      nextMileageDate = now;
    } else {
      const daysSinceService = (now - lastServiceDate) / (1000 * 60 * 60 * 24);
      const avgMilesPerDay = daysSinceService > 0 ? milesSinceService / daysSinceService : 0;
      if (avgMilesPerDay > 0) {
        const daysUntilMileage = milesRemaining / avgMilesPerDay;
        nextMileageDate = new Date(now.getTime() + daysUntilMileage * 24 * 60 * 60 * 1000);
      }
    }
  }

  let nextTimeDate = null;
  if (rule.timeInterval > 0) {
    nextTimeDate = new Date(lastServiceDate.getTime() + rule.timeInterval * 24 * 60 * 60 * 1000);
  }

  let nextServiceDate = null;
  if (nextMileageDate && nextTimeDate) {
    nextServiceDate = nextMileageDate < nextTimeDate ? nextMileageDate : nextTimeDate;
  } else if (nextMileageDate) {
    nextServiceDate = nextMileageDate;
  } else if (nextTimeDate) {
    nextServiceDate = nextTimeDate;
  }

  if (!nextServiceDate) return null;

  const daysUntil = Math.ceil((nextServiceDate - now) / (1000 * 60 * 60 * 24));
  return {
    serviceType,
    serviceName: rule.name,
    nextServiceDate: nextServiceDate.toISOString(),
    daysUntil,
    isOverdue: daysUntil < 0
  };
}

// Send reminder via SNS
async function sendReminder(userEmail, vehicle, predictions) {
  if (!REMINDERS_TOPIC_ARN) {
    console.log('SNS Topic not configured, skipping reminder');
    return;
  }

  const dueServices = predictions.filter(p => isServiceDueSoon(p));
  if (dueServices.length === 0) {
    return; // No services due soon
  }

  const message = {
    subject: `Service Reminder: ${vehicle.make} ${vehicle.model}`,
    body: `Hello,\n\nYour ${vehicle.year} ${vehicle.make} ${vehicle.model} has the following services due:\n\n` +
      dueServices.map(s => 
        `- ${s.serviceName}: ${s.isOverdue ? 'OVERDUE' : `Due in ${s.daysUntil} days`}`
      ).join('\n') +
      `\n\nPlease schedule these services soon.\n\nSmart Vehicle Maintenance`
  };

  try {
    await sns.publish({
      TopicArn: REMINDERS_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: message.subject
    }).promise();
    
    console.log(`Reminder sent to ${userEmail} for vehicle ${vehicle.vehicleId}`);
  } catch (error) {
    console.error(`Error sending reminder to ${userEmail}:`, error);
  }
}

exports.handler = async (event) => {
  try {
    console.log('Reminder function triggered');
    
    // Get all vehicles
    const vehicles = await getAllUsersAndVehicles();
    console.log(`Found ${vehicles.length} vehicles`);

    // Group vehicles by user
    const vehiclesByUser = {};
    vehicles.forEach(vehicle => {
      if (!vehiclesByUser[vehicle.userId]) {
        vehiclesByUser[vehicle.userId] = [];
      }
      vehiclesByUser[vehicle.userId].push(vehicle);
    });

    // Process each user's vehicles
    for (const [userId, userVehicles] of Object.entries(vehiclesByUser)) {
      for (const vehicle of userVehicles) {
        // Get services for this vehicle
        const services = await getVehicleServices(vehicle.vehicleId);
        
        // Group services by type
        const lastServicesByType = {};
        services.forEach(service => {
          const serviceType = service.serviceType;
          if (!lastServicesByType[serviceType] || 
              new Date(service.serviceDate) > new Date(lastServicesByType[serviceType].serviceDate)) {
            lastServicesByType[serviceType] = service;
          }
        });

        // Calculate predictions
        const predictions = [];
        Object.keys(SERVICE_RULES).forEach(serviceType => {
          const lastService = lastServicesByType[serviceType];
          if (lastService) {
            const prediction = calculateNextService(lastService, vehicle, serviceType);
            if (prediction) {
              predictions.push(prediction);
            }
          }
        });

        // Check if any services are due soon
        const dueServices = predictions.filter(p => isServiceDueSoon(p));
        if (dueServices.length > 0) {
          // In a real implementation, you'd fetch user email from Cognito
          // For now, we'll log it
          console.log(`User ${userId} has ${dueServices.length} services due for vehicle ${vehicle.vehicleId}`);
          
          // TODO: Fetch user email from Cognito and send reminder
          // For now, this is a placeholder
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Reminder check completed',
        vehiclesProcessed: vehicles.length
      })
    };
  } catch (error) {
    console.error('Error in reminder function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

