import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import UpgradeModal from './UpgradeModal'
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
    'Other': { icon: '🗂️', color: '#6b7280' },
}

export default function UploadZone({ onSuccess, screenshotCount = 0, limit = 10, tier = 'free' }) {
    const { user } = useAuth()
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [results, setResults] = useState([])
    const [previews, setPreviews] = useState([])
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeTrigger, setUpgradeTrigger] = useState('manual')

    const isFreeTier = tier === 'free'
    const limitReached = isFreeTier && screenshotCount >= limit

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
            toast.error('You can only upload up to 3 photos at a time.', { duration: 4000 })
        }
    }, [])

    const onDrop = useCallback(
        async (acceptedFiles) => {
            if (!acceptedFiles || acceptedFiles.length === 0) return

            if (acceptedFiles.length > 3) {
                toast.error('Only the first 3 photos will be uploaded.')
            }
            const filesToUpload = acceptedFiles.slice(0, 3)

            const maxSize = 10 * 1024 * 1024
            const validFiles = []
            for (const file of filesToUpload) {
                if (file.size > maxSize) {
                    toast.error(`${file.name} is too large (max 10MB).`)
                    continue
                }
                if (!file.type.startsWith('image/')) {
                    toast.error(`${file.name} is not an image.`)
                    continue
                }
                validFiles.push(file)
            }

            if (validFiles.length === 0) return

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
                    } else if (err.response?.status === 409) {
                        toast.error(err.response?.data?.message || `Duplicate: ${file.name}`)
                    } else {
                        toast.error(err.response?.data?.message || `Failed: ${file.name}`)
                    }
                }
            }

            setProgress(100)
            setResults(newResults)
            setUploading(false)
            if (newResults.length === 0) {
                setPreviews([])
            }
            setTimeout(() => setProgress(0), 1000)
        },
        [onSuccess]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        maxSize: 10 * 1024 * 1024,
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
                        <span>❌ {screenshotCount}/{limit} used</span>
                    ) : (
                        <span>📊 {screenshotCount}/{limit} used</span>
                    )}
                </div>
            )}
            {tier === 'pro' && (
                <div className="usage-badge pro">✨ PRO: Unlimited</div>
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
                            <div className="paywall-state">
                                <Sparkles size={48} className="paywall-icon" />
                                <h3>Limit Reached</h3>
                                <p>Upgrade to Pro for unlimited uploads!</p>
                                <button
                                    className="upgrade-cta-btn"
                                    onClick={() => {
                                        setUpgradeTrigger('limit_reached')
                                        setShowUpgradeModal(true)
                                    }}
                                >
                                    <Sparkles size={20} />
                                    Upgrade to Pro
                                </button>
                            </div>
                        ) : (
                            <div
                                {...getRootProps()}
                                className={`dropzone ${isDragActive ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                                id="upload-dropzone"
                            >
                                <input {...getInputProps()} id="screenshot-file-input" />

                                {/* Image Reveal Loading - top to bottom curtain */}
                                {uploading && previews.length > 0 && (
                                    <div className="image-reveal-loader">
                                        <img src={previews[0]} alt="processing" className="reveal-image" />
                                        <motion.div
                                            className="reveal-curtain"
                                            initial={{ height: '100%' }}
                                            animate={{ height: `${100 - progress}%` }}
                                            transition={{ duration: 0.6, ease: 'easeOut' }}
                                        />
                                        <div className="reveal-status">
                                            {progress < 30 ? 'Uploading...' : progress < 70 ? 'Analyzing...' : progress < 90 ? 'Saving...' : 'Done'}
                                        </div>
                                    </div>
                                )}

                                {previews.length > 0 && !uploading && (
                                    <div className="previews-container">
                                        {previews.map((prev, i) => (
                                            <img key={i} src={prev} alt={`preview-${i}`} className="drop-preview-thumb" />
                                        ))}
                                    </div>
                                )}

                                {previews.length === 0 && !uploading && (
                                    <>
                                        <div className="drop-icon-wrap">
                                            <span className="drop-icon-inner">{isDragActive ? '⬇️' : '📤'}</span>
                                        </div>
                                        <p className="drop-title">
                                            {isDragActive ? 'Drop them!' : 'Drop up to 3 screenshots'}
                                        </p>
                                        <p className="drop-sub">PNG, JPG, WEBP up to 10 MB each</p>
                                    </>
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
                        <div className="results-grid">
                            {results.map((res, i) => {
                                const meta = CATEGORY_META[res.category] || CATEGORY_META['Other']
                                return (
                                    <div key={res._id || i} className="result-card" style={{ '--cat-color': meta.color }}>
                                        <div className="result-header">
                                            <div className="result-category-badge" style={{ background: meta.color + '22', border: `1px solid ${meta.color}66`, color: meta.color }}>
                                                {meta.icon} {res.category}
                                            </div>
                                            <div className="result-confidence">
                                                {Math.round((res.metadata?.confidence || 0) * 100)}%
                                            </div>
                                        </div>
                                        <p className="result-summary">{res.metadata?.summary}</p>
                                        <div className="result-actions">
                                            {res.driveViewLink && (
                                                <a href={res.driveViewLink} target="_blank" rel="noreferrer" className="result-action-btn drive">
                                                    📁 Drive
                                                </a>
                                            )}
                                            {res.calendarEventLink && (
                                                <a href={res.calendarEventLink} target="_blank" rel="noreferrer" className="result-action-btn calendar">
                                                    📅 Calendar
                                                </a>
                                            )}
                                            {res.metadata?.mapLink && (
                                                <a href={res.metadata.mapLink} target="_blank" rel="noreferrer" className="result-action-btn map">
                                                    📍 Map
                                                </a>
                                            )}
                                            {res.sheetsRowNumber && user?.sheetsId && (
                                                <a href={`https://docs.google.com/spreadsheets/d/${user.sheetsId}`} target="_blank" rel="noreferrer" className="result-action-btn sheet">
                                                    📊 Sheets
                                                </a>
                                            )}
                                            {res.taskLink && (
                                                <a href={res.taskLink} target="_blank" rel="noreferrer" className="result-action-btn task">
                                                    ✅ Task
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

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                trigger={upgradeTrigger}
            />
        </div>
    )
}
