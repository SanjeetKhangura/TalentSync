// hr-dashboard.js
const API_BASE_URL = 'http://localhost:3000';
let currentUser = null;
let unreadNotificationCount = 0;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Show loading state
    document.body.classList.add('loading');
    
    // Check for token first
    const token = localStorage.getItem('token');
    if (!token) {
      redirectToLogin();
      return;
    }

    // Fetch user data
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Handle response
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        redirectToLogin();
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const userData = await response.json();
    currentUser = userData;
    
    // Verify HR role
    if (userData.role !== 'HR') {
      redirectToLogin();
      return;
    }
    
    // Update UI with user info
    updateUserProfileDisplay(userData);
    
    // Load all HR data
    await loadHRData();

    document.querySelector('.job-posts-container .create-button').addEventListener('click', openJobModal);
    document.querySelector('.close-modal').addEventListener('click', closeJobModal);
    document.getElementById('submit-job').addEventListener('click', createJobPost);
    document.getElementById('submit-job-edit')?.addEventListener('click', updateJobPost);
    document.querySelector('.close-edit-modal')?.addEventListener('click', closeEditJobModal);
    document.getElementById('delete-job-btn')?.addEventListener('click', deleteJobPost);
    document.querySelector('.close-popup')?.addEventListener('click', closeApplicantPopup);

    // Close modal when clicking outside
    document.getElementById('create-job-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('create-job-modal')) {
        closeJobModal();
      }
    });

    setupLogoutButton();
    setupScreeningModal();

    await updateNotificationBadge();
  
    setupNotificationModal();
  
    setInterval(updateNotificationBadge, 30000);
    
  } catch (error) {
    console.error('Initialization error:', error);
    redirectToLogin();
  } finally {
    document.body.classList.remove('loading');
  }
});

function redirectToLogin() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

function updateUserProfileDisplay(userData) {
  const profileElement = document.querySelector('.profile-link');
  if (profileElement) {
    // Use Font Awesome icon and user's name
    profileElement.innerHTML = `
      <i class="fas fa-user-circle"></i> ${userData.name || 'HR Profile'}
    `;
    
    // Update profile image if available
    if (userData.image) {
      profileElement.innerHTML = `
        <img src="data:image/png;base64,${userData.image}" class="profile-image">
        ${userData.name || 'HR Profile'}
      `;
    }
  }
  
  // Update dashboard header if needed
  const dashboardTitle = document.querySelector('.dashboard-title');
  if (dashboardTitle) {
    dashboardTitle.textContent = `HR Dashboard - Welcome, ${userData.name}`;
  }
}

async function loadHRData() {
  await loadJobPosts();
  await loadApplications();
}

// Job Posts Functions
async function loadJobPosts() {
    try {
        console.log("Fetching jobs...");
        const response = await fetch(`${API_BASE_URL}/hr/jobs`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error response:", errorText);
            
            // Check for specific HTTP status codes
            if (response.status === 401) {
                throw new Error('Session expired. Please login again.');
            } else if (response.status === 403) {
                throw new Error('You do not have permission to view jobs.');
            } else {
                throw new Error('Failed to load jobs');
            }
        }
        
        const jobs = await response.json();
        console.log("Jobs received:", jobs);
        
        if (!Array.isArray(jobs)) {
            throw new Error('Invalid jobs data received');
        }
        
        renderJobPosts(jobs);
        return jobs;
    } catch (error) {
        console.error('Error loading jobs:', error);
        
        // Show user-friendly error message
        const errorMessage = error.message || 'Failed to load job posts';
        showNotification({
            type: 'error',
            message: errorMessage,
            duration: 5000
        });
        
        // If unauthorized, redirect to login
        if (error.message.includes('Session expired') || error.message.includes('permission')) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
        
        return []; // Return empty array to prevent further errors
    }
}
  
