import React, { useState, useEffect } from 'react';
import { vehicleService } from '../services/api';

function VehicleForm({ vehicle, onClose, onSave }) {
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    currentMileage: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (vehicle) {
      setFormData({
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        vin: vehicle.vin || '',
        currentMileage: vehicle.currentMileage || 0
      });
    }
  }, [vehicle]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (vehicle) {
        await vehicleService.update(vehicle.vehicleId, formData);
      } else {
        await vehicleService.create(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Make *</label>
            <input
              type="text"
              value={formData.make}
              onChange={(e) => setFormData({ ...formData, make: e.target.value })}
              required
              placeholder="e.g., Toyota"
            />
          </div>
          <div className="form-group">
            <label>Model *</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              required
              placeholder="e.g., Camry"
            />
          </div>
          <div className="form-group">
            <label>Year *</label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              required
              min="1900"
              max={new Date().getFullYear() + 1}
            />
          </div>
          <div className="form-group">
            <label>VIN</label>
            <input
              type="text"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              placeholder="Vehicle Identification Number"
            />
          </div>
          <div className="form-group">
            <label>Current Mileage</label>
            <input
              type="number"
              value={formData.currentMileage}
              onChange={(e) => setFormData({ ...formData, currentMileage: parseInt(e.target.value) || 0 })}
              min="0"
            />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VehicleForm;

