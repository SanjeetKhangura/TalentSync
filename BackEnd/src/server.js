// =============================================
// CONFIGURATION & INITIALIZATION
// =============================================

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Logger Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Middleware Setup
app.use(cors({
  origin: 'http://localhost:52330',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true
}));

app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File Upload Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Database Configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test Database Connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('Successfully connected to MySQL database!');
  } catch (err) {
    logger.error('Error connecting to MySQL:', err);
    process.exit(1);
  }
}
testConnection();

// =============================================
// UTILITY FUNCTIONS
// =============================================

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function getUserByEmail(email) {
  try {
    const [results] = await pool.query(
      'SELECT * FROM users WHERE Email = ?', 
      [email]
    );
    return results[0];
  } catch (err) {
    logger.error('Database error in getUserByEmail:', err);
    throw err;
  }
}

async function getRoleData(user) {
  if (user.Role === 'Applicant') {
    const [applicant] = await pool.query(
      'SELECT ApplicantID FROM applicant WHERE UserID = ?',
      [user.UserID]
    );
    return { applicantId: applicant[0]?.ApplicantID };
  }
  if (user.Role === 'HR') {
    const [hr] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [user.UserID]
    );
    return { hrId: hr[0]?.HRID };
  }
  if (user.Role === 'Admin') {
    const [admin] = await pool.query(
      'SELECT AdminID FROM admin WHERE UserID = ?',
      [user.UserID]
    );
    return { adminId: admin[0]?.AdminID };
  }
  return {};
}

function generateToken(user, roleData) {
  return jwt.sign(
    { userId: user.UserID, role: user.Role, ...roleData },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function setAuthHeaders(res, token) {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Authorization');
  res.header('Authorization', `Bearer ${token}`);
}

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

function authenticateToken(req, res, next) {
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  
  const cookieToken = req.cookies?.token;
  
  
  const authToken = token || cookieToken;

  if (!authToken) {
    return res.status(401).json({ message: 'Authentication token missing' });
  }

  
  jwt.verify(authToken, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    
    req.user = {
      userId: user.userId,      
      role: user.role,         
      ...(user.applicantId && { applicantId: user.applicantId }),
      ...(user.hrId && { hrId: user.hrId }),
      ...(user.adminId && { adminId: user.adminId })
    };
    
    next();
  });
}

// =============================================
// AUTHENTICATION ROUTES
// =============================================

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const user = await getUserByEmail(email).catch(err => {
      logger.error('Login database error:', err);
      throw new Error('Database error during login');
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.Password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const roleData = await getRoleData(user);
    const token = generateToken(user, roleData);

    setAuthHeaders(res, token);
    res.json({
      message: 'Login successful!',
      token,
      role: user.Role,
      redirect: `${user.Role.toLowerCase()}-dashboard.html`
    });

  } catch (error) {
    logger.error('Login process error:', error);
    res.status(500).json({ 
      message: 'An error occurred during login',
      error: error.message 
    });
  }
});

