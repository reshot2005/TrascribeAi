import React, { useEffect } from 'react';
import TrueFocus from '../components/TrueFocus';
import Shuffle from '../components/Shuffle';
import FAQ from '../components/FAQ';
import FloatingLines from '../components/FloatingLines';

function Home() {
    useEffect(() => {
        // Scroll Reveal Animation (Observer)
        const fadeElements = document.querySelectorAll('.reveal');
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15
        };

        const sceneObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        fadeElements.forEach(el => sceneObserver.observe(el));

        // Navbar scroll effect 
        const navbar = document.querySelector('.navbar');
        const handleScroll = () => {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
                navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.85)';
                navbar.style.boxShadow = 'none';
            }
        };
        window.addEventListener('scroll', handleScroll);

        // Simple interaction for Dashboard UI mock
        const bars = document.querySelectorAll('.audio-waveform .bar');
        const interval = setInterval(() => {
            bars.forEach(bar => {
                const randomHeight = Math.floor(Math.random() * 80) + 10;
                bar.style.height = `${randomHeight}%`;
            });
        }, 1500);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearInterval(interval);
            fadeElements.forEach(el => sceneObserver.unobserve(el));
        };
    }, []);

    return (
        <>

            {/* Navigation */}
            <nav className="navbar">
                <div className="nav-container">
                    <a href="/" className="brand">
                        <div className="brand-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="white" />
                                <path d="M8 12H16" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                                <path d="M10 16L14 16" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                                <path d="M10 8L14 8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="12" cy="12" r="3" fill="#6366f1" />
                            </svg>
                        </div>
                        <span className="brand-text">TeamVoice AI</span>
                    </a>
                    <div className="nav-links">
                        <div className="nav-item dropdown cursor-target">
                            <a href="#" className="nav-link">Solutions <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9L12 15L18 9"></path></svg></a>
                        </div>
                        <div className="nav-item dropdown cursor-target">
                            <a href="#" className="nav-link">Product <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9L12 15L18 9"></path></svg></a>
                        </div>
                        <div className="nav-item dropdown cursor-target">
                            <a href="#" className="nav-link">Integrations <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9L12 15L18 9"></path></svg></a>
                        </div>
                        <a href="#" className="nav-link cursor-target">Pricing</a>
                        <div className="nav-item dropdown cursor-target">
                            <a href="#" className="nav-link">Resources <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9L12 15L18 9"></path></svg></a>
                        </div>
                    </div>
                    <div className="nav-actions">
                        <a href="#" className="nav-link d-none-mobile cursor-target">Request a demo</a>
                        <a href="/login" className="nav-link cursor-target" style={{ fontWeight: 600 }}>Log in</a>
                        <a href="#" className="btn btn-primary cursor-target">Sign up for free</a>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="hero">
                <div className="hero-container">
                    <div className="hero-content">
                        <div className="badge fade-in-up">Voice Intelligence Platform</div>
                        <h1 className="hero-title fade-in-up" style={{ animationDelay: '0.1s', marginTop: '1.5rem', marginBottom: '1.5rem', color: 'white' }}>
                            <TrueFocus
                                sentence="The Intelligent"
                                manualMode={false}
                                blurAmount={4}
                                borderColor="#FFB800"
                                glowColor="rgba(255, 184, 0, 0.4)"
                                animationDuration={0.4}
                                pauseBetweenAnimations={1.5}
                            />
                            <br />
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Shuffle
                                    className="shuffle-gradient"
                                    text="Team Audio"
                                    shuffleDirection="up"
                                    duration={0.4}
                                    animationMode="evenodd"
                                    shuffleTimes={2}
                                    ease="power3.out"
                                    stagger={0.05}
                                    triggerOnHover={true}
                                />
                                <span className="text-gradient">Platform</span>
                            </div>
                        </h1>
                        <p className="hero-subtitle fade-in-up" style={{ animationDelay: '0.2s' }}>
                            Capture, analyze, and automatically surface key insights from team audio conversations, async voice notes, and live standups. More than just transcription.
                        </p>
                        <div className="hero-cta fade-in-up" style={{ animationDelay: '0.3s' }}>
                            <a href="#" className="btn btn-primary btn-large cursor-target" style={{ alignSelf: 'flex-start' }}>Get started for free</a>
                            <div className="hero-rating">
                                <div className="stars">★★★★★</div>
                                <span>Loved by 10,000+ teams</span>
                            </div>
                        </div>
                    </div>
                    <div className="hero-visual fade-in" style={{ animationDelay: '0.4s' }}>
                        <div className="hero-visual-card dashboard-card float-anim cursor-target">
                            <div className="dashboard-header">
                                <div className="dots"><span></span><span></span><span></span></div>
                                <div className="dash-title">Engineering Standup Insight</div>
                            </div>
                            <div className="dashboard-body">
                                <div className="audio-waveform">
                                    <div className="bar" style={{ height: '40%' }}></div>
                                    <div className="bar" style={{ height: '60%' }}></div>
                                    <div className="bar" style={{ height: '85%' }}></div>
                                    <div className="bar" style={{ height: '50%' }}></div>
                                    <div className="bar" style={{ height: '90%' }}></div>
                                    <div className="bar" style={{ height: '30%' }}></div>
                                    <div className="bar" style={{ height: '70%' }}></div>
                                    <div className="bar" style={{ height: '55%' }}></div>
                                </div>
                                <div className="insight-box highlight">
                                    <span className="tag">BLOCKER DETECTED</span>
                                    <p>"We are waiting on the API keys from the DevOps team..."</p>
                                </div>
                            </div>
                        </div>

                        <div className="hero-visual-card active-voice float-anim-delayed cursor-target">
                            <div className="avatar"></div>
                            <div className="voice-status">Analyzing tone & sentiment...</div>
                        </div>
                    </div>
                </div >
            </header >

            {/* Logo Cloud */}
            < section className="logo-cloud" >
                <p>Trusted by innovative teams worldwide</p>
                <div className="logos cursor-target">

                </div>
            </section >

            {/* Bento Grid Section */}
            < section className="features" >
                <div className="section-header">
                    <h2>Capture insights from every angle</h2>
                    <p>TeamVoice hooks into every team communication channel to ensure you never miss a vital detail.</p>
                </div>

                <div className="bento-grid">
                    {/* Card 1 */}
                    <div className="bento-card col-span-2 reveal cursor-target">
                        <div className="bento-content">
                            <div className="bento-header">
                                <h3>Team Voice Agent</h3>
                                <span className="pill">COPILOT</span>
                            </div>
                            <p>Your AI voice agent joins automatically, records, analyzes sentiment, and summarizes every voice interaction — no setup needed.</p>
                            <a href="#" className="bento-link">Automatic Audio Insights &rarr;</a>
                        </div>
                        <div className="bento-image-container gradient-bg-1">
                            <img src="/assets/voice_notes.png" alt="Voice Agent Dashboard" className="bento-img" />
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="bento-card col-span-1 reveal" style={{ transitionDelay: '0.1s' }}>
                        <div className="bento-content cursor-target">
                            <div className="bento-header">
                                <h3>Mobile Voice capture</h3>
                                <span className="pill outline">OFFLINE</span>
                            </div>
                            <p>Record asynchronous voice notes on the go and sync them with your team's knowledge base.</p>
                            <a href="#" className="bento-link">iOS & Android App &rarr;</a>
                        </div>
                        <div className="bento-image-container light-bg cursor-target">
                            <img src="/assets/mobile_voice.png" alt="Mobile App" className="bento-img tilt-anim" />
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="bento-card col-span-1 reveal cursor-target">
                        <div className="bento-content">
                            <div className="bento-header">
                                <h3>Browser Audio Extension</h3>
                                <span className="pill outline">NO BOT</span>
                            </div>
                            <p>Capture web-based huddles and external calls instantly, directly from your browser without an active bot.</p>
                            <a href="#" className="bento-link">Record with Chrome &rarr;</a>
                        </div>
                        <div className="bento-image-container light-bg-2">
                            <img src="/assets/browser_voice.png" alt="Browser Extension" className="bento-img slide-up-anim" />
                        </div>
                    </div>

                    {/* Card 4 */}
                    <div className="bento-card col-span-2 reveal cursor-target" style={{ transitionDelay: '0.1s' }}>
                        <div className="bento-content">
                            <div className="bento-header">
                                <h3>Desktop Agent Background</h3>
                                <span className="pill outline">NATIVE</span>
                            </div>
                            <p>Record native desktop app audio (Zoom, Teams, Slack) effortlessly with our low-footprint desktop client.</p>
                            <a href="#" className="bento-link">Record with Desktop App &rarr;</a>
                        </div>
                        <div className="bento-image-container gradient-bg-2">
                            <img src="/assets/desktop_voice.png" alt="Desktop App" className="bento-img scale-anim" />
                        </div>
                    </div>
                </div>
            </section >

            {/* Interactive CTA Section */}
            < section className="cta-section" >
                <div className="cta-container reveal cursor-target">
                    <FloatingLines
                        lineColor="#6366f1"
                        backgroundColor="#010208"
                    />
                    <div className="cta-content-wrapper">
                        <h2>Ready to transform your team's audio?</h2>
                        <p>Join thousands of teams using TeamVoice AI to unlock the hidden value in their conversations.</p>
                        <div className="cta-buttons">
                            <a href="#" className="btn btn-primary btn-large cta-pulse cursor-target">Start for free today</a>
                        </div>
                    </div>
                </div>
            </section >

            {/* FAQ Section */}
            <FAQ />

            {/* Footer */}
            < footer className="footer" >
                <div className="footer-grid">
                    <div className="footer-brand">
                        <a href="/" className="brand">
                            <div className="brand-icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="white" />
                                    <circle cx="12" cy="12" r="3" fill="#6366f1" />
                                </svg>
                            </div>
                            <span className="brand-text">TeamVoice AI</span>
                        </a>
                        <p>The smartest way to surface actionable insights from every team conversation.</p>
                    </div>
                    <div className="footer-links">
                        <h4>Product</h4>
                        <a href="#" className="cursor-target">Solutions</a>
                        <a href="#" className="cursor-target">Integrations</a>
                        <a href="#" className="cursor-target">Pricing</a>
                    </div>
                    <div className="footer-links">
                        <h4>Company</h4>
                        <a href="#" className="cursor-target">About</a>
                        <a href="#" className="cursor-target">Careers</a>
                        <a href="#" className="cursor-target">Contact</a>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2026 TeamVoice AI. All rights reserved.</p>
                </div>
            </footer >
        </>
    );
}

export default Home;
