async function main() {
    const loginRes = await fetch('http://localhost:80/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: 'admin', password: 'adminPassword123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const cppCode = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> mp;
        for (int i = 0; i < nums.size(); i++) {
            int complement = target - nums[i];
            if (mp.find(complement) != mp.end()) {
                return {mp[complement], i};
            }
            mp[nums[i]] = i;
        }
        return {};
    }
};`;

    const runRes = await fetch('http://localhost:80/api/problem/run/two-sum', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            code: cppCode,
            language: 'cpp',
            testCases: [{ input: '[[2,7,11,15],9]', expectedOutput: '[0,1]' }]
        })
    });

    const res = await runRes.json();
    console.log('Run Result:', JSON.stringify(res, null, 2));
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
