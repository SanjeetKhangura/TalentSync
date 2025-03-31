// Global Configuration
const API_BASE = 'http://localhost:3000';
let currentUser = null;
let currentApplicant = null;
let recommendedJobs = [];

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuth();
        await loadUserData();
        await loadDashboardStats();
        await loadRecommendedJobs();
        await loadCurrentPreferences();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('error', 'Failed to load dashboard');
    }
});

// Authentication Check
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        throw error;
    }
}

// Load User Data
async function loadUserData() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch user data');

        currentUser = await response.json();
        document.getElementById('navUserName').textContent = currentUser.Name || 'User';

        // Load applicant data (if exists)
        if (currentUser.UserID) {
            try {
                const applicantResponse = await fetch(`${API_BASE}/applicants/user/${currentUser.UserID}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                currentApplicant = applicantResponse.ok ? await applicantResponse.json() : null;
            } catch (e) {
                console.warn('Failed to load applicant data:', e);
                currentApplicant = null;
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showAlert('error', 'Failed to load profile data');
    }
}

// Dashboard Statistics
async function loadDashboardStats() {
    const pendingEl = document.getElementById('pendingCount');
    const nextStepEl = document.getElementById('nextStepCount');
    const recommendedEl = document.getElementById('recommendedCount');

    // Set defaults
    pendingEl.textContent = 'N/A';
    nextStepEl.textContent = 'N/A';
    recommendedEl.textContent = recommendedJobs.length || 'N/A';

    if (!currentApplicant?.ApplicantID) return;

    try {
        const response = await fetch(`${API_BASE}/applications/stats/${currentApplicant.ApplicantID}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const stats = await response.json();
            pendingEl.textContent = stats.pending || 0;
            nextStepEl.textContent = stats.nextStep || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Recommended Jobs
async function loadRecommendedJobs() {
    const container = document.getElementById('jobListingsContainer');
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const response = await fetch(`${API_BASE}/jobs/recommended`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        recommendedJobs = response.ok ? await response.json() : [];
        renderJobListings(recommendedJobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
        recommendedJobs = [];
        renderJobListings([]);
    }
}

function renderJobListings(jobs) {
    const container = document.getElementById('jobListingsContainer');
    
    if (!jobs || jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-briefcase-slash"></i>
                <p>No recommended jobs available</p>
                <small>N/A</small>
            </div>
        `;
        return;
    }

    container.innerHTML = jobs.map(job => `
        <div class="job-card" data-job-id="${job.JobID}">
            <h4>${job.PositionType || 'No title'}</h4>
            <p><i class="fas fa-map-marker-alt"></i> ${job.Location || 'Location not specified'}</p>
            <p><i class="fas fa-money-bill-wave"></i> $${job.SalaryRange || '0'}</p>
            <button class="btn btn-secondary view-job-btn">View Details</button>
        </div>
    `).join('');

    // Add event listeners
    document.querySelectorAll('.view-job-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const jobId = btn.closest('.job-card').dataset.jobId;
            viewJobDetails(jobId);
        });
    });
}

// Job Preferences
async function loadCurrentPreferences() {
    const container = document.getElementById('currentPreferencesList');
    
    try {
        container.innerHTML = '<div class="empty-state">No preferences set</div>';
        
        if (!currentApplicant?.PreferredJobs) return;
        
        // First try to parse as JSON
        let preferences;
        try {
            preferences = JSON.parse(currentApplicant.PreferredJobs);
        } catch (e) {
            // If parsing fails, try to handle as string
            console.warn('Standard JSON parse failed, trying alternative parsing');
            preferences = tryParseAlternativeFormat(currentApplicant.PreferredJobs);
        }
        
        if (preferences?.length) {
            container.innerHTML = preferences.map(pref => `
                <div class="preference-item">
                    ${pref.jobField ? `<p><strong>Field:</strong> ${pref.jobField}</p>` : ''}
                    ${pref.jobType ? `<p><strong>Type:</strong> ${pref.jobType}</p>` : ''}
                    ${pref.location ? `<p><strong>Location:</strong> ${pref.location}</p>` : ''}
                    ${pref.salary ? `<p><strong>Salary:</strong> $${pref.salary}</p>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
        container.innerHTML = '<div class="error-state">Error loading preferences</div>';
    }
}

// View Job Details
async function viewJobDetails(jobId) {
    try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Job not found');

        const job = await response.json();
        // Populate modal with job details
        // ... (your existing modal code)
        
        document.getElementById('jobModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading job:', error);
        showAlert('error', 'Could not load job details');
    }
}

// Add this with your other main functions like loadRecommendedJobs()
async function searchJobs() {
    const searchTerm = document.getElementById('jobSearchInput').value;
    const jobType = document.getElementById('jobTypeFilter').value;
    const location = document.getElementById('locationFilter').value;
    
    try {
        // Show loading state
        const container = document.getElementById('jobListingsContainer');
        container.innerHTML = '<div class="loading-spinner"></div>';
        
        // Build query params
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (jobType) params.append('type', jobType);
        if (location) params.append('location', location);
        
        // Make API call
        const response = await fetch(`${API_BASE}/jobs/search?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Search failed');
        
        const jobs = await response.json();
        renderJobListings(jobs);
        
    } catch (error) {
        console.error('Search error:', error);
        showAlert('error', 'Failed to search jobs');
        renderJobListings([]);
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(`${this.dataset.section}Section`).classList.add('active');
        });
    });

    // Profile dropdown
    document.querySelector('.profile-tab').addEventListener('click', () => {
        document.querySelector('.dropdown-content').classList.toggle('show');
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });

    // Search button
    document.getElementById('searchJobsBtn').addEventListener('click', searchJobs);

    // Modal close
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('jobModal').style.display = 'none';
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!e.target.matches('.profile-tab, .profile-tab *')) {
            document.querySelector('.dropdown-content').classList.remove('show');
        }
    });
}

// Helper Functions
function showAlert(type, message) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button class="close-alert">&times;</button>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
    alert.querySelector('.close-alert').addEventListener('click', () => alert.remove());
}

// Helper function for non-standard JSON formats
function tryParseAlternativeFormat(prefString) {
    // Case 1: Simple string without quotes
    if (typeof prefString === 'string' && !prefString.trim().startsWith('[')) {
        return [{ jobField: prefString }];
    }
    
    // Case 2: Malformed JSON that might be fixable
    try {
        // Try wrapping in brackets if it looks like an object
        if (prefString.trim().startsWith('{')) {
            return [JSON.parse(prefString)];
        }
        // Try adding quotes around unquoted properties
        const fixed = prefString.replace(/(\w+):/g, '"$1":');
        return JSON.parse(fixed);
    } catch (e) {
        console.warn('Could not parse preferences:', prefString);
        return null;
    }
}

// Initialize
function init() {
    setupEventListeners();
}