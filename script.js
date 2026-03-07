document.addEventListener("DOMContentLoaded", function () {
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

    fadeElements.forEach(el => {
        sceneObserver.observe(el);
    });

    // Navbar scroll effect 
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.85)';
            navbar.style.boxShadow = 'none';
        }
    });

    // Simple interaction for Dashboard UI mock
    const bars = document.querySelectorAll('.audio-waveform .bar');
    setInterval(() => {
        bars.forEach(bar => {
            const randomHeight = Math.floor(Math.random() * 80) + 10;
            bar.style.height = `${randomHeight}%`;
        });
    }, 1500);
});
