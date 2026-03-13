import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LiveStudio.css';

const API_BASE = import.meta.env.VITE_API_URL ? (import.meta.env.VITE_API_URL.endsWith('/api') ? import.meta.env.VITE_API_URL : `${import.meta.env.VITE_API_URL}/api`) : 'http://localhost:8000/api';

const LiveStudio = ({ token, teamMembers, onViewTranscript, fetchAllRecordings: parentFetchAll }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [liveLines, setLiveLines] = useState([]);
    const [savedRecordings, setSavedRecordings] = useState([]);
    const [studioUploadFile, setStudioUploadFile] = useState(null);
    const [isStudioUploading, setIsStudioUploading] = useState(false);
    const [studioUploadTitle, setStudioUploadTitle] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [playingAudio, setPlayingAudio] = useState(null);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [waveformBars, setWaveformBars] = useState([]);
    const [studioProcessing, setStudioProcessing] = useState(false);
    const [recordingState, setRecordingState] = useState('idle'); // idle, recording, processing, saved

    const mediaRecorderRef = useRef(null);
    const wsRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);
    const transcriptEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioPlayerRef = useRef(null);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);

    useEffect(() => {
        fetchSavedRecordings();
        generateRandomWaveform();
    }, []);

    // Poll for processing recordings
    useEffect(() => {
        const hasProcessing = savedRecordings.some(r => r.status === 'processing' || r.status === 'uploaded');
        if (!hasProcessing) return;
        const iv = setInterval(() => fetchSavedRecordings(), 3000);
        return () => clearInterval(iv);
    }, [savedRecordings]);

    // Scroll transcript to bottom (use scrollTop, NOT scrollIntoView which scrolls parents)
    useEffect(() => {
        const scrollEl = transcriptEndRef.current?.parentElement;
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }, [liveLines]);

    const generateRandomWaveform = () => {
        const bars = Array.from({ length: 60 }, () => Math.random() * 0.8 + 0.2);
        setWaveformBars(bars);
    };

    const fetchSavedRecordings = async () => {
        try {
            const res = await fetch(`${API_BASE}/audio/recordings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setSavedRecordings(data.data);
        } catch (e) { console.error(e); }
    };

    const getUserId = () => {
        try {
            const base64Url = token.split('.')[1];
            return JSON.parse(window.atob(base64Url.replace(/-/g, '+').replace(/_/g, '/'))).sub;
        } catch { return null; }
    };

    // ========= LIVE RECORDING =========
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up audio analyser for waveform
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyserRef.current = analyser;
            updateLiveWaveform();

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            setLiveLines([]);
            setRecordingTime(0);
            setRecordingState('recording');

            // WebSocket for live transcript
            const userId = getUserId();
            const ws = new WebSocket(`ws://localhost:8000/ws/transcribe/${userId}`);
            wsRef.current = ws;

            ws.onmessage = (ev) => {
                try {
                    const d = JSON.parse(ev.data);
                    if (d.type === 'transcript' && d.text) {
                        const time = Math.floor((Date.now() - startTimestamp) / 1000);
                        setLiveLines(prev => [...prev, {
                            ts: time,
                            speaker: d.speaker || `Speaker ${(prev.length % 3) + 1}`,
                            text: d.text,
                            color: ['#234e3d', '#6366f1', '#e11d48'][prev.length % 3]
                        }]);
                    }
                } catch (e) { console.error(e); }
            };

            const startTimestamp = Date.now();

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                    if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                cancelAnimationFrame(animFrameRef.current);
                if (ws.readyState === WebSocket.OPEN) ws.close();

                setRecordingState('processing');
                setStudioProcessing(true);

                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const now = new Date();
                const title = `Recording ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
                const file = new File([blob], `${title.replace(/\s/g, '_')}.webm`, { type: 'audio/webm' });

                const fd = new FormData();
                fd.append('file', file);
                fd.append('title', title);

                try {
                    const r = await fetch(`${API_BASE}/audio/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: fd
                    });
                    if (r.ok) {
                        fetchSavedRecordings();
                        if (parentFetchAll) parentFetchAll();
                    }
                } catch (err) { console.error(err); }

                stream.getTracks().forEach(t => t.stop());
                setStudioProcessing(false);
                setRecordingState('saved');
                setTimeout(() => setRecordingState('idle'), 3000);
            };

            mediaRecorder.start(1000);
            setIsRecording(true);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (e) {
            console.error(e);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            clearInterval(timerRef.current);
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            if (isPaused) {
                mediaRecorderRef.current.resume();
                timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
                setIsPaused(false);
            } else {
                mediaRecorderRef.current.pause();
                clearInterval(timerRef.current);
                setIsPaused(true);
            }
        }
    };

    const updateLiveWaveform = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const bars = Array.from(data).slice(0, 60).map(v => v / 255);
        setWaveformBars(bars);
        animFrameRef.current = requestAnimationFrame(updateLiveWaveform);
    };

    // ========= UPLOAD =========
    const handleDrop = useCallback((e) => {
        e.preventDefault(); setDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file && isAudioFile(file)) {
            setStudioUploadFile(file);
            setStudioUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
    }, []);

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);

    const isAudioFile = (file) => {
        const exts = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac'];
        return exts.some(ext => file.name.toLowerCase().endsWith(ext));
    };

    const handleStudioFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && isAudioFile(file)) {
            setStudioUploadFile(file);
            setStudioUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        e.target.value = null;
    };

    const handleStudioUpload = async () => {
        if (!studioUploadFile) return;
        setIsStudioUploading(true);
        const fd = new FormData();
        fd.append('file', studioUploadFile);
        fd.append('title', studioUploadTitle || studioUploadFile.name);
        fd.append('description', 'Uploaded via Live Studio');

        try {
            const res = await fetch(`${API_BASE}/audio/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: fd
            });
            const data = await res.json();
            if (data.success) {
                setStudioUploadFile(null);
                setStudioUploadTitle('');
                fetchSavedRecordings();
                if (parentFetchAll) parentFetchAll();
            } else {
                alert(data.message || 'Upload failed');
            }
        } catch (e) { console.error(e); alert('Upload failed'); }
        finally { setIsStudioUploading(false); }
    };

    // ========= AUDIO PLAYER =========
    const playRecording = (rec) => {
        setPlayingAudio(rec);
        setAudioCurrentTime(0);
        setAudioPlaying(true);
        generateRandomWaveform();
        setTimeout(() => {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.playbackRate = playbackSpeed;
                audioPlayerRef.current.play().catch(() => { });
            }
        }, 100);
    };

    const togglePlay = () => {
        if (!audioPlayerRef.current) return;
        if (audioPlaying) { audioPlayerRef.current.pause(); }
        else { audioPlayerRef.current.play().catch(() => { }); }
        setAudioPlaying(!audioPlaying);
    };

    const cycleSpeed = () => {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const idx = speeds.indexOf(playbackSpeed);
        const next = speeds[(idx + 1) % speeds.length];
        setPlaybackSpeed(next);
        if (audioPlayerRef.current) audioPlayerRef.current.playbackRate = next;
    };

    const fmtRecTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const fmtDuration = (s) => {
        if (!s || s < 60) return `${Math.floor(s || 0)}s`;
        return `${Math.floor(s / 60)} min`;
    };

    const timeAgo = (d) => {
        if (!d) return '';
        const diff = Date.now() - new Date(d).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    };

    const progress = audioDuration > 0 ? (audioCurrentTime / audioDuration) : 0;

    return (
        <>
            <div className="header-row">
                <h1>Live Recording Studio</h1>
                {recordingState === 'processing' && <span className="rec-item-status processing">Processing...</span>}
                {recordingState === 'saved' && <span className="rec-item-status completed">Saved ✓</span>}
            </div>

            <div className="studio-layout">
                {/* ====== MAIN CONTENT ====== */}
                <div className="studio-main">
                    {/* Recording Controls */}
                    <div className="studio-controls">
                        {!isRecording ? (
                            <button className="rec-btn-start" onClick={startRecording}>
                                <span className="rec-dot"></span>
                                Start Recording
                            </button>
                        ) : (
                            <>
                                <button className="rec-btn-recording" onClick={stopRecording}>
                                    <span className="rec-dot"></span>
                                    Stop Recording
                                </button>
                                <button
                                    onClick={pauseRecording}
                                    style={{
                                        padding: '0.6rem 1rem', borderRadius: '30px',
                                        border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.6)',
                                        color: '#555', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem'
                                    }}
                                >
                                    {isPaused ? '▶ Resume' : '⏸ Pause'}
                                </button>
                            </>
                        )}

                        <label className="rec-btn-upload">
                            ⤒ Upload Audio File
                            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleStudioFileSelect} />
                        </label>

                        <span className={`rec-timer ${isRecording ? 'active' : ''}`}>
                            {fmtRecTime(recordingTime)}
                        </span>
                    </div>

                    {/* Live Transcript */}
                    <div className="studio-transcript-card">
                        <h3>
                            📝 Transcript
                            {isRecording && (
                                <span className="live-indicator">
                                    <span className="live-dot"></span>
                                    LIVE
                                </span>
                            )}
                        </h3>
                        <div className="transcript-scroll">
                            {liveLines.length === 0 && !isRecording ? (
                                <div className="transcript-empty">
                                    <div className="empty-icon">🎙️</div>
                                    <p>Start speaking to transcribe in real time, or upload audio files for automatic transcription.</p>
                                </div>
                            ) : liveLines.length === 0 && isRecording ? (
                                <div className="transcript-empty">
                                    <div className="empty-icon" style={{ animation: 'pulse 1.5s infinite' }}>🎙️</div>
                                    <p>Listening... Start speaking and your words will appear here in real time.</p>
                                </div>
                            ) : (
                                liveLines.map((line, i) => (
                                    <div className="transcript-line" key={i}>
                                        <span className="ts">{fmtRecTime(line.ts)}</span>
                                        <span className="speaker-tag" style={{ color: line.color }}>{line.speaker}:</span>
                                        <span className="txt">{line.text}</span>
                                    </div>
                                ))
                            )}
                            {isRecording && liveLines.length > 0 && (
                                <div className="transcript-line" style={{ opacity: 0.5 }}>
                                    <span className="ts">{fmtRecTime(recordingTime)}</span>
                                    <span className="txt" style={{ fontStyle: 'italic', color: '#999' }}>Transcribing...</span>
                                </div>
                            )}
                            <div ref={transcriptEndRef}></div>
                        </div>
                    </div>

                    {/* Audio Player / Waveform */}
                    <div className="studio-player">
                        <button className="player-play-btn" onClick={togglePlay} disabled={!playingAudio}>
                            {audioPlaying ? '⏸' : '▶'}
                        </button>

                        <div className="waveform-container">
                            {waveformBars.map((h, i) => (
                                <div
                                    key={i}
                                    className={`waveform-bar ${i / waveformBars.length <= progress ? 'active' : ''}`}
                                    style={{ height: `${Math.max(h * 100, 8)}%` }}
                                />
                            ))}
                        </div>

                        <span className="player-time">
                            {fmtRecTime(audioCurrentTime)} / {fmtRecTime(audioDuration)}
                        </span>
                        <button className="player-speed" onClick={cycleSpeed}>
                            {playbackSpeed}x
                        </button>
                    </div>

                    {playingAudio && (
                        <audio
                            ref={audioPlayerRef}
                            src={`http://localhost:8000${playingAudio.audio_url}`}
                            onTimeUpdate={(e) => setAudioCurrentTime(e.target.currentTime)}
                            onLoadedMetadata={(e) => setAudioDuration(e.target.duration)}
                            onEnded={() => setAudioPlaying(false)}
                            style={{ display: 'none' }}
                        />
                    )}

                    {/* Saved Recordings (Main area list) */}
                    {savedRecordings.length > 0 && (
                        <div style={{ marginTop: '0.25rem' }}>
                            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                Saved Recordings
                            </h3>
                            <div className="recordings-list">
                                {savedRecordings.slice(0, 5).map(rec => (
                                    <div className="rec-item" key={rec._id} onClick={() => { if (rec.status === 'completed') onViewTranscript(rec._id); }}>
                                        <div className="rec-item-icon">🎙</div>
                                        <div className="rec-item-info">
                                            <h4>{rec.title}</h4>
                                            <div className="rec-meta">
                                                <span>⏱ {fmtDuration(rec.duration)}</span>
                                                {rec.speaker_stats && <span>👥 {Object.keys(rec.speaker_stats).length} speakers</span>}
                                                <span>📅 {timeAgo(rec.created_at)}</span>
                                            </div>
                                        </div>
                                        <span className={`rec-item-status ${rec.status}`}>{rec.status}</span>
                                        {rec.status === 'completed' && (
                                            <button className="saved-rec-play" onClick={(e) => { e.stopPropagation(); playRecording(rec); }}>▶</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ====== RIGHT PANEL ====== */}
                <div className="studio-right">
                    {/* Upload Zone */}
                    <div
                        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => !studioUploadFile && fileInputRef.current?.click()}
                    >
                        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleStudioFileSelect} />

                        {!studioUploadFile ? (
                            <>
                                <div className="upload-cloud">☁️</div>
                                <h3>Upload Audio</h3>
                                <p>Drag & drop your audio file or browse to upload</p>
                                <button className="upload-browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                                    📂 Browse Files
                                </button>
                                <p className="upload-formats">Supported: mp3, wav, m4a, webm, ogg</p>
                            </>
                        ) : (
                            <div onClick={(e) => e.stopPropagation()}>
                                <div className="studio-upload-progress" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                                    <div className="file-icon">🎵</div>
                                    <div className="file-info">
                                        <h5>{studioUploadFile.name}</h5>
                                        <p>{(studioUploadFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <div className="modal-field" style={{ marginBottom: '0.75rem', textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</label>
                                    <input
                                        type="text" value={studioUploadTitle}
                                        onChange={e => setStudioUploadTitle(e.target.value)}
                                        placeholder="Recording title..."
                                        style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '10px', border: '1.5px solid #e5e5e5', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => { setStudioUploadFile(null); setStudioUploadTitle(''); }}
                                        style={{ flex: 1, padding: '0.55rem', borderRadius: '10px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.82rem', color: '#666' }}
                                    >Cancel</button>
                                    <button
                                        onClick={handleStudioUpload}
                                        disabled={isStudioUploading}
                                        style={{ flex: 2, padding: '0.55rem', borderRadius: '10px', border: 'none', background: '#234e3d', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: isStudioUploading ? 0.6 : 1 }}
                                    >{isStudioUploading ? 'Uploading...' : 'Upload & Transcribe'}</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Saved Recordings Sidebar */}
                    <div className="saved-recs-panel">
                        <h3>
                            Saved Recordings
                            <button onClick={fetchSavedRecordings} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#888' }}>↻</button>
                        </h3>
                        {savedRecordings.length === 0 ? (
                            <p style={{ color: '#999', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>No recordings yet. Start recording or upload an audio file.</p>
                        ) : (
                            <div className="saved-recs-list">
                                {savedRecordings.map(rec => (
                                    <div className="saved-rec-item" key={rec._id} onClick={() => { if (rec.status === 'completed') onViewTranscript(rec._id); }}>
                                        <div className="saved-rec-avatar">
                                            {rec.status === 'completed' ? '🎙' : rec.status === 'processing' ? '⏳' : '📤'}
                                        </div>
                                        <div className="saved-rec-info">
                                            <h4>{rec.title}</h4>
                                            <p>
                                                {fmtDuration(rec.duration)}
                                                {rec.speaker_stats && Object.keys(rec.speaker_stats).length > 0 && ` · ${Object.keys(rec.speaker_stats).length} speakers`}
                                            </p>
                                            {rec.status === 'processing' && (
                                                <div className="processing-bar"><div className="processing-bar-fill"></div></div>
                                            )}
                                        </div>
                                        <div className="saved-rec-meta">
                                            <span className="rec-date">{timeAgo(rec.created_at)}</span>
                                        </div>
                                        {rec.status === 'completed' && (
                                            <button className="saved-rec-play" onClick={(e) => { e.stopPropagation(); playRecording(rec); }}>▶</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default LiveStudio;
