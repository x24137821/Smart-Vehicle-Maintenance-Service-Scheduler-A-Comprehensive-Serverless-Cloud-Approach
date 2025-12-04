import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { vehicleService, serviceService, predictionService } from '../services/api';
import Navbar from './Navbar';
import ServiceForm from './ServiceForm';
import { format } from 'date-fns';

function VehicleDetail() {
  const { vehicleId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [services, setServices] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [activeTab, setActiveTab] = useState('services'); // 'services' or 'predictions'

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function loadData() {
    try {
      const [vehicleRes, servicesRes, predictionsRes] = await Promise.all([
        vehicleService.get(vehicleId),
        serviceService.getAll(vehicleId),
        predictionService.get(vehicleId)
      ]);
      
      setVehicle(vehicleRes.data);
      setServices(servicesRes.data.services || []);
      setPredictions(predictionsRes.data.predictions || []);
    } catch (err) {
      setError('Failed to load vehicle data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteService(serviceId, e) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this service record?')) {
      return;
    }

    try {
      await serviceService.delete(serviceId);
      loadData();
    } catch (err) {
      setError('Failed to delete service');
      console.error(err);
    }
  }

  function handleEditService(service, e) {
    e.stopPropagation();
    setEditingService(service);
    setShowServiceForm(true);
  }

  function handleFormClose() {
    setShowServiceForm(false);
    setEditingService(null);
    loadData();
  }

  if (loading) {
    return (
      <>
        <Navbar user={user} signOut={signOut} />
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </>
    );
  }

  if (!vehicle) {
    return (
      <>
        <Navbar user={user} signOut={signOut} />
        <div className="container">
          <div className="error">Vehicle not found</div>
          <button className="btn btn-secondary" onClick={() => navigate('/vehicles')}>
            Back to Vehicles
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar user={user} signOut={signOut} />
      <div className="container">
        <div style={{ marginBottom: '20px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/vehicles')} style={{ marginBottom: '10px' }}>
            ← Back to Vehicles
          </button>
          <div className="card">
            <h1>{vehicle.year} {vehicle.make} {vehicle.model}</h1>
            <p><strong>VIN:</strong> {vehicle.vin || 'N/A'}</p>
            <p><strong>Current Mileage:</strong> {vehicle.currentMileage?.toLocaleString()} miles</p>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button
            className={`btn ${activeTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('services')}
          >
            Service History
          </button>
          <button
            className={`btn ${activeTab === 'predictions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('predictions')}
          >
            Upcoming Services
          </button>
        </div>

        {activeTab === 'services' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => setShowServiceForm(true)}
              >
                Add Service Record
              </button>
            </div>

            {showServiceForm && (
              <ServiceForm
                vehicleId={vehicleId}
                service={editingService}
                onClose={handleFormClose}
                onSave={loadData}
              />
            )}

            {services.length === 0 ? (
              <div className="empty-state">
                <h3>No service records yet</h3>
                <p>Add your first service record to start tracking maintenance</p>
              </div>
            ) : (
              services.map(service => (
                <div key={service.serviceId} className="service-item">
                  <h4>{service.serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                  <p><strong>Date:</strong> {format(new Date(service.serviceDate), 'MMM dd, yyyy')}</p>
                  <p><strong>Mileage:</strong> {service.mileage?.toLocaleString()} miles</p>
                  {service.cost > 0 && <p><strong>Cost:</strong> ${service.cost.toFixed(2)}</p>}
                  {service.serviceProvider && <p><strong>Provider:</strong> {service.serviceProvider}</p>}
                  {service.description && <p><strong>Description:</strong> {service.description}</p>}
                  {service.notes && <p><strong>Notes:</strong> {service.notes}</p>}
                  <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={(e) => handleEditService(service, e)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={(e) => handleDeleteService(service.serviceId, e)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'predictions' && (
          <>
            {predictions.length === 0 ? (
              <div className="empty-state">
                <h3>No predictions available</h3>
                <p>Add service records to get predictions for upcoming maintenance</p>
              </div>
            ) : (
              predictions.map((prediction, index) => (
                <div 
                  key={index} 
                  className={`prediction-item ${prediction.isOverdue ? 'overdue' : ''}`}
                >
                  <h4>{prediction.serviceName}</h4>
                  <p>
                    <strong>Status:</strong>{' '}
                    {prediction.isOverdue ? (
                      <span className="overdue">OVERDUE</span>
                    ) : prediction.daysUntil <= 7 ? (
                      <span className="due-soon">Due in {prediction.daysUntil} days</span>
                    ) : (
                      <span>Due in {prediction.daysUntil} days</span>
                    )}
                  </p>
                  <p><strong>Next Service Date:</strong> {format(new Date(prediction.nextServiceDate), 'MMM dd, yyyy')}</p>
                  {prediction.lastServiceDate && (
                    <p><strong>Last Service:</strong> {format(new Date(prediction.lastServiceDate), 'MMM dd, yyyy')}</p>
                  )}
                  {prediction.recommendedMileage && (
                    <p><strong>Recommended at Mileage:</strong> {prediction.recommendedMileage.toLocaleString()} miles</p>
                  )}
                  {prediction.currentMileage && (
                    <p><strong>Current Mileage:</strong> {prediction.currentMileage.toLocaleString()} miles</p>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}

export default VehicleDetail;

