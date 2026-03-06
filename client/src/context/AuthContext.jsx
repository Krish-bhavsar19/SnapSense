import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

// Configure axios defaults
axios.defaults.withCredentials = true

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchUser = async () => {
        try {
            const res = await axios.get('/auth/me')
            if (res.data.success) {
                setUser(res.data.user)
            } else {
                setUser(null)
            }
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUser()
    }, [])

    const login = () => {
        window.location.href = '/auth/google'
    }

    const logout = async () => {
        try {
            await axios.post('/auth/logout')
            setUser(null)
            window.location.href = '/'
        } catch {
            window.location.href = '/'
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, fetchUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