app.post('/signup', upload.single('image'), async (req, res) => {
  const { 
    name, 
    email, 
    phone, 
    password, 
    confirmPassword,
    dob,
    education,
    workExperience
  } = req.body;
  
  const image = req.file ? req.file.buffer : null;
  const role = 'Applicant';

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const [existingUsers] = await connection.query(
        'SELECT * FROM users WHERE email = ? OR phone = ?',
        [email, phone]
      );

      if (existingUsers.length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Email or phone already exists.' });
      }

      // Insert into users table
      const [userResult] = await connection.query(
        `INSERT INTO users (Name, Email, Phone, Role, Image, Password)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, phone, role, image, hashedPassword]
      );

      const newUserId = userResult.insertId;

      // Insert into applicant table
      const [applicantResult] = await connection.query(
        `INSERT INTO applicant 
        (UserID, DateOfBirth, Education, WorkExperience)
         VALUES (?, ?, ?, ?)`,
        [newUserId, dob, education, workExperience]
      );

      const newApplicantId = applicantResult.insertId;

      await connection.commit();
      
      // Generate token for immediate login
      const tokenPayload = {
        userId: newUserId,
        role: role,
        applicantId: newApplicantId
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.json({ 
        message: 'Signup successful!',
        token,
        role,
        redirect: 'applicant-dashboard.html'
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

// =============================================
// USER PROFILE ROUTES
// =============================================

app.get('/users/me', authenticateToken, async (req, res) => {
  try {
    // 1. Original query remains unchanged
    const [results] = await pool.query(
      'SELECT UserID, Name, Email, Phone, Role, Image FROM users WHERE UserID = ?',
      [req.user.userId]
    );

    if (!results.length) return res.status(404).json({ error: 'User not found' });

    const user = results[0];
    
    // 2. Add admin data without modifying original structure
    if (user.Role === 'Admin') {
      const [adminData] = await pool.query(
        'SELECT AdminID FROM admin WHERE UserID = ?',
        [user.UserID]
      );
      user.AdminID = adminData[0]?.AdminID;
    }

    // 3. Maintain original image handling
    if (user.Image) {
      user.Image = user.Image.toString('base64');
    }

    // 4. Return BOTH formats for compatibility
    res.json({
      // Original exact fields (PascalCase)
      ...user,
      // New camelCase fields
      userId: user.UserID,
      name: user.Name,
      email: user.Email,
      phone: user.Phone,
      role: user.Role,
      image: user.Image,
      // Optional admin field
      ...(user.AdminID && { adminId: user.AdminID })
    });

  } catch (err) {
    console.error('DB Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/users/:userId/profile', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (req.user.userId != userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { name, phone } = req.body;
    const image = req.file ? req.file.buffer : null;

    const updates = [];
    const params = [];

    if (name) {
      updates.push('Name = ?');
      params.push(name);
    }
    if (phone) {
      updates.push('Phone = ?');
      params.push(phone);
    }
    if (image) {
      updates.push('Image = ?');
      params.push(image);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE UserID = ?`;
    params.push(userId);

    await pool.query(query, params);
    
    const [updatedUser] = await pool.query(
      'SELECT UserID, Name, Email, Phone, Role, Image FROM users WHERE UserID = ?',
      [userId]
    );
    
    const user = updatedUser[0];
    if (user.Image) {
      user.Image = user.Image.toString('base64');
    }
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user 
    });
    
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

app.put('/users/:userId/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { currentPassword, newPassword } = req.body;

    if (req.user.userId != userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const [results] = await pool.query(
      'SELECT Password FROM users WHERE UserID = ?',
      [userId]
    );

    if (!results.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, results[0].Password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET Password = ? WHERE UserID = ?',
      [hashedPassword, userId]
    );

    res.json({ success: true, message: 'Password updated successfully' });
    
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// =============================================
// APPLICANT DATA ROUTES
// =============================================

app.get('/applicants/user/:userId', authenticateToken, async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT a.*, u.Name, u.Email, u.Phone 
      FROM applicant a
      JOIN users u ON a.UserID = u.UserID
      WHERE a.UserID = ?
    `, [req.params.userId]);

    if (!results.length) {
      return res.status(404).json({ message: 'Applicant not found' });
    }

    const [prefResults] = await pool.query(`
      SELECT JobField, JobType, Location, Salary 
      FROM preferred_jobs 
      WHERE ApplicantID = ?
    `, [results[0].ApplicantID]);

    res.json({
      ...results[0],
      preferences: prefResults
    });
  } catch (err) {
    logger.error('Error fetching applicant:', err);
    res.status(500).json({ message: 'Error fetching applicant data' });
  }
});

app.get('/applications/stats/:applicantId', authenticateToken, async (req, res) => {
  try {
    const { applicantId } = req.params;
    
    const [results] = await pool.query(`
      SELECT 
        SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN Status = 'Next Step' THEN 1 ELSE 0 END) as nextStep
      FROM applications
      WHERE ApplicantID = ?
    `, [applicantId]);

    res.json(results[0] || { pending: 0, nextStep: 0 });
  } catch (error) {
    logger.error('Error fetching application stats:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// =============================================
// JOB ROUTES
// =============================================

app.get('/jobs/recommended', authenticateToken, async (req, res) => {
  try {
    const [applicant] = await pool.query(
      `SELECT a.ApplicantID 
       FROM applicant a 
       WHERE a.UserID = ?`, 
      [req.user.userId]
    );

    if (!applicant.length) return res.json([]);

    const [preferences] = await pool.query(
      `SELECT JobField, JobType, Location 
       FROM preferred_jobs 
       WHERE ApplicantID = ?`,
      [applicant[0].ApplicantID]
    );

    if (!preferences.length) return res.json([]);

    let whereClauses = [];
    let queryParams = [];
    
    preferences.forEach(pref => {
      whereClauses.push('(PositionType LIKE ? OR Description LIKE ?)');
      queryParams.push(`%${pref.JobField}%`, `%${pref.JobField}%`);
      
      if (pref.JobType) {
        whereClauses.push('PositionType = ?');
        queryParams.push(pref.JobType);
      }
      
      if (pref.Location) {
        whereClauses.push('Location LIKE ?');
        queryParams.push(`%${pref.Location}%`);
      }
    });

    const whereClause = whereClauses.length > 0 ? 
      `WHERE (${whereClauses.join(' OR ')}) AND CloseDate > NOW()` : 
      'WHERE CloseDate > NOW()';

    const [jobs] = await pool.query(
      `SELECT * FROM jobs 
       ${whereClause}
       ORDER BY CloseDate DESC
       LIMIT 10`,
      queryParams
    );
    
    res.json(jobs || []);
  } catch (error) {
    console.error('Recommended jobs error:', error);
    res.status(500).json({ message: 'Error getting recommended jobs' });
  }
});

app.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const [jobs] = await pool.query(
      'SELECT * FROM jobs WHERE CloseDate > NOW() ORDER BY CloseDate DESC'
    );
    res.json(jobs);
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'Error fetching jobs' });
  }
});

app.get('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const [job] = await pool.query('SELECT * FROM jobs WHERE JobID = ?', [req.params.id]);
    
    if (!job.length) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.json(job[0]);
  } catch (error) {
    logger.error('Error fetching job:', error);
    res.status(500).json({ message: 'Error fetching job details' });
  }
});

app.get('/jobs/search', authenticateToken, async (req, res) => {
  try {
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
    
    query += ' ORDER BY CloseDate DESC LIMIT 20';
    
    const [results] = await pool.query(query, params);
    res.json(results);
    
  } catch (error) {
    logger.error('Error searching jobs:', error);
    res.status(500).json({ message: 'Error searching jobs' });
  }
});

// =============================================
// APPLICATION ROUTES
// =============================================

app.post('/applications', authenticateToken, resumeUpload.single('resume'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { jobId } = req.body;
    const applicantId = req.user.applicantId;
    
    if (!jobId || !applicantId) {
      await connection.rollback();
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [existing] = await connection.query(
      'SELECT * FROM applications WHERE JobID = ? AND ApplicantID = ? FOR UPDATE',
      [jobId, applicantId]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'You have already applied for this job' });
    }

    const resume = req.file;
    if (!resume) {
      await connection.rollback();
      return res.status(400).json({ message: 'Resume file is required' });
    }

    const resumeBase64 = resume.buffer.toString('base64');

    // Insert the application
    await connection.query(
      `INSERT INTO applications 
       (JobID, ApplicantID, ApplicationDate, Status, ChangeStatus, Resume)
       VALUES (?, ?, NOW(), 'Pending', 'Application Submitted', ?)`,
      [jobId, applicantId, resumeBase64]
    );

    await connection.commit();
    res.json({ 
      success: true, 
      message: 'Application submitted successfully' 
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error('Error submitting application:', error);
    res.status(500).json({ message: 'Error submitting application' });
  } finally {
    connection.release();
  }
});

app.get('/my-applications', authenticateToken, async (req, res) => {
  try {
    const applicantId = req.user.applicantId;
    const statusFilter = req.query.status;
    
    let query = `
      SELECT a.ApplicationID, a.Status, a.ChangeStatus, a.ApplicationDate,
             j.JobName, j.PositionType, j.Location, j.SalaryRange, j.Description
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicantID = ?
    `;
    
    const params = [applicantId];
    
    if (statusFilter && statusFilter !== 'All') {
      query += ' AND a.Status = ?';
      params.push(statusFilter);
    }
    
    query += ' ORDER BY a.ApplicationDate DESC';
    
    const [applications] = await pool.query(query, params);
    
    res.json(applications);
  } catch (error) {
    logger.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

app.get('/applications/:id', authenticateToken, async (req, res) => {
  try {
    const [application] = await pool.query(`
      SELECT a.*, j.JobName, j.PositionType, j.Location, j.SalaryRange, j.Description
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationID = ?
    `, [req.params.id]);

    if (!application.length) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application[0].ApplicantID !== req.user.applicantId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json(application[0]);
  } catch (error) {
    logger.error('Error fetching application:', error);
    res.status(500).json({ message: 'Error fetching application details' });
  }
});

app.get('/applications/:id/resume', authenticateToken, async (req, res) => {
  try {
    const [application] = await pool.query(
      'SELECT Resume FROM applications WHERE ApplicationID = ? AND ApplicantID = ?',
      [req.params.id, req.user.applicantId]
    );

    if (!application.length) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const pdfBuffer = Buffer.from(application[0].Resume, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
    
  } catch (error) {
    logger.error('Error fetching resume:', error);
    res.status(500).json({ message: 'Error fetching resume' });
  }
});

// =============================================
// PREFERENCE ROUTES
// =============================================

app.get('/applicants/:applicantId/preferences', authenticateToken, async (req, res) => {
  try {
    const { applicantId } = req.params;
    
    const [applicant] = await pool.query(
      'SELECT UserID FROM applicant WHERE ApplicantID = ?',
      [applicantId]
    );
    
    if (!applicant.length || applicant[0].UserID !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const [preferences] = await pool.query(
      `SELECT PreferredJobID as id, JobField, JobType, Location, Salary 
       FROM preferred_jobs 
       WHERE ApplicantID = ?`,
      [applicantId]
    );

    res.json(preferences);
  } catch (error) {
    logger.error('Error getting preferences:', error);
    res.status(500).json({ message: 'Error getting preferences' });
  }
});

app.put('/applicants/:applicantId/preferences', authenticateToken, async (req, res) => {
  try {
    const { preference } = req.body;
    const applicantId = req.params.applicantId;

    const [applicant] = await pool.query(
      'SELECT UserID FROM applicant WHERE ApplicantID = ?',
      [applicantId]
    );

    if (!applicant.length) {
      return res.status(404).json({ message: 'Applicant not found' });
    }

    if (applicant[0].UserID !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const [currentPrefs] = await pool.query(
      'SELECT COUNT(*) as count FROM preferred_jobs WHERE ApplicantID = ?',
      [applicantId]
    );

    if (currentPrefs[0].count >= 3) {
      return res.status(400).json({ 
        success: false,
        message: 'Preference limit reached (max 3)'
      });
    }

    if (!preference || !preference.jobField) {
      return res.status(400).json({ 
        success: false,
        message: 'Job field is required'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.query(
        `INSERT INTO preferred_jobs
        (ApplicantID, JobField, JobType, Location, Salary)
        VALUES (?, ?, ?, ?, ?)`,
        [
          applicantId,
          preference.jobField.trim(),
          preference.jobType || null,
          preference.location ? preference.location.trim() : null,
          Number(preference.salary) || 0
        ]
      );

      await connection.commit();
      res.json({ 
        success: true,
        message: 'Preference added successfully' 
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error adding preference:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error adding preference'
    });
  }
});

app.delete('/applicants/:applicantId/preferences/:prefId', authenticateToken, async (req, res) => {
  try {
    const { applicantId, prefId } = req.params;

    const [applicant] = await pool.query(
      'SELECT UserID FROM applicant WHERE ApplicantID = ?',
      [applicantId]
    );

    if (!applicant.length || applicant[0].UserID !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await pool.query(
      'DELETE FROM preferred_jobs WHERE ApplicantID = ? AND PreferredJobID = ?',
      [applicantId, prefId]
    );

    res.json({ success: true, message: 'Preference deleted successfully' });
  } catch (error) {
    logger.error('Error deleting preference:', error);
    res.status(500).json({ message: 'Error deleting preference' });
  }
});

// =============================================
// ADMIN ROUTES
// =============================================

// Updated Jobs Endpoint
app.get('/admin/jobs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [jobs] = await pool.query(`
      SELECT 
        j.*,
        u.Name AS PostedByName,
        c.Name AS CategoryName
      FROM jobs j
      JOIN users u ON j.PostedBy = u.UserID
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      ORDER BY j.CloseDate DESC
    `);
    
    res.json({
      success: true,
      jobs
    });
    
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/admin/jobs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  const { 
    JobName = '',
    PositionType = 'Full-time',
    CategoryID = null,
    Location = '',
    MinEducation = null,
    MinExperience = null,
    Description = '',
    SalaryRange = null,
    CloseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  } = req.body;

  // Validation
  const errors = [];
  if (!JobName.trim()) errors.push('JobName is required');
  if (!Location.trim()) errors.push('Location is required');
  if (!['Full-time', 'Part-time', 'Contract', 'Internship'].includes(PositionType)) {
    errors.push('Invalid PositionType');
  }
  if (new Date(CloseDate) < new Date()) errors.push('CloseDate must be in the future');

  if (errors.length > 0) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      
      const [result] = await connection.query(
        `INSERT INTO jobs 
         (JobName, PositionType, CategoryID, Location, 
          MinEducation, MinExperience, Description, 
          SalaryRange, CloseDate, PostedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          JobName, 
          PositionType, 
          CategoryID,
          Location,
          MinEducation,
          MinExperience,
          Description,
          SalaryRange,
          CloseDate,
          req.user.userId
        ]
      );

      const [newJob] = await connection.query(`
        SELECT 
          j.*,
          u.Name AS PostedByName,
          c.Name AS CategoryName
        FROM jobs j
        JOIN users u ON j.PostedBy = u.UserID
        LEFT JOIN categories c ON j.CategoryID = c.CategoryID
        WHERE j.JobID = ?
      `, [result.insertId]);

      await connection.commit();

      res.status(201).json({ 
        success: true,
        message: 'Job created successfully',
        job: newJob[0]
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error creating job:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Category Management
app.get('/admin/categories', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
      const [categories] = await pool.query('SELECT * FROM categories');
      res.json({ 
          success: true,
          categories 
      });
  } catch (error) {
      logger.error('Database error:', error);
      res.status(500).json({ 
          success: false,
          message: 'Failed to load categories',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});

app.post('/admin/categories', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  const { Name } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO categories (Name) VALUES (?)',
      [Name]
    );
    
    res.json({ success: true, categoryId: result.insertId });
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category' });
  }
});

app.put('/admin/categories/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  const { Name } = req.body;
  
  try {
    await pool.query(
      'UPDATE categories SET Name = ? WHERE CategoryID = ?',
      [Name, req.params.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
});

// HR Staff Management
app.get('/admin/hr-staff', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [staff] = await pool.query(`
      SELECT hs.HRID, u.UserID, u.Name, u.Email, u.Phone, hs.WorkingID 
      FROM hr_staff hs
      JOIN users u ON hs.UserID = u.UserID
    `);
    res.json(staff);
  } catch (error) {
    logger.error('Error fetching HR staff:', error);
    res.status(500).json({ message: 'Error fetching HR staff' });
  }
});

app.post('/admin/hr-staff', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  const { Name, Email, Phone, Password, WorkingID } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(Password, 10);
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const [userResult] = await connection.query(
        `INSERT INTO users (Name, Email, Phone, Role, Password)
         VALUES (?, ?, ?, 'HR', ?)`,
        [Name, Email, Phone, hashedPassword]
      );

      const newUserId = userResult.insertId;

      await connection.query(
        `INSERT INTO hr_staff (UserID, WorkingID)
         VALUES (?, ?)`,
        [newUserId, WorkingID]
      );

      await connection.commit();
      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('Error creating HR staff:', error);
    res.status(500).json({ message: 'Error creating HR staff' });
  }
});

