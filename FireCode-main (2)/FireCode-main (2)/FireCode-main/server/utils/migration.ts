import mongoose from "mongoose";
import ProblemModel from "../models/problem.model";
import TestCaseModel from "../models/testcase.model";
import UserModel from "../models/user.model";
import bcrypt from "bcrypt";

// Convert slug like "two-sum" to "Two Sum"
function kebabToSpacedPascal(str: string): string {
    if (!str) return "";
    return str
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export async function runDatabaseMigration() {
    try {
        console.log("Checking database migration status...");
        const db = mongoose.connection.db;

        // 1. Check if the old "problems" collection exists
        const collections = await db.listCollections({ name: "problems" }).toArray();
        if (collections.length === 0) {
            console.log("No legacy 'problems' collection found. Skipping migration.");
            return;
        }

        const legacyProblemsCount = await db.collection("problems").countDocuments();
        if (legacyProblemsCount === 0) {
            console.log("Legacy 'problems' collection is empty. Skipping migration.");
            return;
        }

        console.log(`Found ${legacyProblemsCount} legacy problems. Migrating...`);

        const legacyProblems = await db.collection("problems").find().toArray();

        for (const lp of legacyProblems) {
            const slug = lp.slug || lp.main?.name;
            if (!slug) continue;

            const editorialStr = typeof lp.editorial === "string" 
                ? lp.editorial 
                : (lp.editorial?.editorial_body || "");

            // Extract starter code
            const starterCode: { language: string; code: string }[] = [];
            if (lp.starterCode && Array.isArray(lp.starterCode) && lp.starterCode.length > 0) {
                starterCode.push(...lp.starterCode);
            } else if (lp.main?.code_body) {
                for (const [lang, code] of Object.entries(lp.main.code_body)) {
                    starterCode.push({ language: lang, code: String(code) });
                }
            }

            // Extract examples
            const examples: { input: string; output: string; explanation?: string }[] = [];
            if (lp.examples && Array.isArray(lp.examples) && lp.examples.length > 0) {
                examples.push(...lp.examples);
            } else {
                const testCasesList: any[][] = lp.test || [];
                for (let i = 0; i < Math.min(testCasesList.length, 2); i++) {
                    const tc = testCasesList[i];
                    if (Array.isArray(tc) && tc.length >= 2) {
                        const inputs = tc.slice(0, -1);
                        const expected = tc[tc.length - 1];
                        examples.push({
                            input: JSON.stringify(inputs),
                            output: JSON.stringify(expected),
                            explanation: `Example Case ${i + 1}`
                        });
                    }
                }
            }

            const updateFields = {
                problemId: lp.problemId || lp.main?.id || 1,
                title: lp.title || (lp.main?.name ? kebabToSpacedPascal(lp.main.name) : "Two Sum"),
                slug: slug,
                difficulty: lp.difficulty || lp.main?.difficulty || "easy",
                category: lp.category || "Algorithms",
                tags: lp.tags || lp.main?.related_topics || ["Array", "Hash Table"],
                description: lp.description || lp.main?.description_body || "",
                editorial: editorialStr,
                examples: examples,
                starterCode: starterCode,
                functionName: lp.functionName || lp.function_name || "twoSum",
                timeLimit: lp.timeLimit || 2000,
                memoryLimit: lp.memoryLimit || 256,
                points: lp.points || 10,
                acceptanceRate: lp.acceptanceRate || lp.main?.acceptance_rate_count || 0,
                submissionCount: lp.submissionCount || lp.main?.submission_count || 0,
                successCount: lp.successCount || lp.main?.accept_count || 0,
                status: lp.status || "published",
                isDeleted: false
            };

            await db.collection("problems").updateOne(
                { _id: lp._id },
                { $set: updateFields }
            );

            // Create TestCase documents for testcase runner if none exist
            const testCasesList: any[][] = lp.test || [];
            if (testCasesList.length > 0) {
                const existingTC = await TestCaseModel.countDocuments({ problemId: lp._id });
                if (existingTC === 0) {
                    for (let idx = 0; idx < testCasesList.length; idx++) {
                        const tc = testCasesList[idx];
                        if (Array.isArray(tc) && tc.length >= 2) {
                            const inputs = tc.slice(0, -1);
                            const expected = tc[tc.length - 1];
                            const isHidden = idx >= 2;
                            await TestCaseModel.create({
                                problemId: lp._id,
                                input: JSON.stringify(inputs),
                                expectedOutput: JSON.stringify(expected),
                                explanation: isHidden ? undefined : `Example test case ${idx + 1}`,
                                executionOrder: idx,
                                weight: 1,
                                isHidden,
                                isDeleted: false
                            });
                        }
                    }
                }
            }

            console.log(`Successfully migrated/normalized problem: "${updateFields.title}" (${updateFields.slug})`);
        }

        // Optionally delete the legacy collection or keep it to avoid any data loss
        // The instructions say: "Automatically migrate existing seeded problems into the new schema. No data loss."
        // Keeping the old collection ensures 100% no data loss and safety.
        // Seed single admin user
        const existingAdmin = await UserModel.findOne({ role: "admin" });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash("adminPassword123", 10);
            await UserModel.create({
                username: "admin",
                email: "admin@firecode.com",
                password: hashedPassword,
                role: "admin",
                display_name: "System Admin",
                onboarding_complete: true
            });
            // CRITICAL FIX: Never log credentials to console (visible in server logs)
            console.log("Seeded default admin user. Check your .env or source for the seed password.");
        }

        console.log("Database migration check completed.");
    } catch (error) {
        console.error("Error during database migration:", error);
    }
}
