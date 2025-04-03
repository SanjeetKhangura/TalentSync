// =============================================
// CONFIGURATION & STATE MANAGEMENT
// =============================================

const API_BASE = 'http://localhost:3000';
const DEFAULT_AVATAR = '/Assets/default-avatar.png';

const state = {
  user: null,
  applicant: null,
  recommendedJobs: [],
  currentPreferences: [],
  allJobs: [],
  filteredJobs: []
};

const elements = {
  navUserName: document.getElementById('navUserName'),
  navProfileImage: document.getElementById('navProfileImage'),
  pendingCount: document.getElementById('pendingCount'),
  nextStepCount: document.getElementById('nextStepCount'),
  recommendedCount: document.getElementById('recommendedCount'),
  jobListingsContainer: document.getElementById('jobListingsContainer'),
  currentPreferencesList: document.getElementById('currentPreferencesList')
};

// =============================================
// INITIALIZATION
// =============================================

document.addEventListener('DOMContentLoaded', initializeDashboard);

async function initializeDashboard() {
  try {
    await checkAuth();
    await loadUserData();
    showSection('dashboard');
    
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

// =============================================
// AUTHENTICATION & USER MANAGEMENT
// =============================================

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
        state.applicant = { ...data };
        populateProfileForm();
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

function populateProfileForm() {
  document.getElementById('profileName').value = state.user.Name || '';
  document.getElementById('profileEmail').value = state.user.Email || '';
  document.getElementById('profilePhone').value = state.user.Phone || '';
  
  const profilePreview = document.getElementById('profilePreview');
  profilePreview.src = state.user.Image 
    ? `data:image/jpeg;base64,${state.user.Image}`
    : DEFAULT_AVATAR;
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

// =============================================
// DASHBOARD STATS
// =============================================

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
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

// =============================================
// JOB MANAGEMENT
// =============================================

async function loadRecommendedJobs() {
  try {
    const response = await authenticatedFetch('/jobs');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    state.allJobs = await response.json();
    state.recommendedJobs = state.allJobs.slice(0, 3);
    renderJobListings(state.recommendedJobs);
  } catch (error) {
    console.error('Error loading jobs:', error);
    showAlert('error', 'Failed to load jobs');
    state.allJobs = [];
    state.recommendedJobs = [];
    renderJobListings([]);
  }
}

function renderJobListings(jobs) {
  if (!elements.jobListingsContainer) return;
  
  if (!jobs.length) {
    elements.jobListingsContainer.innerHTML = createEmptyStateHTML('No jobs available');
    return;
  }

  elements.jobListingsContainer.innerHTML = jobs.map(createJobCardHTML).join('');
  setupJobCardEventListeners();
}

function createJobCardHTML(job) {
  return `
    <div class="job-card" data-jobid="${job.JobID}">
      <h4>${job.JobName|| 'Position'}</h4>
      <p><strong>Type:</strong> ${job.PositionType || 'Not specified'}</p>
      <p><i class="fas fa-map-marker-alt"></i> ${job.Location || 'Location not specified'}</p>
      <p><i class="fas fa-money-bill-wave"></i> $${job.SalaryRange?.toLocaleString() || '0'}</p>
      <button class="btn btn-secondary view-job-btn">View Details</button>
    </div>
  `;
}

function setupJobCardEventListeners() {
  document.querySelectorAll('.view-job-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobId = e.target.closest('.job-card').dataset.jobid;
      viewJobDetails(jobId);
    });
  });
}

async function viewJobDetails(jobId) {
  try {
    const job = state.allJobs.find(j => j.JobID == jobId) || 
                await (await authenticatedFetch(`/jobs/${jobId}`)).json();
    
    const modal = document.getElementById('jobModal');
    if (!modal) return;

    populateJobModal(modal, job);
    modal.style.display = 'block';
    
    document.getElementById('applicationForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      applyForJob(jobId);
    });
  } catch (error) {
    console.error('Error loading job:', error);
    showAlert('error', 'Could not load job details');
  }
}

function populateJobModal(modal, job) {
  modal.querySelector('#modalJobTitle').textContent = job.JobName;
  modal.querySelector('#modalJobType').textContent = job.PositionType;
  modal.querySelector('#modalJobLocation').textContent = job.Location;
  modal.querySelector('#modalJobSalary').textContent = job.SalaryRange?.toLocaleString() || '0';
  modal.querySelector('#modalJobEducation').textContent = job.MinEducation;
  modal.querySelector('#modalJobExperience').textContent = job.MinExperience;
  modal.querySelector('#modalJobCloseDate').textContent = new Date(job.CloseDate).toLocaleDateString();
  modal.querySelector('#modalJobDescription').textContent = job.Description;
}

