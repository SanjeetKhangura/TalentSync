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


app.delete('/admin/jobs/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    await pool.query('DELETE FROM jobs WHERE JobID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Error deleting job' });
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
  if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Unauthorized' });

  try {
    await pool.query('DELETE FROM notifications WHERE NotificationID = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Error deleting notification' });
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

// =============================================
// REPORT GENERATION ROUTES
// =============================================

// 1. Monthly Report Implementation
async function generateMonthlyReport(startDate, endDate) {
  const [metrics] = await pool.query(`
      SELECT 
          COUNT(*) as totalApplications,
          SUM(CASE WHEN Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          SUM(CASE WHEN Status = 'Next Step' THEN 1 ELSE 0 END) as shortlisted,
          SUM(CASE WHEN Status = 'Screened Out' THEN 1 ELSE 0 END) as screenedOut,
          SUM(CASE WHEN a.Status = 'Hired' THEN j.SalaryRange ELSE 0 END) as totalSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationDate BETWEEN ? AND ?
  `, [startDate, endDate]);

  // 2. Get top performing jobs (unchanged)
  const [topJobs] = await pool.query(`
      SELECT 
          j.JobID,
          j.JobName,
          COUNT(a.ApplicationID) as applications,
          SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          ROUND(AVG(j.SalaryRange), 2) as avgSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY j.JobID, j.JobName
      ORDER BY applications DESC
      LIMIT 5
  `, [startDate, endDate]);

  return {
      metrics: {
          ...metrics[0],
          avgSalary: metrics[0].totalSalary / (metrics[0].hires || 1)
      },
      topJobs,
      // Remove sources from return object
      timePeriod: `${startDate} to ${endDate}`
  };
}

// 2. Yearly Report Implementation
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
          c.Name as category,
          COUNT(a.ApplicationID) as applications,
          SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          ROUND(AVG(j.SalaryRange), 2) as avgSalary
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
          SUM(CASE WHEN a.Status = 'Hired' THEN j.SalaryRange ELSE 0 END) as totalSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      WHERE a.ApplicationDate BETWEEN ? AND ?
  `, [startDate, endDate]);

  return {
      monthlyTrends,
      departmentStats,
      yearlySummary: {
          ...yearlySummary[0],
          avgSalary: yearlySummary[0].totalSalary / (yearlySummary[0].hires || 1),
          hireRate: ((yearlySummary[0].hires / yearlySummary[0].totalApplications) * 100).toFixed(1)
      },
      timePeriod: `${startDate} to ${endDate}`
  };
}

// 3. Category Analysis Implementation
async function generateCategoryReport(startDate, endDate) {
  const [categoryPerformance] = await pool.query(`
      SELECT 
          c.CategoryID,
          c.Name as category,
          COUNT(a.ApplicationID) as applications,
          SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) as hires,
          SUM(CASE WHEN a.Status = 'Next Step' THEN 1 ELSE 0 END) as shortlisted,
          ROUND((SUM(CASE WHEN a.Status = 'Hired' THEN 1 ELSE 0 END) / COUNT(a.ApplicationID) * 100, 2) as hireRate,
          ROUND(AVG(j.SalaryRange), 2) as avgSalary,
          MIN(j.SalaryRange) as minSalary,
          MAX(j.SalaryRange) as maxSalary
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.CategoryID, c.Name
      ORDER BY applications DESC
  `, [startDate, endDate]);

  const [timeToHire] = await pool.query(`
      SELECT 
          c.Name as category,
          AVG(DATEDIFF(a.StatusUpdateDate, a.ApplicationDate)) as avgDaysToHire
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.Status = 'Hired'
      AND a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.Name
  `, [startDate, endDate]);

  const [sourcesByCategory] = await pool.query(`
      SELECT 
          c.Name as category,
          a.Source,
          COUNT(*) as count
      FROM applications a
      JOIN jobs j ON a.JobID = j.JobID
      JOIN categories c ON j.CategoryID = c.CategoryID
      WHERE a.ApplicationDate BETWEEN ? AND ?
      GROUP BY c.Name, a.Source
      ORDER BY c.Name, count DESC
  `, [startDate, endDate]);

  return {
      categoryPerformance,
      timeToHire,
      sourcesByCategory,
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
// SERVER STARTUP
// =============================================

app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});