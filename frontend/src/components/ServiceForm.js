import React, { useState, useEffect } from 'react';
import { serviceService } from '../services/api';

const SERVICE_TYPES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'brake_check', label: 'Brake Check' },
  { value: 'tire_rotation', label: 'Tire Rotation' },
  { value: 'air_filter', label: 'Air Filter Replacement' },
  { value: 'battery_check', label: 'Battery Check' },
  { value: 'transmission_service', label: 'Transmission Service' },
  { value: 'coolant_flush', label: 'Coolant Flush' }
];

function ServiceForm({ vehicleId, service, onClose, onSave }) {
  const [formData, setFormData] = useState({
    serviceType: 'oil_change',
    serviceDate: new Date().toISOString().split('T')[0],
    mileage: 0,
    description: '',
    cost: 0,
    serviceProvider: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (service) {
      setFormData({
        serviceType: service.serviceType || 'oil_change',
        serviceDate: service.serviceDate ? service.serviceDate.split('T')[0] : new Date().toISOString().split('T')[0],
        mileage: service.mileage || 0,
        description: service.description || '',
        cost: service.cost || 0,
        serviceProvider: service.serviceProvider || '',
        notes: service.notes || ''
      });
    }
  }, [service]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ...formData,
        serviceDate: new Date(formData.serviceDate).toISOString(),
        mileage: parseInt(formData.mileage) || 0,
        cost: parseFloat(formData.cost) || 0
      };

      if (service) {
        await serviceService.update(service.serviceId, data);
      } else {
        await serviceService.create(vehicleId, data);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save service');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{service ? 'Edit Service Record' : 'Add Service Record'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Service Type *</label>
            <select
              value={formData.serviceType}
              onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
              required
            >
              {SERVICE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Service Date *</label>
            <input
              type="date"
              value={formData.serviceDate}
              onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Mileage at Service</label>
            <input
              type="number"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
              min="0"
            />
          </div>
          <div className="form-group">
            <label>Cost</label>
            <input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              min="0"
            />
          </div>
          <div className="form-group">
            <label>Service Provider</label>
            <input
              type="text"
              value={formData.serviceProvider}
              onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
              placeholder="e.g., Jiffy Lube, Dealership"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Service details..."
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
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

export default ServiceForm;

