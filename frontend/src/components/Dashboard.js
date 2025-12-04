import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { vehicleService } from '../services/api';
import Navbar from './Navbar';

function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      const response = await vehicleService.getAll();
      setVehicles(response.data.vehicles || []);
    } catch (err) {
      setError('Failed to load vehicles');
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  return (
    <>
      <Navbar user={user} signOut={signOut} />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>My Vehicles</h1>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/vehicles')}
          >
            Manage Vehicles
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {vehicles.length === 0 ? (
          <div className="empty-state">
            <h3>No vehicles yet</h3>
            <p>Add your first vehicle to start tracking maintenance</p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/vehicles')}
              style={{ marginTop: '20px' }}
            >
              Add Vehicle
            </button>
          </div>
        ) : (
          <div className="vehicle-grid">
            {vehicles.map(vehicle => (
              <div 
                key={vehicle.vehicleId} 
                className="vehicle-card"
                onClick={() => navigate(`/vehicles/${vehicle.vehicleId}`)}
              >
                <h3>{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                <p><strong>VIN:</strong> {vehicle.vin || 'N/A'}</p>
                <p><strong>Current Mileage:</strong> {vehicle.currentMileage?.toLocaleString()} miles</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default Dashboard;

