import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';

function Navbar({ user, signOut }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="navbar">
      <h1>🚗 Smart Vehicle Maintenance</h1>
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/vehicles">Vehicles</Link>
        {user && <span>Hello, {user.name || user.email}</span>}
        <button className="btn btn-secondary" onClick={handleSignOut} style={{ marginLeft: '10px' }}>
          Sign Out
        </button>
      </nav>
    </div>
  );
}

export default Navbar;