function renderJobPosts(jobs) {
    const container = document.querySelector('.job-posts-content');
    if (!container) {
        console.error('Job posts container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (jobs.length === 0) {
        container.innerHTML = '<p class="no-jobs">No job posts found</p>';
        return;
    }

    jobs.forEach(job => {
        const jobDiv = document.createElement('div');
        jobDiv.className = 'job';
        jobDiv.innerHTML = `
            <div class="button-wrapper">
                <button class="edit-button" data-job-id="${job.JobID}">Edit</button>
            </div>
            <h3 class="job-title">${job.JobName}</h3>
            <p class="department">Category: ${job.CategoryName || 'Uncategorized'}</p>
            <p class="email"><i class="fas fa-envelope"></i> ${job.ContactInfo}</p>
            <p class="location"><i class="fas fa-map-marker-alt"></i> ${job.Location}</p>
            <p class="job-type"><i class="fas fa-info-circle"></i>${job.PositionType} | ${job.MinEducation} | ${job.MinExperience} Years Experience</p>
            <p class="job-description">${job.Description.substring(0, 100)}...</p>
        `;
        container.appendChild(jobDiv);
    });
    
    // Attach edit handlers
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const jobId = e.target.getAttribute('data-job-id');
            editJobPost(jobId);
        });
    });
}

// Open and close modal functions
function openJobModal() {
    document.getElementById('create-job-modal').style.display = 'block';
}
  
function closeJobModal() {
    document.getElementById('create-job-modal').style.display = 'none';
}
  
// Create job post function
async function createJobPost() {
    try {
      const jobData = {
        JobName: document.getElementById('job-title').value,
        PositionType: document.getElementById('position-type').value,
        Location: document.getElementById('location').value,
        MinEducation: document.getElementById('education').value,
        MinExperience: document.getElementById('experience').value,
        Description: document.getElementById('description').value,
        ContactInfo: document.getElementById('contact-email').value,
        SalaryRange: document.getElementById('salary-range').value,
        CloseDate: document.getElementById('close-date').value
      };
  
      // Basic validation
      if (!jobData.JobName || !jobData.PositionType || !jobData.Location || !jobData.ContactInfo || !jobData.CloseDate) {
        throw new Error('Please fill all required fields');
      }
  
      const response = await fetch(`${API_BASE_URL}/hr/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(jobData)
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create job');
      }
  
      const newJob = await response.json();
      console.log('Job created:', newJob);
      
      // Refresh job list and close modal
      await loadJobPosts();
      closeJobModal();
      alert('Job created successfully!');
      
    } catch (error) {
      console.error('Job creation failed:', error);
      alert(`Error: ${error.message}`);
    }
}

// Edit Job Post
async function editJobPost(jobId) {
    try {
      console.log(`Fetching job ${jobId} for editing...`);
      const response = await fetch(`${API_BASE_URL}/hr/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load job: ${errorText}`);
      }
      
      const job = await response.json();
      console.log("Job data for editing:", job);
      setupEditJobModal(job);
    } catch (error) {
      console.error('Error loading job for editing:', error);
      alert(error.message);
    }
}

// Setup Edit Job Modal
function setupEditJobModal(job) {
    const modal = document.getElementById('edit-job-modal');
    if (!modal) return;
  
    // Populate form with job data
    document.getElementById('edit-job-title').value = job.JobName;
    document.getElementById('edit-position-type').value = job.PositionType;
    document.getElementById('edit-location').value = job.Location;
    document.getElementById('edit-education').value = job.MinEducation;
    document.getElementById('edit-experience').value = job.MinExperience;
    document.getElementById('edit-description').value = job.Description;
    document.getElementById('edit-contact-email').value = job.ContactInfo;
    document.getElementById('edit-salary-range').value = job.SalaryRange;
    document.getElementById('edit-close-date').value = job.CloseDate.split('T')[0];
    
    // Set current job ID
    modal.dataset.jobId = job.JobID;
    
    // Show modal
    modal.style.display = 'block';
    document.getElementById('backdrop').style.display = 'block';
}
  
async function updateJobPost() {
    const modal = document.getElementById('edit-job-modal');
    if (!modal) return;
  
    const jobId = modal.dataset.jobId;
    if (!jobId) return;
  
    try {
      const jobData = {
        JobName: document.getElementById('edit-job-title').value,
        PositionType: document.getElementById('edit-position-type').value,
        Location: document.getElementById('edit-location').value,
        MinEducation: document.getElementById('edit-education').value,
        MinExperience: document.getElementById('edit-experience').value,
        Description: document.getElementById('edit-description').value,
        ContactInfo: document.getElementById('edit-contact-email').value,
        SalaryRange: document.getElementById('edit-salary-range').value,
        CloseDate: document.getElementById('edit-close-date').value
      };
  
      const response = await fetch(`${API_BASE_URL}/hr/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(jobData)
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update job');
      }
  
      const updatedJob = await response.json();
      console.log('Job updated:', updatedJob);
      
      // Refresh job list and close modal
      await loadJobPosts();
      closeEditJobModal();
      alert('Job updated successfully!');
    } catch (error) {
      console.error('Job update failed:', error);
      alert(`Error: ${error.message}`);
    }
}
  