app.delete('/admin/hr-staff/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [hrStaff] = await connection.query(
      'SELECT UserID FROM hr_staff WHERE HRID = ?',
      [req.params.id]
    );

    if (!hrStaff.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'HR staff not found' });
    }

    await connection.query(
      'DELETE FROM hr_staff WHERE HRID = ?',
      [req.params.id]
    );

    await connection.query(
      'DELETE FROM users WHERE UserID = ?',
      [hrStaff[0].UserID]
    );

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    logger.error('Error deleting HR staff:', error);
    res.status(500).json({ message: 'Error deleting HR staff' });
  } finally {
    if (connection) connection.release();
  }
});

// Notifications
app.get('/admin/notifications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [notifications] = await pool.query(`
      SELECT n.*, u.Name as UserName 
      FROM notifications n
      JOIN users u ON n.UserID = u.UserID
      ORDER BY n.SendDate DESC
    `);
    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

app.post('/admin/notifications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  const { UserID, Message } = req.body;
  
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (UserID, Message, SendDate)
       VALUES (?, ?, NOW())`,
      [UserID, Message]
    );
    
    res.json({ success: true, notificationId: result.insertId });
  } catch (error) {
    logger.error('Error creating notification:', error);
    res.status(500).json({ message: 'Error creating notification' });
  }
});

