//server.js

//const http = require('http'); replaced by express
const fs = require('fs');
const path = require('path');
const express = require('express');
const { request } = require('http');

//const hostname = '127.0.0.1'; not used by express
const port = 3000;
const app = express(); //() are required!!!

//read the file
let recipies = [];
const recipePath = path.join(__dirname, 'recipies.json');

//save 
function saveRecipies(data) {
    return new Promise((resolve, reject) => {
        const jsonContent = JSON.stringify(data, null, 4); // Pretty print
        fs.writeFile(recipePath, jsonContent, 'utf8', (error) => {
            if (error) {
                console.error("Error writing menu.json:", error);
                return reject(new Error("Failed to save data"));
            }
            resolve();
        });
    });
}
//end save

//getNewId
function getNewId() {
    if (recipies.length === 0) return 1;
    const maxId = recipies.reduce((max, item) => Math.max(max, item.Id || 0), 0); //gets all items in array and returns max Id field
    return maxId + 1;
}

//Load data
try {
    const data = fs.readFileSync(recipePath, 'utf-8');
    recipies = JSON.parse(data);
    console.log(`Loaded ${recipies.length} recipies`);
}
catch (error) {
    recipies = { Error: "Failed to load recipie file"};
    console.error(`Error loading recipie file: ${error.message}`);
}

// Express Setup ---
// This all seems to be standard Express requirements
// Replaces the manual request body parsing with Express's built-in middleware
app.use(express.json());

// Simple CORS setup (for development/testing)
app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle CORS preflight requests (OPTIONS)
    if (request.method === 'OPTIONS') {
        return response.sendStatus(204);
    }
    next();
});


const router = express.Router();


// 1. READ ALL (GET /menu)
router.get('/', (request, response) => {
    response.status(200).json(recipies);
});

app.use('/', router);

//last route so failed
app.use((request, response) => {
    response.status(404).json({ "Error": "404 Not Found"});
});

app.listen(port, () => {
    console.log(`Express Server running at http://localhost:${port}/`);
    console.log('API routes: /');
});