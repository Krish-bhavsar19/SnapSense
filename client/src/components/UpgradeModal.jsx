import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import useBilling from '../hooks/useBilling'

/**
 * Upgrade modal component with multi-month plan options
 * Triggers: limit_reached | pro_feature | manual
 */
export default function UpgradeModal({ isOpen, onClose, trigger = 'manual' }) {
    const { handleUpgrade, isLoading } = useBilling()
    const [plans, setPlans] = useState([])
    const [selectedMonths, setSelectedMonths] = useState(1)
    const [loadingPlans, setLoadingPlans] = useState(true)

    useEffect(() => {
        if (isOpen) {
            fetchPricingPlans()
        }
    }, [isOpen])

    const fetchPricingPlans = async () => {
        try {
            const response = await fetch('/api/billing/pricing')
            const data = await response.json()
            if (data.success) {
                setPlans(data.plans)
                // Default to 3-month plan (most popular)
                setSelectedMonths(3)
            }
        } catch (error) {
            console.error('Failed to fetch pricing:', error)
        } finally {
            setLoadingPlans(false)
        }
    }

    const headings = {
        limit_reached: "You've used all 10 free screenshots this month",
        pro_feature: 'This feature requires Pro',
        manual: 'Upgrade to SnapSense Pro',
    }

    const onUpgrade = () => {
        handleUpgrade(selectedMonths, () => {
            onClose()
        })
    }

    const selectedPlan = plans.find(p => p.months === selectedMonths) || plans[0]

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
                                Choose your plan duration and save up to 20%
                            </p>
                        </div>

                        {loadingPlans ? (
                            <div className="loading-plans">Loading pricing...</div>
                        ) : (
                            <>
                                {/* Plan Duration Selector */}
                                <div className="plan-selector">
                                    {plans.map((plan) => (
                                        <button
                                            key={plan.months}
                                            className={`plan-option ${selectedMonths === plan.months ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
                                            onClick={() => setSelectedMonths(plan.months)}
                                        >
                                            {plan.popular && <span className="popular-badge">Most Popular</span>}
                                            {plan.bestValue && <span className="best-value-badge">Best Value</span>}
                                            <div className="plan-duration">{plan.name}</div>
                                            <div className="plan-pricing">
                                                <span className="total-price">₹{plan.totalPrice}</span>
                                                <span className="per-month">₹{plan.pricePerMonth}/mo</span>
                                            </div>
                                            {plan.discount > 0 && (
                                                <div className="savings">Save {plan.discount}%</div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Feature Comparison */}
                                <div className="plans-comparison">
                                    <div className="plan-card free-plan">
                                        <h3>Free</h3>
                                        <div className="plan-price">₹0</div>
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
                                        </ul>
                                    </div>

                                    <div className="plan-card pro-plan">
                                        <div className="pro-badge">SELECTED PLAN</div>
                                        <h3>Pro - {selectedPlan?.name || '1 Month'}</h3>
                                        <div className="plan-price">
                                            ₹{selectedPlan?.totalPrice || 349}
                                            <span className="billing-info">
                                                {selectedPlan?.discount > 0 && ` (Save ${selectedPlan.discount}%)`}
                                            </span>
                                        </div>
                                        <ul className="plan-features">
                                            <li>
                                                <Check size={16} /> Unlimited screenshots
                                            </li>
                                            <li>
                                                <Check size={16} /> All Google integrations
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
                                                <Check size={16} /> Full history & export
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
                                                `Upgrade for ₹${selectedPlan?.totalPrice || 349}`
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="payment-methods">
                            <p>💳 Cards, PayPal, Google Pay, Apple Pay accepted</p>
                            <p className="refund-policy">30-day money-back guarantee</p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
