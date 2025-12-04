import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { vehicleService } from '../services/api';
import Navbar from './Navbar';
import VehicleForm from './VehicleForm';

function VehicleList() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

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

  async function handleDelete(vehicleId, e) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this vehicle?')) {
      return;
    }

    try {
      await vehicleService.delete(vehicleId);
      loadVehicles();
    } catch (err) {
      setError('Failed to delete vehicle');
      console.error(err);
    }
  }

  function handleEdit(vehicle, e) {
    e.stopPropagation();
    setEditingVehicle(vehicle);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingVehicle(null);
    loadVehicles();
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
            onClick={() => setShowForm(true)}
          >
            Add Vehicle
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {showForm && (
          <VehicleForm
            vehicle={editingVehicle}
            onClose={handleFormClose}
            onSave={loadVehicles}
          />
        )}

        {vehicles.length === 0 ? (
          <div className="empty-state">
            <h3>No vehicles yet</h3>
            <p>Add your first vehicle to start tracking maintenance</p>
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
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={(e) => handleEdit(vehicle, e)}
                    style={{ flex: 1 }}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={(e) => handleDelete(vehicle.vehicleId, e)}
                    style={{ flex: 1 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default VehicleList;

