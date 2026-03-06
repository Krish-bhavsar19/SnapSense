import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

/**
 * Custom hook for handling billing and upgrade flow
 * Loads Lemon Squeezy embed script and provides upgrade functionality
 */
export default function useBilling() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    // Load Lemon Squeezy embed script on mount
    useEffect(() => {
        const scriptId = 'lemonsqueezy-embed-script'
        
        // Check if script already exists
        if (document.getElementById(scriptId)) {
            return
        }

        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://assets.lemonsqueezy.com/lemon.js'
        script.defer = true
        document.body.appendChild(script)

        return () => {
            // Cleanup on unmount
            const existingScript = document.getElementById(scriptId)
            if (existingScript) {
                existingScript.remove()
            }
        }
    }, [])

    /**
     * Handle upgrade to PRO
     * Opens Lemon Squeezy checkout overlay and polls for payment success
     */
    const handleUpgrade = async (onSuccess) => {
        setIsLoading(true)
        setError(null)

        try {
            // Step 1: Create checkout session
            const { data } = await axios.post('/api/billing/checkout')
            
            if (!data.checkoutUrl) {
                throw new Error('Failed to create checkout session')
            }

            // Step 2: Open Lemon Squeezy overlay
            if (window.LemonSqueezy && window.LemonSqueezy.Url) {
                window.LemonSqueezy.Url.Open(data.checkoutUrl)
            } else {
                // Fallback: open in new tab if embed not loaded
                window.open(data.checkoutUrl, '_blank')
            }

            // Step 3: Poll billing status to detect upgrade
            let attempts = 0
            const maxAttempts = 10 // 30 seconds total
            const pollInterval = 3000 // 3 seconds

            const pollStatus = setInterval(async () => {
                attempts++

                try {
                    const statusRes = await axios.get('/api/billing/status')
                    
                    // Check if user upgraded to PRO
                    if (statusRes.data.tier === 'pro') {
                        clearInterval(pollStatus)
                        setIsLoading(false)
                        toast.success('🎉 Welcome to SnapSense Pro!')
                        
                        if (onSuccess) {
                            onSuccess()
                        }
                        
                        // Reload page to update UI
                        setTimeout(() => {
                            window.location.reload()
                        }, 1500)
                        
                        return
                    }

                    // Stop polling after max attempts
                    if (attempts >= maxAttempts) {
                        clearInterval(pollStatus)
                        setIsLoading(false)
                        toast('Payment received. If Pro is not active yet, please refresh.', {
                            icon: 'ℹ️',
                            duration: 5000,
                        })
                    }
                } catch (pollErr) {
                    console.error('Polling error:', pollErr)
                }
            }, pollInterval)

            // Allow manual stop of loading state
            setTimeout(() => {
                setIsLoading(false)
            }, 5000) // Stop loading spinner after 5s even if still polling

        } catch (err) {
            console.error('Upgrade error:', err)
            setError(err.response?.data?.error || 'Failed to initiate upgrade')
            toast.error('Something went wrong. Please try again.')
            setIsLoading(false)
        }
    }

    return {
        handleUpgrade,
        isLoading,
        error,
    }
}
