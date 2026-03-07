import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:8000') + '/api';

const HRDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home');
    const [teamMembers, setTeamMembers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [newMemberData, setNewMemberData] = useState({ name: '', email: '' });
    const [isLoading, setIsLoading] = useState(false);

    // Upload modal state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const uploadFileInputRef = useRef(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchTeamMembers();
    }, [token]);

    const fetchTeamMembers = async () => {
        try {
            const res = await fetch(`${API_BASE}/users/team`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setTeamMembers(data.data);
            }
        } catch (error) {
            console.error("Error fetching team:", error);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/users/team/member`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newMemberData)
            });
            const data = await res.json();
            if (data.success) {
                setTeamMembers([...teamMembers, data.data]);
                setIsAddMemberModalOpen(false);
                setNewMemberData({ name: '', email: '' });
            } else {
                alert(data.message || 'Failed to add member');
            }
        } catch (error) {
            console.error("Error adding member:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserRecordings = async (userId) => {
        try {
            const res = await fetch(`${API_BASE}/audio/recordings?user_id=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setRecordings(data.data);
            }
        } catch (error) {
            console.error("Error fetching recordings:", error);
        }
    };

    const openMemberProfile = (user) => {
        setSelectedUser(user);
        fetchUserRecordings(user._id);
        setActiveTab('member-profile');
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Step 1: User picks file → open modal
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file || !selectedUser) return;
        setUploadFile(file);
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
        setUploadDescription('');
        setIsUploadModalOpen(true);
        event.target.value = null;
    };

    // Step 2: Submit upload with title + description
    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile || !selectedUser) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', uploadTitle || uploadFile.name);
        formData.append('description', uploadDescription);
        formData.append('target_user_id', selectedUser._id);

        try {
            const res = await fetch(`${API_BASE}/audio/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setIsUploadModalOpen(false);
                setUploadFile(null);
                setUploadTitle('');
                setUploadDescription('');
                fetchUserRecordings(selectedUser._id);
            } else {
                alert(data.message || 'Failed to upload audio');
            }
        } catch (error) {
            console.error("Error uploading audio:", error);
            alert("Error uploading audio");
        } finally {
            setIsUploading(false);
        }
    };

    const formatTime = (seconds) => {
        if (!seconds) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    // Sub-components
    const GlobalPerformance = () => (
        <>
            <div className="header-row">
                <h1>HR Performance Summary</h1>
                <button className="btn-quick-record">Quick Record</button>
            </div>

            <div className="dashboard-grid">
                <section className="card trends-card section-span-2">
                    <div className="card-header">
                        <h3>Summary of recording trends</h3>
                        <div className="card-controls">
                            <span className="legend"><div className="dot dark"></div> Recording</span>
                            <span className="legend"><div className="dot light"></div> Speaking</span>
                            <button className="select-btn">Summary</button>
                        </div>
                    </div>
                    <div className="chart-placeholder">
                        <svg className="chart-svg" viewBox="0 0 800 200" preserveAspectRatio="none">
                            <path d="M0 200 L0 150 Q100 50, 200 120 T400 60 T600 140 T800 40 L800 200 Z" fill="rgba(35, 78, 61, 0.4)" stroke="#234e3d" strokeWidth="3" />
                            <path d="M0 200 L0 180 Q150 100, 300 160 T500 100 T700 120 T800 80 L800 200 Z" fill="rgba(180, 80, 80, 0.3)" stroke="#b56565" strokeWidth="3" />
                        </svg>
                    </div>
                    <div className="stats-row">
                        <div className="stat-item">
                            <span className="stat-label"><div className="dot dark"></div> Active Members</span>
                            <span className="stat-value">{teamMembers.length}</span>
                        </div>
                    </div>
                </section>

                <section className="card side-card">
                    <h3>Recent Activity Feed</h3>
                    <div className="activity-list">
                        {teamMembers.slice(0, 3).map((user, i) => (
                            <div className="activity-item" key={user._id || i}>
                                <div className="activity-avatar-container">
                                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={user.name} />
                                </div>
                                <div className="activity-details">
                                    <h4>{user.name} joined</h4>
                                    <p>{user.role}</p>
                                </div>
                                <span className="activity-time">new</span>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="team-cards-wrapper section-span-2">
                    {teamMembers.slice(0, 3).map((user) => (
                        <div className="card team-card" key={user._id} onClick={() => openMemberProfile(user)} style={{ cursor: 'pointer' }}>
                            <div className="avatar-wrapper">
                                <div className="avatar-ring-1"></div>
                                <div className="avatar-ring-2"></div>
                                <div className="profile-avatar-lg">
                                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={user.name} />
                                </div>
                            </div>
                            <h4 className="user-name">{user.name}</h4>
                            <p className="user-role">{user.role}</p>
                            <div className="user-stats">
                                <div className="user-stat-col">
                                    <span className="user-stat-label"><div className="dot dark"></div> Recordings</span>
                                    <span className="user-stat-value">{user.recording_count || 0}</span>
                                </div>
                                <div className="vertical-divider"></div>
                                <div className="user-stat-col">
                                    <span className="user-stat-label"><div className="dot light"></div> Spoken Time</span>
                                    <span className="user-stat-value">{formatTime(user.total_speaking_time)}</span>
                                </div>
                            </div>
                            <button className="btn-cta">View Profile</button>
                        </div>
                    ))}
                </div>

                <section className="card side-card quick-actions-card">
                    <h3>Quick Actions Panel</h3>
                    <div className="quick-actions-grid">
                        <button className="action-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path></svg>
                            Create New Transcript
                        </button>
                    </div>
                </section>
            </div>
        </>
    );

    const FullTeamMembers = () => (
        <>
            <div className="header-row">
                <h1>Team Members</h1>
                <button className="btn-quick-record" onClick={() => setIsAddMemberModalOpen(true)}>+ Add Member</button>
            </div>
            <div className="team-grid-full">
                {teamMembers.map((user) => (
                    <div className="card team-card" key={user._id} onClick={() => openMemberProfile(user)} style={{ cursor: 'pointer' }}>
                        <div className="avatar-wrapper">
                            <div className="avatar-ring-1"></div>
                            <div className="avatar-ring-2"></div>
                            <div className="profile-avatar-lg">
                                <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={user.name} />
                            </div>
                        </div>
                        <h4 className="user-name">{user.name}</h4>
                        <p className="user-role">{user.role}</p>
                        <div className="user-stats">
                            <div className="user-stat-col">
                                <span className="user-stat-label"><div className="dot dark"></div> Recordings</span>
                                <span className="user-stat-value">{user.recording_count || 0}</span>
                            </div>
                            <div className="vertical-divider"></div>
                            <div className="user-stat-col">
                                <span className="user-stat-label"><div className="dot light"></div> Spoken Time</span>
                                <span className="user-stat-value">{formatTime(user.total_speaking_time)}</span>
                            </div>
                        </div>
                        <button className="btn-cta">View Profile</button>
                    </div>
                ))}
            </div>
        </>
    );

    const MemberProfile = () => {
        if (!selectedUser) return <GlobalPerformance />;

        return (
            <>
                <div className="header-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => setActiveTab('team')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#666' }}>←</button>
                        <h1>HR view: {selectedUser.name}'s Profile</h1>
                    </div>
                </div>

                <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <section className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Recordings & Transcripts</h3>
                            <label style={{ cursor: 'pointer', background: '#234e3d', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold' }}>
                                Upload Audio
                                <input ref={uploadFileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                            </label>
                        </div>
                        {recordings.length === 0 ? (
                            <p style={{ color: '#666', padding: '2rem 0', textAlign: 'center' }}>No recordings found for this user.</p>
                        ) : (
                            <div className="activity-list" style={{ marginTop: '1rem' }}>
                                {recordings.map((rec) => (
                                    <div className="activity-item" key={rec._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #eee' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{rec.title}</h4>
                                            {rec.description && <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.82rem', fontStyle: 'italic' }}>{rec.description}</p>}
                                            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>Status: {rec.status} | Duration: {formatTime(rec.duration)}</p>
                                        </div>
                                        <div>
                                            {rec.status === 'completed' ? (
                                                <button className="select-btn" onClick={() => alert(rec.transcript_raw)}>View Transcript</button>
                                            ) : (
                                                <span style={{ color: '#888', fontStyle: 'italic' }}>{rec.step}...</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </>
        );
    };

    const PlaceholderView = ({ title }) => (
        <div className="placeholder-view">
            <div className="header-row">
                <h1>{title}</h1>
            </div>
            <div className="card text-center py-10">
                <h3 style={{ margin: '3rem 0', color: '#666' }}>
                    The {title} functionality is under development.
                </h3>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <GlobalPerformance />;
            case 'team':
                return <FullTeamMembers />;
            case 'member-profile':
                return <MemberProfile />;
            case 'recordings':
                return <PlaceholderView title="Recordings & Transcripts" />;
            case 'messages':
                return <PlaceholderView title="Messages & Notifications" />;
            case 'settings':
                return <PlaceholderView title="Settings" />;
            default:
                return <GlobalPerformance />;
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="blob blob-pink"></div>
            <div className="blob blob-green"></div>

            <nav className="sidebar">
                <div className="sidebar-logo">AI</div>
                <ul className="sidebar-menu">
                    <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')} title="Overview">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
                    </li>
                    <li className={activeTab === 'team' ? 'active' : ''} onClick={() => setActiveTab('team')} title="Team Members">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path></svg>
                    </li>
                    <li className={activeTab === 'recordings' ? 'active' : ''} onClick={() => setActiveTab('recordings')} title="Transcribe">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"></path><path d="M19 10v2a7 7 0 01-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                    </li>
                    <li className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')} title="Settings">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>
                    </li>
                </ul>
                <div className="sidebar-logout" onClick={handleLogout} title="Logout">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </div>
            </nav>

            <main className="main-content">
                <div className="topbar">
                    <div className="search-bar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" placeholder="Search..." />
                    </div>
                </div>
                {renderContent()}
            </main>

            {isAddMemberModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', width: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ marginBottom: '1.5rem', fontFamily: 'Georgia, serif' }}>Add Team Member</h2>
                        <form onSubmit={handleAddMember}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#555' }}>Full Name</label>
                                <input required type="text" value={newMemberData.name} onChange={e => setNewMemberData({ ...newMemberData, name: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#555' }}>Email Address</label>
                                <input required type="email" value={newMemberData.email} onChange={e => setNewMemberData({ ...newMemberData, email: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setIsAddMemberModalOpen(false)} style={{ padding: '0.8rem 1.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isLoading} style={{ padding: '0.8rem 1.5rem', border: 'none', background: '#234e3d', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>{isLoading ? 'Adding...' : 'Add Member'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload Audio Modal */}
            {isUploadModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'fadeIn 0.2s ease' }}>
                        <h2 style={{ marginBottom: '0.5rem', fontFamily: 'Georgia, serif', color: '#1a1a1a' }}>📤 Upload Audio</h2>
                        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Add a title and description to help identify this audio later.</p>

                        {uploadFile && (
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.3rem' }}>🎵</span>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#166534', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{uploadFile.name}</p>
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#4ade80' }}>{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleUploadSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>Title *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Team standup meeting"
                                    value={uploadTitle}
                                    onChange={e => setUploadTitle(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' }}
                                    onFocus={e => e.target.style.borderColor = '#234e3d'}
                                    onBlur={e => e.target.style.borderColor = '#ddd'}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>Description</label>
                                <textarea
                                    placeholder="Brief description about this audio..."
                                    value={uploadDescription}
                                    onChange={e => setUploadDescription(e.target.value)}
                                    rows={3}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', transition: 'border 0.2s', boxSizing: 'border-box' }}
                                    onFocus={e => e.target.style.borderColor = '#234e3d'}
                                    onBlur={e => e.target.style.borderColor = '#ddd'}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); }} style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', fontSize: '0.95rem' }}>Cancel</button>
                                <button type="submit" disabled={isUploading} style={{ padding: '0.75rem 1.5rem', border: 'none', background: '#234e3d', color: '#fff', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', opacity: isUploading ? 0.6 : 1, transition: 'opacity 0.2s' }}>{isUploading ? 'Uploading...' : 'Upload & Transcribe'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRDashboard;
