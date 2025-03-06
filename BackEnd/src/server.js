const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware to parse JSON
app.use(bodyParser.json());

// Endpoint to handle job application submissions
app.post('/apply', (req, res) => {
  const { name, email, preferredJob, education, workExperience } = req.body;

  // Here, you would typically save this data to a database
  // For now, just log it to the console and send a success message
  console.log('Received application:', req.body);

  res.json({
    message: 'Application submitted successfully! We will get back to you soon.',
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
