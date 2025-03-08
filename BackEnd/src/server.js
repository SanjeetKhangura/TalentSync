const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors package

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON
app.use(bodyParser.json());

// Endpoint to handle job application submissions
app.post('/apply', (req, res) => {
  const { name, email, preferredJob, education, workExperience } = req.body;

  // Log the received data
  console.log('Received application:', req.body);

  // Send a success response
  res.json({
    message: 'Application submitted successfully! We will get back to you soon.',
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});