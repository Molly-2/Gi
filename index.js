const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const FuzzySet = require('fuzzyset.js');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let summaryMemory = {}; // This will store taught summaries.
let fuzzySet = FuzzySet(); // FuzzySet instance for fuzzy matching
const accessKey = "Acme12"; // Key to authenticate teaching requests

// Load learned summaries from file on startup
function loadSummaryMemory() {
    try {
        if (fs.existsSync('summaries.txt')) {
            const data = fs.readFileSync('summaries.txt', 'utf-8');
            summaryMemory = JSON.parse(data);
            console.log('Summaries loaded successfully:', summaryMemory);
            updateFuzzySet(); // Update fuzzy set with loaded data
        } else {
            console.log('summaries.txt file does not exist. Starting with empty summary memory.');
        }
    } catch (error) {
        console.error('Error loading summary memory:', error);
        summaryMemory = {}; // Reset memory in case of error
    }
}

// Save learned summaries to file
function saveSummaryMemory() {
    try {
        fs.writeFileSync('summaries.txt', JSON.stringify(summaryMemory, null, 2));
        console.log('Summaries saved successfully:', summaryMemory);
    } catch (error) {
        console.error('Error saving summary memory:', error);
    }
}

// Update the fuzzy set with current summary keys
function updateFuzzySet() {
    fuzzySet = FuzzySet(Object.keys(summaryMemory));
}

// Initial load of summary memory
loadSummaryMemory();

// Serve the HTML file
app.use(express.static('public'));

// Handle summary requests
app.get('/summary', (req, res) => {
    const query = req.query.query?.trim().toLowerCase();
    console.log('Received summary query:', query);

    if (query) {
        if (summaryMemory[query]) {
            // Return taught summary if an exact match exists
            const summary = summaryMemory[query];
            return res.json({ summary });
        } else {
            // Attempt fuzzy matching
            const fuzzyMatch = fuzzySet.get(query);
            if (fuzzyMatch && fuzzyMatch[0][0] > 0.5) { // 0.5 is the threshold; adjust as needed
                const bestMatch = fuzzyMatch[0][1];
                const summary = summaryMemory[bestMatch];
                return res.json({ summary: `Did you mean "${bestMatch}"? Here's the summary: ${summary}` });
            }
            return res.json({ summary: `No taught summary found for: "${query}". Please teach me!` });
        }
    } else {
        res.json({ summary: "Please provide a query for summarization." });
    }
});

// Handle teaching new summaries
app.post('/teachSummary', (req, res) => {
    let { query, summary, key } = req.body;

    // Key validation
    if (key !== accessKey) {
        return res.status(403).json({ response: "Access denied: Invalid key." });
    }

    if (query && summary) {
        const lowerCaseQuery = query.trim().toLowerCase();
        summaryMemory[lowerCaseQuery] = summary.trim();
        console.log('Learned summary:', lowerCaseQuery, '->', summary);
        updateFuzzySet(); // Update fuzzy set with the new entry
        saveSummaryMemory(); // Save the updated summary memory to file
        res.json({ response: `Learned summary for: "${query}"` });
    } else {
        res.status(400).json({ response: "Invalid data format. Provide both 'query' and 'summary'." });
    }
});

// Handle chat history retrieval
app.get('/history', (req, res) => {
    res.json({ response: summaryMemory });
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
