document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
  
    // Decode token to get user info
    const decodedToken = jwt_decode(token);
    const userId = decodedToken.userId;
    
    // DOM Elements
    const sidebarLinks = document.querySelectorAll('.sidebar li');
    const contentSections = document.querySelectorAll('.content-section');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Initialize dashboard
    initDashboard(userId);
  
    // Sidebar navigation
    sidebarLinks.forEach(link => {
      if (link.id !== 'logoutBtn') {
        link.addEventListener('click', function() {
          const sectionId = this.getAttribute('data-section');
          showSection(sectionId);
          
          // Update active state
          sidebarLinks.forEach(l => l.classList.remove('active'));
          this.classList.add('active');
        });
      }
    });
  
    // Logout functionality
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    });
  
    // Show initial section
    showSection('dashboard');
  
    // Initialize form submissions
    initForms(userId);
  });
  
  function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${sectionId}Section`).classList.add('active');
    
    // Load section-specific data
    switch(sectionId) {
      case 'dashboard':
        loadDashboardData();
        break;
      case 'profile':
        loadProfileData();
        break;
      case 'jobs':
        loadJobSearch();
        break;
      case 'applications':
        loadApplications();
        break;
      case 'preferences':
        loadPreferences();
        break;
    }
  }
  
  async function initDashboard(userId) {
    try {
      // Fetch user data
      const userResponse = await fetch(`http://localhost:3000/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!userResponse.ok) throw new Error('Failed to fetch user data');
      
      const userData = await userResponse.json();
      
      // Update profile summary
      document.getElementById('userName').textContent = userData.Name;
      document.getElementById('userEmail').textContent = userData.Email;
      
      if (userData.Image) {
        document.getElementById('profileImage').src = `data:image/jpeg;base64,${userData.Image.toString('base64')}`;
      } else {
        document.getElementById('profileImage').src = 'assets/default-profile.png';
      }
      
      // Fetch applicant data
      const applicantResponse = await fetch(`http://localhost:3000/applicants/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!applicantResponse.ok) throw new Error('Failed to fetch applicant data');
      
      const applicantData = await applicantResponse.json();
      localStorage.setItem('applicantId', applicantData.ApplicantID);
      
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      alert('Error loading dashboard data');
    }
  }
  
  function loadDashboardData() {
    const applicantId = localStorage.getItem('applicantId');
    
    // Fetch application stats
    fetch(`http://localhost:3000/applications/stats/${applicantId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(response => response.json())
    .then(stats => {
      document.getElementById('pendingCount').textContent = stats.pending || 0;
      document.getElementById('nextStepCount').textContent = stats.nextStep || 0;
    })
    .catch(error => console.error('Error fetching stats:', error));
    
    // Fetch recommended jobs count
    fetch(`http://localhost:3000/jobs/recommended/count/${applicantId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(response => response.json())
    .then(data => {
      document.getElementById('recommendedCount').textContent = data.count || 0;
    })
    .catch(error => console.error('Error fetching recommended jobs:', error));
    
    // Fetch recent activity
    fetch(`http://localhost:3000/notifications/user/${userId}?limit=5`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(response => response.json())
    .then(notifications => {
      const activityList = document.getElementById('activityList');
      activityList.innerHTML = '';
      
      notifications.forEach(notification => {
        const li = document.createElement('li');
        li.innerHTML = `
          <p>${notification.Message}</p>
          <small>${new Date(notification.SendDate).toLocaleString()}</small>
        `;
        activityList.appendChild(li);
      });
    })
    .catch(error => console.error('Error fetching notifications:', error));
  }
  
  // Implement similar functions for loadProfileData(), loadJobSearch(), etc.
  // Add event listeners for form submissions
  // Implement modal functionality for job applications
  
  // Note: You'll need to create corresponding API endpoints in server.js