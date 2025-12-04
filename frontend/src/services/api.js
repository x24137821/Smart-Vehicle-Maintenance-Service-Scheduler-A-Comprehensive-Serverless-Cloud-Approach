import axios from 'axios';
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const API_URL = process.env.REACT_APP_API_URL || '';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper to get auth token
async function getAuthToken() {
  try {
    const poolData = {
      UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
      ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID
    };
    const userPool = new CognitoUserPool(poolData);
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser) {
      return new Promise((resolve, reject) => {
        cognitoUser.getSession((err, session) => {
          if (err || !session.isValid()) {
            reject(err || new Error('Invalid session'));
          } else {
            resolve(session.getIdToken().getJwtToken());
          }
        });
      });
    }
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const vehicleService = {
  getAll: () => api.get('/vehicles'),
  get: (vehicleId) => api.get(`/vehicles/${vehicleId}`),
  create: (data) => api.post('/vehicles', data),
  update: (vehicleId, data) => api.put(`/vehicles/${vehicleId}`, data),
  delete: (vehicleId) => api.delete(`/vehicles/${vehicleId}`)
};

export const serviceService = {
  getAll: (vehicleId) => api.get(`/vehicles/${vehicleId}/services`),
  create: (vehicleId, data) => api.post(`/vehicles/${vehicleId}/services`, data),
  update: (serviceId, data) => api.put(`/services/${serviceId}`, data),
  delete: (serviceId) => api.delete(`/services/${serviceId}`)
};

export const predictionService = {
  get: (vehicleId) => api.get(`/vehicles/${vehicleId}/predictions`)
};

export default api;