app.delete('/admin/notifications/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
          success: false,
          message: 'Unauthorized' 
      });
  }

  try {
      const [result] = await pool.query(
          'DELETE FROM notifications WHERE NotificationID = ?',
          [req.params.id]
      );

      if (result.affectedRows === 0) {
          return res.status(404).json({
              success: false,
              message: 'Notification not found'
          });
      }

      res.json({ 
          success: true,
          message: 'Notification deleted successfully'
      });
  } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
          success: false,
          message: 'Error deleting notification',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});

// Categories Endpoint
app.get('/admin/categories', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [categories] = await pool.query('SELECT * FROM categories');
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching categories'
    });
  }
});

// HR Staff Endpoint
app.get('/admin/hr-staff', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [staff] = await pool.query(`
      SELECT 
        hs.HRID,
        u.UserID,
        u.Name,
        u.Email,
        u.Phone,
        hs.WorkingID
      FROM hr_staff hs
      JOIN users u ON hs.UserID = u.UserID
    `);
    res.json({
      success: true,
      staff
    });
  } catch (error) {
    logger.error('Error fetching HR staff:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching HR staff'
    });
  }
});

// Notifications Endpoint
app.get('/admin/notifications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [notifications] = await pool.query(`
      SELECT 
        n.*,
        u.Name AS UserName
      FROM notifications n
      JOIN users u ON n.UserID = u.UserID
      ORDER BY n.SendDate DESC
    `);
    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching notifications'
    });
  }
});

// Get jobs in a specific category
app.get('/admin/categories/:id/jobs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  try {
    const [jobs] = await pool.query(`
      SELECT j.* FROM jobs j
      WHERE j.CategoryID = ?
      ORDER BY j.CloseDate DESC
    `, [req.params.id]);
    
    res.json(jobs);
  } catch (error) {
    logger.error('Error fetching category jobs:', error);
    res.status(500).json({ message: 'Error fetching category jobs' });
  }
});

// Assign job to category
app.put('/admin/jobs/:id/category', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  const { CategoryID } = req.body;
  
  try {
    await pool.query(
      'UPDATE jobs SET CategoryID = ? WHERE JobID = ?',
      [CategoryID, req.params.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating job category:', error);
    res.status(500).json({ message: 'Error updating job category' });
  }
});

// Delete category
app.delete('/admin/categories/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
          success: false,
          message: 'Unauthorized' 
      });
  }

  const connection = await pool.getConnection();
  try {
      await connection.beginTransaction();

      // 1. First update all jobs in this category to set category to NULL
      const [updateResult] = await connection.query(
          'UPDATE jobs SET CategoryID = NULL WHERE CategoryID = ?',
          [req.params.id]
      );

      // 2. Then delete the category
      const [deleteResult] = await connection.query(
          'DELETE FROM categories WHERE CategoryID = ?',
          [req.params.id]
      );

      if (deleteResult.affectedRows === 0) {
          await connection.rollback();
          return res.status(404).json({ 
              success: false,
              message: 'Category not found' 
          });
      }

      await connection.commit();
      res.json({ 
          success: true,
          message: `Category deleted and ${updateResult.affectedRows} job(s) were unassigned`,
          jobsAffected: updateResult.affectedRows
      });
  } catch (error) {
      await connection.rollback();
      console.error('Error deleting category:', error);
      
      res.status(500).json({ 
          success: false,
          message: 'Error deleting category',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  } finally {
      connection.release();
  }
});

// =============================================
// REPORT GENERATION ROUTES
// =============================================

// Update the generateMonthlyReport function
async function generateMonthlyReport(startDate, endDate) {
  const [metrics] = await pool.query(`
      SELECT 
          COUNT(*) as totalApplications,
          SUM(CASE WHEN Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          SUM(CASE WHEN Status = 'Next Step' THEN 1 ELSE 0 END) as shortlisted,
          SUM(CASE WHEN Status = 'Screened Out' THEN 1 ELSE 0 END) as screenedOut,
          IFNULL(SUM(CASE WHEN a.Status = 'Hired' THEN j.SalaryRange ELSE 0 END), 0) as totalSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationDate BETWEEN ? AND ?
  `, [startDate, endDate]);

  const [topJobs] = await pool.query(`
      SELECT 
          j.JobID,
          j.JobName,
          COUNT(a.ApplicationID) as applications,
          SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          IFNULL(ROUND(AVG(j.SalaryRange), 2), 0) as avgSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY j.JobID, j.JobName
      ORDER BY applications DESC
      LIMIT 5
  `, [startDate, endDate]);

  return {
      metrics: {
          totalApplications: Number(metrics[0].totalApplications) || 0,
          hires: Number(metrics[0].hires) || 0,
          shortlisted: Number(metrics[0].shortlisted) || 0,
          screenedOut: Number(metrics[0].screenedOut) || 0,
          totalSalary: Number(metrics[0].totalSalary) || 0,
          avgSalary: metrics[0].hires > 0 ? 
              (metrics[0].totalSalary / metrics[0].hires) : 0
      },
      topJobs: topJobs.map(job => ({
          ...job,
          applications: Number(job.applications) || 0,
          hires: Number(job.hires) || 0,
          avgSalary: Number(job.avgSalary) || 0
      })),
      timePeriod: `${startDate} to ${endDate}`
  };
}

// Update the generateYearlyReport function
async function generateYearlyReport(startDate, endDate) {
  const [monthlyTrends] = await pool.query(`
      SELECT 
          DATE_FORMAT(ApplicationDate, '%Y-%m') as month,
          COUNT(*) as applications,
          SUM(CASE WHEN Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          SUM(CASE WHEN Status = 'Next Step' THEN 1 ELSE 0 END) as shortlisted
      FROM applications
      WHERE ApplicationDate BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(ApplicationDate, '%Y-%m')
      ORDER BY month ASC
  `, [startDate, endDate]);

  const [departmentStats] = await pool.query(`
      SELECT 
          IFNULL(c.Name, 'Uncategorized') as category,
          COUNT(a.ApplicationID) as applications,
          SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          IFNULL(ROUND(AVG(j.SalaryRange), 2), 0) as avgSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.Name
      ORDER BY applications DESC
  `, [startDate, endDate]);

  const [yearlySummary] = await pool.query(`
      SELECT 
          COUNT(*) as totalApplications,
          SUM(CASE WHEN Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          SUM(CASE WHEN Status = 'Next Step' THEN 1 ELSE 0 END) as shortlisted,
          IFNULL(SUM(CASE WHEN a.Status = 'Hired' THEN j.SalaryRange ELSE 0 END), 0) as totalSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationDate BETWEEN ? AND ?
  `, [startDate, endDate]);

  return {
      monthlyTrends: monthlyTrends.map(month => ({
          ...month,
          applications: Number(month.applications) || 0,
          hires: Number(month.hires) || 0,
          shortlisted: Number(month.shortlisted) || 0
      })),
      departmentStats: departmentStats.map(dept => ({
          ...dept,
          applications: Number(dept.applications) || 0,
          hires: Number(dept.hires) || 0,
          avgSalary: Number(dept.avgSalary) || 0
      })),
      yearlySummary: {
          totalApplications: Number(yearlySummary[0].totalApplications) || 0,
          hires: Number(yearlySummary[0].hires) || 0,
          shortlisted: Number(yearlySummary[0].shortlisted) || 0,
          totalSalary: Number(yearlySummary[0].totalSalary) || 0,
          avgSalary: yearlySummary[0].hires > 0 ? 
              (yearlySummary[0].totalSalary / yearlySummary[0].hires) : 0,
          hireRate: yearlySummary[0].totalApplications > 0 ?
              ((yearlySummary[0].hires / yearlySummary[0].totalApplications) * 100).toFixed(1) : '0.0'
      },
      timePeriod: `${startDate} to ${endDate}`
  };
}

// Update the generateCategoryReport function
async function generateCategoryReport(startDate, endDate) {
  const [categoryPerformance] = await pool.query(`
      SELECT 
          IFNULL(c.Name, 'Uncategorized') as category,
          COUNT(a.ApplicationID) as applications,
          SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          IFNULL(ROUND((SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) / 
                 COUNT(a.ApplicationID)) * 100, 2), 0) as hireRate,
          IFNULL(ROUND(AVG(j.SalaryRange), 2), 0) as avgSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.Name
      ORDER BY applications DESC
  `, [startDate, endDate]);

  const [timeToHire] = await pool.query(`
      SELECT 
          IFNULL(c.Name, 'Uncategorized') as category,
          IFNULL(AVG(DATEDIFF(a.StatusUpdateDate, a.ApplicationDate)), 0) as avgDaysToHire
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.Status = 'Hired'
      AND a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.Name
  `, [startDate, endDate]);

  const [sourcesByCategory] = await pool.query(`
      SELECT 
          IFNULL(c.Name, 'Uncategorized') as category,
          IFNULL(a.Source, 'Unknown') as Source,
          COUNT(*) as count
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.Name, a.Source
      ORDER BY c.Name, count DESC
  `, [startDate, endDate]);

  return {
      categoryPerformance: categoryPerformance.map(cat => ({
          ...cat,
          applications: Number(cat.applications) || 0,
          hires: Number(cat.hires) || 0,
          hireRate: Number(cat.hireRate) || 0,
          avgSalary: Number(cat.avgSalary) || 0
      })),
      timeToHire: timeToHire.map(item => ({
          ...item,
          avgDaysToHire: Number(item.avgDaysToHire) || 0
      })),
      sourcesByCategory: sourcesByCategory.map(source => ({
          ...source,
          count: Number(source.count) || 0
      })),
      timePeriod: `${startDate} to ${endDate}`
  };
}

// Report Generation Endpoint
app.post('/admin/reports', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
  }

  const { reportType, startDate, endDate } = req.body;

  // Validate inputs
  if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ 
          success: false,
          message: 'Invalid date range provided' 
      });
  }

  const validReportTypes = ['monthly', 'yearly', 'category'];
  if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({ 
          success: false,
          message: 'Invalid report type specified' 
      });
  }

  try {
      let reportData;
      
      switch (reportType) {
          case 'monthly':
              reportData = await generateMonthlyReport(startDate, endDate);
              break;
          case 'yearly':
              reportData = await generateYearlyReport(startDate, endDate);
              break;
          case 'category':
              reportData = await generateCategoryReport(startDate, endDate);
              break;
      }

      // Add metadata
      reportData.generatedAt = new Date().toISOString();
      reportData.generatedBy = req.user.userId;

      res.json({
          success: true,
          reportType,
          startDate,
          endDate,
          data: reportData
      });

  } catch (error) {
      logger.error('Error generating report:', error);
      res.status(500).json({ 
          success: false,
          message: 'Error generating report',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});

// =============================================
// HR-SPECIFIC ROUTES
// =============================================

// Get HR profile with working ID
app.get('/hr/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    const [hrProfile] = await pool.query(`
      SELECT u.*, hs.WorkingID 
      FROM users u
      JOIN hr_staff hs ON u.UserID = hs.UserID
      WHERE u.UserID = ?
    `, [req.user.userId]);

    if (!hrProfile.length) return res.status(404).json({ message: 'HR profile not found' });
    
    const profile = hrProfile[0];
    if (profile.Image) {
      profile.Image = profile.Image.toString('base64');
    }
    
    res.json(profile);
  } catch (error) {
    logger.error('Error fetching HR profile:', error);
    res.status(500).json({ message: 'Error fetching HR profile' });
  }
});

// Get jobs posted by this HR
app.get('/hr/jobs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // First get the HRID for this user
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );
    
    if (!hrStaff.length) {
      return res.status(403).json({ message: 'HR staff record not found' });
    }
    
    const hrid = hrStaff[0].HRID;

    const [jobs] = await pool.query(`
      SELECT j.*, c.Name as CategoryName 
      FROM jobs j
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE j.PostedBy = ?
      ORDER BY j.CloseDate DESC
    `, [hrid]); // Query using HRID
    
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching HR jobs:', error);
    res.status(500).json({ message: 'Error fetching jobs' });
  }
});

// Create new job post
app.post('/hr/jobs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // get the HRID for the current user
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );

    if (!hrStaff.length) {
      return res.status(403).json({ message: 'HR staff record not found' });
    }

    const hrid = hrStaff[0].HRID;

    const { 
      JobName, PositionType, CategoryID, Location, 
      MinEducation, MinExperience, Description, 
      ContactInfo, SalaryRange, CloseDate 
    } = req.body;

    // Validation
    const requiredFields = ['JobName', 'PositionType', 'Location', 'Description', 'ContactInfo', 'CloseDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        missingFields 
      });
    }

    const [result] = await pool.query(
      `INSERT INTO jobs 
       (JobName, PositionType, CategoryID, Location, 
        MinEducation, MinExperience, Description, 
        ContactInfo, SalaryRange, CloseDate, PostedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        JobName, 
        PositionType, 
        CategoryID || null, 
        Location,
        MinEducation,
        MinExperience,
        Description,
        ContactInfo,
        SalaryRange || null,
        CloseDate,
        hrid  // Using HRID instead of UserID
      ]
    );

    // Return the created job
    const [newJob] = await pool.query(`
      SELECT j.*, c.Name as CategoryName 
      FROM jobs j
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE j.JobID = ?
    `, [result.insertId]);

    res.status(201).json(newJob[0]);
    
  } catch (error) {
    console.error('Job creation error:', error);
    res.status(500).json({ 
      message: 'Error creating job',
      error: error.message 
    });
  }
});

