// Global Configuration
const API_BASE = 'http://localhost:3000';
const DEFAULT_AVATAR = '/Assets/default-avatar.png';
const state = {
  user: null,
  applicant: null,
  recommendedJobs: []
};

// DOM Elements
const elements = {
  navUserName: document.getElementById('navUserName'),
  navProfileImage: document.getElementById('navProfileImage'),
  pendingCount: document.getElementById('pendingCount'),
  nextStepCount: document.getElementById('nextStepCount'),
  recommendedCount: document.getElementById('recommendedCount'),
  jobListingsContainer: document.getElementById('jobListingsContainer'),
  currentPreferencesList: document.getElementById('currentPreferencesList')
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', initializeDashboard);

async function initializeDashboard() {
  try {
    await checkAuth();
    await loadUserData(); // Must complete first
    await Promise.all([
      loadDashboardStats(),
      loadRecommendedJobs(),
      loadCurrentPreferences()
    ]);
    setupEventListeners();
  } catch (error) {
    console.error('Initialization error:', error);
    showAlert('error', 'Failed to load dashboard');
  }
}

// Authentication
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) redirectToLogin();

  try {
    const response = await authenticatedFetch('/users/me');
    state.user = await response.json();
  } catch (error) {
    console.error('Auth check failed:', error);
    redirectToLogin();
  }
}

function redirectToLogin() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

// Data Loading
async function loadUserData() {
  try {
    // First ensure we have user data
    if (!state.user) {
      const response = await authenticatedFetch('/users/me');
      state.user = await response.json();
    }

    // Only fetch applicant data if we have a UserID
    if (state.user?.UserID) {
      try {
        const applicantResponse = await authenticatedFetch(`/applicants/user/${state.user.UserID}`);
        state.applicant = await applicantResponse.json();
      } catch (e) {
        console.warn('No applicant data found for user');
        state.applicant = null;
      }
    }

    updateUI();
  } catch (error) {
    console.error('Error loading user data:', error);
    handleProfileImageError();
    throw error;
  }
}

function updateUI() {
  if (elements.navUserName) {
    elements.navUserName.textContent = state.user?.Name || 'User';
  }
  updateProfileImage();
}

function updateProfileImage() {
  if (!elements.navProfileImage) return;

  elements.navProfileImage.src = state.user?.Image 
    ? `data:image/jpeg;base64,${state.user.Image}`
    : DEFAULT_AVATAR;

  elements.navProfileImage.onerror = handleProfileImageError;
}

function handleProfileImageError() {
  if (elements.navProfileImage) {
    elements.navProfileImage.src = DEFAULT_AVATAR;
  }
  showAlert('error', 'Failed to load profile image');
}