function closeEditJobModal() {
    document.getElementById('edit-job-modal').style.display = 'none';
    document.getElementById('backdrop').style.display = 'none';
}

// Delete Job Post
async function deleteJobPost() {
    const modal = document.getElementById('edit-job-modal');
    if (!modal) return;
  
    const jobId = modal.dataset.jobId;
    if (!jobId) return;
  
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this job post? This action cannot be undone.')) {
      return;
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/hr/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      // First check if response is OK
      if (!response.ok) {
        // Try to parse error response as JSON
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      // If response is OK, parse as JSON
      const result = await response.json();

      // Close modal and refresh job list
      closeEditJobModal();
      await loadJobPosts();
      
      // Show success message
      showNotification({
        type: 'success',
        message: result.message || 'Job deleted successfully',
        duration: 5000
      });
    } catch (error) {
      console.error('Job deletion failed:', error);
      
      showNotification({
        type: 'error',
        message: error.message || 'Failed to delete job',
        duration: 8000
      });
    }
}

// Applications Functions
async function loadApplications() {
    try {
      console.log("Loading applications...");
      const response = await fetch(`${API_BASE_URL}/hr/applications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load applications: ${errorText}`);
      }
      
      const applications = await response.json();
      console.log("Applications loaded:", applications);
      renderApplications(applications);
    } catch (error) {
      console.error('Error loading applications:', error);
      alert(error.message);
    }
}
  
function renderApplications(applications) {
    const container = document.querySelector('.applications-content');
    container.innerHTML = '';
    
    if (applications.length === 0) {
      container.innerHTML = '<p class="no-data">No applications found</p>';
      return;
    }
  
    // Group by job
    const jobsMap = new Map();
    applications.forEach(app => {
      if (!jobsMap.has(app.JobID)) {
        jobsMap.set(app.JobID, {
          JobName: app.JobName,
          applications: []
        });
      }
      jobsMap.get(app.JobID).applications.push(app);
    });
  
    // Render each job with its applications
    jobsMap.forEach((jobData, jobId) => {
      const appDiv = document.createElement('div');
      appDiv.className = 'application';
      appDiv.innerHTML = `
        <h3>${jobData.JobName}</h3>
        <p>Applications: ${jobData.applications.length}</p>
        <div class="button-wrapper">
          <button class="view-button" data-job-id="${jobId}">View Applicants</button>
        </div>
      `;
      container.appendChild(appDiv);
    });
  
    // Add event listeners
    document.querySelectorAll('.view-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const jobId = e.target.getAttribute('data-job-id');
        viewJobApplications(jobId);
      });
    });
}
  
async function viewJobApplications(jobId) {
    try {
      console.log(`Loading applications for job ${jobId}`);
      const response = await fetch(`${API_BASE_URL}/hr/applications/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load applications: ${errorText}`);
      }
      
      const applications = await response.json();
      console.log(`Applications for job ${jobId}:`, applications);
      renderApplicantsList(applications);
    } catch (error) {
      console.error('Error loading job applications:', error);
      alert(error.message);
    }
}
  
function renderApplicantsList(applications) {
    const container = document.querySelector('.view-applicant-content');
    container.innerHTML = '';
    
    if (applications.length === 0) {
      container.innerHTML = '<p class="no-data">No applicants found</p>';
      return;
    }
  
    applications.forEach(applicant => {
      const applicantDiv = document.createElement('div');
      applicantDiv.className = 'applicant-card';
      applicantDiv.dataset.appId = applicant.ApplicationID; // Add data attribute
      applicantDiv.innerHTML = `
        <div class="applicant-header">
          <i class="fas fa-user-circle"></i>
          <h3>${applicant.ApplicantName}</h3>
        </div>
        <p><strong>Status:</strong> ${applicant.Status}</p>
        <p><strong>Applied:</strong> ${new Date(applicant.ApplicationDate).toLocaleDateString()}</p>
        ${applicant.PreviousJobTitle ? `<p><strong>Experience:</strong> ${applicant.PreviousJobTitle} at ${applicant.EmployerName}</p>` : ''}
      `;
      container.appendChild(applicantDiv);
      
      // Add click handler to the entire card
      applicantDiv.addEventListener('click', () => {
        viewApplicationDetails(applicantDiv.dataset.appId);
      });
    });
}
  
