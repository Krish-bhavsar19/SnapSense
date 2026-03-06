import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import UploadZone from '../components/UploadZone'
import { useAuth } from '../context/AuthContext'

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

export default function Dashboard() {
    const { user } = useAuth()
    const [stats, setStats] = useState({ total: 0, byCategory: [] })
    const [recent, setRecent] = useState([])
    const [loading, setLoading] = useState(true)
    const [billingStatus, setBillingStatus] = useState({
        tier: 'free',
        screenshotCount: 0,
        limit: 10,
    })
    const mergeInProgress = useRef(false)

    const fetchData = async () => {
        try {
            const [statsRes, screenshotsRes, billingRes] = await Promise.all([
                axios.get('/api/screenshots/stats'),
                axios.get('/api/screenshots?limit=6'),
                axios.get('/api/billing/status'),
            ])
            setStats(statsRes.data)
            setRecent(screenshotsRes.data.data || [])
            setBillingStatus({
                tier: billingRes.data.tier || 'free',
                screenshotCount: billingRes.data.screenshotCount || 0,
                limit: billingRes.data.limit || 10,
            })
        } catch (err) {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    // Auto-merge any pending anonymous session actions on login
    const mergeAnonymousSession = async () => {
        const sessionId = localStorage.getItem('snap_session_id')
        const pendingCards = JSON.parse(localStorage.getItem('snap_pending_cards') || '[]')
        
        if (!sessionId || pendingCards.length === 0) {
            localStorage.removeItem('snap_session_id')
            localStorage.removeItem('snap_pending_cards')
            return
        }

        if (mergeInProgress.current) return
        mergeInProgress.current = true

        try {
            const res = await axios.post('/auth/merge', { 
                sessionId,
                pendingCards // Sending the cards stored in localStorage as requested
            })
            
            if (res.data.success && res.data.merged > 0) {
                toast.success(
                    `🎉 Saved ${res.data.merged} screenshot${res.data.merged > 1 ? 's' : ''} from your preview session!`,
                    { duration: 6000 }
                )
                fetchData()
            }
        } catch (err) {
            console.error('Auto-merge failed (non-critical):', err.message)
        } finally {
            localStorage.removeItem('snap_session_id')
            localStorage.removeItem('snap_pending_cards')
        }
    }


    useEffect(() => {
        mergeAnonymousSession()
        fetchData()
        
        // Check if redirected from successful payment
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get('upgraded') === 'true') {
            toast.success('🎉 Payment successful! Checking your Pro status...', { duration: 3000 })
            // Clear the URL parameter
            window.history.replaceState({}, '', '/dashboard')
            // Refresh data to get updated tier
            setTimeout(() => {
                fetchData()
            }, 2000)
        }
    }, [])

    const handleUploadSuccess = (result) => {
        toast.success(`✅ ${result.message}`, { duration: 5000 })
        fetchData()
    }


    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        Hey, <span className="gradient-text">{user?.name?.split(' ')[0]}</span> 👋
                        {billingStatus.tier === 'pro' && (
                            <span className="pro-badge">✨ PRO</span>
                        )}
                    </h1>
                    <p className="dashboard-subtitle">
                        {stats.total} screenshots organized across {stats.byCategory.length} categories
                    </p>
                </div>
                <div className="dashboard-header-actions">
                    <div className="stat-chip">
                        <span>📸</span>
                        <span>{stats.total} Total</span>
                    </div>
                </div>
            </div>

            {/* Upload Zone */}
            <section className="section">
                <UploadZone 
                    onSuccess={handleUploadSuccess}
                    screenshotCount={billingStatus.screenshotCount}
                    limit={billingStatus.limit}
                    tier={billingStatus.tier}
                />
            </section>

            {/* Category Grid */}
            {stats.byCategory.length > 0 && (
                <section className="section">
                    <h2 className="section-heading">📂 Categories</h2>
                    <div className="category-grid">
                        {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                            const found = stats.byCategory.find((s) => s.category === cat)
                            const count = found?.count || 0
                            return (
                                <motion.div key={cat} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                                    <Link to={`/category/${encodeURIComponent(cat)}`} className="category-card" style={{ '--cat-color': meta.color }}>
                                        <div className="category-card-icon">{meta.icon}</div>
                                        <div className="category-card-name">{cat}</div>
                                        <div className="category-card-count" style={{ color: meta.color }}>
                                            {count}
                                        </div>
                                    </Link>
                                </motion.div>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* Recent Screenshots */}
            {recent.length > 0 && (
                <section className="section">
                    <h2 className="section-heading">🕐 Recent</h2>
                    <div className="recent-grid">
                        <AnimatePresence>
                            {recent.map((sc, i) => {
                                const meta = CATEGORY_META[sc.category] || CATEGORY_META['Other']
                                return (
                                    <motion.div
                                        key={sc._id}
                                        className="recent-card"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <div className="recent-card-thumb">
                                            {sc.driveThumbnailLink ? (
                                                <img src={sc.driveThumbnailLink} alt={sc.originalName} />
                                            ) : (
                                                <div className="recent-card-placeholder">{meta.icon}</div>
                                            )}
                                        </div>
                                        <div className="recent-card-info">
                                            <span
                                                className="recent-card-badge"
                                                style={{ background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}55` }}
                                            >
                                                {meta.icon} {sc.category}
                                            </span>
                                            <p className="recent-card-summary">{sc.metadata?.summary}</p>
                                            <div className="recent-card-actions">
                                                {sc.driveViewLink && (
                                                    <a href={sc.driveViewLink} target="_blank" rel="noreferrer" className="action-link">
                                                        📁 Drive
                                                    </a>
                                                )}
                                                {sc.calendarEventLink && (
                                                    <a href={sc.calendarEventLink} target="_blank" rel="noreferrer" className="action-link calendar">
                                                        📅 Calendar
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                </section>
            )}

            {/* Empty state */}
            {!loading && recent.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📸</div>
                    <h3>No screenshots yet</h3>
                    <p>Drop your first screenshot above to get started!</p>
                </div>
            )}
        </div>
    )
}
