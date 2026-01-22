import { User, type IUser } from '../models/index.js';

// ==========================================
// User Service
// ==========================================

export class UserService {
    /**
     * Get user by ID
     */
    async getUserById(userId: string): Promise<IUser | null> {
        return await User.findById(userId);
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<IUser | null> {
        return await User.findOne({ email: email.toLowerCase() });
    }

    /**
     * Update user profile
     */
    async updateProfile(
        userId: string,
        updates: { name?: string; email?: string }
    ): Promise<IUser | null> {
        // If updating email, check if it's already taken
        if (updates.email) {
            const existing = await User.findOne({
                email: updates.email.toLowerCase(),
                _id: { $ne: userId },
            });

            if (existing) {
                throw new Error('Email is already in use');
            }

            updates.email = updates.email.toLowerCase();
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (user) {
            console.log(`✅ Profile updated: ${user.email}`);
        }

        return user;
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: string): Promise<{
        totalVideos: number;
        completedVideos: number;
        failedVideos: number;
        memberSince: Date;
    }> {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Import Video model dynamically to avoid circular dependency
        const { Video } = await import('../models/index.js');

        const videoCounts = await Video.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const statusCounts = videoCounts.reduce(
            (acc, item) => {
                acc[item._id] = item.count;
                return acc;
            },
            {} as Record<string, number>
        );

        const totalVideos = (Object.values(statusCounts) as number[]).reduce((a, b) => a + b, 0);

        return {
            totalVideos,
            completedVideos: statusCounts['completed'] || 0,
            failedVideos: statusCounts['failed'] || 0,
            memberSince: user.createdAt,
        };
    }

    /**
     * List all users (admin only)
     */
    async listUsers(
        page: number = 1,
        limit: number = 20
    ): Promise<{
        users: IUser[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
            User.countDocuments(),
        ]);

        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Check if user exists
     */
    async userExists(userId: string): Promise<boolean> {
        const count = await User.countDocuments({ _id: userId });
        return count > 0;
    }

    /**
     * Delete user and all their data
     */
    async deleteUser(userId: string): Promise<void> {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Import to avoid circular dependency
        const { Video } = await import('../models/index.js');
        const { storageService } = await import('./storage.service.js');

        // Get all user's videos
        const videos = await Video.find({ userId });

        // Delete video files
        for (const video of videos) {
            await storageService.deleteVideoFiles(userId, video._id.toString());
        }

        // Delete videos from database
        await Video.deleteMany({ userId });

        // Delete user
        await User.findByIdAndDelete(userId);

        console.log(`🗑️ User deleted: ${user.email}`);
    }
}

// Singleton instance
export const userService = new UserService();

export default userService;
