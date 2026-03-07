import { useEffect, useState } from 'react'
import { Calendar, AlertCircle } from 'lucide-react'

/**
 * SubscriptionBanner - Shows subscription status and expiry info
Display on Dashboard to show users their subscription details
 */
export default function SubscriptionBanner() {
    const [subscription, setSubscription] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSubscription()
    }, [])

    const fetchSubscription = async () => {
        try {
            const response = await fetch('/api/billing/subscription', {
                credentials: 'include',
            })
            const data = await response.json()
            if (data.success) {
                setSubscription(data)
            }
        } catch (error) {
            console.error('Failed to fetch subscription:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return null
    }

    // Don't show banner for free users
    if (!subscription?.hasSubscription || subscription.tier === 'free') {
        return null
    }

    const { status, currentPeriodEnd, daysRemaining, isExpired } = subscription
    const expiryDate = new Date(currentPeriodEnd)

    // Format date in a standard, readable way (e.g., March 7, 2026)
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Determine urgency level
    let urgency = 'normal'
    let message = ''
    let icon = <Calendar size={20} />

    if (isExpired || status === 'expired') {
        urgency = 'critical'
        message = 'Your subscription has expired'
        icon = <AlertCircle size={20} />
    } else if (status === 'refunded') {
        urgency = 'critical'
        message = 'Your payment was refunded - subscription cancelled'
        icon = <AlertCircle size={20} />
    } else if (status === 'cancelled') {
        urgency = 'warning'
        message = `Subscription cancelled - active until ${formatDate(expiryDate)}`
        icon = <AlertCircle size={20} />
    } else if (status === 'payment_failed') {
        urgency = 'critical'
        message = 'Payment failed - please update payment method'
        icon = <AlertCircle size={20} />
    } else if (daysRemaining <= 7) {
        urgency = 'warning'
        message = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your subscription`
    } else {
        message = `PRO subscription active until ${formatDate(expiryDate)}`
    }

    return (
        <div className={`subscription-banner ${urgency}`}>
            <div className="banner-icon">{icon}</div>
            <div className="banner-content">
                <div className="banner-message">{message}</div>
                {!isExpired && status === 'active' && (
                    <div className="banner-progress">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${Math.max(0, (daysRemaining / 30) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
            {(urgency === 'critical' || urgency === 'warning') && status !== 'cancelled' && (
                <a href="/upgrade" className="banner-action">
                    Renew Now
                </a>
            )}
        </div>
    )
}