// Get job details
app.get('/hr/jobs/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // First get HRID for the current user
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );
    
    if (!hrStaff.length) {
      return res.status(403).json({ message: 'HR staff record not found' });
    }
    
    const hrid = hrStaff[0].HRID;

    // Get the job, ensuring it belongs to this HR
    const [job] = await pool.query(`
      SELECT j.*, c.Name as CategoryName 
      FROM jobs j
      LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE j.JobID = ? AND j.PostedBy = ?
    `, [req.params.id, hrid]);
    
    if (!job.length) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }
    
    res.json(job[0]);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ message: 'Error fetching job details' });
  }
});

// Update job post
app.put('/hr/jobs/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // Verify HR owns this job
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );
    
    const [job] = await pool.query(
      'SELECT JobID FROM jobs WHERE JobID = ? AND PostedBy = ?',
      [req.params.id, hrStaff[0].HRID]
    );
    
    if (!job.length) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    const {
      JobName, PositionType, CategoryID, Location,
      MinEducation, MinExperience, Description,
      ContactInfo, SalaryRange, CloseDate
    } = req.body;

    await pool.query(
      `UPDATE jobs SET
        JobName = ?, PositionType = ?, CategoryID = ?,
        Location = ?, MinEducation = ?, MinExperience = ?,
        Description = ?, ContactInfo = ?, SalaryRange = ?, CloseDate = ?
       WHERE JobID = ?`,
      [
        JobName, PositionType, CategoryID,
        Location, MinEducation, MinExperience,
        Description, ContactInfo, SalaryRange, CloseDate,
        req.params.id
      ]
    );

    const [updatedJob] = await pool.query(`
      SELECT j.*, c.Name as CategoryName
      FROM jobs j LEFT JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE j.JobID = ?
    `, [req.params.id]);

    res.json(updatedJob[0]);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Error updating job' });
  }
});

