import ProblemModel from "../models/problem.model";

export class ProblemRepository {
    static async findById(id: string) {
        return ProblemModel.findById(id);
    }

    static async findBySlug(slug: string, options: { isDeleted?: boolean; status?: string } = {}) {
        return this.findBySlugOrId(slug, options);
    }

    static async findBySlugOrId(identifier: string, options: { isDeleted?: boolean; status?: string } = {}) {
        const query: any = {};
        if (options.isDeleted !== undefined) {
            query.isDeleted = options.isDeleted;
        } else {
            query.isDeleted = { $ne: true };
        }
        if (options.status !== undefined) {
            query.status = options.status;
        }

        const isMongoId = Boolean(identifier.match(/^[0-9a-fA-F]{24}$/));
        const num = Number(identifier);

        if (isMongoId) {
            query._id = identifier;
        } else if (!isNaN(num) && identifier.trim() !== "") {
            query.$or = [{ problemId: num }, { slug: identifier }];
        } else {
            query.slug = identifier;
        }

        return ProblemModel.findOne(query).lean();
    }

    static async findByIdOrSlug(problemId: number, slug: string) {
        return ProblemModel.findOne({
            $or: [{ problemId }, { slug }]
        });
    }

    static async getAll(query: any = {}, projection: any = null, sort: any = null) {
        let dbQuery = ProblemModel.find(query, projection).lean();
        if (sort) dbQuery = (dbQuery as any).sort(sort);
        return dbQuery;
    }

    static async create(problemData: any) {
        const problem = new ProblemModel(problemData);
        return problem.save();
    }

    static async update(id: string, updateData: any) {
        return ProblemModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    }

    static async updateMany(filter: any, updateData: any) {
        return ProblemModel.updateMany(filter, updateData);
    }

    static async delete(id: string) {
        return ProblemModel.findByIdAndDelete(id);
    }

    static async findOneAdjacent(query: any, sort: any) {
        return ProblemModel.findOne(query, "slug title problemId").sort(sort).lean();
    }

    static async countProblems(query: any = {}) {
        return ProblemModel.countDocuments(query);
    }

    static async findByIdOrNumericId(id: string) {
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            return ProblemModel.findById(id);
        }
        const num = Number(id);
        if (!isNaN(num)) {
            return ProblemModel.findOne({ problemId: num });
        }
        return ProblemModel.findOne({ slug: id });
    }
}
