//server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;

//read the file
let recipies = [];
const recipePath = path.join(__dirname, 'recipies.json');

try {
    const data = fs.readFileSync(recipePath, 'utf-8');
    recipies = JSON.parse(data);
    console.log(`Loaded ${recipies.length} recipies`);
}
catch (error) {
    recipies = { Error: "Failed to load recipie file"};
    console.error(`Error loading recipie file: ${error.message}`);
}

const server = http.createServer( (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (recipies.error) {
        response.statusCode = 500; //error
    }
    else {
        response.statusCode = 200;
    }
    response.end(JSON.stringify(recipies));   
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});