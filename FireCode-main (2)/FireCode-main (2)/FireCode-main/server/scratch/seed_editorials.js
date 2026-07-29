const mongoose = require('mongoose');

async function seedEditorials() {
    await mongoose.connect('mongodb://localhost:27017/firecode');
    const ProblemModel = require('../dist/models/problem.model').default;

    const twoSumEditorial = `<h3>Approach 1: One-Pass Hash Map</h3>
<p>We can use a hash map to store the values we have seen so far. For each element <code>nums[i]</code>, we check if <code>target - nums[i]</code> exists in our map. If it does, we return the stored index and <code>i</code>.</p>
<h4>Algorithm</h4>
<ol class="list-decimal pl-5 space-y-1">
  <li>Initialize an empty hash map.</li>
  <li>Iterate through the array <code>nums</code> with index <code>i</code>.</li>
  <li>Calculate complement = <code>target - nums[i]</code>.</li>
  <li>If complement is in map, return <code>[map[complement], i]</code>.</li>
  <li>Otherwise, set <code>map[nums[i]] = i</code>.</li>
</ol>
<h4>Complexity Analysis</h4>
<ul class="list-disc pl-5 space-y-1">
  <li><strong>Time Complexity:</strong> O(N) — We traverse the list of N elements only once. Hash map lookups take O(1) time.</li>
  <li><strong>Space Complexity:</strong> O(N) — Extra space needed for the hash map storing up to N elements.</li>
</ul>`;

    const fractionEditorial = `<h3>Approach: Hash Map for Remainder Tracking</h3>
<p>To convert a fraction <code>numerator / denominator</code> to a string representation with recurring decimals, we handle sign, integer part, and fractional part systematically.</p>
<h4>Algorithm</h4>
<ol class="list-decimal pl-5 space-y-1">
  <li>Handle edge cases (0 numerator) and determine negative sign.</li>
  <li>Calculate the integral part using integer division: <code>Math.floor(n / d)</code>.</li>
  <li>If remainder is 0, return the result.</li>
  <li>Otherwise, append decimal point <code>.</code> and process remainder in a loop with a Hash Map storing <code>remainder -&gt; index</code> position.</li>
  <li>If a remainder repeats, wrap the substring from its initial index to current position in parentheses <code>(...)</code> and terminate.</li>
</ol>
<h4>Complexity Analysis</h4>
<ul class="list-disc pl-5 space-y-1">
  <li><strong>Time Complexity:</strong> O(Denominator) — There can be at most <code>denominator</code> unique remainders before repeating or terminating.</li>
  <li><strong>Space Complexity:</strong> O(Denominator) — Space required to store remainder positions in the hash map.</li>
</ul>`;

    await ProblemModel.updateOne(
        { slug: 'two-sum' },
        { $set: { status: 'published', editorial: twoSumEditorial } }
    );

    await ProblemModel.updateOne(
        { slug: 'fraction-to-recurring-decimal' },
        { $set: { status: 'published', editorial: fractionEditorial } }
    );

    console.log('Successfully updated DB with published status and rich editorials for both problems!');
    await mongoose.disconnect();
}

seedEditorials().catch(console.error);
