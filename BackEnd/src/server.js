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

// Enable CORS with proper configuration
app.use(cors({
  origin: 'http://localhost:52330', // Adjust if your frontend runs on a different port
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true
}));

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

// Login endpoint - Updated with proper headers
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
          const token = jwt.sign(
            { userId: user.UserID, role: user.Role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
          );

          // Set secure HTTP headers
          res.header('Access-Control-Allow-Credentials', 'true');
          res.header('Access-Control-Expose-Headers', 'Authorization');
          res.header('Authorization', `Bearer ${token}`);

          // Log successful login
          logger.info(`User ${user.Email} logged in successfully.`);

          // Return token and role to the frontend
          res.json({ 
            message: 'Login successful!', 
            token, 
            role: user.Role,
            redirect: `${user.Role.toLowerCase()}-dashboard.html`
          });
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

// Applicant Dashboard Endpoints

// Get current user (for authentication check)
app.get('/users/me', authenticateToken, (req, res) => {
  pool.query('SELECT * FROM users WHERE UserID = ?', [req.user.userId], (err, results) => {
    if (err) {
      console.error('DB Error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results.length) return res.status(404).json({ error: 'User not found' });
    
    const user = results[0];
    delete user.Password;
    res.json(user);
  });
});

// Get applicant data by user ID
app.get('/applicants/user/:userId', authenticateToken, (req, res) => {
  const userId = req.params.userId;
  
  pool.query(`
    SELECT a.*, u.Name, u.Email, u.Phone 
    FROM applicant a
    JOIN users u ON a.UserID = u.UserID
    WHERE a.UserID = ?
  `, [userId], (err, results) => {
    if (err) {
      logger.error('Error fetching applicant:', err);
      return res.status(500).json({ message: 'Error fetching applicant data' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Applicant not found' });
    }
    
    res.json(results[0]);
  });
});

// Get application stats for dashboard
app.get('/applications/stats/:applicantId', authenticateToken, (req, res) => {
  const applicantId = req.params.applicantId;
  
  const query = `
    SELECT 
      SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN Status = 'Next Step' THEN 1 ELSE 0 END) as nextStep
    FROM applications
    WHERE ApplicantID = ?
  `;
  
  pool.query(query, [applicantId], (err, results) => {
    if (err) {
      logger.error('Error fetching application stats:', err);
      return res.status(500).json({ message: 'Error fetching stats' });
    }
    
    res.json(results[0] || { pending: 0, nextStep: 0 });
  });
});

// Get recommended jobs for applicant
app.get('/jobs/recommended', authenticateToken, async (req, res) => {
  try {
    const [applicant] = await pool.promise().query(
      'SELECT PreferredJobs FROM applicant WHERE UserID = ?', 
      [req.user.userId]
    );

    // Return empty array if no preferences exist
    if (!applicant.length || !applicant[0].PreferredJobs) {
      return res.json([]);
    }

    const preferences = JSON.parse(applicant[0].PreferredJobs || '[]');
    
    // Return empty array if no matching jobs found
    if (!preferences.length) {
      return res.json([]);
    }

    const [jobs] = await pool.promise().query(
      `SELECT * FROM jobs 
       WHERE CloseDate > NOW() 
       ORDER BY PostDate DESC 
       LIMIT 10`
    );
    
    res.json(jobs || []);
    
  } catch (error) {
    console.error('Recommended jobs error:', error);
    res.json([]); // Return empty array on error
  }
});

// Get job details
app.get('/jobs/:id', authenticateToken, (req, res) => {
  const jobId = req.params.id;
  
  pool.query('SELECT * FROM jobs WHERE JobID = ?', [jobId], (err, results) => {
      if (err) {
          logger.error('Error fetching job:', err);
          return res.status(500).json({ message: 'Error fetching job details' });
      }
      
      if (results.length === 0) {
          return res.status(404).json({ message: 'Job not found' });
      }
      
      res.json(results[0]);
  });
});

// Search jobs
app.get('/jobs/search', authenticateToken, (req, res) => {
  const { search, type, location } = req.query;
  
  let query = 'SELECT * FROM jobs WHERE CloseDate > NOW()';
  const params = [];
  
  if (search) {
      query += ' AND (PositionType LIKE ? OR Description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
  }
  
  if (type) {
      query += ' AND PositionType = ?';
      params.push(type);
  }
  
  if (location) {
      query += ' AND Location LIKE ?';
      params.push(`%${location}%`);
  }
  
  query += ' ORDER BY PostDate DESC LIMIT 20';
  
  pool.query(query, params, (err, results) => {
      if (err) {
          logger.error('Error searching jobs:', err);
          return res.status(500).json({ message: 'Error searching jobs' });
      }
      
      res.json(results);
  });
});

// Get applications for applicant
app.get('/applications/applicant/:applicantId', authenticateToken, (req, res) => {
  const applicantId = req.params.applicantId;
  
  const query = `
      SELECT a.*, j.PositionType as JobTitle, j.Location, j.PositionType
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicantID = ?
      ORDER BY a.ApplicationDate DESC
  `;
  
  pool.query(query, [applicantId], (err, results) => {
      if (err) {
          logger.error('Error fetching applications:', err);
          return res.status(500).json({ message: 'Error fetching applications' });
      }
      
      res.json(results);
  });
});

// Middleware to authenticate JWT token - Updated
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Add OPTIONS handler for preflight requests
app.options('*', cors());

// Start the server
app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});