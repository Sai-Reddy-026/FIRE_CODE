import ContestModel from "../models/contest.model";

export class ContestRepository {
    static async getAllSortedByStartTime() {
        return ContestModel.find({ isDeleted: { $ne: true } }).sort({ start_time: -1 });
    }

    static async getUpcoming(now: Date, limit: number = 10) {
        return ContestModel.find({
            start_time: { $gt: now },
            isDeleted: { $ne: true }
        }).sort({ start_time: 1 }).limit(limit);
    }

    static async getLive(now: Date) {
        return ContestModel.find({
            start_time: { $lte: now },
            end_time: { $gte: now },
            isDeleted: { $ne: true }
        });
    }

    static async getPast(now: Date, limit: number = 20) {
        return ContestModel.find({
            end_time: { $lt: now },
            isDeleted: { $ne: true }
        }).sort({ end_time: -1 }).limit(limit);
    }

    static async findBySlug(slug: string) {
        return ContestModel.findOne({ slug, isDeleted: { $ne: true } });
    }

    static async findByIdOrNumericId(id: string) {
        if (/^\d+$/.test(id)) {
            return ContestModel.findOne({ id: Number(id), isDeleted: { $ne: true } });
        }
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            return ContestModel.findOne({ _id: id, isDeleted: { $ne: true } });
        }
        return ContestModel.findOne({ slug: id, isDeleted: { $ne: true } });
    }

    static async create(contestData: any) {
        const contest = new ContestModel(contestData);
        return contest.save();
    }

    static async update(id: string, updateData: any) {
        const query = /^\d+$/.test(id) ? { id: Number(id) } : { _id: id };
        return ContestModel.findOneAndUpdate(query, { $set: updateData }, { new: true });
    }

    static async softDelete(id: string) {
        const query = /^\d+$/.test(id) ? { id: Number(id) } : { _id: id };
        return ContestModel.findOneAndUpdate(query, { $set: { isDeleted: true } }, { new: true });
    }

    static async findPaginated(query: any, skip: number, limit: number) {
        return ContestModel.find({ ...query, isDeleted: { $ne: true } })
            .sort({ start_time: -1 })
            .skip(skip)
            .limit(limit);
    }

    static async countContests(query: any) {
        return ContestModel.countDocuments({ ...query, isDeleted: { $ne: true } });
    }
}
