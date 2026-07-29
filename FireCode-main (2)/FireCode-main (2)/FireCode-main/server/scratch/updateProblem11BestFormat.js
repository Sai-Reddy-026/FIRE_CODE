const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/firecode');
    const Problem = mongoose.model('Problem', new mongoose.Schema({}, { strict: false }));
    const TestCase = mongoose.model('TestCase', new mongoose.Schema({}, { strict: false }));

    const probs = await Problem.find({ $or: [{ problemId: 11 }, { slug: 'longest-substring' }, { title: /Longest Substring/i }] });
    for (const prob of probs) {
        prob.description = `<p>Given a string <code>s</code>, find the length of the <strong>longest substring</strong> without duplicate characters.</p>`;
        prob.inputFormat = `<p>A single string <code>s</code> consisting of English letters, digits, symbols, and spaces.</p>`;
        prob.outputFormat = `<p>Return a single integer representing the length of the longest substring without repeating characters.</p>`;
        prob.constraints = `<ul><li><code>0 &le; s.length &le; 5 &times; 10<sup>4</sup></code></li><li><code>s</code> consists of English letters, digits, symbols and spaces.</li></ul>`;
        prob.hints = [
            "Try using a Hash Map or Sliding Window to store previously visited elements.",
            "Maintain a left pointer to shrink the window whenever a duplicate character is encountered."
        ];
        prob.examples = [
            {
                input: 's = "abcabcbb"',
                output: "3",
                explanation: 'The answer is "abc", with the length of 3.'
            },
            {
                input: 's = "bbbbb"',
                output: "1",
                explanation: 'The answer is "b", with the length of 1.'
            },
            {
                input: 's = "pwwkew"',
                output: "3",
                explanation: 'The answer is "wke", with the length of 3. Notice that the answer must be a substring, "pwke" is a subsequence and not a substring.'
            }
        ];
        await prob.save();
        console.log('Updated Problem Document:', prob._id);

        // Also ensure sample testcases in TestCase collection
        await TestCase.deleteMany({ problemId: prob._id });
        const newTestCases = [
            { input: 'abcabcbb', expectedOutput: '3', isHidden: false, executionOrder: 0 },
            { input: 'bbbbb', expectedOutput: '1', isHidden: false, executionOrder: 1 },
            { input: 'pwwkew', expectedOutput: '3', isHidden: false, executionOrder: 2 },
            { input: 'zojja', expectedOutput: '3', isHidden: true, executionOrder: 3 },
            { input: 'nswnjdzj', expectedOutput: '6', isHidden: true, executionOrder: 4 },
            { input: 'azthquoc', expectedOutput: '8', isHidden: true, executionOrder: 5 },
            { input: 'nlordv', expectedOutput: '6', isHidden: true, executionOrder: 6 },
            { input: 'izunxhx', expectedOutput: '6', isHidden: true, executionOrder: 7 },
            { input: 'yjgkphgq', expectedOutput: '6', isHidden: true, executionOrder: 8 },
            { input: 'lrswbjgf', expectedOutput: '8', isHidden: true, executionOrder: 9 },
            { input: 'hzfeju', expectedOutput: '6', isHidden: true, executionOrder: 10 },
            { input: 'wwpri', expectedOutput: '4', isHidden: true, executionOrder: 11 },
            { input: 'uxvmmmmnv', expectedOutput: '4', isHidden: true, executionOrder: 12 }
        ];

        for (const tc of newTestCases) {
            await TestCase.create({ ...tc, problemId: prob._id, isDeleted: false });
        }
    }

    console.log('SUCCESSFULLY UPDATED PROBLEM 11 TO BEST FORMAT!');
    await mongoose.disconnect();
}

run();
