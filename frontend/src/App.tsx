import { useEffect, useState } from 'react';
import keycloak from './keycloak';
import Dashboard from './components/Dashboard';
import Whiteboard from './components/Whiteboard';

// Import Bootstrap 5 styles
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    keycloak
      .init({
        onLoad: 'login-required', // Redirect to Keycloak login if not authenticated
        pkceMethod: 'S256',        // Recommended standard for SPA clients
        checkLoginIframe: false    // Prevents issues with iframe reloading in local testing environments
      })
      .then((auth) => {
        setAuthenticated(auth);
        setInitialized(true);
      })
      .catch((err) => {
        console.error('Keycloak initialization failed:', err);
      });
  }, []);

  // Show a professional loading state during Keycloak handshake
  if (!initialized) {
    return (
      <div className="container-fluid min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light text-dark">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <h5 className="fw-semibold text-dark mb-1">CollabBoard Authentication</h5>
        <p className="text-secondary small">Verifying secure session, please wait...</p>
      </div>
    );
  }

  // Fallback UI in case authentication failed or user cancelled
  if (!authenticated) {
    return (
      <div className="container-fluid min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light text-dark">
        <div className="card glass-panel p-4 text-center" style={{ maxWidth: 400, backgroundColor: '#ffffff' }}>
          <h4 className="text-danger fw-bold mb-3">Authentication Required</h4>
          <p className="text-secondary small mb-4">
            You must be logged in to access the collaborative whiteboard application.
          </p>
          <button className="btn btn-primary w-100 py-2 fw-semibold" onClick={() => keycloak.login()}>
            Sign In with Keycloak
          </button>
        </div>
      </div>
    );
  }

  // Active routes: Whiteboard Room vs Session Dashboard
  return roomId ? (
    <Whiteboard roomId={roomId} onLeaveRoom={() => setRoomId(null)} />
  ) : (
    <Dashboard onJoinRoom={(id) => setRoomId(id)} />
  );
}

export default App;
