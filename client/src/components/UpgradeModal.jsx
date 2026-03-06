import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Sparkles } from 'lucide-react'
import useBilling from '../hooks/useBilling'

/**
 * Upgrade modal component with plan comparison
 * Triggers: limit_reached | pro_feature | manual
 */
export default function UpgradeModal({ isOpen, onClose, trigger = 'manual' }) {
    const { handleUpgrade, isLoading } = useBilling()

    const headings = {
        limit_reached: "You've used all 10 free screenshots this month",
        pro_feature: 'This feature requires Pro',
        manual: 'Upgrade to SnapSense Pro',
    }

    const onUpgrade = () => {
        handleUpgrade(() => {
            onClose()
        })
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="modal-content upgrade-modal"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="modal-close" onClick={onClose}>
                            <X size={24} />
                        </button>

                        <div className="modal-header">
                            <Sparkles size={40} className="sparkles-icon" />
                            <h2>{headings[trigger]}</h2>
                            <p className="modal-subtitle">
                                Unlock unlimited power with SnapSense Pro
                            </p>
                        </div>

                        <div className="plans-comparison">
                            <div className="plan-card free-plan">
                                <h3>Free</h3>
                                <div className="plan-price">$0</div>
                                <ul className="plan-features">
                                    <li>
                                        <Check size={16} /> 10 screenshots/month
                                    </li>
                                    <li>
                                        <Check size={16} /> Google Calendar
                                    </li>
                                    <li>
                                        <Check size={16} /> Google Tasks
                                    </li>
                                    <li className="disabled">
                                        <X size={16} /> Google Drive
                                    </li>
                                    <li className="disabled">
                                        <X size={16} /> Google Sheets
                                    </li>
                                    <li className="disabled">
                                        <X size={16} /> Full History
                                    </li>
                                    <li className="disabled">
                                        <X size={16} /> CSV Export
                                    </li>
                                </ul>
                            </div>

                            <div className="plan-card pro-plan">
                                <div className="pro-badge">BEST VALUE</div>
                                <h3>Pro</h3>
                                <div className="plan-price">
                                    ₹399<span>/month</span>
                                </div>
                                <ul className="plan-features">
                                    <li>
                                        <Check size={16} /> Unlimited screenshots
                                    </li>
                                    <li>
                                        <Check size={16} /> All 5 Google integrations
                                    </li>
                                    <li>
                                        <Check size={16} /> Google Drive storage
                                    </li>
                                    <li>
                                        <Check size={16} /> Google Sheets logging
                                    </li>
                                    <li>
                                        <Check size={16} /> Bulk upload
                                    </li>
                                    <li>
                                        <Check size={16} /> Full upload history
                                    </li>
                                    <li>
                                        <Check size={16} /> CSV export
                                    </li>
                                </ul>
                                <button
                                    className="upgrade-btn"
                                    onClick={onUpgrade}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <span className="loading-spinner-small"></span>
                                    ) : (
                                        'Upgrade to Pro'
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="payment-methods">
                            <p>💳 Cards, PayPal, Google Pay, Apple Pay accepted</p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
