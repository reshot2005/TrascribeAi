import React, { useState } from 'react';
import './FAQ.css';

const faqs = [
    { q: 'How does TeamVoice support enterprise-level voice management?', a: 'TeamVoice offers advanced administrative controls, SSO, and unlimited storage for enterprise clients to manage teams securely at scale.' },
    { q: 'Can I integrate voice notes with my CRM or Slack?', a: 'Yes, TeamVoice integrates seamlessly with popular tools like Salesforce, HubSpot, Slack, and Microsoft Teams to push automated insights immediately.' },
    { q: 'Is it secure to record team voice sessions with TeamVoice?', a: 'Absolutely. We use enterprise-grade end-to-end encryption, regular penetration testing, and are fully SOC2 Type II compliant.' },
    { q: 'Can AI transcribe and summarize customer calls?', a: 'Yes! Our custom-trained AI models identify distinct action items, sentiment, and key decisions specifically tailored for customer and sales calls.' },
    { q: 'How does TeamVoice automatically record voice intelligence?', a: 'TeamVoice simply joins your calendar events as a silent participant, or locally captures your microphone/system audio, transcribing in real-time.' },
    { q: 'What is a team voice intelligence tool?', a: 'A voice intelligence tool captures team audio and uses Deep Learning to provide intelligent summaries and action items.' },
    { q: 'Does TeamVoice support multiple languages for transcription?', a: 'Yes, we natively support over 50 languages with automatic language detection mixed into transcripts.' },
    { q: 'Are there any TeamVoice discounts or promo codes?', a: 'We offer specialized scalable pricing for non-profits, startups, and educational institutions upon request.' }
];

const FAQ = () => {
    const [openIndex, setOpenIndex] = useState(null);

    const toggleFAQ = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="faq-section reveal active">
            <div className="faq-container">
                <div className="faq-header">
                    <h2>FAQs</h2>
                    <p>You have questions? We have answers!</p>
                </div>
                <div className="faq-grid">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className={`faq-card ${openIndex === index ? 'open' : ''}`}
                            onClick={() => toggleFAQ(index)}
                        >
                            <div className="faq-question">
                                <h4>{faq.q}</h4>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron">
                                    <path d="M6 9l6 6 6-6"></path>
                                </svg>
                            </div>
                            <div className="faq-answer">
                                <p>{faq.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQ;
