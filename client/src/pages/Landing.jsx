import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'

const FEATURES = [
    {
        icon: '🤖',
        title: 'AI Classification',
        desc: 'Powered by Groq Vision — classifies into 14 smart categories instantly',
    },
    {
        icon: '☁️',
        title: 'Google Drive Sync',
        desc: 'Every screenshot auto-organized in your Drive by category',
    },
    {
        icon: '📊',
        title: 'Sheets Logging',
        desc: 'Quotes, Payments & Locations logged into dedicated Sheets tabs',
    },
    {
        icon: '📅',
        title: 'Calendar & Tasks',
        desc: 'Tickets added to Calendar. Study notes become Google Tasks.',
    },
]

const CATEGORIES = [
    { icon: '🎫', name: 'Ticket' },
    { icon: '🖼️', name: 'Wallpaper' },
    { icon: '💼', name: 'LinkedIn' },
    { icon: '📱', name: 'Social Media' },
    { icon: '💳', name: 'Payment' },
    { icon: '🔒', name: 'Sensitive Doc' },
    { icon: '👤', name: 'Contact' },
    { icon: '📧', name: 'Mail' },
    { icon: '💬', name: 'WhatsApp Chat' },
    { icon: '📝', name: 'Quote' },
    { icon: '📚', name: 'Study Notes' },
    { icon: '📍', name: 'Location' },
    { icon: '🗂️', name: 'Other' },
]

const CATEGORY_META = {
    'Ticket': { icon: '🎫', color: '#f59e0b' },
    'Wallpaper': { icon: '🖼️', color: '#3b82f6' },
    'LinkedIn Profile': { icon: '💼', color: '#0077b5' },
    'LinkedIn Post': { icon: '📄', color: '#0077b5' },
    'Social Media Post': { icon: '📱', color: '#e1306c' },
    'Payment': { icon: '💳', color: '#10b981' },
    'Sensitive Document': { icon: '🔒', color: '#ef4444' },
    'Contact': { icon: '👤', color: '#8b5cf6' },
    'Mail': { icon: '📧', color: '#f97316' },
    'Quote': { icon: '💬', color: '#ec4899' },
    'WhatsApp Chat': { icon: '📲', color: '#25d366' },
    'Study Notes': { icon: '📚', color: '#06b6d4' },
    'Location': { icon: '📍', color: '#f43f5e' },
    'Other': { icon: '🗂️', color: '#6b7280' },
}

// Get or create a persistent anonymous session ID
function getSessionId() {
    let id = localStorage.getItem('snap_session_id')
    if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem('snap_session_id', id)
    }
    return id
}