// =============================================
// APPLICATION MANAGEMENT
// =============================================

async function loadApplications() {
  try {
    if (!state.applicant?.ApplicantID) {
      showEmptyState(document.getElementById('applicationsList'), 'No applications found');
      return;
    }

    showLoading(document.getElementById('applicationsList'));

    const statusFilter = document.getElementById('applicationStatusFilter').value;
    const endpoint = statusFilter !== 'All' 
      ? `/my-applications?status=${encodeURIComponent(statusFilter)}`
      : '/my-applications';

    const response = await authenticatedFetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const applications = await response.json();
    renderApplications(applications, statusFilter);
  } catch (error) {
    console.error('Error loading applications:', error);
    showErrorState(document.getElementById('applicationsList'));
    showAlert('error', 'Failed to load applications');
  }
}

function renderApplications(applications, statusFilter) {
  const container = document.getElementById('applicationsList');
  if (!container) return;

  if (!applications.length) {
    const message = statusFilter === 'All' 
      ? 'No applications submitted yet' 
      : `No ${statusFilter.toLowerCase()} applications`;
    showEmptyState(container, message);
    return;
  }

  container.innerHTML = applications.map(createApplicationCardHTML).join('');
  setupApplicationCardEventListeners();
}

function createApplicationCardHTML(app) {
  return `
    <div class="application-card" data-app-id="${app.ApplicationID}">
      <div class="application-header">
        <h4>${app.JobName || 'Unknown Position'}</h4>
        <span class="status-badge ${app.Status.toLowerCase().replace(' ', '-')}">
          ${app.Status}
        </span>
      </div>
      <div class="application-details">
        <p><i class="fas fa-map-marker-alt"></i> ${app.Location || 'Location not specified'}</p>
        <p><i class="fas fa-money-bill-wave"></i> $${app.SalaryRange?.toLocaleString() || '0'}</p>
        <p><i class="fas fa-calendar-alt"></i> Applied on: ${new Date(app.ApplicationDate).toLocaleDateString()}</p>
      </div>
      <button class="btn btn-secondary view-application-btn">View Details</button>
    </div>
  `;
}

function setupApplicationCardEventListeners() {
  document.querySelectorAll('.view-application-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const appId = e.target.closest('.application-card').dataset.appId;
      viewApplicationDetails(appId);
    });
  });
}

