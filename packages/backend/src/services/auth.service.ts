import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User, type IUser } from '../models/index.js';

// ==========================================
// Authentication Service
// ==========================================

interface TokenPayload {
    userId: string;
    email: string;
}

interface AuthResult {
    user: Record<string, unknown>;
    accessToken: string;
    expiresIn: string;
}

export class AuthService {
    private readonly jwtSecret: string;
    private readonly jwtExpiresIn: string;

    constructor() {
        this.jwtSecret = config.jwt.secret;
        this.jwtExpiresIn = config.jwt.expiresIn;
    }

    /**
     * Register a new user
     */
    async register(
        email: string,
        password: string,
        name: string
    ): Promise<AuthResult> {
        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Create new user
        const user = new User({
            email: email.toLowerCase(),
            password,
            name,
        });

        await user.save();
        console.log(`✅ User registered: ${email}`);

        // Generate token
        const accessToken = this.generateToken(user);

        return {
            user: user.toJSON(),
            accessToken,
            expiresIn: this.jwtExpiresIn,
        };
    }

    /**
     * Login user with email and password
     */
    async login(email: string, password: string): Promise<AuthResult> {
        // Find user (include password for verification)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            throw new Error('Invalid email or password');
        }

        if (!user.isActive) {
            throw new Error('Account is deactivated');
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();

        console.log(`✅ User logged in: ${email}`);

        // Generate token
        const accessToken = this.generateToken(user);

        return {
            user: user.toJSON(),
            accessToken,
            expiresIn: this.jwtExpiresIn,
        };
    }

    /**
     * Generate JWT token
     */
    generateToken(user: IUser): string {
        const payload: TokenPayload = {
            userId: user._id.toString(),
            email: user.email,
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
        });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token: string): TokenPayload {
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
            return decoded;
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            }
            throw new Error('Invalid token');
        }
    }

    /**
     * Get user from token
     */
    async getUserFromToken(token: string): Promise<IUser | null> {
        const payload = this.verifyToken(token);
        return await User.findById(payload.userId);
    }

    /**
     * Refresh token (generate new token with extended expiry)
     */
    async refreshToken(currentToken: string): Promise<{ accessToken: string; expiresIn: string }> {
        const payload = this.verifyToken(currentToken);
        const user = await User.findById(payload.userId);

        if (!user || !user.isActive) {
            throw new Error('User not found or deactivated');
        }

        const accessToken = this.generateToken(user);

        return {
            accessToken,
            expiresIn: this.jwtExpiresIn,
        };
    }

    /**
     * Change password
     */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        const user = await User.findById(userId).select('+password');

        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            throw new Error('Current password is incorrect');
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        console.log(`✅ Password changed for user: ${user.email}`);
    }

    /**
     * Deactivate user account
     */
    async deactivateAccount(userId: string): Promise<void> {
        const user = await User.findByIdAndUpdate(userId, { isActive: false });

        if (!user) {
            throw new Error('User not found');
        }

        console.log(`⚠️ Account deactivated: ${user.email}`);
    }
}

// Singleton instance
export const authService = new AuthService();

export default authService;
