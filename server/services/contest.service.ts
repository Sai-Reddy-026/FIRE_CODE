import { ContestRepository } from "../repositories/contest.repository";
import { NotFoundError } from "../errors/AppError";
import cacheService from "./cache.service";

export class ContestService {
    static async getAllContests() {
        const cacheKey = "contests:all";
        let contests = await cacheService.get(cacheKey);
        if (!contests) {
            contests = await ContestRepository.getAllSortedByStartTime();
            await cacheService.set(cacheKey, contests, 300); // 5 mins cache
        }
        return contests;
    }

    static async getUpcomingContests() {
        const cacheKey = "contests:upcoming";
        let contests = await cacheService.get(cacheKey);
        if (!contests) {
            contests = await ContestRepository.getUpcoming(new Date());
            await cacheService.set(cacheKey, contests, 60); // 1 min cache
        }
        return contests;
    }

    static async getLiveContests() {
        const cacheKey = "contests:live";
        let contests = await cacheService.get(cacheKey);
        if (!contests) {
            contests = await ContestRepository.getLive(new Date());
            await cacheService.set(cacheKey, contests, 60); // 1 min cache
        }
        return contests;
    }

    static async getPastContests() {
        const cacheKey = "contests:past";
        let contests = await cacheService.get(cacheKey);
        if (!contests) {
            contests = await ContestRepository.getPast(new Date());
            await cacheService.set(cacheKey, contests, 120); // 2 mins cache
        }
        return contests;
    }

    static async getContestBySlug(slug: string) {
        const cacheKey = `contest:${slug}`;
        let contest = await cacheService.get(cacheKey);
        if (!contest) {
            contest = await ContestRepository.findBySlug(slug);
            if (!contest) {
                throw new NotFoundError("Contest not found");
            }
            await cacheService.set(cacheKey, contest, 600); // 10 mins cache
        }
        return contest;
    }
}