async function viewApplicationDetails(applicationId) {
  try {
    const response = await authenticatedFetch(`/applications/${applicationId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const application = await response.json();
    const modal = document.getElementById('applicationDetailsModal');
    
    populateApplicationModal(modal, application);
    modal.style.display = 'block';
    
    setupModalCloseHandlers(modal);
  } catch (error) {
    console.error('Error loading application details:', error);
    showAlert('error', error.message || 'Failed to load application details');
  }
}

function populateApplicationModal(modal, application) {
  modal.querySelector('#modalAppPosition').textContent = application.PositionType || 'Unknown';
  modal.querySelector('#modalAppLocation').textContent = application.Location || 'Not specified';
  modal.querySelector('#modalAppSalary').textContent = application.SalaryRange?.toLocaleString() || '0';
  modal.querySelector('#modalAppDate').textContent = new Date(application.ApplicationDate).toLocaleDateString();
  modal.querySelector('#modalAppNotes').textContent = application.ChangeStatus || 'None';
  modal.querySelector('#modalAppDescription').textContent = application.Description || 'No description available';
  
  const statusBadge = modal.querySelector('#modalAppStatus');
  statusBadge.textContent = application.Status;
  statusBadge.className = `status-badge ${application.Status.toLowerCase().replace(' ', '-')}`;
}

function setupModalCloseHandlers(modal) {
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// =============================================
// PREFERENCE MANAGEMENT
// =============================================

async function loadCurrentPreferences() {
  try {
    if (!state.applicant?.ApplicantID) {
      state.currentPreferences = [];
      renderPreferenceCards();
      return;
    }

    const response = await authenticatedFetch(`/applicants/${state.applicant.ApplicantID}/preferences`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    state.currentPreferences = await response.json();
    renderPreferenceCards();
  } catch (error) {
    console.error('Error loading preferences:', error);
    showAlert('error', 'Failed to load preferences');
    state.currentPreferences = [];
    renderPreferenceCards();
  }
}

function renderPreferenceCards() {
  const mainContainer = document.getElementById('preferencesCards');
  const dashboardContainer = document.getElementById('dashboardPreferencesCards');
  const cardsHTML = createPreferenceCardsHTML();
  
  if (mainContainer) mainContainer.innerHTML = cardsHTML;
  if (dashboardContainer) dashboardContainer.innerHTML = cardsHTML;
  
  setupPreferenceDeleteHandlers();
}

function createPreferenceCardsHTML() {
  if (!state.currentPreferences?.length) {
    return createEmptyStateHTML('No preferences saved yet', 'Add your first job preference above');
  }

  return state.currentPreferences.map((pref, index) => `
    <div class="preference-card" data-id="${pref.PreferredJobID || pref.id}">
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
    </div>
  `).join('');
}

function setupPreferenceDeleteHandlers() {
  document.querySelectorAll('.delete-pref-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePreference(btn.dataset.id);
    });
  });
}

async function savePreferences(e) {
  e.preventDefault();
  
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
    const response = await authenticatedFetch(
      `/applicants/${state.applicant.ApplicantID}/preferences`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ preference: newPref })
      }
    );
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    
    document.getElementById('preferencesForm').reset();
    await loadCurrentPreferences();
    showAlert('success', 'Preference added successfully');
  } catch (error) {
    console.error('Error saving preference:', error);
    showAlert('error', error.message || 'Failed to save preference');
  }
}

async function deletePreference(id) {
  try {
    const response = await authenticatedFetch(
      `/applicants/${state.applicant.ApplicantID}/preferences/${id}`,
      { method: 'DELETE' }
    );
    
    if (!response.ok) throw new Error('Failed to delete preference');
    
    await loadCurrentPreferences();
    showAlert('success', 'Preference deleted successfully');
  } catch (error) {
    console.error('Error deleting preference:', error);
    showAlert('error', 'Failed to delete preference');
  }
}

// =============================================
// PROFILE MANAGEMENT
// =============================================

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    document.getElementById('profilePreview').src = event.target.result;
  };
  reader.readAsDataURL(file);
}

async function updateProfile(e) {
  e.preventDefault();
  
  const formData = new FormData();
  const profileUpload = document.getElementById('profileUpload');
  const name = document.getElementById('profileName').value;
  const phone = document.getElementById('profilePhone').value;
  
  if (profileUpload.files[0]) formData.append('image', profileUpload.files[0]);
  formData.append('name', name);
  formData.append('phone', phone);

  try {
    const response = await fetch(`${API_BASE}/users/${state.user.UserID}/profile`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    updateUserState(name, phone, result);
    showAlert('success', 'Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    showAlert('error', error.message || 'Failed to update profile');
  }
}

function updateUserState(name, phone, result) {
  state.user = {
    ...state.user,
    Name: name,
    Phone: phone,
    Image: result.user?.Image || state.user.Image
  };
  updateUI();
}

async function changePassword(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showAlert('error', 'New passwords do not match');
    return;
  }

  try {
    const response = await authenticatedFetch(`/users/${state.user.UserID}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    showAlert('success', 'Password changed successfully');
    document.getElementById('passwordForm').reset();
  } catch (error) {
    console.error('Error changing password:', error);
    showAlert('error', error.message || 'Failed to change password');
  }
}

// =============================================
// JOB APPLICATION
// =============================================

async function applyForJob(jobId) {
  const resumeInput = document.getElementById('resumeUpload');
  if (!isValidResume(resumeInput)) return;

  try {
    const formData = createApplicationFormData(resumeInput, jobId);
    const response = await submitApplication(formData);
    await handleApplicationResponse(response);
  } catch (error) {
    handleApplicationError(error);
  }
}

function isValidResume(resumeInput) {
  if (!resumeInput?.files?.[0]) {
    showAlert('error', 'Please upload a resume file');
    return false;
  }

  if (resumeInput.files[0].size > 5 * 1024 * 1024) {
    showAlert('error', 'Resume must be less than 5MB');
    return false;
  }

  return true;
}

function createApplicationFormData(resumeInput, jobId) {
  const formData = new FormData();
  formData.append('resume', resumeInput.files[0]);
  formData.append('jobId', jobId.toString());
  return formData;
}

async function submitApplication(formData) {
  return fetch(`${API_BASE}/applications`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: formData
  });
}

