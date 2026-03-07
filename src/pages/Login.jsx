import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const API_BASE = 'http://localhost:8000/api';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Store token
                localStorage.setItem('token', data.data.token);

                // Redirect based on role
                const userRole = data.data.user.role;
                if (userRole === 'admin') {
                    navigate('/admin-dashboard');
                } else if (userRole === 'hr') {
                    navigate('/hr-dashboard');
                } else {
                    // Fallback generic dashboard or handle other roles
                    navigate('/dashboard');
                }
            } else {
                setError(data.message || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            setError('Network error. Please try again later.');
            console.error("Login error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Left Panel - Login Form */}
            <div className="login-left">
                <div className="login-form-wrapper">
                    <a href="/" className="login-brand">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-logo">
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#6366f1" />
                            <circle cx="12" cy="12" r="3" fill="#ffffff" />
                        </svg>
                        <span>TeamVoice AI</span>
                    </a>

                    <div className="login-header">
                        <h2>Welcome back</h2>
                        <p>Enter your details to access your account.</p>
                    </div>

                    {error && <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</div>}

                    <form className="login-form" onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="you@company.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="form-options">
                            <label className="checkbox-container">
                                <input type="checkbox" />
                                <span className="checkmark"></span>
                                Remember me
                            </label>
                            <a href="#" className="forgot-password">Forgot password?</a>
                        </div>

                        <button type="submit" className="btn btn-login" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <p className="login-footer">
                        Don't have an account? <a href="#">Sign up</a>
                    </p>
                </div>
            </div>

            {/* Right Panel - Hero Video */}
            <div className="login-right">
                <div className="fade-edge"></div>
                <div className="video-overlay"></div>
                <video
                    className="hero-video"
                    autoPlay
                    loop
                    muted
                    playsInline
                >
                    <source src="/assets/HERO.mp4" type="video/mp4" />
                </video>
            </div>
        </div>
    );
};

export default Login;