// Delete job post (HR)
app.delete('/hr/jobs/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') {
      return res.status(403).json({ 
          success: false,
          message: 'Unauthorized' 
      });
  }

  const connection = await pool.getConnection();
  try {
      await connection.beginTransaction();

      // 1. First delete all applications for this job
      const [deleteAppsResult] = await connection.query(
          'DELETE FROM applications WHERE JobID = ?',
          [req.params.id]
      );

      console.log(`Deleted ${deleteAppsResult.affectedRows} applications`);

      // 2. Then delete the job
      const [deleteJobResult] = await connection.query(
          'DELETE FROM jobs WHERE JobID = ?',
          [req.params.id]
      );

      if (deleteJobResult.affectedRows === 0) {
          await connection.rollback();
          return res.status(404).json({ 
              success: false,
              message: 'Job not found' 
          });
      }

      await connection.commit();
      res.json({ 
          success: true,
          message: `Job and ${deleteAppsResult.affectedRows} associated application(s) deleted successfully`
      });
  } catch (error) {
      await connection.rollback();
      console.error('Error deleting job:', error);
      
      res.status(500).json({ 
          success: false,
          message: 'Error deleting job',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  } finally {
      connection.release();
  }
});

// Delete job post
app.delete('/admin/jobs/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ 
      success: false,
      message: 'Unauthorized' 
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. First delete all AI screening records for applications of this job
    await connection.query(`
      DELETE ai FROM ai_screening ai
      JOIN applications a ON ai.ApplicationID = a.ApplicationID
      WHERE a.JobID = ?
    `, [req.params.id]);

    // 2. Then delete all applications for this job
    const [deleteAppsResult] = await connection.query(
      'DELETE FROM applications WHERE JobID = ?',
      [req.params.id]
    );

    // 3. Finally delete the job
    const [deleteJobResult] = await connection.query(
      'DELETE FROM jobs WHERE JobID = ?',
      [req.params.id]
    );

    if (deleteJobResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Job not found' 
      });
    }

    await connection.commit();
    res.json({ 
      success: true,
      message: `Job and ${deleteAppsResult.affectedRows} associated application(s) deleted successfully`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting job:', error);
    
    let errorMessage = 'Error deleting job';
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      errorMessage = 'Cannot delete job because it has associated records.';
    }

    res.status(500).json({ 
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        message: error.message,
        sql: error.sql
      } : undefined
    });
  } finally {
    connection.release();
  }
});

