import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import UpgradeModal from './UpgradeModal'

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

export default function UploadZone({ onSuccess, screenshotCount = 0, limit = 10, tier = 'free' }) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [result, setResult] = useState(null)
    const [preview, setPreview] = useState(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeTrigger, setUpgradeTrigger] = useState('manual')

    const isFreeTier = tier === 'free'
    const limitReached = isFreeTier && screenshotCount >= limit

    // Usage badge color logic
    const getUsageBadgeClass = () => {
        if (tier === 'pro') return 'usage-badge pro'
        if (screenshotCount >= 10) return 'usage-badge danger'
        if (screenshotCount >= 7) return 'usage-badge warning'
        return 'usage-badge success'
    }

    const onDrop = useCallback(
        async (acceptedFiles) => {
            const file = acceptedFiles[0]
            if (!file) return

            // File size check (max 10MB)
            const maxSize = 10 * 1024 * 1024 // 10MB
            if (file.size > maxSize) {
                toast.error('File too large. Maximum size is 10MB.')
                return
            }

            // File type check
            if (!file.type.startsWith('image/')) {
                toast.error('Only image files are allowed (PNG, JPG, WEBP)')
                return
            }

            // Preview
            const reader = new FileReader()
            reader.onload = (e) => setPreview(e.target.result)
            reader.readAsDataURL(file)

            setUploading(true)
            setResult(null)
            setProgress(10)

            const formData = new FormData()
            formData.append('screenshot', file)

            try {
                setProgress(30)
                const res = await axios.post('/api/screenshots/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (e) => {
                        const pct = Math.round((e.loaded * 50) / e.total)
                        setProgress(30 + pct)
                    },
                })
                setProgress(100)
                setResult(res.data.screenshot)
                onSuccess?.(res.data)
            } catch (err) {
                // Handle 402 (limit reached) or 403 (pro feature)
                if (err.response?.status === 402) {
                    setUpgradeTrigger('limit_reached')
                    setShowUpgradeModal(true)
                } else if (err.response?.status === 403) {
                    setUpgradeTrigger('pro_feature')
                    setShowUpgradeModal(true)
                } else {
                    toast.error(err.response?.data?.message || 'Upload failed')
                }
                setPreview(null)
            } finally {
                setUploading(false)
                setTimeout(() => setProgress(0), 1000)
            }
        },
        [onSuccess]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: false,
        disabled: uploading || limitReached,
    })

    const reset = () => {
        setResult(null)
        setPreview(null)
        setProgress(0)
    }

    const catMeta = result ? CATEGORY_META[result.category] || CATEGORY_META['Other'] : null

    return (
        <div className="upload-section">
            {/* Usage Badge */}
            {isFreeTier && (
                <div className={getUsageBadgeClass()}>
                    {limitReached ? (
                        <span>❌ Limit Reached: {screenshotCount} / {limit} screenshots used</span>
                    ) : (
                        <span>📊 {screenshotCount} / {limit} screenshots used this month</span>
                    )}
                </div>
            )}
            {tier === 'pro' && (
                <div className="usage-badge pro">
                    ✨ PRO: Unlimited uploads
                </div>
            )}

            <AnimatePresence mode="wait">
                {!result ? (
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {limitReached ? (
                            // Paywall State
                            <div className="paywall-state">
                                <Sparkles size={64} className="paywall-icon" />
                                <h3>Monthly Limit Reached</h3>
                                <p>
                                    You've used all {limit} free screenshots this month.
                                    Upgrade to Pro for unlimited uploads!
                                </p>
                                <button
                                    className="upgrade-cta-btn"
                                    onClick={() => {
                                        setUpgradeTrigger('limit_reached')
                                        setShowUpgradeModal(true)
                                    }}
                                >
                                    <Sparkles size={20} />
                                    Upgrade to Pro — ₹399/mo
                                </button>
                            </div>
                        ) : (
                            // Normal Upload Zone
                            <div
                                {...getRootProps()}
                                className={`dropzone ${isDragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                                id="upload-dropzone"
                            >
                                <input {...getInputProps()} id="screenshot-file-input" />
                                {preview && !uploading && (
                                    <img src={preview} alt="preview" className="drop-preview" />
                                )}
                                {!preview && (
                                    <>
                                        <div className="drop-icon">
                                            {isDragActive ? '⬇️' : '📤'}
                                        </div>
                                        <p className="drop-title">
                                            {isDragActive ? 'Drop it!' : 'Drop a screenshot here'}
                                        </p>
                                        <p className="drop-sub">or click to browse · PNG, JPG, WEBP up to 10MB</p>
                                    </>
                                )}
                                {uploading && (
                                    <div className="upload-progress-wrap">
                                        <div className="upload-steps">
                                            <div className={`step ${progress >= 10 ? 'done' : ''}`}>📤 Uploading</div>
                                            <div className={`step ${progress >= 30 ? 'done' : ''}`}>🤖 AI Classifying</div>
                                            <div className={`step ${progress >= 70 ? 'done' : ''}`}>☁️ Saving to Drive</div>
                                            <div className={`step ${progress >= 90 ? 'done' : ''}`}>📊 Logging to Sheets</div>
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
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="result"
                        className="result-card"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ '--cat-color': catMeta.color }}
                    >
                        <div className="result-header">
                            <div className="result-category-badge" style={{ background: catMeta.color + '22', border: `1px solid ${catMeta.color}66`, color: catMeta.color }}>
                                {catMeta.icon} {result.category}
                            </div>
                            <div className="result-confidence">
                                {Math.round((result.metadata?.confidence || 0) * 100)}% confident
                            </div>
                        </div>
                        <p className="result-summary">{result.metadata?.summary}</p>

                        <div className="result-actions">
                            {result.driveViewLink && (
                                <a href={result.driveViewLink} target="_blank" rel="noreferrer" className="result-action-btn drive">
                                    📁 View in Drive
                                </a>
                            )}
                            {result.calendarEventLink && (
                                <a href={result.calendarEventLink} target="_blank" rel="noreferrer" className="result-action-btn calendar">
                                    📅 Calendar Event Created
                                </a>
                            )}
                        </div>

                        <button className="btn-upload-another" onClick={reset}>
                            + Upload Another
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upgrade Modal */}
            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                trigger={upgradeTrigger}
            />
        </div>
    )
}
