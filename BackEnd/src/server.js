require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer'); // For handling file uploads
const path = require('path');

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Middleware to parse JSON and form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up multer for file uploads
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage });

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'Not set');
console.log('DB_NAME:', process.env.DB_NAME);

// Test the database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database!');
    connection.release();
  }
});

// Signup endpoint
app.post('/signup', upload.single('image'), (req, res) => {
  const { name, email, phone, role, password } = req.body;
  const image = req.file ? req.file.buffer : null; // Get image as binary data

  // Check if the email or phone already exists
  const checkQuery = 'SELECT * FROM users WHERE email = ? OR phone = ?';
  pool.query(checkQuery, [email, phone], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ message: 'An error occurred. Please try again later.' });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: 'Email or phone already exists.' });
    }

    // Insert the new user into the database
    const insertQuery = `
      INSERT INTO users (Name, Email, Phone, Role, Image, password)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    pool.query(insertQuery, [name, email, phone, role, image, password], (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ message: 'An error occurred. Please try again later.' });
      }

      console.log('New user registered:', { UserID: results.insertId, name, email });
      res.json({ message: 'Signup successful!' });
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});