// Get applications for HR's jobs
app.get('/hr/applications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // First get HRID for the current user
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );
    
    if (!hrStaff.length) {
      return res.status(403).json({ message: 'HR staff record not found' });
    }
    
    const hrid = hrStaff[0].HRID;

    // Get all jobs posted by this HR
    const [jobs] = await pool.query(
      'SELECT JobID FROM jobs WHERE PostedBy = ?',
      [hrid]
    );
    
    if (jobs.length === 0) {
      return res.json([]); // No jobs means no applications
    }
    
    const jobIds = jobs.map(job => job.JobID);
    
    // Get applications for these jobs
    const [applications] = await pool.query(`
      SELECT a.*, j.JobName, u.Name as ApplicantName
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      JOIN applicant ap ON a.ApplicantID = ap.ApplicantID
      JOIN users u ON ap.UserID = u.UserID
      WHERE a.JobID IN (?)
      ORDER BY a.ApplicationDate DESC
    `, [jobIds]);
    
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// Get application details
app.get('/hr/applications/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // Verify HR has access to this application
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );
    
    const [application] = await pool.query(`
      SELECT a.*, j.JobName, u.Name as ApplicantName, u.Email, u.Phone,
             ap.DateOfBirth, ap.Education, a.Resume
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      JOIN applicant ap ON a.ApplicantID = ap.ApplicantID
      JOIN users u ON ap.UserID = u.UserID
      WHERE a.ApplicationID = ? AND j.PostedBy = ?
    `, [req.params.id, hrStaff[0].HRID]);
    
    if (!application.length) {
      return res.status(404).json({ message: 'Application not found or unauthorized' });
    }

    // Get work experience
    const [workExperience] = await pool.query(
      'SELECT * FROM work_experience WHERE ApplicantID = ?',
      [application[0].ApplicantID]
    );

    res.json({
      ...application[0],
      workExperience
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ message: 'Error fetching application' });
  }
});

// Update application status
app.put('/hr/applications/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  const { status, changeStatus } = req.body;

  try {
      // Verify HR has permission to update this application
      const [application] = await pool.query(`
          SELECT a.ApplicationID 
          FROM applications a
          JOIN jobs j ON a.JobID = j.JobID
          JOIN hr_staff hs ON j.PostedBy = hs.HRID
          WHERE a.ApplicationID = ? AND hs.UserID = ?
      `, [req.params.id, req.user.userId]);

      if (!application.length) {
          return res.status(404).json({ message: 'Application not found or unauthorized' });
      }

      // Updated query matching your table structure
      await pool.query(
          'UPDATE applications SET Status = ?, ChangeStatus = ? WHERE ApplicationID = ?',
          [status, changeStatus || `Status changed to ${status}`, req.params.id]
      );

      // Create notification for applicant
      const [applicant] = await pool.query(`
          SELECT u.UserID 
          FROM applications a
          JOIN applicant ap ON a.ApplicantID = ap.ApplicantID
          JOIN users u ON ap.UserID = u.UserID
          WHERE a.ApplicationID = ?
      `, [req.params.id]);

      if (applicant.length) {
          await pool.query(
              `INSERT INTO notifications (UserID, Message, SendDate)
              VALUES (?, ?, NOW())`,
              [applicant[0].UserID, `Your application status has been updated to: ${status}`]
          );
      }

      res.json({ 
          success: true, 
          message: 'Application status updated',
          updatedStatus: status
      });
  } catch (error) {
      logger.error('Error updating application status:', error);
      res.status(500).json({ 
          success: false,
          message: 'Error updating application status',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});

// Get applicants for a specific job
app.get('/hr/applications/job/:jobId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // Verify HR owns this job
    const [hrStaff] = await pool.query(
      'SELECT HRID FROM hr_staff WHERE UserID = ?',
      [req.user.userId]
    );
    
    const [job] = await pool.query(
      'SELECT JobID FROM jobs WHERE JobID = ? AND PostedBy = ?',
      [req.params.jobId, hrStaff[0].HRID]
    );
    
    if (!job.length) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    const [applications] = await pool.query(`
      SELECT 
        a.ApplicationID, a.Status, a.ApplicationDate,
        u.UserID, u.Name as ApplicantName, u.Email,
        ap.DateOfBirth, ap.Education,
        we.JobTitle as PreviousJobTitle, we.EmployerName
      FROM applications a
      JOIN applicant ap ON a.ApplicantID = ap.ApplicantID
      JOIN users u ON ap.UserID = u.UserID
      LEFT JOIN work_experience we ON ap.ApplicantID = we.ApplicantID
      WHERE a.JobID = ?
      ORDER BY a.ApplicationDate DESC
    `, [req.params.jobId]);
    
    res.json(applications);
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({ message: 'Error fetching applications' });
  }
});

// Get application resume
app.get('/hr/applications/:id/resume', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    const [application] = await pool.query(`
      SELECT a.Resume 
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationID = ? AND j.PostedBy = ?
    `, [req.params.id, req.user.userId]);

    if (!application.length || !application[0].Resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    const pdfBuffer = Buffer.from(application[0].Resume, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error fetching resume:', error);
    res.status(500).json({ message: 'Error fetching resume' });
  }
});

