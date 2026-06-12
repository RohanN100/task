import React, { useState, useEffect } from 'react';
import { 
  Home, History, LayoutGrid, User, BarChart3, 
  Menu, X, LogOut, PlusCircle, ArrowRight, 
  Trash2, Copy, Check, Palette, Sparkles, 
  Activity, Shield, Clock, Calendar 
} from 'lucide-react';
import keycloak from '../keycloak';

interface DashboardProps {
  onJoinRoom: (roomId: string) => void;
}

interface RecentRoom {
  id: string;
  name: string;
  joinedAt: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onJoinRoom }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'designs' | 'templates' | 'profile' | 'insights'>('home');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [customBoardName, setCustomBoardName] = useState('');
  const [error, setError] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Load recent rooms from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('collabboard_recent_rooms');
      if (stored) {
        setRecentRooms(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent rooms from history:', e);
    }
  }, []);

  const addRoomToHistory = (id: string, name: string) => {
    try {
      const cleanName = name.trim() || `Design (${id})`;
      const item: RecentRoom = {
        id,
        name: cleanName,
        joinedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const filtered = recentRooms.filter((r) => r.id !== id);
      const updated = [item, ...filtered].slice(0, 30); // Cap at 30 recent rooms
      
      localStorage.setItem('collabboard_recent_rooms', JSON.stringify(updated));
      setRecentRooms(updated);
    } catch (e) {
      console.error('Failed to save room to history:', e);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    // Generate a clean session ID: wb-xxxx-xxxx
    const randPart1 = Math.random().toString(36).substring(2, 6);
    const randPart2 = Math.random().toString(36).substring(2, 6);
    const newRoomId = `wb-${randPart1}-${randPart2}`;

    const boardName = customBoardName.trim() || `Canvas ${newRoomId.replace('wb-', '')}`;
    addRoomToHistory(newRoomId, boardName);
    onJoinRoom(newRoomId);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoomId = roomIdInput.trim();
    if (!cleanRoomId) {
      setError('Please enter a session ID.');
      return;
    }
    // Save to history with generic title
    addRoomToHistory(cleanRoomId, `Joined Session (${cleanRoomId})`);
    onJoinRoom(cleanRoomId);
  };

  const handleDeleteRoom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card click
    const filtered = recentRooms.filter((r) => r.id !== id);
    setRecentRooms(filtered);
    localStorage.setItem('collabboard_recent_rooms', JSON.stringify(filtered));
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateFromTemplate = (templateName: string) => {
    const randPart1 = Math.random().toString(36).substring(2, 6);
    const randPart2 = Math.random().toString(36).substring(2, 6);
    const newRoomId = `wb-${randPart1}-${randPart2}`;

    addRoomToHistory(newRoomId, templateName);
    onJoinRoom(newRoomId);
  };

  const handleLogout = () => {
    keycloak.logout();
  };

  // Extract metadata from Keycloak token
  const userName = keycloak.tokenParsed?.given_name || keycloak.tokenParsed?.preferred_username || 'User';
  const userFullName = keycloak.tokenParsed?.name || `${keycloak.tokenParsed?.given_name || ''} ${keycloak.tokenParsed?.family_name || ''}`.trim() || 'CollabBoard Member';
  const userEmail = keycloak.tokenParsed?.email || 'No email registered';
  const keycloakRealm = keycloak.realm || 'whiteboard-realm';
  const tokenExpiration = keycloak.tokenParsed?.exp 
    ? new Date(keycloak.tokenParsed.exp * 1000).toLocaleString() 
    : 'Unknown';

  // Static templates inspired by Canva layout categories
  const templates = [
    { name: 'Marketing Brainstorm', category: 'Brainstorm', desc: 'Map out campaigns, goals, and audience strategies together.', color: '#00C4CC' },
    { name: 'UX/UI Wireframe Layout', category: 'Wireframe', desc: 'Design UI mockups, user flows, and wireframes.', color: '#7D2AE8' },
    { name: 'Sprint Retrospective Grid', category: 'Agile Plan', desc: 'Collect team feedback on what went well and areas to improve.', color: '#FFB900' },
    { name: 'Mind Mapping Tree', category: 'Idea Tree', desc: 'Visualize complex connections, branching ideas, and thoughts.', color: '#FF4B4B' },
    { name: 'Flowchart Architecture', category: 'Engineering', desc: 'Draft software architecture flowcharts and API flows.', color: '#107C41' },
    { name: 'Weekly Team Standup', category: 'Collaboration', desc: 'Organize standup points, status bars, and weekly actions.', color: '#0078D7' },
  ];

  return (
    <div className="canva-dashboard">
      
      {/* Mobile Top Header */}
      <div className="d-lg-none d-flex align-items-center justify-content-between bg-white border-bottom border-secondary border-opacity-10 px-3 py-2.5 text-dark">
        <div className="d-flex align-items-center gap-2">
          <button 
            className="btn btn-light p-1.5 border-0" 
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            <Menu size={22} />
          </button>
          <div className="d-flex align-items-center gap-1.5 ms-1">
            <div className="rounded-circle bg-primary bg-opacity-20 p-1.5" style={{ color: '#00C4CC' }}>
              <Palette size={18} />
            </div>
            <span className="fw-bold tracking-tight">CollabBoard</span>
          </div>
        </div>
        
        <div className="d-flex align-items-center gap-2">
          <div 
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold bg-secondary bg-opacity-30" 
            style={{ width: 32, height: 32, fontSize: 13 }}
            title={userFullName}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`canva-sidebar ${mobileSidebarOpen ? 'show' : ''}`}>
        <div className="canva-sidebar-logo d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2.5">
            <div 
              className="canva-gradient-bg rounded-circle d-flex align-items-center justify-content-center" 
              style={{ width: 38, height: 38 }}
            >
              <Palette size={18} className="text-white" />
            </div>
            <h5 className="m-0 fw-bold text-white tracking-tight">CollabBoard</h5>
          </div>
          <button 
            className="btn btn-light d-lg-none p-1 border-0" 
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="canva-sidebar-nav">
          <button 
            className={`canva-sidebar-link ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); setMobileSidebarOpen(false); }}
          >
            <Home size={18} />
            <span>Discover</span>
          </button>
          
          <button 
            className={`canva-sidebar-link ${activeTab === 'designs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('designs'); setMobileSidebarOpen(false); }}
          >
            <History size={18} />
            <span>My Designs</span>
          </button>

          <button 
            className={`canva-sidebar-link ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => { setActiveTab('templates'); setMobileSidebarOpen(false); }}
          >
            <LayoutGrid size={18} />
            <span>Templates</span>
          </button>

          <button 
            className={`canva-sidebar-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => { setActiveTab('profile'); setMobileSidebarOpen(false); }}
          >
            <User size={18} />
            <span>Profile & Auth</span>
          </button>

          <button 
            className={`canva-sidebar-link ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => { setActiveTab('insights'); setMobileSidebarOpen(false); }}
          >
            <BarChart3 size={18} />
            <span>Workspace Insights</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-top border-secondary border-opacity-10 d-flex flex-column gap-2">
          <div className="d-flex align-items-center gap-2.5 px-2 py-1.5">
            <div 
              className="canva-gradient-bg rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" 
              style={{ width: 34, height: 34, fontSize: 13 }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="d-flex flex-column overflow-hidden">
              <span className="text-dark fw-medium text-truncate small">{userFullName}</span>
              <span className="text-secondary text-truncate" style={{ fontSize: '11px' }}>{userEmail}</span>
            </div>
          </div>
          <button 
            className="btn btn-outline-danger w-100 py-2 btn-sm d-flex align-items-center justify-content-center gap-2 border-0 hover-bg-opacity-10"
            onClick={handleLogout}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="canva-content">
        
        {/* TAB 1: Discover */}
        {activeTab === 'home' && (
          <div className="fade-in d-flex flex-column gap-4">
            
            {/* Canva Welcome Banner */}
            <div className="canva-banner">
              <span className="canva-badge canva-badge-active mb-3">
                <Sparkles size={12} className="me-1 align-text-top" />
                Next-Gen Whiteboarding
              </span>
              <h1 className="display-6 fw-bold text-dark mb-2">
                Design anything <span className="canva-gradient-text">together</span> in real-time.
              </h1>
              <p className="text-secondary col-lg-8 m-0 small">
                Collaborate seamlessly on high-performance vector sketches. Create custom whiteboard links, choose ready-made frameworks, and brainstorm with teammates from anywhere.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger border-0 bg-danger bg-opacity-10 text-danger p-3 rounded-3" role="alert">
                {error}
              </div>
            )}

            {/* Quick Action Double Card Grid */}
            <div className="row g-4">
              
              {/* Column 1: Generate Board */}
              <div className="col-md-6">
                <div className="canva-card canva-card-glow h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div className="p-2 bg-success bg-opacity-10 text-success rounded-3">
                        <PlusCircle size={20} />
                      </div>
                      <h4 className="fw-bold m-0 text-dark">Create a Workspace</h4>
                    </div>
                    <p className="text-secondary small mb-4">
                      Start a blank workspace or team canvas. Give it a customized project name, then share it to invite collaborators.
                    </p>
                  </div>
                  
                  <form onSubmit={handleCreateRoom}>
                    <div className="mb-3">
                      <input 
                        type="text" 
                        className="form-control bg-light border-secondary border-opacity-25 text-dark py-2 px-3 placeholder-secondary"
                        placeholder="Enter Project Name (e.g. UX Wireframe)"
                        value={customBoardName}
                        onChange={(e) => setCustomBoardName(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn canva-gradient-btn w-100 py-2.5">
                      <span>Create New Board</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Column 2: Join Board */}
              <div className="col-md-6">
                <div className="canva-card canva-card-glow h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div className="p-2 bg-info bg-opacity-10 text-info rounded-3">
                        <Activity size={20} />
                      </div>
                      <h4 className="fw-bold m-0 text-dark">Join Active Session</h4>
                    </div>
                    <p className="text-secondary small mb-4">
                      Access an ongoing drawing board. Provide the whiteboard code provided by your coworker or team lead.
                    </p>
                  </div>

                  <form onSubmit={handleJoinRoom}>
                    <div className="input-group mb-0">
                      <input
                        type="text"
                        className="form-control bg-light border-secondary border-opacity-25 text-dark py-2.5 px-3 placeholder-secondary"
                        placeholder="Enter Room Code (e.g. wb-xxxx-xxxx)"
                        value={roomIdInput}
                        onChange={(e) => {
                          setRoomIdInput(e.target.value);
                          setError('');
                        }}
                      />
                      <button type="submit" className="btn canva-gradient-btn d-flex align-items-center justify-content-center px-4">
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>

            {/* Template Shortcuts Carousel-Row */}
            <div className="mt-2">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-bold text-dark m-0">Start with a template</h5>
                <button 
                  className="btn btn-link text-decoration-none text-secondary hover-text-primary p-0 btn-sm"
                  onClick={() => setActiveTab('templates')}
                >
                  View all templates →
                </button>
              </div>
              <div className="row g-3">
                {templates.slice(0, 3).map((tpl, idx) => (
                  <div key={idx} className="col-md-4">
                    <div 
                      className="canva-card cursor-pointer h-100 d-flex flex-column justify-content-between"
                      style={{ borderLeft: `4px solid ${tpl.color}` }}
                      onClick={() => handleCreateFromTemplate(tpl.name)}
                    >
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="badge text-white" style={{ backgroundColor: `${tpl.color}15`, color: tpl.color, border: `1px solid ${tpl.color}25` }}>
                            {tpl.category}
                          </span>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">{tpl.name}</h6>
                        <p className="text-secondary m-0" style={{ fontSize: '12px' }}>{tpl.desc}</p>
                      </div>
                      <div className="d-flex justify-content-end mt-3">
                        <span className="text-secondary small d-flex align-items-center gap-1 hover-text-primary">
                          Use Template <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: My Designs */}
        {activeTab === 'designs' && (
          <div className="fade-in d-flex flex-column gap-4">
            <div>
              <h2 className="fw-bold text-dark m-0">My Designs</h2>
              <p className="text-secondary m-0 small">A list of all collaborative whiteboards you've created or connected to recently.</p>
            </div>

            {recentRooms.length === 0 ? (
              <div className="canva-card text-center py-5">
                <div className="p-3 bg-secondary bg-opacity-5 rounded-circle d-inline-block mb-3 text-secondary">
                  <Palette size={32} />
                </div>
                <h5 className="text-dark fw-bold">No designs found</h5>
                <p className="text-secondary col-md-6 mx-auto mb-4 small">
                  You haven't drawn on any whiteboards yet. Create a blank canvas or join an existing board code to get started.
                </p>
                <button className="btn canva-gradient-btn px-4 py-2" onClick={() => setActiveTab('home')}>
                  Create a Board
                </button>
              </div>
            ) : (
              <div className="row g-3">
                {recentRooms.map((room) => (
                  <div key={room.id} className="col-md-6 col-xl-4">
                    <div 
                      className="canva-card h-100 d-flex flex-column justify-content-between cursor-pointer"
                      onClick={() => onJoinRoom(room.id)}
                    >
                      <div>
                        <div className="d-flex align-items-start justify-content-between mb-2">
                          <h6 className="fw-bold text-dark m-0 text-truncate col-10">{room.name}</h6>
                          <div className="d-flex gap-1">
                            <button 
                              className="btn btn-light p-1 border-0 hover-text-white text-secondary"
                              onClick={(e) => handleCopyId(room.id, e)}
                              title="Copy Room ID"
                            >
                              {copiedId === room.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                            </button>
                            <button 
                              className="btn btn-light p-1 border-0 hover-text-danger text-secondary"
                              onClick={(e) => handleDeleteRoom(room.id, e)}
                              title="Delete from History"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <span className="badge bg-secondary bg-opacity-10 font-monospace text-dark border border-secondary border-opacity-15 small mb-3">
                          {room.id}
                        </span>
                      </div>

                      <div className="border-top border-secondary border-opacity-10 pt-2.5 mt-3 d-flex align-items-center justify-content-between text-secondary" style={{ fontSize: '11px' }}>
                        <span className="d-flex align-items-center gap-1">
                          <Clock size={11} />
                          {room.joinedAt}
                        </span>
                        <span className="fw-semibold text-primary text-opacity-75 hover-text-white d-flex align-items-center gap-0.5">
                          Open <ArrowRight size={10} />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Templates */}
        {activeTab === 'templates' && (
          <div className="fade-in d-flex flex-column gap-4">
            <div>
              <h2 className="fw-bold text-dark m-0">Template Directory</h2>
              <p className="text-secondary m-0 small">Jumpstart your brainstorming session with one of our ready-to-use vector board frameworks.</p>
            </div>

            <div className="row g-4">
              {templates.map((tpl, idx) => (
                <div key={idx} className="col-md-6 col-xl-4">
                  <div className="canva-card h-100 d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="badge" style={{ backgroundColor: `${tpl.color}15`, color: tpl.color, border: `1px solid ${tpl.color}25` }}>
                          {tpl.category}
                        </span>
                        <span className="text-secondary" style={{ fontSize: '11px' }}>Ready-to-Use</span>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">{tpl.name}</h5>
                      <p className="text-secondary small m-0">{tpl.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-top border-secondary border-opacity-10 d-flex align-items-center justify-content-between">
                      <span className="text-secondary small font-monospace" style={{ fontSize: '11px' }}>
                        Type: Vectors
                      </span>
                      <button 
                        className="btn canva-gradient-btn py-1.5 px-3 btn-sm text-white"
                        onClick={() => handleCreateFromTemplate(tpl.name)}
                      >
                        Create Design
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Profile & Authentication */}
        {activeTab === 'profile' && (
          <div className="fade-in d-flex flex-column gap-4">
            <div>
              <h2 className="fw-bold text-dark m-0">Profile & Security</h2>
              <p className="text-secondary m-0 small">Secure user identity settings verified via your local Keycloak instance.</p>
            </div>

            <div className="row g-4">
              {/* Identity Claims Card */}
              <div className="col-xl-8">
                <div className="canva-card">
                  <h4 className="fw-bold text-dark mb-4 d-flex align-items-center gap-2">
                    <Shield size={20} className="text-primary" />
                    <span>Identity Token Claims (JWT)</span>
                  </h4>
                  
                  <div className="d-flex flex-column gap-3">
                    
                    <div className="row border-bottom border-secondary border-opacity-10 pb-3 align-items-center">
                      <div className="col-sm-4 text-secondary small">User Full Name</div>
                      <div className="col-sm-8 fw-semibold text-dark">{userFullName}</div>
                    </div>

                    <div className="row border-bottom border-secondary border-opacity-10 pb-3 align-items-center">
                      <div className="col-sm-4 text-secondary small">Registered Email</div>
                      <div className="col-sm-8 text-dark">{userEmail}</div>
                    </div>

                    <div className="row border-bottom border-secondary border-opacity-10 pb-3 align-items-center">
                      <div className="col-sm-4 text-secondary small">Preferred Username</div>
                      <div className="col-sm-8 text-dark font-monospace">{userName}</div>
                    </div>

                    <div className="row border-bottom border-secondary border-opacity-10 pb-3 align-items-center">
                      <div className="col-sm-4 text-secondary small">Identity Sub ID (`sub`)</div>
                      <div className="col-sm-8 text-secondary font-monospace" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {keycloak.tokenParsed?.sub || 'anonymous'}
                      </div>
                    </div>

                    <div className="row border-bottom border-secondary border-opacity-10 pb-3 align-items-center">
                      <div className="col-sm-4 text-secondary small">Keycloak Realm</div>
                      <div className="col-sm-8">
                        <span className="badge bg-secondary bg-opacity-10 text-dark border border-secondary border-opacity-20 font-monospace">
                          {keycloakRealm}
                        </span>
                      </div>
                    </div>

                    <div className="row align-items-center">
                      <div className="col-sm-4 text-secondary small">Active Session Expires</div>
                      <div className="col-sm-8 text-warning small d-flex align-items-center gap-1">
                        <Clock size={12} />
                        {tokenExpiration}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Active Roles Sidebar-Card */}
              <div className="col-xl-4">
                <div className="canva-card h-100 bg-secondary bg-opacity-5">
                  <h5 className="fw-bold text-dark mb-3">Security Provider</h5>
                  <p className="text-secondary small mb-4">
                    Your account is securely authenticated using Single Sign-On (SSO) backed by Keycloak's open-source OpenID Connect server.
                  </p>
                  
                  <div className="alert bg-light border-secondary border-opacity-25 p-3 rounded-3 mb-4">
                    <h6 className="fw-semibold text-dark mb-1 d-flex align-items-center gap-1.5">
                      <Activity size={14} className="text-success" />
                      Realm Authorized
                    </h6>
                    <p className="text-secondary m-0" style={{ fontSize: '11px' }}>
                      Token validation is checked locally on every page refresh using cryptographically signed headers.
                    </p>
                  </div>

                  <button 
                    className="btn btn-outline-danger w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Terminate Secure Session</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Insights */}
        {activeTab === 'insights' && (
          <div className="fade-in d-flex flex-column gap-4">
            <div>
              <h2 className="fw-bold text-dark m-0">Workspace Insights</h2>
              <p className="text-secondary m-0 small">Real-time statistics monitoring drawing history, team connections, and workspace activity.</p>
            </div>

            {/* Stat Cards Grid */}
            <div className="row g-4">
              
              <div className="col-sm-6 col-md-3">
                <div className="canva-card text-center">
                  <span className="text-secondary text-uppercase font-weight-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>
                    Active Boards
                  </span>
                  <div className="canva-stat-value my-2">
                    {recentRooms.length}
                  </div>
                  <span className="text-secondary small d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '11px' }}>
                    <Calendar size={11} /> Registered
                  </span>
                </div>
              </div>

              <div className="col-sm-6 col-md-3">
                <div className="canva-card text-center">
                  <span className="text-secondary text-uppercase" style={{ fontSize: '10px' }}>
                    Total Connections
                  </span>
                  <div className="canva-stat-value my-2">
                    {recentRooms.length ? Math.round(recentRooms.length * 1.5) : 0}
                  </div>
                  <span className="text-success small d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '11px' }}>
                    <Activity size={11} /> 100% Success
                  </span>
                </div>
              </div>

              <div className="col-sm-6 col-md-3">
                <div className="canva-card text-center">
                  <span className="text-secondary text-uppercase" style={{ fontSize: '10px' }}>
                    Drawing Hours
                  </span>
                  <div className="canva-stat-value my-2" style={{ background: 'linear-gradient(135deg, #FFB900, #FF4B4B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    12.4h
                  </div>
                  <span className="text-secondary small d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '11px' }}>
                    <Clock size={11} /> Mock Tracked
                  </span>
                </div>
              </div>

              <div className="col-sm-6 col-md-3">
                <div className="canva-card text-center">
                  <span className="text-secondary text-uppercase" style={{ fontSize: '10px' }}>
                    Collaborators Met
                  </span>
                  <div className="canva-stat-value my-2">
                    8
                  </div>
                  <span className="text-secondary small d-flex align-items-center justify-content-center gap-1" style={{ fontSize: '11px' }}>
                    <User size={11} /> Active peers
                  </span>
                </div>
              </div>

            </div>

            {/* Mock Charts */}
            <div className="row g-4">
              {/* Chart 1 */}
              <div className="col-md-6">
                <div className="canva-card">
                  <h5 className="fw-bold text-dark mb-4">Weekly Board Creation Activity</h5>
                  <div className="d-flex align-items-end justify-content-between px-3" style={{ height: '150px' }}>
                    {/* Columns */}
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '35px', opacity: 0.4 }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Mon</span>
                    </div>
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '60px', opacity: 0.5 }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Tue</span>
                    </div>
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '40px', opacity: 0.4 }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Wed</span>
                    </div>
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '90px', opacity: 0.75 }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Thu</span>
                    </div>
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '120px' }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Fri</span>
                    </div>
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '20px', opacity: 0.2 }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Sat</span>
                    </div>
                    <div className="d-flex flex-column align-items-center gap-2 w-100">
                      <div className="canva-gradient-bg w-50 rounded-2" style={{ height: '10px', opacity: 0.1 }}></div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>Sun</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 2 */}
              <div className="col-md-6">
                <div className="canva-card">
                  <h5 className="fw-bold text-dark mb-4">Collaborator Presence Share</h5>
                  <div className="d-flex align-items-center gap-4 justify-content-center py-2">
                    
                    {/* Circle SVG */}
                    <div className="position-relative" style={{ width: 110, height: 110 }}>
                      <svg width="100%" height="100%" viewBox="0 0 42 42" className="donut">
                        <circle className="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="transparent"></circle>
                        <circle className="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="rgba(0, 0, 0, 0.05)" strokeWidth="4.5"></circle>
                        
                        {/* Segment 1: Teal (65%) */}
                        <circle className="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#00C4CC" strokeWidth="4.5" strokeDasharray="65 35" strokeDashoffset="25"></circle>
                        
                        {/* Segment 2: Purple (20%) */}
                        <circle className="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#7D2AE8" strokeWidth="4.5" strokeDasharray="20 80" strokeDashoffset="60"></circle>
                      </svg>
                      <div className="position-absolute top-50 start-50 translate-middle text-center">
                        <span className="fw-bold text-dark small" style={{ fontSize: '12px' }}>85%</span>
                        <div className="text-secondary" style={{ fontSize: '8px' }}>Collab</div>
                      </div>
                    </div>

                    {/* Legends */}
                    <div className="d-flex flex-column gap-2 text-secondary small">
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: '#00C4CC' }}></div>
                        <span>Active Drawing (65%)</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: '#7D2AE8' }}></div>
                        <span>Idle Viewing (20%)</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: 'rgba(0, 0, 0, 0.05)' }}></div>
                        <span>Inactive Offline (15%)</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;
