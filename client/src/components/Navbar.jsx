import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

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

            <div className="navbar-right">
                <ThemeToggle />
                {user && (
                    <div className="user-menu">
                        <img
                            src={user.picture}
                            alt={user.name}
                            className="user-avatar"
                            referrerPolicy="no-referrer"
                        />
                        <span className="user-name">
                            {user.name?.split(' ')[0]}
                            {user.tier === 'pro' && (
                                <span className="nav-pro-tag">PRO</span>
                            )}
                        </span>
                        <button className="btn-logout" onClick={logout}>
                            Sign out
                        </button>
                    </div>
                )}
            </div>
        </motion.nav>
    )
}
