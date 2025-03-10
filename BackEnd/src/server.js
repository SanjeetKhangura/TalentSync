const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Middleware to parse JSON
app.use(bodyParser.json());

// Mock user database (replace with a real database in production)
const users = [];

// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Find the user in the mock database
  const user = users.find((u) => u.email === email && u.password === password);

  if (user) {
    res.json({ message: 'Login successful!' });
  } else {
    res.status(401).json({ message: 'Invalid email or password.' });
  }
});

// Signup endpoint
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  // Check if the email already exists
  const userExists = users.some((user) => user.email === email);

  if (userExists) {
    return res.status(400).json({ message: 'Email already exists.' });
  }

  // Add the new user to the mock database
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password, // In production, store hashed passwords
  };
  users.push(newUser);

  console.log('New user registered:', newUser);
  res.json({ message: 'Signup successful!' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});