// hr-dashboard.js

const API_BASE_URL = 'http://localhost:3000';
let currentUser = null;

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
  await loadNotifications();
}

// Job Posts Functions
async function loadJobPosts() {
    try {
      console.log("Fetching jobs..."); // Debug log
      const response = await fetch(`${API_BASE_URL}/hr/jobs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log("Response status:", response.status); // Debug log
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText); // Debug log
        throw new Error('Failed to load jobs');
      }
      
      const jobs = await response.json();
      console.log("Jobs received:", jobs); // Debug log
      renderJobPosts(jobs);
      return jobs;
    } catch (error) {
      console.error('Error loading jobs:', error);
      alert('Failed to load job posts');
    }
}
  
function renderJobPosts(jobs) {
    const jobPostsContent = document.querySelector('.job-posts-content');
    jobPostsContent.innerHTML = '';
    
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
      
      jobPostsContent.appendChild(jobDiv);
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
        await updateApplicationStatus(appId, status);
        closeApplicantPopup();
        await loadApplications(); // Refresh the applications list
      } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status');
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
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating application status:', error);
      throw error;
    }
}

// Notifications Functions
async function loadNotifications() {
    try {
      const response = await fetch(`${API_BASE_URL}/hr/notifications`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load notifications');
      
      const notifications = await response.json();
      renderNotifications(notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      alert('Failed to load notifications');
    }
}
  
function renderNotifications(notifications) {
    const notificationsContent = document.querySelector('.notifications-content');
    notificationsContent.innerHTML = '';
    
    notifications.forEach(notification => {
      const notifDiv = document.createElement('div');
      notifDiv.className = 'notification';
      notifDiv.innerHTML = `
        <h3 class="notification-title">Notification</h3>
        <p class="notification-description">${notification.Message}</p>
        <p class="notification-date">${new Date(notification.SendDate).toLocaleString()}</p>
        <div class="button-wrapper">
          <button class="remove-button" data-notif-id="${notification.NotificationID}">X</button>
        </div>
      `;
      
      notificationsContent.appendChild(notifDiv);
    });
    
    // Attach remove handlers
    document.querySelectorAll('.remove-button').forEach(button => {
      button.addEventListener('click', async (e) => {
        const notifId = e.target.getAttribute('data-notif-id');
        const success = await deleteNotification(notifId);
        if (success) {
          loadNotifications(); // Refresh the list
        }
      });
    });
}
  
async function deleteNotification(notificationId) {
    try {
      const response = await fetch(`${API_BASE_URL}/hr/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete notification');
      
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Failed to delete notification');
      return false;
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