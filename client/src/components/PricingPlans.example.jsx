// Example Pricing Component for SnapSense Pro
// This shows how to integrate with the new multi-month billing API

import React, { useState, useEffect } from 'react';

const PricingPlans = () => {
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPricingAndSubscription();
  }, []);

  const fetchPricingAndSubscription = async () => {
    try {
      // Fetch pricing plans
      const pricingRes = await fetch('/api/billing/pricing');
      const pricingData = await pricingRes.json();
      
      // Fetch current subscription
      const subRes = await fetch('/api/billing/subscription', {
        credentials: 'include',
      });
      const subData = await subRes.json();
      
      setPlans(pricingData.plans || []);
      setCurrentSubscription(subData.hasSubscription ? subData : null);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
      setLoading(false);
    }
  };

  const handleCheckout = async (months) => {
    setProcessing(true);
    
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ months }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to Lemon Squeezy checkout
        window.location.href = data.checkoutUrl;
      } else if (data.error === 'ALREADY_SUBSCRIBED') {
        alert(`You already have an active subscription until ${new Date(data.currentPeriodEnd).toLocaleDateString()}`);
      } else {
        alert(data.message || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading pricing...</div>;
  }

  return (
    <div className="pricing-container">
      <h1>Choose Your Plan</h1>
      
      {currentSubscription && currentSubscription.status === 'active' && (
        <div className="current-subscription-banner">
          <p>✅ You have an active PRO subscription</p>
          <p>Valid until: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}</p>
          <p>{currentSubscription.daysRemaining} days remaining</p>
        </div>
      )}

      <div className="pricing-grid">
        {plans.map((plan) => (
          <div 
            key={plan.months} 
            className={`pricing-card ${plan.popular ? 'popular' : ''} ${plan.bestValue ? 'best-value' : ''}`}
          >
            {plan.popular && <div className="badge popular-badge">Most Popular</div>}
            {plan.bestValue && <div className="badge best-value-badge">Best Value</div>}
            
            <h3>{plan.name}</h3>
            
            <div className="price">
              <span className="currency">₹</span>
              <span className="amount">{plan.totalPrice}</span>
            </div>
            
            {plan.discount > 0 && (
              <div className="discount-info">
                <span className="discount-badge">{plan.discount}% OFF</span>
                <span className="savings">Save ₹{plan.savings}</span>
              </div>
            )}
            
            <div className="price-per-month">
              ₹{plan.pricePerMonth}/month
            </div>
            
            <button
              onClick={() => handleCheckout(plan.months)}
              disabled={processing || (currentSubscription?.status === 'active')}
              className="checkout-button"
            >
              {processing ? 'Processing...' : 
               currentSubscription?.status === 'active' ? 'Active Subscription' : 
               'Get Started'}
            </button>
            
            <ul className="features">
              <li>✓ Unlimited screenshot uploads</li>
              <li>✓ AI-powered organization</li>
              <li>✓ Google Drive integration</li>
              <li>✓ Google Calendar events</li>
              <li>✓ Google Tasks creation</li>
              <li>✓ Google Sheets logging</li>
              <li>✓ Priority support</li>
              {plan.months >= 6 && <li>✓ Extended storage retention</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        
        <div className="faq-item">
          <h4>What happens when my subscription expires?</h4>
          <p>Your account will revert to the free tier with a limit of 10 screenshots per month.</p>
        </div>
        
        <div className="faq-item">
          <h4>Can I upgrade to a longer plan?</h4>
          <p>Yes! Purchase a new plan and your subscription will be extended.</p>
        </div>
        
        <div className="faq-item">
          <h4>Are there refunds?</h4>
          <p>Please contact support within 7 days for refund requests.</p>
        </div>
        
        <div className="faq-item">
          <h4>Can I cancel anytime?</h4>
          <p>Yes, but you'll retain PRO access until the end of your billing period.</p>
        </div>
      </div>
    </div>
  );
};

/* CSS Styles */
const styles = `
.pricing-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.current-subscription-banner {
  background: #e8f5e9;
  border: 2px solid #4caf50;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: center;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.pricing-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 2rem;
  position: relative;
  transition: transform 0.3s, box-shadow 0.3s;
}

.pricing-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.pricing-card.popular {
  border-color: #2196f3;
  box-shadow: 0 5px 20px rgba(33,150,243,0.2);
}

.pricing-card.best-value {
  border-color: #ff9800;
  box-shadow: 0 5px 20px rgba(255,152,0,0.2);
}

.badge {
  position: absolute;
  top: -10px;
  right: 20px;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  color: white;
}

.popular-badge {
  background: #2196f3;
}

.best-value-badge {
  background: #ff9800;
}

.price {
  font-size: 3rem;
  font-weight: bold;
  margin: 1rem 0;
  color: #333;
}

.currency {
  font-size: 1.5rem;
  vertical-align: super;
}

.discount-info {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 0.5rem 0;
}

.discount-badge {
  background: #4caf50;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.9rem;
}

.savings {
  color: #4caf50;
  font-weight: bold;
}

.price-per-month {
  color: #666;
  margin-bottom: 1.5rem;
}

.checkout-button {
  width: 100%;
  padding: 1rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.3s;
}

.checkout-button:hover:not(:disabled) {
  background: #4f46e5;
}

.checkout-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.features {
  list-style: none;
  padding: 0;
  margin-top: 1.5rem;
}

.features li {
  padding: 0.5rem 0;
  color: #555;
}

.faq-section {
  margin-top: 4rem;
  padding: 2rem;
  background: #f5f5f5;
  border-radius: 12px;
}

.faq-item {
  margin: 1.5rem 0;
}

.faq-item h4 {
  color: #333;
  margin-bottom: 0.5rem;
}

.faq-item p {
  color: #666;
}
`;

export default PricingPlans;