// View Application Details
async function viewApplicationDetails(applicationId) {
    console.log('Viewing application details for ID:', applicationId);
    try {
      const response = await fetch(`${API_BASE_URL}/hr/applications/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load application details');
      }
      
      const application = await response.json();
      renderApplicationDetails(application);
    } catch (error) {
      console.error('Error loading application:', error);
      alert(error.message);
    }
}

function renderApplicationDetails(application) {
    const popup = document.getElementById('applicant-popup');
    if (!popup) return;
  
    // Basic info
    document.getElementById('popup-job-title').textContent = application.JobName;
    document.getElementById('popup-applicant-name').textContent = application.ApplicantName;
    document.getElementById('popup-applicant-status').textContent = `Status: ${application.Status}`;
    
    // Resume - use the application.Resume directly from the API response
    const iframe = document.getElementById('resume-iframe');
    if (application.Resume) {
      // Create a blob URL for the PDF
      const pdfBlob = base64ToBlob(application.Resume, 'application/pdf');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      iframe.src = pdfUrl;
    } else {
      iframe.srcdoc = "<html><body><p>No resume available</p></body></html>";
    }
    
    // Clear previous content and add new
    const resumeContainer = document.querySelector('.resume-container');
    resumeContainer.innerHTML = '';
    resumeContainer.appendChild(iframe);
    
    // Status controls
    document.getElementById('status-select').value = application.Status;
    document.getElementById('save-status-btn').dataset.appId = application.ApplicationID;
    
    // Add close button handler
    document.querySelector('.close-popup').addEventListener('click', closeApplicantPopup);
    
    // Add save status handler
    document.getElementById('save-status-btn').addEventListener('click', async () => {
        const status = document.getElementById('status-select').value;
        const appId = document.getElementById('save-status-btn').dataset.appId;
        
        try {
            const result = await updateApplicationStatus(appId, status);
            
            showNotification({
                type: 'success',
                message: result.message || 'Status updated successfully!',
                duration: 3000
            });
            
            closeApplicantPopup();
            await loadApplications(); // Refresh the applications list
        } catch (error) {
            console.error('Error updating status:', error);
            showNotification({
                type: 'error',
                message: error.message || 'Failed to update status',
                duration: 5000
            });
        }
    });
    
    // Show popup
    popup.style.display = 'block';
    document.getElementById('backdrop').style.display = 'block';
}
  
async function updateApplicationStatus(applicationId, status) {
    try {
        const response = await fetch(`${API_BASE_URL}/hr/applications/${applicationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                status: status,
                changeStatus: `Status updated to ${status} by HR`
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('Error updating application status:', error);
        throw error;
    }
}

function showNotification({ type, message, duration }) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="icon">${type === 'success' ? '✓' : '⚠'}</span>
        <span class="message">${message}</span>
        <button class="close-btn">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    const timer = setTimeout(() => {
        notification.remove();
    }, duration);
    
    // Manual close
    notification.querySelector('.close-btn').addEventListener('click', () => {
        clearTimeout(timer);
        notification.remove();
    });
    
    // Add some basic styling
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            transform: translateX(100%);
            animation: slideIn 0.3s forwards;
        }
        .notification.success { background: #4CAF50; }
        .notification.error { background: #F44336; }
        .close-btn {
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 1.2em;
            margin-left: 10px;
        }
        @keyframes slideIn {
            to { transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);
}

// AI SCREENING FUNCTIONS

// Add these new functions
function setupScreeningModal() {
    const screeningBtn = document.createElement('a');
    screeningBtn.href = '#';
    screeningBtn.innerHTML = '<i class="fas fa-robot"></i> Screening';
    screeningBtn.addEventListener('click', openScreeningModal);
    
    const iconWrapper = document.querySelector('.icon-wrapper');
    iconWrapper.insertBefore(screeningBtn, document.querySelector('.profile-dropdown'));
    
    document.querySelector('.close-screening-modal').addEventListener('click', closeScreeningModal);
    document.getElementById('run-screening-btn').addEventListener('click', runAIScreening);
}
  
function openScreeningModal() {
    populateJobDropdown();
    document.getElementById('screening-modal').style.display = 'block';
    document.getElementById('backdrop').style.display = 'block';
}
  
function closeScreeningModal() {
    document.getElementById('screening-modal').style.display = 'none';
    document.getElementById('backdrop').style.display = 'none';
}
  
async function populateJobDropdown() {
    try {
      const response = await fetch(`${API_BASE_URL}/hr/jobs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load jobs');
      
      const jobs = await response.json();
      const dropdown = document.getElementById('screening-job');
      dropdown.innerHTML = '<option value="">-- Select a Job --</option>';
      
      jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.JobID;
        option.textContent = job.JobName;
        dropdown.appendChild(option);
      });
    } catch (error) {
      console.error('Error populating job dropdown:', error);
      showNotification({
        type: 'error',
        message: 'Failed to load jobs for screening',
        duration: 5000
      });
    }
}
  
async function runAIScreening() {
    const jobId = document.getElementById('screening-job').value;
    const educationChecked = document.querySelector('input[name="education"]').checked;
    const experienceChecked = document.querySelector('input[name="experience"]').checked;
    const keywordsChecked = document.querySelector('input[name="keywords"]').checked;
    
    if (!jobId) {
      showNotification({
        type: 'error',
        message: 'Please select a job to screen',
        duration: 3000
      });
      return;
    }
    
    try {
      showLoading(true); // Show loading overlay
      
      const response = await fetch(`${API_BASE_URL}/hr/screening`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          jobId,
          criteria: {
            education: educationChecked,
            experience: experienceChecked,
            keywords: keywordsChecked
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Screening failed');
      }
      
      const results = await response.json();
      renderScreenedApplicants(results);
      closeScreeningModal();
      showNotification({
        type: 'success',
        message: `Screening completed: ${results.length} applicants passed`,
        duration: 5000
      });
    } catch (error) {
      console.error('Error running AI screening:', error);
      showNotification({
        type: 'error',
        message: error.message || 'Failed to run screening',
        duration: 5000
      });
    } finally {
      showLoading(false); // Hide loading overlay
    }
}
  
function renderScreenedApplicants(applications) {
    const container = document.querySelector('.screened-content');
    container.innerHTML = '';
    
    if (applications.length === 0) {
      container.innerHTML = '<p class="no-data">No screened applicants found</p>';
      return;
    }
    
    applications.forEach(app => {
      const appDiv = document.createElement('div');
      appDiv.className = 'applicant-card screened-applicant';
      appDiv.innerHTML = `
        <div class="applicant-header">
          <i class="fas fa-user-circle"></i>
          <h3>${app.ApplicantName}</h3>
        </div>
        <p><strong>Job:</strong> ${app.JobName}</p>
        <p><strong>Status:</strong> ${app.Status}</p>
        <p><strong>Screened On:</strong> ${new Date().toLocaleDateString()}</p>
        <div class="button-wrapper">
          <button class="view-details" data-app-id="${app.ApplicationID}">
            <i class="fas fa-eye"></i> View Details
          </button>
        </div>
      `;
      container.appendChild(appDiv);
      
      // Add click handler for view details
      appDiv.querySelector('.view-details').addEventListener('click', (e) => {
        e.stopPropagation();
        viewApplicationDetails(app.ApplicationID);
      });
    });
}

// Notification Functions
// Add notification badge to mail icon
async function updateNotificationBadge() {
    try {
      const response = await fetch('http://localhost:3000/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to get unread count');
      
      const data = await response.json();
      unreadNotificationCount = data.count;
      
      const mailIcon = document.querySelector('.icon-wrapper a[href="#"] i.fa-envelope');
      if (mailIcon) {
        const badge = mailIcon.nextElementSibling || document.createElement('span');
        if (data.count > 0) {
          badge.className = 'notification-badge';
          badge.textContent = data.count > 9 ? '9+' : data.count;
          if (!mailIcon.nextElementSibling) {
            mailIcon.parentNode.insertBefore(badge, mailIcon.nextSibling);
          }
        } else if (badge.classList.contains('notification-badge')) {
          badge.remove();
        }
      }
    } catch (error) {
      console.error('Error updating notification badge:', error);
    }
  }
  
// Set up notification modal
function setupNotificationModal() {
    const mailLink = document.querySelector('.icon-wrapper a[href="#"] i.fa-envelope')?.parentNode;
    if (!mailLink) return;
    
    mailLink.addEventListener('click', async (e) => {
      e.preventDefault();
      openNotificationModal();
    });
    
    // Create modal HTML with proper structure
    const modalHTML = `
      <div id="notification-modal" class="modal" style="display:none;">
        <div class="modal-content">
          <span class="close-modal">&times;</span>
          <h2>Notifications</h2>
          <div class="modal-actions">
            <button class="send-message-btn">Send Message to Admin</button>
          </div>
          <div class="notifications-list">
            <!-- Notifications will be loaded here -->
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal if it exists
    const existingModal = document.getElementById('notification-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Close modal handler
    const closeButton = document.querySelector('#notification-modal .close-modal');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        document.getElementById('notification-modal').style.display = 'none';
      });
    }
    
    // Send message handler
    const sendButton = document.querySelector('#notification-modal .send-message-btn');
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        sendMessageToAdmin();
      });
    }
    
    // Close when clicking outside modal content
    document.getElementById('notification-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('notification-modal')) {
        document.getElementById('notification-modal').style.display = 'none';
      }
    });
}
  