// HR Notification Endpoints
app.get('/hr/notifications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });
  
  try {
    // Get notifications for this HR user
    const [notifications] = await pool.query(`
      SELECT * FROM notifications 
      WHERE UserID = ?
      ORDER BY SendDate DESC
      LIMIT 20
    `, [req.user.userId]);
    
    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching HR notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

app.delete('/hr/notifications/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  try {
    // Verify notification belongs to this user
    const [notification] = await pool.query(
      'SELECT * FROM notifications WHERE NotificationID = ? AND UserID = ?',
      [req.params.id, req.user.userId]
    );

    if (!notification.length) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await pool.query(
      'DELETE FROM notifications WHERE NotificationID = ?',
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

// Screening applications using AI
app.post('/hr/screening', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  const { jobId, criteria } = req.body;

  try {
    // Verify HR owns this job and get job requirements
    const [job] = await pool.query(
      `SELECT j.*, c.Name as CategoryName 
       FROM jobs j
       LEFT JOIN categories c ON j.CategoryID = c.CategoryID
       WHERE j.JobID = ? AND j.PostedBy = ?`,
      [jobId, req.user.hrId]
    );

    if (!job.length) {
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }

    // Get all applications for this job with applicant details
    const [applications] = await pool.query(`
      SELECT 
        a.*, 
        u.Name as ApplicantName, 
        u.Email,
        u.Phone,
        j.JobName,
        ap.Education,
        ap.WorkExperience,
        we.JobTitle as PreviousJobTitle,
        we.EmployerName,
        we.TimePeriod,
        we.JobDescription as WorkDescription
      FROM applications a
      JOIN applicant ap ON a.ApplicantID = ap.ApplicantID
      JOIN users u ON ap.UserID = u.UserID
      JOIN jobs j ON a.JobID = j.JobID
      LEFT JOIN work_experience we ON ap.ApplicantID = we.ApplicantID
      WHERE a.JobID = ?
    `, [jobId]);

    // Enhanced screening logic
    const screenedApplications = applications.filter(app => {
      let passes = true;
      const jobReq = job[0];
      
      // 1. Education Matching
      if (criteria.education && jobReq.MinEducation) {
        passes = passes && matchEducation(app.Education, jobReq.MinEducation);
      }
      
      // 2. Experience Matching
      if (criteria.experience && jobReq.MinExperience) {
        passes = passes && matchExperience(app.WorkExperience, jobReq.MinExperience);
      }
      
      // 3. Keyword Matching
      if (criteria.keywords && jobReq.Description) {
        passes = passes && matchKeywords(app.Resume, jobReq.Description);
      }
      
      return passes;
    });

    // Update screened applications in database
    for (const app of screenedApplications) {
      await pool.query(
        'INSERT INTO ai_screening (ApplicationID, Result) VALUES (?, "Next Step") ' +
        'ON DUPLICATE KEY UPDATE Result = "Next Step"',
        [app.ApplicationID]
      );
      
      await pool.query(
        'UPDATE applications SET Status = "Next Step" WHERE ApplicationID = ?',
        [app.ApplicationID]
      );
    }

    res.json(screenedApplications);
  } catch (error) {
    logger.error('Error running AI screening:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error running screening',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper functions for matching criteria
function matchEducation(applicantEducation, jobEducation) {
  if (!applicantEducation) return false;
  
  // Create a hierarchy of education levels
  const educationHierarchy = {
    'high school': 1,
    'associate': 2,
    'bachelor': 3,
    'master': 4,
    'phd': 5
  };
  
  // Find the highest level mentioned in job requirements
  const jobLevel = Object.keys(educationHierarchy)
    .filter(level => jobEducation.toLowerCase().includes(level))
    .map(level => educationHierarchy[level])
    .sort((a, b) => b - a)[0] || 0;
  
  // Find the highest level in applicant's education
  const applicantLevel = Object.keys(educationHierarchy)
    .filter(level => applicantEducation.toLowerCase().includes(level))
    .map(level => educationHierarchy[level])
    .sort((a, b) => b - a)[0] || 0;
  
  return applicantLevel >= jobLevel;
}

function matchExperience(workExperience, minYears) {
  if (!workExperience) return false;
  
  // Extract years of experience from work history
  const experiencePattern = /(\d+)\s*(year|yr|years)/gi;
  let totalYears = 0;
  let match;
  
  while ((match = experiencePattern.exec(workExperience)) !== null) {
    totalYears += parseInt(match[1]);
  }
  
  // Also check work_experience table if available
  if (this.WorkDescription) {
    const descMatch = this.WorkDescription.match(experiencePattern);
    if (descMatch) {
      totalYears += parseInt(descMatch[1]);
    }
  }
  
  return totalYears >= minYears;
}

function matchKeywords(resume, jobDescription) {
  if (!resume || !jobDescription) return false;
  
  try {
    const resumeText = atob(resume);
    const jobKeywords = extractKeywords(jobDescription);
    
    if (jobKeywords.length === 0) return true; // No keywords to match
    
    const matchedKeywords = jobKeywords.filter(keyword =>
      resumeText.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Require at least 50% of keywords to match
    return (matchedKeywords.length / jobKeywords.length) >= 0.5;
  } catch (e) {
    console.error('Error processing resume:', e);
    return false;
  }
}

function extractKeywords(text) {
  // Simple keyword extraction - could be enhanced with NLP
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const commonWords = new Set(['with', 'this', 'that', 'have', 'will', 'your']);
  
  return [...new Set(words)]
    .filter(word => word.length > 3 && !commonWords.has(word))
    .slice(0, 20); // Limit to top 20 keywords
}

// HR sends notification to admin
app.post('/hr/notifications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'HR') return res.status(403).json({ message: 'Unauthorized' });

  const { message, jobId } = req.body;
  
  try {
    // Get all admin users
    const [admins] = await pool.query(`
      SELECT u.UserID 
      FROM users u
      JOIN admin a ON u.UserID = a.UserID
      WHERE u.Role = 'Admin'
    `);

    if (!admins.length) {
      return res.status(404).json({ message: 'No admin users found' });
    }

    // Create notifications for all admins
    const insertPromises = admins.map(admin => 
      pool.query(
        `INSERT INTO notifications (UserID, Message, SendDate, FromUserID, JobID, IsRead)
         VALUES (?, ?, NOW(), ?, ?, 0)`,
        [admin.UserID, message, req.user.userId, jobId]
      )
    );

    await Promise.all(insertPromises);
    
    res.json({ success: true, message: 'Notification sent to admins' });
  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({ message: 'Error sending notification' });
  }
});

// Get unread notification count
app.get('/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE UserID = ? AND IsRead = 0',
      [req.user.userId]
    );
    
    res.json({ count: result[0].count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Error getting unread count' });
  }
});

// Get notifications for current user
app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await pool.query(`
      SELECT 
        n.*,
        u.Name as FromUserName,
        j.JobName
      FROM notifications n
      LEFT JOIN users u ON n.FromUserID = u.UserID
      LEFT JOIN jobs j ON n.JobID = j.JobID
      WHERE n.UserID = ?
      ORDER BY n.SendDate DESC
    `, [req.user.userId]);
    
    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Mark notification as read
app.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?',
      [req.params.id, req.user.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

// Reply to notification
app.post('/notifications/:id/reply', authenticateToken, async (req, res) => {
  const { message } = req.body;
  
  try {
    // Get original notification
    const [notification] = await pool.query(
      'SELECT * FROM notifications WHERE NotificationID = ?',
      [req.params.id]
    );

    if (!notification.length) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Create reply notification
    await pool.query(
      `INSERT INTO notifications (UserID, Message, SendDate, FromUserID, JobID, IsRead, IsReply)
       VALUES (?, ?, NOW(), ?, ?, 0, 1)`,
      [notification[0].FromUserID, message, req.user.userId, notification[0].JobID]
    );
    
    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (error) {
    logger.error('Error replying to notification:', error);
    res.status(500).json({ message: 'Error replying to notification' });
  }
});

// =============================================
// SERVER STARTUP
// =============================================

app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});