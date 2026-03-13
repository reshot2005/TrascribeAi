import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import LiveStudio from './LiveStudio';

const API_BASE = import.meta.env.VITE_API_URL ? (import.meta.env.VITE_API_URL.endsWith('/api') ? import.meta.env.VITE_API_URL : `${import.meta.env.VITE_API_URL}/api`) : 'http://localhost:8000/api';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home');
    const [teamMembers, setTeamMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [deptMembers, setDeptMembers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [allRecordings, setAllRecordings] = useState([]);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
    const [newMemberData, setNewMemberData] = useState({ name: '', email: '', phone: '', department: '' });
    const [newDeptData, setNewDeptData] = useState({ name: '', description: '' });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewingTranscript, setViewingTranscript] = useState(null);
    const [isPolling, setIsPolling] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [recFilter, setRecFilter] = useState('all');
    const [transcriptViewMode, setTranscriptViewMode] = useState('dialogue'); // 'dialogue' or 'narrative'

    const mediaRecorderRef = useRef(null);
    const wsRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const uploadFileInputRef = useRef(null);
    const avatarInputRef = useRef(null);
    const token = localStorage.getItem('token');
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);
    const mainContentRef = useRef(null);

    useEffect(() => { if (!token) { navigate('/login'); return; } fetchTeamMembers(); fetchDepartments(); fetchAllRecordings(); }, [token]);
    useEffect(() => { if (!isPolling || !selectedUser) return; const iv = setInterval(() => fetchUserRecordings(selectedUser._id), 3000); return () => clearInterval(iv); }, [isPolling, selectedUser]);
    useEffect(() => { const has = recordings.some(r => r.status === 'processing' || r.status === 'uploaded'); setIsPolling(has); }, [recordings]);
    useEffect(() => { if (mainContentRef.current) mainContentRef.current.scrollTop = 0; }, [activeTab]);
    // Real-time polling: refresh team members + recordings every 10s on home tab
    useEffect(() => {
        if (activeTab !== 'home') return;
        const iv = setInterval(() => { fetchTeamMembers(); fetchAllRecordings(); }, 10000);
        return () => clearInterval(iv);
    }, [activeTab]);

    useEffect(() => {
        if (!token) return;
        try {
            const base64Url = token.split('.')[1];
            const payload = JSON.parse(window.atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')));
            const ws = new WebSocket(`ws://localhost:8000/ws/notifications/${payload.sub}`);
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'progress') {
                    setRecordings(prev => prev.map(rec => rec._id === data.recording_id ? { ...rec, status: data.status, step: data.step } : rec));
                    setAllRecordings(prev => prev.map(rec => rec._id === data.recording_id ? { ...rec, status: data.status, step: data.step } : rec));
                }
            };
            return () => ws.close();
        } catch (e) { console.error('WS Error:', e); }
    }, [token]);

    const fetchTeamMembers = async () => {
        try { const res = await fetch(`${API_BASE}/users/team`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) setTeamMembers(data.data); } catch (e) { console.error(e); }
    };
    const fetchDepartments = async () => {
        try { const res = await fetch(`${API_BASE}/users/departments`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) setDepartments(data.data); } catch (e) { console.error(e); }
    };
    const fetchDeptMembers = async (deptId) => {
        try { const res = await fetch(`${API_BASE}/users/team/department/${deptId}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) setDeptMembers(data.data); } catch (e) { console.error(e); }
    };
    const fetchUserRecordings = async (userId) => {
        try { const res = await fetch(`${API_BASE}/audio/recordings?user_id=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) setRecordings(data.data); } catch (e) { console.error(e); }
    };
    const fetchAllRecordings = async () => {
        try { const res = await fetch(`${API_BASE}/audio/recordings?team_id=${teamMembers[0]?.team_id || ''}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) setAllRecordings(data.data); } catch (e) { console.error(e); }
    };

    const handleCreateDept = async (e) => {
        e.preventDefault(); setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/users/departments`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(newDeptData) });
            const data = await res.json();
            if (data.success) { setDepartments([...departments, data.data]); setIsAddDeptModalOpen(false); setNewDeptData({ name: '', description: '' }); }
            else alert(data.message || 'Failed');
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleDeleteDept = async (deptId) => {
        if (!window.confirm('Delete this department? Members will become unassigned.')) return;
        try { const res = await fetch(`${API_BASE}/users/departments/${deptId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) { setDepartments(departments.filter(d => d._id !== deptId)); if (selectedDept?._id === deptId) setSelectedDept(null); } } catch (e) { console.error(e); }
    };

    const handleAddMember = async (e) => {
        e.preventDefault(); setIsLoading(true);
        try {
            const body = { ...newMemberData };
            if (selectedDept) body.department = selectedDept._id;
            const res = await fetch(`${API_BASE}/users/team/member`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) {
                // Upload avatar if selected
                if (avatarFile && data.data._id) {
                    const fd = new FormData(); fd.append('file', avatarFile);
                    await fetch(`${API_BASE}/users/team/member/${data.data._id}/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
                }
                setTeamMembers([...teamMembers, data.data]);
                if (selectedDept) fetchDeptMembers(selectedDept._id);
                fetchDepartments();
                setIsAddMemberModalOpen(false);
                setNewMemberData({ name: '', email: '', phone: '', department: '' });
                setAvatarFile(null); setAvatarPreview(null);
            } else alert(data.message || 'Failed');
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleDeleteMember = async (userId) => {
        if (!window.confirm('Delete this user permanently?')) return;
        try { const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) { setTeamMembers(teamMembers.filter(m => m._id !== userId)); if (selectedDept) fetchDeptMembers(selectedDept._id); fetchDepartments(); if (selectedUser?._id === userId) { setActiveTab('team'); setSelectedUser(null); } } } catch (e) { console.error(e); }
    };

    const handleDeleteRecording = async (recordingId) => {
        if (!window.confirm('Delete this recording?')) return;
        try { const res = await fetch(`${API_BASE}/audio/recordings/${recordingId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) { setRecordings(prev => prev.filter(r => r._id !== recordingId)); setAllRecordings(prev => prev.filter(r => r._id !== recordingId)); } } catch (e) { console.error(e); }
    };

    const openDept = (dept) => { setSelectedDept(dept); fetchDeptMembers(dept._id); };
    const openMemberProfile = (user) => { setSelectedUser(user); fetchUserRecordings(user._id); setActiveTab('member-profile'); };
    const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        setAvatarFile(file);
        const reader = new FileReader(); reader.onloadend = () => setAvatarPreview(reader.result); reader.readAsDataURL(file);
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0]; if (!file || !selectedUser) return;
        setUploadFile(file); setUploadTitle(file.name.replace(/\.[^/.]+$/, '')); setUploadDescription(''); setIsUploadModalOpen(true); event.target.value = null;
    };
    const handleUploadSubmit = async (e) => {
        e.preventDefault(); if (!uploadFile || !selectedUser) return; setIsUploading(true);
        const formData = new FormData(); formData.append('file', uploadFile); formData.append('title', uploadTitle || uploadFile.name); formData.append('description', uploadDescription); formData.append('target_user_id', selectedUser._id);
        try { const res = await fetch(`${API_BASE}/audio/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }); const data = await res.json(); if (data.success) { setIsUploadModalOpen(false); setUploadFile(null); fetchUserRecordings(selectedUser._id); } else alert(data.message || 'Failed'); } catch (e) { console.error(e); } finally { setIsUploading(false); }
    };

    const handleSearch = async (e) => {
        const q = e.target.value; setSearchQuery(q);
        if (q.trim().length < 3) { setSearchResults([]); return; }
        setIsSearching(true);
        try { const res = await fetch(`${API_BASE}/search/?q=${encodeURIComponent(q)}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) { setSearchResults(data.data); if (data.data.length > 0) setActiveTab('search'); } } catch (e) { console.error(e); } finally { setIsSearching(false); }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder; chunksRef.current = []; setLiveTranscript(''); setRecordingTime(0);
            const userId = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
            const ws = new WebSocket(`ws://localhost:8000/ws/transcribe/${userId}`); wsRef.current = ws;
            ws.onmessage = (ev) => { const d = JSON.parse(ev.data); if (d.type === 'transcript') setLiveTranscript(d.text); };
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) { chunksRef.current.push(e.data); if (ws.readyState === WebSocket.OPEN) ws.send(e.data); } };
            mediaRecorder.onstop = async () => {
                if (ws.readyState === WebSocket.OPEN) ws.close();
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], `Live_Recording_${new Date().toISOString().slice(0, 10)}.webm`, { type: 'audio/webm' });
                const fd = new FormData(); fd.append('file', file); fd.append('title', file.name); fd.append('target_user_id', selectedUser._id);
                try { const r = await fetch(`${API_BASE}/audio/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd }); if (r.ok) fetchUserRecordings(selectedUser._id); } catch (err) { console.error(err); }
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start(1000); setIsRecording(true);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (e) { alert('Could not access microphone.'); }
    };
    const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); clearInterval(timerRef.current); setLiveTranscript(''); } };

    const formatTime = (s) => { if (!s) return '0h 0m'; return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; };
    const formatTimestamp = (s) => { if (!s) return '0:00'; return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; };
    const formatDate = (d) => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
    const formatDateTime = (d) => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); };

    const fetchFullRecording = async (recordingId) => {
        try { const res = await fetch(`${API_BASE}/audio/recordings/${recordingId}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (data.success) setViewingTranscript(data.data); } catch (e) { console.error(e); }
    };

    const SPEAKER_COLORS = ['#234e3d', '#6366f1', '#e11d48', '#ca8a04', '#0891b2', '#9333ea'];

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    };
    const AVATAR_COLORS = ['#234e3d', '#6366f1', '#e11d48', '#ca8a04', '#0891b2', '#9333ea', '#ea580c', '#4f46e5'];

    const GlobalPerformance = () => {
        const totalRecs = allRecordings.length;
        const completedRecs = allRecordings.filter(r => r.status === 'completed').length;
        const totalDuration = allRecordings.reduce((a, r) => a + (r.duration || 0), 0);
        const processingRecs = allRecordings.filter(r => r.status === 'processing').length;

        return (
            <>
                <div className="header-row"><h1>Admin Global Performance</h1><button className="btn-quick-record" onClick={() => setActiveTab('studio')}>Quick Record</button></div>
                <div className="dashboard-grid">
                    <section className="card trends-card section-span-2">
                        <div className="card-header"><h3>Summary of recording trends</h3><div className="card-controls"><span className="legend"><div className="dot dark"></div> Recording</span><span className="legend"><div className="dot light"></div> Speaking</span><button className="select-btn">Summary</button></div></div>
                        <div className="chart-placeholder"><svg className="chart-svg" viewBox="0 0 800 200" preserveAspectRatio="none"><path d="M0 200 L0 150 Q100 50, 200 120 T400 60 T600 140 T800 40 L800 200 Z" fill="rgba(35,78,61,0.4)" stroke="#234e3d" strokeWidth="3" /><path d="M0 200 L0 180 Q150 100, 300 160 T500 100 T700 120 T800 80 L800 200 Z" fill="rgba(180,80,80,0.3)" stroke="#b56565" strokeWidth="3" /></svg></div>
                        <div className="stats-row">
                            <div className="stat-item"><span className="stat-label"><div className="dot dark"></div> Active Members</span><span className="stat-value">{teamMembers.length}</span></div>
                            <div className="stat-item"><span className="stat-label"><div className="dot light"></div> Total Recordings</span><span className="stat-value">{totalRecs}</span></div>
                            <div className="stat-item"><span className="stat-label"><div className="dot dark"></div> Transcribed</span><span className="stat-value">{completedRecs}</span></div>
                            <div className="stat-item"><span className="stat-label"><div className="dot light"></div> Total Duration</span><span className="stat-value">{formatTime(totalDuration)}</span></div>
                        </div>
                    </section>
                    <section className="card side-card"><h3>Recent Activity Feed</h3><div className="activity-list">{teamMembers.slice(0, 5).map((u, i) => (
                        <div className="activity-item" key={u._id || i} onClick={() => openMemberProfile(u)} style={{ cursor: 'pointer' }}>
                            <div className="activity-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, overflow: 'hidden' }}>
                                {u.avatar_url ?
                                    <img src={`http://localhost:8000${u.avatar_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = getInitials(u.name); }} /> :
                                    getInitials(u.name)
                                }
                            </div>
                            <div className="activity-details" style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name} joined</h4>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#999' }}>{u.role}</p>
                            </div>
                            <span className="activity-time" style={{ fontSize: '0.75rem', color: '#bbb', flexShrink: 0 }}>new</span>
                        </div>
                    ))}</div></section>
                    {processingRecs > 0 && (
                        <section className="card" style={{ gridColumn: '1 / -1' }}>
                            <h3 style={{ marginBottom: '0.5rem' }}>⏳ Currently Processing</h3>
                            <p style={{ color: '#ca8a04', fontSize: '0.88rem' }}>{processingRecs} recording{processingRecs > 1 ? 's' : ''} being transcribed...</p>
                            <div className="processing-bar"><div className="processing-bar-fill"></div></div>
                        </section>
                    )}
                </div>
            </>
        );
    };

    // ===== TEAM WITH DEPARTMENT FOLDERS =====
    const FullTeamMembers = () => {
        if (selectedDept) {
            return (
                <>
                    <div className="header-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button onClick={() => { setSelectedDept(null); setDeptMembers([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#666' }}>←</button>
                            <h1>{selectedDept.name}</h1>
                            <span style={{ fontSize: '0.85rem', color: '#888', marginLeft: '0.5rem' }}>{deptMembers.length} members</span>
                        </div>
                        <button className="btn-quick-record" onClick={() => { setNewMemberData({ name: '', email: '', phone: '', department: selectedDept._id }); setIsAddMemberModalOpen(true); }}>+ Add Member</button>
                    </div>
                    {deptMembers.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><p style={{ color: '#888', fontSize: '1rem' }}>No members in this department yet.<br /><span style={{ fontSize: '0.85rem' }}>Click "+ Add Member" to add team members.</span></p></div>
                    ) : (
                        <div className="team-grid-full">
                            {deptMembers.map(user => (
                                <div className="card team-card" key={user._id} onClick={() => openMemberProfile(user)} style={{ cursor: 'pointer' }}>
                                    <div className="avatar-wrapper"><div className="avatar-ring-1"></div><div className="avatar-ring-2"></div><div className="profile-avatar-lg"><img src={user.avatar_url ? `http://localhost:8000${user.avatar_url}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={user.name} /></div></div>
                                    <h4 className="user-name">{user.name}</h4>
                                    <p className="user-role">{user.role}</p>
                                    <div className="user-stats"><div className="user-stat-col"><span className="user-stat-label"><div className="dot dark"></div> Recordings</span><span className="user-stat-value">{user.recording_count || 0}</span></div><div className="vertical-divider"></div><div className="user-stat-col"><span className="user-stat-label"><div className="dot light"></div> Spoken Time</span><span className="user-stat-value">{formatTime(user.total_speaking_time)}</span></div></div>
                                    <button className="btn-cta">View Profile</button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            );
        }

        return (
            <>
                <div className="header-row"><h1>Teams & Departments</h1></div>
                <div className="dept-grid">
                    {departments.map(dept => (
                        <div className="dept-folder" key={dept._id} onClick={() => openDept(dept)}>
                            <div className="dept-actions" onClick={e => e.stopPropagation()}>
                                <button className="delete-btn" onClick={() => handleDeleteDept(dept._id)} title="Delete">🗑</button>
                            </div>
                            <div className="dept-folder-icon">📁</div>
                            <h4>{dept.name}</h4>
                            <span className="dept-count">{dept.member_count || 0} members</span>
                        </div>
                    ))}
                    <div className="add-dept-card" onClick={() => setIsAddDeptModalOpen(true)}>
                        <div className="plus-icon">+</div>
                        <span>Create Department</span>
                    </div>
                </div>
            </>
        );
    };

    // ===== RECORDINGS & TRANSCRIPTS PAGE =====
    const RecordingsPage = () => {
        useEffect(() => { fetchAllRecordings(); }, [teamMembers]);
        const filtered = recFilter === 'all' ? allRecordings : allRecordings.filter(r => r.status === recFilter);
        const totalDuration = allRecordings.reduce((a, r) => a + (r.duration || 0), 0);
        const completed = allRecordings.filter(r => r.status === 'completed').length;
        const processing = allRecordings.filter(r => r.status === 'processing').length;

        return (
            <div className="recordings-page">
                <div className="header-row"><h1>Recordings & Transcripts</h1></div>
                <div className="recordings-stats-row">
                    <div className="rec-stat-card"><div className="rec-stat-icon green">🎙</div><div className="rec-stat-info"><h4>{allRecordings.length}</h4><p>Total Recordings</p></div></div>
                    <div className="rec-stat-card"><div className="rec-stat-icon blue">✅</div><div className="rec-stat-info"><h4>{completed}</h4><p>Transcribed</p></div></div>
                    <div className="rec-stat-card"><div className="rec-stat-icon amber">⏳</div><div className="rec-stat-info"><h4>{processing}</h4><p>Processing</p></div></div>
                    <div className="rec-stat-card"><div className="rec-stat-icon rose">⏱</div><div className="rec-stat-info"><h4>{formatTime(totalDuration)}</h4><p>Total Duration</p></div></div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {['all', 'completed', 'processing', 'failed'].map(f => (
                        <button key={f} onClick={() => setRecFilter(f)} style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: recFilter === f ? 'none' : '1px solid #ddd', background: recFilter === f ? '#234e3d' : 'white', color: recFilter === f ? 'white' : '#666', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', transition: 'all 0.2s' }}>{f}</button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}><p style={{ color: '#888' }}>No recordings found.</p></div>
                ) : (
                    <div className="recordings-list">
                        {filtered.map(rec => (
                            <div className="rec-item" key={rec._id} onClick={() => { fetchFullRecording(rec._id); setActiveTab('member-profile'); }}>
                                <div className="rec-item-icon">🎵</div>
                                <div className="rec-item-info">
                                    <h4>{rec.title}</h4>
                                    <div className="rec-meta">
                                        <span>📅 {formatDateTime(rec.created_at)}</span>
                                        <span>⏱ {formatTime(rec.duration)}</span>
                                        {rec.description && <span>📝 {rec.description}</span>}
                                    </div>
                                </div>
                                <span className={`rec-item-status ${rec.status}`}>{rec.status}</span>
                                <div className="rec-item-actions" onClick={e => e.stopPropagation()}>
                                    <button className="danger" onClick={() => handleDeleteRecording(rec._id)} title="Delete">🗑</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // ===== MEMBER PROFILE (with date/time on recordings) =====
    const MemberProfile = () => {
        if (!selectedUser && !viewingTranscript) return <GlobalPerformance />;

        if (viewingTranscript) {
            return (
                <>
                    <div className="header-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><button onClick={() => setViewingTranscript(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#666' }}>←</button><h1>Transcript: {viewingTranscript.title}</h1></div>
                        <span style={{ color: '#234e3d', fontWeight: 'bold' }}>{formatTime(viewingTranscript.duration)}</span>
                    </div>
                    <div className="card" style={{ marginBottom: '1rem', padding: '1rem', position: 'sticky', top: '10px', zIndex: 10 }}>
                        <audio ref={audioRef} controls style={{ width: '100%' }} src={`http://localhost:8000${viewingTranscript.audio_url}`} onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}></audio>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#888' }}>📅 Uploaded: {formatDateTime(viewingTranscript.created_at)} {viewingTranscript.updated_at && ` · Transcribed: ${formatDateTime(viewingTranscript.updated_at)}`}</p>
                    </div>
                    {viewingTranscript.summary && (<div className="card" style={{ marginBottom: '1rem' }}><h3 style={{ marginBottom: '0.75rem' }}>📋 AI Summary</h3><p style={{ color: '#444', lineHeight: 1.7 }}>{viewingTranscript.summary}</p>{viewingTranscript.action_items?.length > 0 && (<div style={{ marginTop: '1rem' }}><h4 style={{ color: '#234e3d', marginBottom: '0.5rem' }}>✅ Action Items</h4><ul style={{ paddingLeft: '1.5rem', color: '#444' }}>{viewingTranscript.action_items.map((item, i) => <li key={i} style={{ marginBottom: '0.3rem' }}>{item}</li>)}</ul></div>)}</div>)}
                    {viewingTranscript.speaker_stats && Object.keys(viewingTranscript.speaker_stats).length > 0 && (<div className="card" style={{ marginBottom: '1rem' }}><h3 style={{ marginBottom: '0.75rem' }}>🎤 Speaker Statistics</h3><div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>{Object.entries(viewingTranscript.speaker_stats).map(([speaker, stats], idx) => (<div key={speaker} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderRadius: '12px', background: `${SPEAKER_COLORS[idx % SPEAKER_COLORS.length]}15`, border: `2px solid ${SPEAKER_COLORS[idx % SPEAKER_COLORS.length]}30` }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: SPEAKER_COLORS[idx % SPEAKER_COLORS.length] }}></div><div><strong style={{ color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length] }}>{speaker}</strong><p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>{stats.word_count} words · {stats.turn_count} turns · {formatTime(stats.total_time)}</p></div></div>))}</div></div>)}

                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>📝 Transcript View</h3>
                            <div className="view-toggle-buttons" style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '12px' }}>
                                <button
                                    onClick={() => setTranscriptViewMode('dialogue')}
                                    style={{ padding: '6px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, background: transcriptViewMode === 'dialogue' ? 'white' : 'transparent', color: transcriptViewMode === 'dialogue' ? '#234e3d' : '#666', boxShadow: transcriptViewMode === 'dialogue' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                                >
                                    Dialogue View
                                </button>
                                <button
                                    onClick={() => setTranscriptViewMode('narrative')}
                                    style={{ padding: '6px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, background: transcriptViewMode === 'narrative' ? 'white' : 'transparent', color: transcriptViewMode === 'narrative' ? '#234e3d' : '#666', boxShadow: transcriptViewMode === 'narrative' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                                >
                                    Narrative Mode
                                </button>
                            </div>
                        </div>

                        {viewingTranscript.speakers?.length > 0 ? (
                            <div style={{ lineHeight: 1.8 }}>
                                {viewingTranscript.speakers.map((seg, i) => {
                                    const idx = parseInt(seg.speaker_label?.replace('SPEAKER_', '') || '0');
                                    const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];

                                    if (transcriptViewMode === 'dialogue') {
                                        return (
                                            <div key={i} style={{ marginBottom: '1.25rem', paddingLeft: '1.25rem', borderLeft: `3px solid ${color}` }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                                    <span style={{ fontWeight: 'bold', color, fontSize: '0.88rem' }}>{seg.speaker_label}</span>
                                                    <span style={{ color: '#999', fontSize: '0.75rem' }}>[{formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}]</span>
                                                </div>
                                                <p style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
                                                    {seg.words ? seg.words.map((w, wIdx) => {
                                                        const hl = currentTime >= w.start && currentTime <= w.end;
                                                        return <span key={wIdx} style={{ backgroundColor: hl ? '#bbf7d0' : 'transparent', color: hl ? '#166534' : 'inherit', borderRadius: '4px', padding: '0 2px', transition: 'all 0.1s' }}>{w.word}{' '}</span>;
                                                    }) : seg.text}
                                                </p>
                                            </div>
                                        );
                                    } else {
                                        // Narrative Mode: Paragraphs without labels
                                        return (
                                            <p key={i} style={{ marginBottom: '1rem', color: '#444', fontSize: '1rem', textAlign: 'justify' }}>
                                                <span style={{ color: color, fontWeight: 700, marginRight: '8px' }}>•</span>
                                                {seg.words ? seg.words.map((w, wIdx) => {
                                                    const hl = currentTime >= w.start && currentTime <= w.end;
                                                    return <span key={wIdx} style={{ backgroundColor: hl ? '#dcfce7' : 'transparent', color: hl ? '#166534' : 'inherit', borderRadius: '4px', padding: '0 2px' }}>{w.word}{' '}</span>;
                                                }) : seg.text}
                                            </p>
                                        );
                                    }
                                })}
                            </div>
                        ) : (
                            <div style={{ background: '#f9fafb', padding: '2rem', borderRadius: '16px', border: '1px dashed #e5e7eb' }}>
                                <p style={{ color: '#444', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: '1.05rem', margin: 0 }}>
                                    {viewingTranscript.transcript_raw}
                                </p>
                            </div>
                        )}
                    </div>

                    {transcriptViewMode === 'narrative' && (
                        <div className="card" style={{ marginTop: '1rem', borderTop: '4px solid #234e3d' }}>
                            <h3 style={{ marginBottom: '1rem' }}>📄 Complete Narrative Text</h3>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '1rem' }}>
                                <p style={{ color: '#374151', lineHeight: 1.8, fontSize: '1.05rem', textAlign: 'justify' }}>
                                    {viewingTranscript.transcript_raw || viewingTranscript.speakers?.map(s => s.text).join(' ')}
                                </p>
                            </div>
                        </div>
                    )}
                </>
            );
        }

        return (
            <>
                <div className="header-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><button onClick={() => { setActiveTab(selectedDept ? 'team' : 'team'); setViewingTranscript(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#666' }}>←</button><h1>{selectedUser.name}'s Profile</h1></div>
                    <button onClick={() => handleDeleteMember(selectedUser._id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Delete User</button>
                </div>
                <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <section className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Recordings & Transcripts</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => fetchUserRecordings(selectedUser._id)} style={{ background: '#eee', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>↻ Refresh</button>
                                {!isRecording ? <button onClick={startRecording} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>⏺ Record</button> : <button onClick={stopRecording} style={{ background: '#ca8a04', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>⏹ Stop ({formatTime(recordingTime)})</button>}
                                <label style={{ cursor: 'pointer', background: '#234e3d', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold' }}>⤒ Upload<input ref={uploadFileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileSelect} /></label>
                            </div>
                        </div>
                        {isRecording && liveTranscript && (<div style={{ background: '#fef3c7', padding: '1rem', marginTop: '1rem', borderRadius: '8px', border: '1px solid #fde68a' }}><strong style={{ color: '#92400e', display: 'block' }}>Live Transcript:</strong><p style={{ margin: 0, color: '#b45309' }}>{liveTranscript}</p></div>)}
                        {recordings.length === 0 ? <p style={{ color: '#666', padding: '2rem 0', textAlign: 'center' }}>No recordings found.</p> : (
                            <div className="recordings-list" style={{ marginTop: '1rem' }}>
                                {recordings.map(rec => (
                                    <div className="rec-item" key={rec._id}>
                                        <div className="rec-item-icon">🎵</div>
                                        <div className="rec-item-info">
                                            <h4>{rec.title}</h4>
                                            <div className="rec-meta">
                                                <span>📅 {formatDateTime(rec.created_at)}</span>
                                                <span>⏱ {formatTime(rec.duration)}</span>
                                                <span style={{ color: rec.status === 'completed' ? '#166534' : rec.status === 'failed' ? '#ef4444' : '#ca8a04', fontWeight: 600 }}>{rec.status}</span>
                                                {rec.status === 'processing' && <span>🔄 {rec.step}</span>}
                                            </div>
                                            {rec.description && <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>{rec.description}</p>}
                                        </div>
                                        <div className="rec-item-actions">
                                            {rec.status === 'completed' && <button onClick={() => fetchFullRecording(rec._id)} title="View">📄</button>}
                                            <button className="danger" onClick={() => handleDeleteRecording(rec._id)} title="Delete">🗑</button>
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

    const renderContent = () => {
        if (activeTab === 'search') {
            return (<div style={{ padding: '0 2rem' }}><h1 style={{ marginBottom: '2rem' }}>Search Results for "{searchQuery}"</h1><div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>{searchResults.length === 0 ? <p style={{ color: '#666' }}>No results found.</p> : searchResults.map((res, i) => (<div key={i} className="card" style={{ marginBottom: '1rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><h3 style={{ margin: 0, marginBottom: '1rem', color: '#234e3d' }}>{res.title}</h3><button onClick={() => { setActiveTab('member-profile'); fetchFullRecording(res.recording_id); }} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 'bold' }}>View →</button></div><div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>{res.matched_segments.map((seg, idx) => (<div key={idx} style={{ marginBottom: idx < res.matched_segments.length - 1 ? '1rem' : '0' }}><span style={{ fontSize: '0.8rem', color: '#999', display: 'block', marginBottom: '0.2rem' }}>{formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}</span><p style={{ margin: 0, color: '#444' }}>{seg.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, pIdx) => part.toLowerCase() === searchQuery.toLowerCase() ? <strong key={pIdx} style={{ background: '#fef08a', padding: '0 2px' }}>{part}</strong> : part)}</p></div>))}</div></div>))}</div></div>);
        }
        switch (activeTab) {
            case 'home': return <GlobalPerformance />;
            case 'team': return <FullTeamMembers />;
            case 'member-profile': return <MemberProfile />;
            case 'recordings': return <RecordingsPage />;
            case 'studio': return <LiveStudio token={token} teamMembers={teamMembers} onViewTranscript={(id) => { fetchFullRecording(id); setActiveTab('member-profile'); }} fetchAllRecordings={fetchAllRecordings} />;
            case 'settings': return <div className="placeholder-view"><div className="header-row"><h1>Settings</h1></div><div className="card text-center py-10"><h3 style={{ margin: '3rem 0', color: '#666' }}>Settings under development.</h3></div></div>;
            default: return <GlobalPerformance />;
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="blob blob-pink"></div><div className="blob blob-green"></div>
            <nav className="sidebar">
                <div className="sidebar-logo">AI</div>
                <ul className="sidebar-menu">
                    <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')} title="Overview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg></li>
                    <li className={activeTab === 'team' ? 'active' : ''} onClick={() => { setActiveTab('team'); setSelectedDept(null); }} title="Teams"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path></svg></li>
                    <li className={activeTab === 'recordings' ? 'active' : ''} onClick={() => setActiveTab('recordings')} title="Recordings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"></path><path d="M19 10v2a7 7 0 01-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></li>
                    <li className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')} title="Live Recording Studio" style={activeTab === 'studio' ? { boxShadow: '0 0 12px rgba(35,78,61,0.3)' } : {}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></li>
                    <li className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')} title="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg></li>
                </ul>
                <div className="sidebar-logout" onClick={handleLogout} title="Logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></div>
            </nav>
            <main className="main-content" ref={mainContentRef}>
                <div className="topbar"><div className="search-bar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" placeholder="Search..." value={searchQuery} onChange={handleSearch} /></div></div>
                {renderContent()}
            </main>

            {/* CREATE DEPARTMENT MODAL */}
            {isAddDeptModalOpen && (
                <div className="modal-overlay" onClick={() => setIsAddDeptModalOpen(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h2>Create Department</h2>
                        <p className="modal-subtitle">Organize your team into departments</p>
                        <form onSubmit={handleCreateDept}>
                            <div className="modal-field"><label>Department Name</label><input required type="text" placeholder="e.g. Tech Team" value={newDeptData.name} onChange={e => setNewDeptData({ ...newDeptData, name: e.target.value })} /></div>
                            <div className="modal-field"><label>Description <span className="optional-tag">optional</span></label><input type="text" placeholder="Brief description..." value={newDeptData.description} onChange={e => setNewDeptData({ ...newDeptData, description: e.target.value })} /></div>
                            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setIsAddDeptModalOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Creating...' : 'Create'}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD TEAM MEMBER MODAL */}
            {isAddMemberModalOpen && (
                <div className="modal-overlay" onClick={() => { setIsAddMemberModalOpen(false); setAvatarFile(null); setAvatarPreview(null); }}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h2>Add Team Member</h2>
                        <p className="modal-subtitle">Add a new member to {selectedDept ? selectedDept.name : 'your team'}</p>
                        <form onSubmit={handleAddMember}>
                            <div className="avatar-upload-area">
                                <div className="avatar-preview">{avatarPreview ? <img src={avatarPreview} alt="Preview" /> : '👤'}</div>
                                <div><button type="button" className="avatar-upload-btn" onClick={() => avatarInputRef.current?.click()}>Upload Photo</button><input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} /></div>
                            </div>
                            <div className="modal-field"><label>Name</label><input required type="text" placeholder="Full name" value={newMemberData.name} onChange={e => setNewMemberData({ ...newMemberData, name: e.target.value })} /></div>
                            <div className="modal-field"><label>Email <span className="optional-tag">optional</span></label><input type="email" placeholder="email@example.com" value={newMemberData.email} onChange={e => setNewMemberData({ ...newMemberData, email: e.target.value })} /></div>
                            <div className="modal-field"><label>Phone <span className="optional-tag">optional</span></label><input type="tel" placeholder="+91 98765 43210" value={newMemberData.phone} onChange={e => setNewMemberData({ ...newMemberData, phone: e.target.value })} /></div>
                            {!selectedDept && departments.length > 0 && (
                                <div className="modal-field"><label>Department <span className="optional-tag">optional</span></label><select value={newMemberData.department} onChange={e => setNewMemberData({ ...newMemberData, department: e.target.value })}><option value="">Select department</option>{departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
                            )}
                            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => { setIsAddMemberModalOpen(false); setAvatarFile(null); setAvatarPreview(null); }}>Cancel</button><button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Member'}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* UPLOAD AUDIO MODAL */}
            {isUploadModalOpen && (
                <div className="modal-overlay" onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); }}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '440px' }}>
                        <h2>📤 Upload Audio</h2>
                        <p className="modal-subtitle">Add title and description for this audio</p>
                        {uploadFile && (<div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><span style={{ fontSize: '1.2rem' }}>🎵</span><div style={{ flex: 1, overflow: 'hidden' }}><p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#166534', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{uploadFile.name}</p><p style={{ margin: 0, fontSize: '0.75rem', color: '#4ade80' }}>{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</p></div></div>)}
                        <form onSubmit={handleUploadSubmit}>
                            <div className="modal-field"><label>Title</label><input required type="text" placeholder="e.g. Team standup" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} /></div>
                            <div className="modal-field"><label>Description <span className="optional-tag">optional</span></label><input type="text" placeholder="Brief description..." value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} /></div>
                            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); }}>Cancel</button><button type="submit" className="btn-primary" disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload & Transcribe'}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