// Open notification modal
async function openNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (!modal) return;
    
    try {
      const response = await fetch('http://localhost:3000/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load notifications');
      
      const notifications = await response.json();
      const container = modal.querySelector('.notifications-list');
      container.innerHTML = '';
      
      if (notifications.length === 0) {
        container.innerHTML = '<p class="no-notifications">No notifications found</p>';
      } else {
        notifications.forEach(notification => {
          const notificationElement = document.createElement('div');
          notificationElement.className = `notification ${notification.IsRead ? '' : 'unread'}`;
          notificationElement.dataset.id = notification.NotificationID;
          notificationElement.innerHTML = `
            <div class="notification-header">
              <h3 class="notification-title">${notification.FromUserName || 'System'}</h3>
              <span class="notification-date">${new Date(notification.SendDate).toLocaleString()}</span>
            </div>
            <p class="notification-message">${notification.Message}</p>
          `;
          container.appendChild(notificationElement);
        });
      }
      
      modal.style.display = 'block';
    } catch (error) {
      console.error('Error loading notifications:', error);
      const modal = document.getElementById('notification-modal');
      if (modal) {
        modal.querySelector('.notifications-list').innerHTML = `<div class="error">Error: ${error.message}</div>`;
        modal.style.display = 'block';
      }
    }
}

