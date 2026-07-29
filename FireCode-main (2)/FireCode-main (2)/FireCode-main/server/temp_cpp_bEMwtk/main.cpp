
#include <bits/stdc++.h>
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
};


#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

int main() {
    string input;
    if (!getline(cin, input)) return 0;
    
    vector<int> nums;
    int target = 0;
    
    size_t openBracket = input.find('[');
    size_t closeBracket = input.find(']');
    if (openBracket != string::npos && closeBracket != string::npos && closeBracket > openBracket) {
        string numsStr = input.substr(openBracket + 1, closeBracket - openBracket - 1);
        stringstream ss(numsStr);
        string val;
        while (getline(ss, val, ',')) {
            if (!val.empty()) nums.push_back(stoi(val));
        }
        size_t commaAfter = input.find(',', closeBracket);
        if (commaAfter != string::npos) {
            string targetStr = input.substr(commaAfter + 1);
            targetStr.erase(remove(targetStr.begin(), targetStr.end(), ']'), targetStr.end());
            targetStr.erase(remove(targetStr.begin(), targetStr.end(), ' '), targetStr.end());
            if (!targetStr.empty()) target = stoi(targetStr);
        }
    }

    Solution sol;
    vector<int> res = sol.twoSum(nums, target);
    cout << "[" << res[0] << "," << res[1] << "]" << endl;
    return 0;
}