export default function Landing() {
    const { login } = useAuth()
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [actionCard, setActionCard] = useState(null)
    const [preview, setPreview] = useState(null)
    const [limitReached, setLimitReached] = useState(false)

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target.result)
        reader.readAsDataURL(file)

        setUploading(true)
        setActionCard(null)
        setProgress(20)

        const formData = new FormData()
        formData.append('screenshot', file)

        try {
            setProgress(50)
            const res = await axios.post('/api/screenshots/upload/anonymous', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'x-session-id': getSessionId(),
                },
            })
            setProgress(100)
            const card = res.data.actionCard
            setActionCard(card)

            // Persist to localStorage so it survives OAuth redirect for later merge
            const existing = JSON.parse(localStorage.getItem('snap_pending_cards') || '[]')
            existing.push(card)
            localStorage.setItem('snap_pending_cards', JSON.stringify(existing))

            toast.success('AI classified your screenshot!')

        } catch (err) {
            if (err.response?.status === 409) {
                toast.error(err.response?.data?.message || 'Screenshot already uploaded in this session.')
            } else if (err.response?.data?.limitReached) {
                setLimitReached(true)
            } else {
                toast.error(err.response?.data?.message || 'Upload failed')
            }
            setPreview(null)
        } finally {
            setUploading(false)
            setTimeout(() => setProgress(0), 800)
        }
    }, [])


    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
        maxSize: 20 * 1024 * 1024,
        multiple: false,
        disabled: uploading,
    })

    const reset = () => {
        setActionCard(null)
        setPreview(null)
        setProgress(0)
        setLimitReached(false)
    }

    const catMeta = actionCard ? CATEGORY_META[actionCard.category] || CATEGORY_META['Other'] : null

    return (
        <div className="landing">
            {/* Hero */}
            <section className="hero">
                <div className="hero-bg">
                    <div className="hero-orb hero-orb-1" />
                    <div className="hero-orb hero-orb-2" />
                    <div className="hero-orb hero-orb-3" />
                </div>
                <motion.div
                    className="hero-content"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                >
                    <div className="hero-badge">
                        <span>✨ AI-Powered</span>
                    </div>
                    <h1 className="hero-title">
                        Your Screenshots,
                        <br />
                        <span className="gradient-text">Finally Organized</span>
                    </h1>
                    <p className="hero-subtitle">
                        Drop a screenshot below. Our AI classifies it instantly — no login needed to try it!
                    </p>
                    <motion.button
                        className="btn-google"
                        onClick={login}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign In with Google to Save
                    </motion.button>
                    <p className="hero-disclaimer">
                        🔒 We request Drive, Sheets & Calendar access to organize your screenshots
                    </p>
                </motion.div>

                {/* Floating category pills */}
                <motion.div
                    className="category-pills"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                >
                    {CATEGORIES.map((cat, i) => (
                        <motion.div
                            key={cat.name}
                            className="category-pill"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 + i * 0.05 }}
                        >
                            <span>{cat.icon}</span>
                            <span>{cat.name}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ── Try It Now — Anonymous Upload ── */}
            <section className="try-section">
                <motion.div
                    className="try-container"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="section-title" style={{ marginBottom: '0.5rem' }}>Try it now — no login needed</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', textAlign: 'center' }}>
                        Drop any screenshot and see the AI Action Card. Sign in after to save it to your Google account.
                    </p>

                    <AnimatePresence mode="wait">
                        {limitReached ? (
                            <motion.div
                                key="limit"
                                className="result-card"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ '--cat-color': '#8b5cf6', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}
                            >
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
                                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
                                    Free Preview Limit Reached
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '20px' }}>
                                    You've used all 3 free preview uploads. Sign in with Google to unlock unlimited uploads, Drive sync, Sheets logging, and more!
                                </p>
                                <motion.button
                                    className="btn-google"
                                    onClick={login}
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.97 }}
                                    style={{ margin: '0 auto', display: 'flex', justifyContent: 'center' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Sign In with Google — It's Free
                                </motion.button>
                            </motion.div>
                        ) : !actionCard ? (
                            <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <div
                                    {...getRootProps()}
                                    className={`dropzone ${isDragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                                    id="anon-upload-dropzone"
                                    style={{ maxWidth: 560, margin: '0 auto' }}
                                >
                                    <input {...getInputProps()} id="anon-file-input" />
                                    {preview && !uploading && <img src={preview} alt="preview" className="drop-preview" />}
                                    {!preview && (
                                        <>
                                            <div className="drop-icon">{isDragActive ? '⬇️' : '📤'}</div>
                                            <p className="drop-title">{isDragActive ? 'Drop it!' : 'Drop a screenshot here'}</p>
                                            <p className="drop-sub">or click to browse · PNG, JPG, WEBP up to 20MB</p>
                                        </>
                                    )}
                                    {uploading && (
                                        <div className="upload-progress-wrap">
                                            <div className="upload-steps">
                                                <div className={`step ${progress >= 20 ? 'done' : ''}`}>📤 Uploading</div>
                                                <div className={`step ${progress >= 50 ? 'done' : ''}`}>🤖 AI Classifying</div>
                                                <div className={`step ${progress >= 100 ? 'done' : ''}`}>✅ Done</div>
                                            </div>
                                            <div className="progress-bar">
                                                <motion.div
                                                    className="progress-fill"
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 0.4 }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="result"
                                className="result-card"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ '--cat-color': catMeta.color, maxWidth: 560, margin: '0 auto' }}
                            >
                                <div className="result-header">
                                    <div className="result-category-badge" style={{ background: catMeta.color + '22', border: `1px solid ${catMeta.color}66`, color: catMeta.color }}>
                                        {catMeta.icon} {actionCard.category}
                                    </div>
                                    <div className="result-confidence">
                                        {Math.round((actionCard.confidence || 0) * 100)}% confident
                                    </div>
                                </div>
                                <p className="result-summary">{actionCard.summary}</p>

                                {/* Extra info based on category */}
                                {actionCard.quoteAuthor && (
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                        ✍️ Author: <strong>{actionCard.quoteAuthor}</strong>
                                    </p>
                                )}
                                {actionCard.transactionAmount && (
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                        💰 {actionCard.transactionType}: <strong>{actionCard.transactionAmount}</strong>
                                    </p>
                                )}
                                {actionCard.mapLink && (
                                    <a href={actionCard.mapLink} target="_blank" rel="noreferrer" className="result-action-btn" style={{ background: '#f43f5e22', borderColor: '#f43f5e66', color: '#f43f5e', marginTop: '0.75rem', display: 'inline-block' }}>
                                        📍 Open in Google Maps
                                    </a>
                                )}

                                {/* Login CTA to save */}
                                <div className="anon-save-cta">
                                    <p>🔒 Sign in to save this to your Google Drive, Sheets & Calendar</p>
                                    <motion.button
                                        className="btn-google"
                                        onClick={login}
                                        whileHover={{ scale: 1.04 }}
                                        whileTap={{ scale: 0.97 }}
                                        style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Sign In with Google to Save
                                    </motion.button>
                                </div>

                                <button className="btn-upload-another" onClick={reset} style={{ marginTop: '1rem' }}>
                                    + Try Another Screenshot
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </section>

            {/* Features */}
            <section className="features-section">
                <motion.h2
                    className="section-title"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                >
                    Everything automated
                </motion.h2>
                <div className="features-grid">
                    {FEATURES.map((feat, i) => (
                        <motion.div
                            key={feat.title}
                            className="feature-card"
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -6, borderColor: 'rgba(139,92,246,0.6)' }}
                        >
                            <div className="feature-icon">{feat.icon}</div>
                            <h3>{feat.title}</h3>
                            <p>{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section">
                <motion.div
                    className="cta-card"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                >
                    <h2>Ready to tame your screenshots?</h2>
                    <p>Sign in once. Screenshots organized forever.</p>
                    <motion.button
                        className="btn-google"
                        onClick={login}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Get Started — It's Free
                    </motion.button>
                </motion.div>
            </section>

            <footer className="footer">
                <p>© 2026 SnapSense AI · Built with 💜 for the Hackathon</p>
            </footer>
        </div>
    )
}
