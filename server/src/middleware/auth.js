/**
 * Middleware to ensure a user is authenticated via session
 */
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in with Google.',
    });
};

module.exports = { requireAuth };
