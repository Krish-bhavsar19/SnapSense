import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
    const { user, logout } = useAuth()
    const location = useLocation()

    return (
        <motion.nav
            className="navbar"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
        >
            <Link to="/dashboard" className="navbar-logo">
                <span className="logo-icon">📸</span>
                <span className="logo-text">SnapSense <span className="logo-ai">AI</span></span>
            </Link>

            <div className="navbar-center">
                <Link
                    to="/dashboard"
                    className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                >
                    Dashboard
                </Link>
            </div>

            <div className="navbar-right">
                {user && (
                    <div className="user-menu">
                        <img
                            src={user.picture}
                            alt={user.name}
                            className="user-avatar"
                            referrerPolicy="no-referrer"
                        />
                        <div className="user-info">
                            <span className="user-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {user.name}
                                {user.tier === 'pro' && (
                                    <span style={{ fontSize: '0.65rem', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white', padding: '2px 6px', borderRadius: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                        PRO
                                    </span>
                                )}
                            </span>
                            <span className="user-email">{user.email}</span>
                        </div>
                        <button className="btn-logout" onClick={logout}>
                            Sign out
                        </button>
                    </div>
                )}
            </div>
        </motion.nav>
    )
}