//  Send message to admin function
async function sendMessageToAdmin() {
    const message = prompt('Enter your message to the admin:');
    if (!message) return;
    
    try {
      const response = await fetch('http://localhost:3000/hr/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: message
        })
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      
      showNotification({
        type: 'success',
        message: 'Message sent to admin successfully!',
        duration: 3000
      });
      
      // Refresh notifications
      await openNotificationModal();
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification({
        type: 'error',
        message: 'Failed to send message to admin',
        duration: 5000
      });
    }
}
  
async function markNotificationAsRead(notificationId) {
    try {
      await fetch(`http://localhost:3000/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
}

//helper function to convert base64 to blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

//function to close the applicant popup
function closeApplicantPopup() {
    document.getElementById('applicant-popup').style.display = 'none';
    document.getElementById('backdrop').style.display = 'none';
    
    // Clean up the PDF blob URL to prevent memory leaks
    const iframe = document.getElementById('resume-iframe');
    if (iframe.src && iframe.src.startsWith('blob:')) {
      URL.revokeObjectURL(iframe.src);
    }
    iframe.src = '';
}

function showLoading(show) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (show) {
      loadingOverlay.style.display = 'flex';
    } else {
      loadingOverlay.style.display = 'none';
    }
  }

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }
  }
  
  function logout() {
    // Clear the token from local storage
    localStorage.removeItem('token');
    
    // Redirect to login page
    window.location.href = 'login.html';
  }