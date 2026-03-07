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
    const [results, setResults] = useState([])
    const [previews, setPreviews] = useState([])
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

    const onDropRejected = useCallback((rejectedFiles) => {
        const hasTooMany = rejectedFiles.some(f =>
            f.errors?.some(e => e.code === 'too-many-files')
        )
        if (hasTooMany) {
            toast.error('You can only upload up to 3 photos at a time. Please try again with 3 or fewer files.', { duration: 4000 })
        }
    }, [])

    const onDrop = useCallback(
        async (acceptedFiles) => {
            if (!acceptedFiles || acceptedFiles.length === 0) return

            // Warn and cap if more than 3 somehow pass through
            if (acceptedFiles.length > 3) {
                toast.error('Only the first 3 photos will be uploaded. Please select up to 3 at a time.')
            }
            const filesToUpload = acceptedFiles.slice(0, 3)

            // File validation check
            const maxSize = 10 * 1024 * 1024 // 10MB
            const validFiles = []
            for (const file of filesToUpload) {
                if (file.size > maxSize) {
                    toast.error(`File ${file.name} is too large. Maximum size is 10MB.`)
                    continue
                }
                if (!file.type.startsWith('image/')) {
                    toast.error(`File ${file.name} is not an image (PNG, JPG, WEBP)`)
                    continue
                }
                validFiles.push(file)
            }

            if (validFiles.length === 0) return

            // Generate Previews
            const newPreviews = await Promise.all(validFiles.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onload = (e) => resolve(e.target.result)
                    reader.readAsDataURL(file)
                })
            }))

            setPreviews(newPreviews)
            setUploading(true)
            setResults([])
            setProgress(10)

            const totalFiles = validFiles.length
            const newResults = []

            for (let i = 0; i < totalFiles; i++) {
                const file = validFiles[i]
                const baseProgress = 10 + (i * (90 / totalFiles))
                const fileProgressShare = 90 / totalFiles
                
                const formData = new FormData()
                formData.append('screenshot', file)

                try {
                    setProgress(baseProgress + (fileProgressShare * 0.2))
                    const res = await axios.post('/api/screenshots/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        onUploadProgress: (e) => {
                            const pct = (e.loaded / e.total)
                            setProgress(baseProgress + (fileProgressShare * (0.2 + (pct * 0.8))))
                        },
                    })
                    newResults.push(res.data.screenshot)
                    onSuccess?.(res.data)
                } catch (err) {
                    if (err.response?.status === 402) {
                        setUpgradeTrigger('limit_reached')
                        setShowUpgradeModal(true)
                        break
                    } else if (err.response?.status === 403) {
                        setUpgradeTrigger('pro_feature')
                        setShowUpgradeModal(true)
                        break
                    } else {
                        toast.error(err.response?.data?.message || `Upload failed for ${file.name}`)
                    }
                }
            }

            setProgress(100)
            setResults(newResults)
            setUploading(false)
            setTimeout(() => setProgress(0), 1000)
        },
        [onSuccess]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: true,
        maxFiles: 3,
        disabled: uploading || limitReached,
    })

    const reset = () => {
        setResults([])
        setPreviews([])
        setProgress(0)
    }

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
                {results.length === 0 ? (
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
                                {previews.length > 0 && !uploading && (
                                    <div className="previews-container" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        {previews.map((prev, i) => (
                                            <img key={i} src={prev} alt={`preview-${i}`} className="drop-preview" style={{ height: '80px', width: 'auto', borderRadius: '8px' }} />
                                        ))}
                                    </div>
                                )}
                                {previews.length === 0 && (
                                    <>
                                        <div className="drop-icon">
                                            {isDragActive ? '⬇️' : '📤'}
                                        </div>
                                        <p className="drop-title">
                                            {isDragActive ? 'Drop them!' : 'Drop up to 3 screenshots here'}
                                        </p>
                                        <p className="drop-sub">or click to browse · PNG, JPG, WEBP up to 10MB each</p>
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
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="results-wrapper"
                    >
                        <div className="results-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {results.map((res, i) => {
                                const meta = CATEGORY_META[res.category] || CATEGORY_META['Other']
                                return (
                                    <div key={res._id || i} className="result-card" style={{ '--cat-color': meta.color, margin: 0 }}>
                                        <div className="result-header">
                                            <div className="result-category-badge" style={{ background: meta.color + '22', border: `1px solid ${meta.color}66`, color: meta.color }}>
                                                {meta.icon} {res.category}
                                            </div>
                                            <div className="result-confidence">
                                                {Math.round((res.metadata?.confidence || 0) * 100)}% confident
                                            </div>
                                        </div>
                                        <p className="result-summary">{res.metadata?.summary}</p>
                                        <div className="result-actions">
                                            {res.driveViewLink && (
                                                <a href={res.driveViewLink} target="_blank" rel="noreferrer" className="result-action-btn drive">
                                                    📁 View in Drive
                                                </a>
                                            )}
                                            {res.calendarEventLink && (
                                                <a href={res.calendarEventLink} target="_blank" rel="noreferrer" className="result-action-btn calendar">
                                                    📅 Calendar Event Created
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <button className="btn-upload-another" onClick={reset} style={{ marginTop: '1.5rem', width: '100%' }}>
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
