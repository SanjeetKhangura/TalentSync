// Load environment variables
require('dotenv').config(); 
// Import Express module
const express = require('express');
// For parsing request body
const bodyParser = require('body-parser');
// For handling CORS
const cors = require('cors');
// For MySQL database
const mysql = require('mysql2');
// For handling file uploads
const multer = require('multer');
// For password hashing
const bcrypt = require('bcrypt'); 
// For session management
const jwt = require('jsonwebtoken');
// For logging
const winston = require('winston');

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

// Set up multer for file uploads
const storage = multer.memoryStorage();
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
  const { 
    name, 
    email, 
    phone, 
    password, 
    confirmPassword,
    dob,
    education,
    workExperience,
    preferredJobs
  } = req.body;
  
  const image = req.file ? req.file.buffer : null;
  const role = 'Applicant'; // Hardcoded

  // Validate inputs
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  // validate password match
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await pool.promise().getConnection();
    
    try {
      await connection.beginTransaction();

      // 1. Check for existing user
      const [existingUsers] = await connection.query(
        'SELECT * FROM users WHERE email = ? OR phone = ?',
        [email, phone]
      );

      if (existingUsers.length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Email or phone already exists.' });
      }

      // 2. Insert into users table
      const [userResult] = await connection.query(
        `INSERT INTO users (Name, Email, Phone, Role, Image, Password)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, phone, role, image, hashedPassword]
      );

      const newUserId = userResult.insertId;

      // 3. Insert into applicant table
      await connection.query(
        `INSERT INTO applicant 
        (UserID, DateOfBirth, Education, WorkExperience, PreferredJobs)
         VALUES (?, ?, ?, ?, ?)`,
        [newUserId, dob, education, workExperience, preferredJobs]
      );

      await connection.commit();
      res.json({ 
        message: 'Signup successful!',
        userId: newUserId
      });

    } catch (err) {
      await connection.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Duplicate entry detected.' });
      }
      logger.error('Transaction error:', err);
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({ message: 'An error occurred during signup.' });
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});