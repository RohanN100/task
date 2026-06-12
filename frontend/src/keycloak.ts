import Keycloak from 'keycloak-js';

// Configure Keycloak with our local realm and client credentials
const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'whiteboard-realm',
  clientId: 'whiteboard-client',
});

export default keycloak;
