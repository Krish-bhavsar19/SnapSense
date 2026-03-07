import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import UploadZone from '../components/UploadZone'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import SubscriptionBanner from '../components/SubscriptionBanner'

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
    const { user, fetchUser } = useAuth()
    const [stats, setStats] = useState({ total: 0, byCategory: [] })
    const [recent, setRecent] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAllCategories, setShowAllCategories] = useState(false)
    const [billingStatus, setBillingStatus] = useState({
        tier: 'free',
        screenshotCount: 0,
        limit: 10,
    })

    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeTrigger, setUpgradeTrigger] = useState('manual')

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
                pendingCards
            })

            if (res.data.success && res.data.merged > 0) {
                toast.success(
                    `🎉 Saved ${res.data.merged} screenshot${res.data.merged > 1 ? 's' : ''} from your preview session!`,
                    { duration: 6000 }
                )
                localStorage.removeItem('snap_session_id')
                localStorage.removeItem('snap_pending_cards')
                fetchData()
            }
        } catch (err) {
            if (err.response?.status === 402) {
                setUpgradeTrigger('limit_reached')
                setShowUpgradeModal(true)
                toast.error(err.response?.data?.message || 'Free tier limit reached for merging', { duration: 5000 })
            } else {
                console.error('Auto-merge failed (non-critical):', err.message)
                localStorage.removeItem('snap_session_id')
                localStorage.removeItem('snap_pending_cards')
            }
        } finally {
            mergeInProgress.current = false
        }
    }

    useEffect(() => {
        mergeAnonymousSession()
        fetchData()

        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get('upgraded') === 'true') {
            toast.success('🎉 Payment successful! Setting up your Pro account...', { duration: 3000 })
            window.history.replaceState({}, '', '/dashboard')

            axios.post('/api/billing/verify-upgrade')
                .then(() => {
                    toast.success('Welcome to Pro! Enjoy unlimited uploads! ✨')
                    fetchUser()
                    fetchData()
                })
                .catch(() => {
                    fetchData()
                })
        }
    }, [])

    const handleUploadSuccess = (result) => {
        toast.success(`✅ ${result.message}`, { duration: 5000 })
        fetchData()
    }

    // Get top 5 categories that have screenshots, sorted by count
    const categoriesWithData = stats.byCategory
        .map(s => ({
            ...s,
            meta: CATEGORY_META[s.category] || CATEGORY_META['Other']
        }))
        .sort((a, b) => b.count - a.count)

    const topCategories = categoriesWithData.slice(0, 5)
    const restCategories = categoriesWithData.slice(5)

    // All categories (including those with 0 screenshots) for "show more"
    const allCategories = Object.entries(CATEGORY_META).map(([cat, meta]) => {
        const found = stats.byCategory.find((s) => s.category === cat)
        return { category: cat, count: found?.count || 0, meta }
    }).sort((a, b) => b.count - a.count)

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        Hey, <span className="accent-text">{user?.name?.split(' ')[0]}</span>
                        {billingStatus.tier === 'pro' && (
                            <span className="pro-badge">PRO</span>
                        )}
                    </h1>
                    <p className="dashboard-subtitle">
                        {stats.total} screenshots · {stats.byCategory.length} categories
                    </p>
                </div>
                <div className="dashboard-header-actions">
                    <div className="stat-chip">
                        <span>{stats.total}</span>
                    </div>
                    {billingStatus.tier === 'free' && (
                        <motion.button
                            className="upgrade-header-btn"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                                setUpgradeTrigger('manual')
                                setShowUpgradeModal(true)
                            }}
                        >
                            Upgrade
                        </motion.button>
                    )}
                </div>
            </div>

            <SubscriptionBanner />

            {/* Upload Zone */}
            <section className="section">
                <UploadZone
                    onSuccess={handleUploadSuccess}
                    screenshotCount={billingStatus.screenshotCount}
                    limit={billingStatus.limit}
                    tier={billingStatus.tier}
                />
            </section>

            {/* Top 5 Categories with screenshots */}
            {topCategories.length > 0 && (
                <section className="section">
                    <h2 className="section-heading">Top Categories</h2>
                    <div className="top-categories">
                        {topCategories.map((catData, i) => (
                            <motion.div
                                key={catData.category}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                            >
                                <Link
                                    to={`/category/${encodeURIComponent(catData.category)}`}
                                    className="top-cat-card"
                                    style={{ '--cat-color': catData.meta.color }}
                                >
                                    <div className="top-cat-icon">{catData.meta.icon}</div>
                                    <div className="top-cat-info">
                                        <span className="top-cat-name">{catData.category}</span>
                                        <span className="top-cat-count" style={{ color: catData.meta.color }}>
                                            {catData.count} screenshot{catData.count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="top-cat-arrow">→</div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* Show More */}
                    {(restCategories.length > 0 || allCategories.length > 5) && (
                        <>
                            <motion.button
                                className="show-more-btn"
                                onClick={() => setShowAllCategories(!showAllCategories)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {showAllCategories ? 'Show Less' : `Show All ${allCategories.length} Categories`}
                            </motion.button>

                            <AnimatePresence>
                                {showAllCategories && (
                                    <motion.div
                                        className="all-categories-grid"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {allCategories.slice(5).map((catData) => (
                                            <Link
                                                key={catData.category}
                                                to={`/category/${encodeURIComponent(catData.category)}`}
                                                className="mini-cat-card"
                                                style={{ '--cat-color': catData.meta.color }}
                                            >
                                                <span className="mini-cat-icon">{catData.meta.icon}</span>
                                                <span className="mini-cat-name">{catData.category}</span>
                                                <span className="mini-cat-count" style={{ color: catData.meta.color }}>{catData.count}</span>
                                            </Link>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </section>
            )}

            {/* Recent Screenshots */}
            {recent.length > 0 && (
                <section className="section">
                    <h2 className="section-heading">Recent</h2>
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
                                                {sc.metadata?.mapLink && (
                                                    <a href={sc.metadata.mapLink} target="_blank" rel="noreferrer" className="action-link map">
                                                        📍 Map
                                                    </a>
                                                )}
                                                {sc.sheetsRowNumber && user?.sheetsId && (
                                                    <a href={`https://docs.google.com/spreadsheets/d/${user.sheetsId}`} target="_blank" rel="noreferrer" className="action-link sheet">
                                                        📊 Sheets
                                                    </a>
                                                )}
                                                {sc.taskLink && (
                                                    <a href={sc.taskLink} target="_blank" rel="noreferrer" className="action-link task">
                                                        ✅ Task
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

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                trigger={upgradeTrigger}
            />
        </div>
    )
}