async function handleApplicationResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Application failed (${response.status})`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Application submission failed');
  }

  showAlert('success', result.message || 'Application submitted successfully');
  hideModal();

  if (window.location.hash.includes('applications')) {
    loadApplications();
  } else {
    loadRecommendedJobs();
  }
}

function handleApplicationError(error) {
  console.error('Application submission error:', error);
  showAlert('error', error.message || 'Failed to submit application');
}

// =============================================
// JOB SEARCH
// =============================================

async function searchJobs() {
  const searchTerm = document.getElementById('jobSearchInput').value.toLowerCase();
  const jobType = document.getElementById('jobTypeFilter').value;
  const location = document.getElementById('locationFilter').value;

  try {
    showLoading(elements.jobListingsContainer);
    state.filteredJobs = filterJobs(searchTerm, jobType, location);
    renderJobListings(state.filteredJobs);
  } catch (error) {
    console.error('Search error:', error);
    showAlert('error', 'Failed to search jobs');
    renderJobListings([]);
  }
}

function filterJobs(searchTerm, jobType, location) {
  return state.allJobs.filter(job => {
    const matchesSearch = !searchTerm || 
      job.PositionType.toLowerCase().includes(searchTerm) || 
      job.Description.toLowerCase().includes(searchTerm);
    
    const matchesType = !jobType || job.PositionType === jobType;
    const matchesLocation = !location || job.Location.includes(location);
    
    return matchesSearch && matchesType && matchesLocation;
  });
}

// =============================================
// EVENT LISTENERS & NAVIGATION
// =============================================

function setupEventListeners() {
  setupNavigationListeners();
  setupProfileDropdownListener();
  setupLogoutListener();
  setupSearchListener();
  setupModalCloseListener();
  setupDropdownCloseListener();

  document.getElementById('preferencesForm')?.addEventListener('submit', savePreferences);
  document.getElementById('profileForm')?.addEventListener('submit', updateProfile);
  document.getElementById('passwordForm')?.addEventListener('submit', changePassword);
  document.getElementById('profileUpload')?.addEventListener('change', handleImageUpload);
  document.getElementById('applicationStatusFilter')?.addEventListener('change', loadApplications);
}

function setupNavigationListeners() {
  const navItems = document.querySelectorAll('.nav-item');
  const dropdownItems = document.querySelectorAll('.dropdown-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      showSection(this.dataset.section);
    });
  });
  
  dropdownItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      showSection(this.dataset.section);
    });
  });
}

function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
    section.classList.add('hidden');
  });
  
  const activeSection = document.getElementById(`${sectionId}Section`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
    activeSection.classList.add('active');
    
    if (sectionId === 'preferences') {
      document.getElementById('preferencesForm').style.display = 'block';
    }
  }
  
  updateActiveNavItem(sectionId);
  loadSectionData(sectionId);
}

function updateActiveNavItem(sectionId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  if (sectionId === 'profile') {
    document.querySelector('.profile-tab').classList.add('active');
  } else {
    document.querySelector(`.nav-item[data-section="${sectionId}"]`).classList.add('active');
  }
}

function loadSectionData(sectionId) {
  switch(sectionId) {
    case 'applications': loadApplications(); break;
    case 'preferences': loadCurrentPreferences(); break;
    case 'dashboard': 
      loadDashboardStats(); 
      loadRecommendedJobs(); 
      break;
  }
}

function setupProfileDropdownListener() {
  const profileTab = document.querySelector('.profile-tab');
  if (!profileTab) return;

  profileTab.addEventListener('click', (e) => {
    e.stopPropagation();
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

// =============================================
// UTILITY FUNCTIONS
// =============================================

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

function showEmptyState(container, message, subMessage = 'N/A') {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-briefcase-slash"></i>
      <p>${message}</p>
      <small>${subMessage}</small>
    </div>
  `;
}

function createEmptyStateHTML(message, subMessage = 'N/A') {
  return `
    <div class="empty-state">
      <i class="fas fa-briefcase-slash"></i>
      <p>${message}</p>
      <small>${subMessage}</small>
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

function safeSetContent(element, value) {
  if (element) element.textContent = value;
}