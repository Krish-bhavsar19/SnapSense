import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import ThemeToggle from '../components/ThemeToggle'

const FEATURES = [
    { icon: '📁', title: 'Drive Sync', desc: 'Auto-organized in Google Drive' },
    { icon: '📊', title: 'Sheets Log', desc: 'Payments & quotes logged' },
    { icon: '📅', title: 'Calendar', desc: 'Events added automatically' },
    { icon: '✅', title: 'Tasks', desc: 'Study notes become tasks' },
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
            {/* Top Nav */}
            <nav className="landing-nav">
                <div className="landing-nav-logo">
                    <span className="logo-icon">📸</span>
                    <span className="logo-text">SnapSense <span className="logo-ai">AI</span></span>
                </div>
                <div className="landing-nav-right">
                    <ThemeToggle />
                    <motion.button
                    className="btn-google-sm"
                    onClick={login}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign In
                </motion.button>
                </div>
            </nav>

            {/* Two Column Hero */}
            <section className="landing-hero">
                {/* LEFT — Upload Board */}
                <motion.div
                    className="landing-left"
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7 }}
                >
                    <div className="landing-upload-card">
                        <div className="upload-card-header">
                            Try it free — no sign-in needed
                        </div>

                        <AnimatePresence mode="wait">
                            {limitReached ? (
                                <motion.div
                                    key="limit"
                                    className="landing-limit-state"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <div className="limit-icon">🔒</div>
                                    <h3>Free limit reached</h3>
                                    <p>Sign in to unlock unlimited uploads</p>
                                    <motion.button className="btn-google" onClick={login} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Sign In — It's Free
                                    </motion.button>
                                </motion.div>
                            ) : !actionCard ? (
                                <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <div
                                        {...getRootProps()}
                                        className={`landing-dropzone ${isDragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                                        id="anon-upload-dropzone"
                                    >
                                        <input {...getInputProps()} id="anon-file-input" />

                                        {/* Image reveal loading — curtain slides top to bottom */}
                                        {uploading && preview && (
                                            <div className="image-reveal-loader">
                                                <img src={preview} alt="processing" className="reveal-image" />
                                                <motion.div
                                                    className="reveal-curtain"
                                                    initial={{ height: '100%' }}
                                                    animate={{ height: `${100 - progress}%` }}
                                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                                />
                                                <div className="reveal-status">
                                                    {progress < 50 ? 'Uploading...' : progress < 100 ? 'Analyzing...' : 'Done'}
                                                </div>
                                            </div>
                                        )}

                                        {!uploading && preview && !actionCard && (
                                            <img src={preview} alt="preview" className="drop-preview" />
                                        )}

                                        {!preview && !uploading && (
                                            <>
                                                <div className="drop-icon-wrap">
                                                    <span className="drop-icon-inner">{isDragActive ? '⬇️' : '📤'}</span>
                                                </div>
                                                <p className="drop-title">{isDragActive ? 'Drop it!' : 'Drop a screenshot'}</p>
                                                <p className="drop-sub">PNG, JPG, WEBP up to 20 MB</p>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="result"
                                    className="landing-result"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <div className="result-header">
                                        <div className="result-category-badge" style={{ background: catMeta.color + '22', border: `1px solid ${catMeta.color}66`, color: catMeta.color }}>
                                            {catMeta.icon} {actionCard.category}
                                        </div>
                                        <div className="result-confidence">
                                            {Math.round((actionCard.confidence || 0) * 100)}%
                                        </div>
                                    </div>
                                    <p className="result-summary">{actionCard.summary}</p>

                                    {actionCard.quoteAuthor && (
                                        <p className="result-extra">✍️ {actionCard.quoteAuthor}</p>
                                    )}
                                    {actionCard.transactionAmount && (
                                        <p className="result-extra">💰 {actionCard.transactionType}: {actionCard.transactionAmount}</p>
                                    )}
                                    {actionCard.mapLink && (
                                        <a href={actionCard.mapLink} target="_blank" rel="noreferrer" className="result-action-btn map">
                                            📍 Open in Maps
                                        </a>
                                    )}

                                    <div className="anon-save-cta">
                                        <p>🔒 Sign in to save to Drive, Sheets & Calendar</p>
                                        <motion.button className="btn-google" onClick={login} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            Sign In to Save
                                        </motion.button>
                                    </div>

                                    <button className="btn-upload-another" onClick={reset}>
                                        + Try Another
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* RIGHT — Info & Login */}
                <motion.div
                    className="landing-right"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.7, delay: 0.15 }}
                >
                    <h1 className="hero-title">
                        Your screenshots,<br />
                        <span className="accent-text">finally organized.</span>
                    </h1>
                    <p className="hero-subtitle">
                        Drop any screenshot. AI classifies it into 13 categories and syncs to Google Drive, Sheets, and Calendar.
                    </p>

                    {/* Feature pills */}
                    <div className="landing-features">
                        {FEATURES.map((f, i) => (
                            <motion.div
                                key={f.title}
                                className="landing-feature-pill"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.08 }}
                            >
                                <span className="feature-pill-icon">{f.icon}</span>
                                <div>
                                    <span className="feature-pill-title">{f.title}</span>
                                    <span className="feature-pill-desc">{f.desc}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Category tags */}
                    <div className="landing-categories-wrap">
                        <p className="landing-cat-label">13 Smart Categories</p>
                        <div className="landing-cat-tags">
                            {CATEGORIES.map((cat, i) => (
                                <motion.span
                                    key={cat.name}
                                    className="cat-tag"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.7 + i * 0.04 }}
                                >
                                    {cat.icon} {cat.name}
                                </motion.span>
                            ))}
                        </div>
                    </div>

                    {/* Google Sign-in */}
                    <motion.button
                        className="btn-google landing-cta"
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
                        Get Started with Google
                    </motion.button>
                </motion.div>
            </section>

            <footer className="footer">
                <p>© 2026 SnapSense AI</p>
            </footer>
        </div>
    )
}