// Dashboard Stats
async function loadDashboardStats() {
  setDefaultStats();
  
  if (!state.applicant?.ApplicantID) return;

  try {
    const response = await authenticatedFetch(`/applications/stats/${state.applicant.ApplicantID}`);
    const stats = await response.json();
    
    elements.pendingCount.textContent = stats.pending || 0;
    elements.nextStepCount.textContent = stats.nextStep || 0;
    elements.recommendedCount.textContent = state.recommendedJobs.length || 0;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Set default stats
function setDefaultStats() {
    safeSetContent(elements.pendingCount, 'N/A');
    safeSetContent(elements.nextStepCount, 'N/A');
    safeSetContent(elements.recommendedCount, state.recommendedJobs.length || 'N/A');
}

// Helper function to set content safely
function safeSetContent(element, value) {
    if (element) element.textContent = value;
}

// Jobs
async function loadRecommendedJobs() {
  showLoading(elements.jobListingsContainer);

  try {
    const response = await authenticatedFetch('/jobs/recommended');
    state.recommendedJobs = await response.json();
    renderJobListings(state.recommendedJobs);
  } catch (error) {
    console.error('Error loading jobs:', error);
    state.recommendedJobs = [];
    renderJobListings([]);
  }
}

function renderJobListings(jobs = []) {
  if (!elements.jobListingsContainer) return;
  
  if (!jobs.length) {
    return showEmptyState(elements.jobListingsContainer, 'No recommended jobs available');
  }

  elements.jobListingsContainer.innerHTML = jobs.map(job => `
    <div class="job-card" data-job-id="${job.JobID}">
      <h4>${job.PositionType || 'No title'}</h4>
      <p><i class="fas fa-map-marker-alt"></i> ${job.Location || 'Location not specified'}</p>
      <p><i class="fas fa-money-bill-wave"></i> $${job.SalaryRange || '0'}</p>
      <button class="btn btn-secondary view-job-btn">View Details</button>
    </div>
  `).join('');

  document.querySelectorAll('.view-job-btn').forEach(btn => {
    btn.addEventListener('click', () => viewJobDetails(btn.closest('.job-card').dataset.jobId));
  });
}

// Preferences
async function loadCurrentPreferences() {
    if (!elements.currentPreferencesList) return;
    
    showEmptyState(elements.currentPreferencesList, 'No preferences set');
    
    if (!state.applicant?.PreferredJobs) return;
  
    try {
      // First try to parse as JSON
      let preferences;
      try {
          preferences = JSON.parse(state.applicant.PreferredJobs);
      } catch (e) {
          // If parsing fails, try to handle as string
          preferences = tryParseAlternativeFormat(state.applicant.PreferredJobs);
      }
      
      if (preferences?.length) {
          elements.currentPreferencesList.innerHTML = preferences.map(pref => `
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
      showErrorState(elements.currentPreferencesList);
    }
}

// Helper Functions
function authenticatedFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token');

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  });
}

function showLoading(container) {
  if (container) container.innerHTML = '<div class="loading-spinner"></div>';
}

function showEmptyState(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-briefcase-slash"></i>
      <p>${message}</p>
      <small>N/A</small>
    </div>
  `;
}

function showErrorState(container) {
  if (container) container.innerHTML = '<div class="error-state">Error loading data</div>';
}

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

// setupEventListeners():
function setupEventListeners() {
    setupNavigationListeners();
    setupProfileDropdownListener();
    setupLogoutListener();
    setupSearchListener();
    setupModalCloseListener();
    setupDropdownCloseListener();
}

function setupNavigationListeners() {
    const navItems = document.querySelectorAll('.nav-item');
    if (!navItems.length) return;

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            removeActiveFromNavigationAndContent();
            this.classList.add('active');
            activateSection(this.dataset.section);
        });
    });
}

function setupProfileDropdownListener() {
    const profileTab = document.querySelector('.profile-tab');
    if (!profileTab) return;

    profileTab.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent immediate close when clicking
        toggleDropdownVisibility();
    });
}

function setupLogoutListener() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

function setupSearchListener() {
    const searchBtn = document.getElementById('searchJobsBtn');
    if (!searchBtn) return;

    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        searchJobs();
    });
}

function setupModalCloseListener() {
    const closeModal = document.querySelector('.close-modal');
    if (!closeModal) return;

    closeModal.addEventListener('click', hideModal);
}

function setupDropdownCloseListener() {
    window.addEventListener('click', (e) => {
        if (!e.target.matches('.profile-tab, .profile-tab *')) {
            hideDropdown();
        }
    });
}

// Helper Functions
function removeActiveFromNavigationAndContent() {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
}

function activateSection(sectionId) {
    const section = document.getElementById(`${sectionId}Section`);
    if (section) section.classList.add('active');
}

function toggleDropdownVisibility() {
    const dropdown = document.querySelector('.dropdown-content');
    if (dropdown) dropdown.classList.toggle('show');
}

function hideModal() {
    const modal = document.getElementById('jobModal');
    if (modal) modal.style.display = 'none';
}

function hideDropdown() {
    const dropdown = document.querySelector('.dropdown-content');
    if (dropdown) dropdown.classList.remove('show');
}

// Job Details
async function viewJobDetails(jobId) {
  try {
    const response = await authenticatedFetch(`/jobs/${jobId}`);
    const job = await response.json();
    
    // Populate modal with job details
    const modal = document.getElementById('jobModal');
    if (modal) {
      modal.style.display = 'block';
      // Add your modal population logic here
    }
  } catch (error) {
    console.error('Error loading job:', error);
    showAlert('error', 'Could not load job details');
  }
}

// Search Jobs
async function searchJobs() {
  const searchTerm = document.getElementById('jobSearchInput')?.value;
  const jobType = document.getElementById('jobTypeFilter')?.value;
  const location = document.getElementById('locationFilter')?.value;
  
  try {
    showLoading(elements.jobListingsContainer);
    
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (jobType) params.append('type', jobType);
    if (location) params.append('location', location);
    
    const response = await authenticatedFetch(`/jobs/search?${params.toString()}`);
    const jobs = await response.json();
    renderJobListings(jobs);
  } catch (error) {
    console.error('Search error:', error);
    showAlert('error', 'Failed to search jobs');
    renderJobListings([]);
  }
}