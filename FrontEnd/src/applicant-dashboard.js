// Global Configuration
const API_BASE = 'http://localhost:3000';
const DEFAULT_AVATAR = '/Assets/default-avatar.png';
const state = {
  user: null,
  applicant: null,
  recommendedJobs: [],
  currentPreferences: []
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
      if (!state.user) {
        const response = await authenticatedFetch('/users/me');
        state.user = await response.json();
      }
  
      if (state.user?.UserID) {
        try {
          const applicantResponse = await authenticatedFetch(`/applicants/user/${state.user.UserID}`);
          const data = await applicantResponse.json();
          
          // Handle both old and new preference formats during transition
          state.applicant = {
            ...data,
          };
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
    try {
        if (!state.applicant?.ApplicantID) {
            setDefaultStats();
            return;
        }

        const stats = await fetchDashboardStats(state.applicant.ApplicantID);
        updateStatsUI(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
        setDefaultStats();
        showAlert('error', 'Failed to load application stats');
    }
}

async function fetchDashboardStats(applicantId) {
    const response = await authenticatedFetch(`/applications/stats/${applicantId}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

function updateStatsUI(stats) {
    safeSetContent(elements.pendingCount, stats.pending || 0);
    safeSetContent(elements.nextStepCount, stats.nextStep || 0);
    safeSetContent(elements.recommendedCount, state.recommendedJobs?.length || 0);
}

function setDefaultStats() {
    if (elements.pendingCount) elements.pendingCount.textContent = '0';
    if (elements.nextStepCount) elements.nextStepCount.textContent = '0';
    if (elements.recommendedCount) {
      elements.recommendedCount.textContent = state.recommendedJobs?.length || '0';
    }
}

// Helper function to set content safely
function safeSetContent(element, value) {
    if (element) element.textContent = value;
}

// Jobs
async function loadRecommendedJobs() {
    try {
      const response = await authenticatedFetch('/jobs/recommended');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      state.recommendedJobs = await response.json();
      renderJobListings(state.recommendedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      showAlert('error', 'Failed to load recommended jobs. Please try again.');
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
    <div class="job-card">
      <h4>${job.JobField || 'No title'}</h4>
      <p><i class="fas fa-briefcase"></i> ${job.JobType || 'Type not specified'}</p>
      <p><i class="fas fa-map-marker-alt"></i> ${job.Location || 'Remote'}</p>
      <p><i class="fas fa-money-bill-wave"></i> $${job.Salary || '0'}</p>
    </div>
  `).join('');

  document.querySelectorAll('.view-job-btn').forEach(btn => {
    btn.addEventListener('click', () => viewJobDetails(btn.closest('.job-card').dataset.jobId));
  });
}

// Preferences
async function loadCurrentPreferences() {
    try {
      if (!state.applicant?.ApplicantID) {
        state.currentPreferences = [];
        renderPreferenceCards();
        return;
      }
  
      const response = await authenticatedFetch(
        `/applicants/${state.applicant.ApplicantID}/preferences`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
  
      state.currentPreferences = await response.json();
      renderPreferenceCards(); // This will update the UI
      
    } catch (error) {
      console.error('Error loading preferences:', error);
      showAlert('error', 'Failed to load preferences');
      state.currentPreferences = [];
      renderPreferenceCards();
    }
}

function renderPreferenceCards() {
    const container = document.getElementById('preferencesCards');
    if (!container) {
        console.error('Preferences container not found');
        return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Add preference count header
    const countHeader = document.createElement('div');
    countHeader.className = 'preferences-header';
    countHeader.innerHTML = `
        <h3>Job Preferences</h3>
        <div class="preference-count">
            ${state.currentPreferences.length}/3 used
            ${state.currentPreferences.length >= 3 ? 
                '<span class="limit-reached">(Limit reached)</span>' : 
                '<span class="limit-remaining">(You can add ' + (3 - state.currentPreferences.length) + ' more)</span>'
            }
        </div>
    `;
    container.appendChild(countHeader);

    // Handle empty state
    if (!state.currentPreferences || state.currentPreferences.length === 0) {
        container.innerHTML += `
            <div class="empty-state">
                <i class="fas fa-star"></i>
                <p>No preferences saved yet</p>
                <small>Add your first job preference above</small>
            </div>
        `;
        return;
    }

    // Create cards for each preference
    state.currentPreferences.forEach((pref, index) => {
        const card = document.createElement('div');
        card.className = 'preference-card';
        card.dataset.id = pref.PreferredJobID || pref.id;

        // Build card content
        card.innerHTML = `
            <div class="preference-content">
                <div class="preference-number">${index + 1}</div>
                ${pref.JobField ? `<p><strong>Field:</strong> ${pref.JobField}</p>` : ''}
                ${pref.JobType ? `<p><strong>Type:</strong> ${pref.JobType}</p>` : ''}
                ${pref.Location ? `<p><strong>Location:</strong> ${pref.Location}</p>` : ''}
                ${pref.Salary ? `<p><strong>Salary:</strong> $${pref.Salary.toLocaleString()}</p>` : ''}
            </div>
            <button class="delete-pref-btn" data-id="${pref.PreferredJobID || pref.id}">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(card);
    });

    // Add delete handlers
    document.querySelectorAll('.delete-pref-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePreference(btn.dataset.id);
        });
    });
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

// setupEventListeners():
function setupEventListeners() {
    setupNavigationListeners();
    setupProfileDropdownListener();
    setupLogoutListener();
    setupSearchListener();
    setupModalCloseListener();
    setupDropdownCloseListener();

    document.getElementById('preferencesForm')?.addEventListener('submit', savePreferences);
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

// Save Preferences
async function savePreferences(e) {
    e.preventDefault();
    
    // Get and validate form values
    const jobField = document.getElementById('prefJobField').value.trim();
    if (!jobField) {
      showAlert('error', 'Job field is required');
      return;
    }

    const newPref = {
      jobField,
      jobType: document.getElementById('prefJobType').value || null,
      location: document.getElementById('prefLocation').value.trim() || null,
      salary: Number(document.getElementById('prefSalary').value) || 0
    };
  
    try {
      // Send single preference to server
      const response = await authenticatedFetch(
        `/applicants/${state.applicant.ApplicantID}/preferences`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            preference: newPref // Send single preference
          })
        }
      );
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Reset form
      document.getElementById('preferencesForm').reset();
      
      // Reload preferences from server to stay in sync
      await loadCurrentPreferences();
      
      showAlert('success', 'Preference added successfully');
      
    } catch (error) {
      console.error('Error saving preference:', error);
      showAlert('error', error.message || 'Failed to save preference');
    }
}

// Delete preference
async function deletePreference(id) {
    try {
        const response = await authenticatedFetch(
            `/applicants/${state.applicant.ApplicantID}/preferences/${id}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to delete preference');
        }
        
        // Reload preferences from server
        await loadCurrentPreferences();
        
        showAlert('success', 'Preference deleted successfully');
        
    } catch (error) {
        console.error('Error deleting preference:', error);
        showAlert('error', 'Failed to delete preference');
    }
}

// Sync with server
async function updatePreferencesOnServer() {
    try {
        validateApplicantId();
        validatePreferenceLimit();
        const response = await sendPreferencesToServer();
        return handleServerResponse(response);
    } catch (error) {
        handlePreferencesError(error);
        throw error;
    }
}

function validateApplicantId() {
    if (!state.applicant?.ApplicantID) {
        throw new Error('No applicant profile found');
    }
}

function validatePreferenceLimit() {
    if (state.currentPreferences.length > 3) {
        throw new Error('Preference limit reached (max 3)');
    }
}

async function sendPreferencesToServer() {
    return authenticatedFetch(
        `/applicants/${state.applicant.ApplicantID}/preferences`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                preferences: state.currentPreferences
                    .filter(p => p.jobField) // Filter out invalid prefs
                    .slice(0, 3) // Enforce server-side limit
            })
        }
    );
}

function handleServerResponse(response) {
    if (!response.ok) {
        return response.json().then(errorData => {
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }).catch(() => {
            throw new Error(`HTTP ${response.status}`);
        });
    }
    return response.json().then(result => {
        if (!result.success) {
            throw new Error(result.message || 'Failed to update preferences');
        }
        return result;
    });
}

function handlePreferencesError(error) {
    console.error('Update preferences error:', error);
    showAlert('error', error.message || 'Failed to update preferences');
    
    // Rollback local state if server update failed
    if (error.message.includes('limit reached')) {
        state.currentPreferences = state.currentPreferences.slice(0, 3);
        renderPreferenceCards();
    }
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