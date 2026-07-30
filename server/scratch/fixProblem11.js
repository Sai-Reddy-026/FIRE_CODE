const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/firecode');
    const Problem = mongoose.model('Problem', new mongoose.Schema({}, { strict: false }));
    const TestCase = mongoose.model('TestCase', new mongoose.Schema({}, { strict: false }));

    const probs = await Problem.find({});
    console.log('All Problems:', probs.map(p => ({ id: p._id, pid: p.problemId, title: p.title, slug: p.slug })));

    let targetProb = probs.find(p => p.problemId === 11 || p.slug === 'longest-substring' || p.title.includes('Longest Substring'));
    if (!targetProb) {
        console.log('Problem 11 not in DB. Creating Problem 11: Longest Substring...');
        targetProb = await Problem.create({
            problemId: 11,
            title: "Longest Substring",
            slug: "longest-substring",
            difficulty: "medium",
            category: "Algorithms",
            points: 25,
            tags: ["Array", "Hash Table", "Sliding Window"],
            status: "published",
            description: "Given a string s, find the length of the longest substring without duplicate characters.",
            inputFormat: "<p>The first line contains a string s.</p>",
            outputFormat: "<p>Return a single integer representing the result.</p>",
            constraints: "0 <= s.length <= 50000",
            hints: ["Try using a Hash Map to store previously visited elements."],
            editorial: "Use a sliding window with a hash map to maintain unique character indices.",
            examples: [
                { input: "pwwkew", output: "3", explanation: "The answer is 'wke' with length 3." }
            ],
            starterCode: [
                { language: "python", code: "# Write your solution here\ndef solution(s: str) -> int:\n    pass\n" },
                { language: "javascript", code: "// Write your solution here\nfunction solution(s) {\n    \n}\n" }
            ],
            timeLimit: 2000,
            memoryLimit: 256,
            isDeleted: false,
        });
    }

    console.log('Target Problem ID:', targetProb._id);

    // Delete existing testcases for this problem
    await TestCase.deleteMany({ problemId: targetProb._id });

    const newTestCases = [
        { input: "pwwkew", expectedOutput: "3", isHidden: false, executionOrder: 0 },
        { input: "abcabcbb", expectedOutput: "3", isHidden: false, executionOrder: 1 },
        { input: "bbbbb", expectedOutput: "1", isHidden: true, executionOrder: 2 },
        { input: "au", expectedOutput: "2", isHidden: true, executionOrder: 3 },
        { input: "dvdf", expectedOutput: "3", isHidden: true, executionOrder: 4 },
        { input: "anviaj", expectedOutput: "5", isHidden: true, executionOrder: 5 },
        { input: "tmmzuxt", expectedOutput: "5", isHidden: true, executionOrder: 6 },
        { input: "abcdefghijklmnopqrstuvwxyz", expectedOutput: "26", isHidden: true, executionOrder: 7 },
        { input: "aab", expectedOutput: "2", isHidden: true, executionOrder: 8 },
        { input: "cdd", expectedOutput: "2", isHidden: true, executionOrder: 9 },
        { input: "space string test", expectedOutput: "10", isHidden: true, executionOrder: 10 }
    ];

    for (const tc of newTestCases) {
        await TestCase.create({ ...tc, problemId: targetProb._id, isDeleted: false });
    }

    console.log('SUCCESSFULLY FIXED 11 TEST CASES FOR LONGEST SUBSTRING!');
    await mongoose.disconnect();
}

run();
