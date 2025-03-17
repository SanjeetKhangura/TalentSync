require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer'); // For handling file uploads
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For session management
const winston = require('winston'); // For logging

const app = express();
const port = 3000;

// Set up logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Enable CORS
app.use(cors());

// Middleware to parse JSON and form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up multer for file uploads with validation
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

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

// Test the database connection
pool.getConnection((err, connection) => {
  if (err) {
    logger.error('Error connecting to MySQL:', err);
  } else {
    logger.info('Connected to MySQL database!');
    connection.release();
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  try {
    // Query the database to find the user
    const query = 'SELECT * FROM users WHERE Email = ?';
    pool.query(query, [email], async (err, results) => {
      if (err) {
        logger.error('Error executing query:', err);
        return res.status(500).json({ message: 'An error occurred. Please try again later.' });
      }

      if (results.length > 0) {
        const user = results[0];

        // Compare the provided password with the hashed password in the database
        const passwordMatch = await bcrypt.compare(password, user.Password);

        if (passwordMatch) {
          // Generate a JWT token for session management
          const token = jwt.sign({ userId: user.UserID, role: user.Role }, process.env.JWT_SECRET, { expiresIn: '1h' });

          // Log successful login
          logger.info(`User ${user.Email} logged in successfully.`);

          // Return token and role to the frontend
          res.json({ message: 'Login successful!', token, role: user.Role });
        } else {
          // Log failed login attempt
          logger.warn(`Failed login attempt for email: ${email}`);
          res.status(401).json({ message: 'Invalid email or password.' });
        }
      } else {
        // User not found
        res.status(401).json({ message: 'Invalid email or password.' });
      }
    });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
});

// Signup endpoint
app.post('/signup', upload.single('image'), async (req, res) => {
  const { name, email, phone, role, password, confirmPassword } = req.body;
  const image = req.file ? req.file.buffer : null; // Get image as binary data

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  // Validate password match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

    // Check if the email or phone already exists
    const checkQuery = 'SELECT * FROM users WHERE email = ? OR phone = ?';
    pool.query(checkQuery, [email, phone], async (err, results) => {
      if (err) {
        logger.error('Error executing query:', err);
        return res.status(500).json({ message: 'An error occurred. Please try again later.' });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: 'Email or phone already exists.' });
      }

      // Insert the new user into the database
      const insertQuery = `
        INSERT INTO users (Name, Email, Phone, Role, Image, Password)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      pool.query(insertQuery, [name, email, phone, role, image, hashedPassword], (err, results) => {
        if (err) {
          logger.error('Error executing query:', err);
          return res.status(500).json({ message: 'An error occurred. Please try again later.' });
        }

        // Log successful registration
        logger.info(`New user registered: ${email}`);

        res.json({ message: 'Signup successful!' });
      });
    });
  } catch (error) {
    logger.error('Error during signup:', error);
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});