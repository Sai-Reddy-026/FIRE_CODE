import UserModel from "../models/user.model";

export class UserRepository {
    static async findById(id: string) {
        return UserModel.findOne({ _id: id, isDeleted: { $ne: true } });
    }

    static async findByIdIncludeDeleted(id: string) {
        return UserModel.findById(id);
    }

    static async findByUsername(username: string) {
        return UserModel.findOne({ username, isDeleted: { $ne: true } });
    }

    /**
     * Public-safe profile lookup — only returns fields appropriate for display
     * to unauthenticated callers. Never exposes email, password, ban status,
     * solved problem slugs, or internal flags.
     */
    static async findPublicProfile(username: string) {
        return UserModel.findOne({ username, isDeleted: { $ne: true } })
            .select(
                "username display_name bio location company website " +
                "github linkedin twitter country avatar_url rating rank " +
                "points total_points_earned problems_solved_count " +
                "problems_attempted_count longest_streak skills languages " +
                "preferred_language role createdAt"
            )
            .lean();
    }

    /** Same projection as findPublicProfile but looked up by ObjectId */
    static async findPublicProfileById(id: string) {
        return UserModel.findOne({ _id: id, isDeleted: { $ne: true } })
            .select(
                "username display_name bio location company website " +
                "github linkedin twitter country avatar_url rating rank " +
                "points total_points_earned problems_solved_count " +
                "problems_attempted_count longest_streak skills languages " +
                "preferred_language role createdAt"
            )
            .lean();
    }

    static async findByEmail(email: string) {
        return UserModel.findOne({ email, isDeleted: { $ne: true } });
    }

    static async findByUsernameOrEmail(value: string) {
        return UserModel.findOne({
            $or: [{ username: value }, { email: value }],
            isDeleted: { $ne: true }
        });
    }

    static async create(userData: any) {
        const user = new UserModel(userData);
        return user.save();
    }

    static async update(id: string, updateData: any) {
        return UserModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );
    }

    static async delete(id: string) {
        return UserModel.findByIdAndDelete(id);
    }

    static async softDelete(id: string) {
        return UserModel.findByIdAndUpdate(id, { $set: { isDeleted: true } }, { new: true });
    }

    static async getAll() {
        return UserModel.find({ isDeleted: { $ne: true } });
    }

    static async findPaginated(query: any, skip: number, limit: number) {
        return UserModel.find({ ...query, isDeleted: { $ne: true } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
    }

    static async countUsers(query: any) {
        return UserModel.countDocuments({ ...query, isDeleted: { $ne: true } });
    }
}
