//server.js

console.log("Server attempt to start at " + Date().toLocaleString());

//const http = require('http'); replaced by express
const fs = require('fs');
const path = require('path');
const express = require('express');
//const { request } = require('http'); ??? I didn't cut/paste so how is it here?

//const hostname = '127.0.0.1'; not used by express
const port = 3000;
const app = express(); //() are required!!!

//read the file
let recipes = [];
const recipePath = path.join(__dirname, 'recipes.json');

//save 
function saveRecipes(data) {
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
    if (recipes.length === 0) return 1;
    const maxId = recipes.reduce((max, item) => Math.max(max, item.Id || 0), 0); //gets all items in array and returns max Id field
    return maxId + 1;
}

//Load data
try {
    const data = fs.readFileSync(recipePath, 'utf-8');
    recipes = JSON.parse(data);
    console.log(`Loaded ${recipes.length} recipes`);
}
catch (error) {
    recipes = { Error: "Failed to load recipie file"};
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

// NEW ROOT HANDLER: Inform the user where the API lives
// This would be used in browsers, and is before setting /recipes
app.get('/', (request, response) => {
    response.status(200).json({
        message: "Welcome to the Recipes API!",
        instructions: "All API endpoints are located under the /recipes path.",
        endpoints: {
            "GET /recipes": "Retrieve all recipes.",
            "POST /recipes": "Create a new recipe.",
            "PUT /recipes/:Id": "Update a recipe by ID.",
            "PUT /recipes/name/:Name": "Update a recipe by Name.",
            "GET /recipes/:Id": "Retrieve a single recipe.",
            "GET /recipes/ingredients/:SearchTerm": "Retrieve recipes matching a partial ingredient search.",
            "DELETE /recipes/:Id": "Delete a recipe by ID.",
            "DELETE /recipes/name/:Name": "Delete a recipe by Name."
        }
    });
});

const router = express.Router();

// READ ALL (GET /recipes)
router.get('/', (request, response) => {
    response.status(200).json(recipes);
});


// CREATE (POST /recipes) Add a new recipe with the next ID
router.post('/', async (request, response) => {
    try {
        const newItem = request.body; 

        // validation 
        if (!newItem.Name || !newItem.ingredients) {
            return response.status(400).json({ 
                message: "Missing required fields (Name/Ingredients)." 
            });
        }

        // Assign Id
        const newRecipie = {
            Id: getNewId(),
            Name: newItem.Name,
            Styles: newItem.Styles || [],
            ingredients: newItem.ingredients || [],
            wholesaleCost: parseFloat(newItem.wholesaleCost) || null, // Ensure it's a number or blank
            suggestedPrice: parseFloat(newItem.suggestedPrice) || null 
        };

        // Update in-memory data
        recipes.push(newItem);
        
        // Persist data to file
        await saveRecipes(recipes);
        
        // Respond with the created item
        response.status(201).json(newItem); // 201 Created status

    } catch (error) {
        console.error("POST error:", error.message);
        response.status(500).json({ message: `Error: ${error.message}` });
    }
});

// READ ONE (GET recipes/:Id)
router.get('/:Id', (request, response) => {
    const id = parseInt(request.params.Id); 
    const recipe = recipes.find(item => item.Id === id);

    if (!recipe) {
        return response.status(404).json({ message: `Recipe with ID ${id} not found.` });
    }
    
    response.status(200).json(recipe);
});

router.get('name/:Name', (request, response) => {
    const name = decodeURIComponent(request.params.Name); 
    const recipe = recipes.find(item => item.Name === name);

    if (!recipe) {
        return response.status(404).json({ message: `Recipe with ID ${name} not found.` });
    }
    
    response.status(200).json(recipe);
});

// GET RECIPES BY INGREDIENT
router.get('/ingredients/:SearchTerm', (request, response) => {
    const searchTerm = decodeURIComponent(request.params.SearchTerm).toLowerCase();
    
    // Filter recipes where at least one ingredient contains the search term
    const matchingRecipes = recipes.filter(recipe => {
        // Ensure ingredients is an array before trying to search
        if (!Array.isArray(recipe.ingredients)) {
            return false;
        }

        return recipe.ingredients.some(ingredient => {
            // Check if the lowercase ingredient string contains the lowercase search term
            return ingredient.toLowerCase().includes(searchTerm);
        });
    });

    if (matchingRecipes.length === 0) {
        return response.status(404).json({ message: `No recipes found containing ingredient fragment: "${searchTerm}"` });
    }
    
    response.status(200).json(matchingRecipes);
});

// UPDATE BY ID (PUT /recipes/:Id) 
router.put('/:Id', async (request, response) => {
    try {
        const id = parseInt(request.params.Id);
        const index = recipes.findIndex(item => item.Id === id);

        if (index === -1) {
            return response.status(404).json({ message: `Recipe with ID ${id} not found.` });
        }

        // Merge existing item with new data from request body
        const existingRecipe = recipes[index];
        const updatedRecipe = { 
            ...existingRecipe, 
            ...request.body 
        };

        // Preserve the original Id and Name, preventing modification via PUT body
        updatedRecipe.Id = existingRecipe.Id;
        if (request.body.Name) {
            updatedRecipe.Name = request.body.Name; //existingRecipe.Name;
            console.log(`Warning, name changed from ${existingRecipe.Name} to ${updatedRecipe.Name}`);
        }; // Typically Name is not modified in a PUT by ID, but good practice to preserve it.

        // Ensure numerical fields are correctly parsed from string inputs
        if (updatedRecipe.wholesaleCost) updatedRecipe.wholesaleCost = parseFloat(updatedRecipe.wholesaleCost);
        if (updatedRecipe.suggestedPrice) updatedRecipe.suggestedPrice = parseFloat(updatedRecipe.suggestedPrice);

        // Update in-memory array
        recipes[index] = updatedRecipe;

        // Persist data to file
        await saveRecipes(recipes);

        response.status(200).json(updatedRecipe); // 200 OK status

    } catch (error) {
        console.error("PUT /:Id error:", error.message);
        response.status(500).json({ message: `Server error: ${error.message}` });
    }
});

// UPDATE BY NAME (PUT /recipes/name/:Name) 
router.put('/name/:Name', async (request, response) => {
    try {
        const name = decodeURIComponent(request.params.Name);
        const nameLowerCase = name.toLowerCase();
        
        const index = recipes.findIndex(item => item.Name.toLowerCase() === nameLowerCase);

        if (index === -1) {
            return response.status(404).json({ message: `Recipe with Name "${name}" not found.` });
        }

        // Merge existing item with new data from request body
        const existingRecipe = recipes[index];
        const updatedRecipe = { 
            ...existingRecipe, 
            ...request.body 
        };

        // Preserve the original Id and Name, preventing modification
        updatedRecipe.Id = existingRecipe.Id;
        updatedRecipe.Name = existingRecipe.Name;

        if (existingRecipe.Name != name)
        {
            console.log(`Warning, cannot change name through /name request for ${existingRecipe.Name}`);
        }

        // Ensure numerical fields are correctly parsed from string inputs
        if (updatedRecipe.wholesaleCost) updatedRecipe.wholesaleCost = parseFloat(updatedRecipe.wholesaleCost);
        if (updatedRecipe.suggestedPrice) updatedRecipe.suggestedPrice = parseFloat(updatedRecipe.suggestedPrice);

        // Update in-memory array
        recipes[index] = updatedRecipe;

        // Persist data to file
        await saveRecipes(recipes);

        response.status(200).json(updatedRecipe); // 200 OK status

    } catch (error) {
        console.error("PUT /name/:Name error:", error.message);
        response.status(500).json({ message: `Server error: ${error.message}` });
    }
});


// DELETE BY ID (DELETE /:Id) - Standard RESTful deletion
router.delete('/:Id', async (request, response) => {
    try {
        const id = parseInt(request.params.Id);
        const initialLength = recipes.length;
        
        // Filter out the recipe with the matching ID
        recipes = recipes.filter(item => item.Id !== id);

        if (recipes.length === initialLength) {
            // If the array length hasn't changed, the item wasn't found
            return response.status(404).json({ message: `Recipe with ID ${id} not found.` });
        }

        await saveRecipes(recipes); // Save the filtered array
        
        // 204 No Content is the standard response for successful deletion
        response.sendStatus(204); 

    } catch (error) {
        console.error("DELETE /:Id error:", error.message);
        response.status(500).json({ message: `Server error: ${error.message}` });
    }
});


// DELETE BY NAME (DELETE /recipes/name/:Name) - Secondary deletion method
router.delete('/name/:Name', async (request, response) => {
    try {
        const name = decodeURIComponent(request.params.Name);
        const nameLowerCase = name.toLowerCase();
        const initialLength = recipes.length;

        // Filter out the recipe with the matching Name (case-insensitive search)
        recipes = recipes.filter(item => item.Name.toLowerCase() !== nameLowerCase);

        if (recipes.length === initialLength) {
            // If the array length hasn't changed, the item wasn't found
            return response.status(404).json({ message: `Recipe with Name "${name}" not found.` });
        }

        await saveRecipes(recipes); // Save the filtered array
        
        response.sendStatus(204); 

    } catch (error) {
        console.error("DELETE /name/:Name error:", error.message);
        response.status(500).json({ message: `Server error: ${error.message}` });
    }
});



app.use('/recipes', router); //not root, recipes

//last route so failed
app.use((request, response) => {
    response.status(404).json({ "Error": "404 Not Found"});
});

app.listen(port, () => {
    console.log(`Express Server running at http://localhost:${port}/`);
    console.log('API routes: /recipes, /recipes/name');
});