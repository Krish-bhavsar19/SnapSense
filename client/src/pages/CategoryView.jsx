import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'

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
    'Other': { icon: '🗂️', color: '#6b7280' },
}

export default function CategoryView() {
    const { categoryName } = useParams()
    const category = decodeURIComponent(categoryName)
    const meta = CATEGORY_META[category] || CATEGORY_META['Other']
    const [screenshots, setScreenshots] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await axios.get(`/api/screenshots/category/${encodeURIComponent(category)}`)
                setScreenshots(res.data.data || [])
            } catch {
                toast.error('Failed to load screenshots')
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [category])

    const handleDelete = async (id) => {
        if (!confirm('Delete this screenshot?')) return
        try {
            await axios.delete(`/api/screenshots/${id}`)
            setScreenshots((prev) => prev.filter((s) => s._id !== id))
            toast.success('Deleted')
        } catch {
            toast.error('Failed to delete')
        }
    }

    return (
        <div className="category-view">
            <div className="category-view-header">
                <Link to="/dashboard" className="back-link">← Back</Link>
                <div className="category-view-title">
                    <span className="category-big-icon">{meta.icon}</span>
                    <div>
                        <h1 style={{ color: meta.color }}>{category}</h1>
                        <p>{screenshots.length} screenshots</p>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="loading-screen">
                    <div className="loading-spinner" />
                </div>
            )}

            {!loading && screenshots.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">{meta.icon}</div>
                    <h3>No {category} screenshots yet</h3>
                    <p>Upload a screenshot and it'll appear here when classified as {category}.</p>
                    <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
                </div>
            )}

            <div className="gallery-grid">
                <AnimatePresence>
                    {screenshots.map((sc, i) => (
                        <motion.div
                            key={sc._id}
                            className="gallery-card"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: i * 0.04 }}
                            layout
                        >
                            <div className="gallery-card-img">
                                {sc.driveThumbnailLink ? (
                                    <img src={sc.driveThumbnailLink} alt={sc.originalName} />
                                ) : (
                                    <div className="gallery-placeholder">{meta.icon}</div>
                                )}
                                <button
                                    className="gallery-delete-btn"
                                    onClick={() => handleDelete(sc._id)}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                            <div className="gallery-card-body">
                                <p className="gallery-summary">{sc.metadata?.summary}</p>
                                <div className="gallery-meta">
                                    {sc.metadata?.date && (
                                        <span className="gallery-date">
                                            📅 {new Date(sc.metadata.date).toLocaleDateString()}
                                        </span>
                                    )}
                                    <span className="gallery-confidence">
                                        {Math.round((sc.metadata?.confidence || 0) * 100)}% confident
                                    </span>
                                </div>
                                <div className="gallery-links">
                                    {sc.driveViewLink && (
                                        <a href={sc.driveViewLink} target="_blank" rel="noreferrer" className="action-link">
                                            📁 View in Drive
                                        </a>
                                    )}
                                    {sc.calendarEventLink && (
                                        <a href={sc.calendarEventLink} target="_blank" rel="noreferrer" className="action-link calendar">
                                            📅 Calendar Event
                                        </a>
                                    )}
                                </div>
                                <p className="gallery-time">
                                    {new Date(sc.createdAt).toLocaleString()}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
