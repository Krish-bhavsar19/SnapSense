// Example Subscription Status Component
// Shows current subscription details on the dashboard

import React, { useState, useEffect } from 'react';

const SubscriptionStatus = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/billing/subscription', {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        setSubscription(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading subscription...</div>;
  }

  if (!subscription?.hasSubscription || subscription.tier === 'free') {
    return (
      <div className="subscription-banner free">
        <div className="banner-content">
          <h3>🆓 Free Plan</h3>
          <p>10 screenshots per month</p>
          <a href="/upgrade" className="upgrade-link">
            Upgrade to PRO for unlimited uploads →
          </a>
        </div>
      </div>
    );
  }

  const { status, currentPeriodEnd, daysRemaining, isExpired } = subscription;
  const expiryDate = new Date(currentPeriodEnd);
  
  // Calculate progress bar percentage
  const totalDays = 30; // Assume 30 days initially
  const percentageRemaining = Math.max(0, Math.min(100, (daysRemaining / totalDays) * 100));
  
  // Determine status color and message
  let statusColor = 'green';
  let statusMessage = 'Active';
  let urgency = 'normal';
  
  if (isExpired) {
    statusColor = 'red';
    statusMessage = 'Expired';
    urgency = 'critical';
  } else if (status === 'cancelled') {
    statusColor = 'orange';
    statusMessage = 'Cancelled (Active until expiry)';
    urgency = 'warning';
  } else if (daysRemaining <= 7) {
    statusColor = 'orange';
    statusMessage = 'Expiring Soon';
    urgency = 'warning';
  } else if (status === 'payment_failed') {
    statusColor = 'red';
    statusMessage = 'Payment Failed';
    urgency = 'critical';
  }

  return (
    <div className={`subscription-banner pro ${urgency}`}>
      <div className="banner-content">
        <div className="subscription-header">
          <div className="tier-info">
            <h3>⭐ SnapSense Pro</h3>
            <span className={`status-badge ${statusColor}`}>{statusMessage}</span>
          </div>
          
          {!isExpired && (
            <div className="expiry-info">
              <div className="days-remaining">
                <span className="days-number">{daysRemaining}</span>
                <span className="days-label">days left</span>
              </div>
              <div className="expiry-date">
                Valid until {expiryDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
            </div>
          )}
        </div>

        {!isExpired && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${percentageRemaining}%`,
                  backgroundColor: urgency === 'warning' ? '#ff9800' : '#4caf50'
                }}
              />
            </div>
          </div>
        )}

        {urgency === 'warning' && !isExpired && (
          <div className="warning-message">
            ⚠️ Your subscription is expiring soon. <a href="/upgrade">Renew now</a> to continue enjoying PRO features.
          </div>
        )}

        {isExpired && (
          <div className="expired-message">
            ❌ Your subscription has expired. <a href="/upgrade">Renew now</a> to regain access to PRO features.
          </div>
        )}

        {status === 'payment_failed' && (
          <div className="error-message">
            ❌ Payment failed. Please update your payment method or <a href="/upgrade">renew your subscription</a>.
          </div>
        )}

        <div className="features-summary">
          <div className="feature">✓ Unlimited uploads</div>
          <div className="feature">✓ AI organization</div>
          <div className="feature">✓ Cloud integration</div>
          <div className="feature">✓ Priority support</div>
        </div>
      </div>
    </div>
  );
};

/* CSS Styles */
const styles = `
.subscription-banner {
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.subscription-banner.free {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.subscription-banner.warning {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.subscription-banner.critical {
  background: linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%);
}

.banner-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.subscription-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.tier-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tier-info h3 {
  margin: 0;
  font-size: 1.5rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
  background: rgba(255,255,255,0.2);
}

.status-badge.green {
  background: rgba(76,175,80,0.3);
  border: 1px solid rgba(76,175,80,0.5);
}

.status-badge.orange {
  background: rgba(255,152,0,0.3);
  border: 1px solid rgba(255,152,0,0.5);
}

.status-badge.red {
  background: rgba(244,67,54,0.3);
  border: 1px solid rgba(244,67,54,0.5);
}

.expiry-info {
  text-align: right;
}

.days-remaining {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.days-number {
  font-size: 2rem;
  font-weight: bold;
  line-height: 1;
}

.days-label {
  font-size: 0.875rem;
  opacity: 0.9;
}

.expiry-date {
  font-size: 0.875rem;
  opacity: 0.8;
  margin-top: 0.25rem;
}

.progress-container {
  margin: 0.5rem 0;
}

.progress-bar {
  background: rgba(255,255,255,0.2);
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.warning-message,
.expired-message,
.error-message {
  background: rgba(255,255,255,0.15);
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.95rem;
}

.warning-message a,
.expired-message a,
.error-message a {
  color: white;
  text-decoration: underline;
  font-weight: bold;
}

.features-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.9;
}

.upgrade-link {
  display: inline-block;
  margin-top: 0.5rem;
  color: white;
  text-decoration: underline;
  font-weight: bold;
}

.upgrade-link:hover {
  opacity: 0.8;
}

/* Responsive */
@media (max-width: 768px) {
  .subscription-header {
    flex-direction: column;
  }
  
  .expiry-info {
    text-align: left;
  }
  
  .days-remaining {
    align-items: flex-start;
  }
  
  .features-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;

export default SubscriptionStatus;
