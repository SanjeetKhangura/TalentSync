// // Global variables
// let currentAdminId = null;

// //Verify admin status and permissions
// async function verifyAdmin() {
//     const token = localStorage.getItem('token');
//     if (!token) throw new Error('No authentication token');
  
//     try {
//       const response = await fetch('http://localhost:3000/users/me', {
//         headers: { 
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         credentials: 'include'
//       });
  
//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.message || 'Authentication failed');
//       }
      
//       const user = await response.json();
      
//       if (user.role !== 'Admin' || !user.adminId) {
//         throw new Error('Admin privileges required');
//       }
  
//       return {
//         userId: user.userId,
//         adminId: user.adminId,
//         name: user.name
//       };
//     } catch (error) {
//       console.error('Auth error:', error);
//       throw error;
//     }
// }

// // Initialize dashboard
// document.addEventListener("DOMContentLoaded", async () => {
//     console.log('Stored token:', localStorage.getItem('token'));
    
//     try {
//       const adminData = await verifyAdmin();
//       currentAdminId = adminData.adminId;
      
//       console.log('Admin data:', adminData);
      
//       await loadAllData();
//       setupEventListeners();
      
//     } catch (error) {
//       console.error('Initialization failed:', error);
//       localStorage.removeItem('token');
//       window.location.href = 'login.html';
//     }
// });

// Load all dashboard data
async function loadAllData() {
    try {
        document.getElementById('loading-indicator').style.display = 'block';
        
        await loadJobs();
        await loadCategories().catch(e => console.error("Categories failed:", e));
        await loadHRStaff().catch(e => console.error("HR Staff failed:", e));
        await loadNotifications().catch(e => console.error("Notifications failed:", e));
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        if (error.message.includes('401') || error.message.includes('403')) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    } finally {
        document.getElementById('loading-indicator').style.display = 'none';
    }
}
  
// Display functions
function displayJobs(jobs) {
    const container = document.querySelector('.job-posts-content');
    container.innerHTML = '';

    jobs.forEach(job => {
        const jobElement = document.createElement('div');
        jobElement.className = 'job-card';
        jobElement.dataset.id = job.JobID;
        jobElement.innerHTML = `
            <div class="job-header">
                <h3 class="job-title">${job.JobName || 'New Position'}</h3>
                <span class="job-type">${job.PositionType || 'Full-time'}</span>
            </div>
            <div class="job-meta">
                <span class="job-location">📍 ${job.Location || 'Remote'}</span>
                <span class="job-category">🏷 ${job.CategoryName || 'General'}</span>
            </div>
            <p class="job-dates">⏰ Closes: ${new Date(job.CloseDate).toLocaleDateString()}</p>
            <div class="job-actions">
                <button class="add-category-button">+</button>
                <button class="remove-button">🗑</button>
            </div>
        `;
        container.appendChild(jobElement);
    });

    document.querySelectorAll('.add-category-button').forEach(button => {
        button.addEventListener('click', showCategoryModal);
    });
}

// Show category modal function
async function showCategoryModal(e) {
    const jobId = e.target.closest('.job-card').dataset.id;
    const jobName = e.target.closest('.job-card').querySelector('.job-title').textContent;
    
    try {
        const response = await fetch('http://localhost:3000/admin/categories', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch categories');

        const data = await response.json();
        const categories = Array.isArray(data) ? data : 
                         (data.categories || data.data || []);
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-island">
                    <button class="close-modal">&times;</button>
                    <h3>Assign "${jobName}" to Category</h3>
                    <div class="category-list">
                        ${categories.length > 0 ? 
                            categories.map(cat => `
                                <div class="category-option" data-id="${cat.CategoryID}">
                                    <strong>${cat.Name}</strong>
                                    <small>ID: ${cat.CategoryID}</small>
                                </div>
                            `).join('') :
                            '<p class="no-categories">No categories available</p>'
                        }
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners
        document.querySelectorAll('.category-option').forEach(option => {
            option.addEventListener('click', async () => {
                try {
                    const response = await fetch(`http://localhost:3000/admin/jobs/${jobId}/category`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ CategoryID: option.dataset.id })
                    });
                    
                    if (!response.ok) throw new Error('Failed to assign category');
                    
                    document.querySelector('.modal-overlay').remove();
                    alert(`"${jobName}" assigned to category successfully!`);
                    await loadJobs();
                } catch (error) {
                    console.error('Error:', error);
                    alert(`Error: ${error.message}`);
                }
            });
        });

        document.querySelector('.close-modal').addEventListener('click', () => {
            document.querySelector('.modal-overlay').remove();
        });
    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to load categories: ${error.message}`);
    }
}

// Assign job to category function
async function assignJobToCategory(jobId, categoryId) {
    const response = await fetch(`http://localhost:3000/admin/jobs/${jobId}/category`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ CategoryID: categoryId })
    });
    
    if (!response.ok) {
        throw new Error('Failed to assign category');
    }
}

function displayCategories(categories) {
    const container = document.querySelector('.categories-content');
    container.innerHTML = '';

    if (!categories || categories.length === 0) {
        container.innerHTML = '<p class="no-categories">No categories found</p>';
        return;
    }

    categories.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category';
        categoryElement.dataset.id = category.CategoryID;
        categoryElement.innerHTML = `
            <h3 class="category-title">${category.Name}</h3>
            <p class="category-description">ID: ${category.CategoryID}</p>
            <div class="button-wrapper">
                <button class="edit-button">Edit</button>
            </div>
        `;
        container.appendChild(categoryElement);
    });
}

// Job Posts functions
async function loadJobs() {
    try {
        console.log("Fetching jobs...");
        const response = await fetch('http://localhost:3000/admin/jobs', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error response:", errorData);
            throw new Error(errorData.message || 'Failed to load jobs');
        }

        const data = await response.json();
        console.log("Jobs data received:", data);
        
        displayJobs(data.jobs || []);
    } catch (error) {
        console.error("Error loading jobs:", error);
        const container = document.querySelector('.job-posts-content');
        container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Categories functions
async function loadCategories() {
    try {
        const response = await fetch('http://localhost:3000/admin/categories', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load categories');
        }

        const data = await response.json();
        console.log("Categories data received:", data); 
        
        
        let categories = Array.isArray(data) ? data : 
                        (Array.isArray(data.categories) ? data.categories : 
                        (Array.isArray(data.data) ? data.data : []));
        
        displayCategories(categories);
    } catch (error) {
        console.error("Error loading categories:", error);
        const container = document.querySelector('.categories-content');
        container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// HR Staff functions
async function loadHRStaff() {
    try {
      const response = await fetch('http://localhost:3000/admin/hr-staff', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load HR staff');
      }
  
      const staff = await response.json();
      const container = document.querySelector('.hr-staff-content');
      container.innerHTML = '';
      
      if (!staff || staff.length === 0) {
        container.innerHTML = '<p class="no-staff">No HR staff found</p>';
        return;
      }
  
      staff.forEach(member => {
        const memberElement = document.createElement('div');
        memberElement.className = 'staff-member';
        memberElement.dataset.id = member.HRID;
        memberElement.innerHTML = `
          <div class="avatar"><i class="fas fa-user-circle"></i></div>
          <p class="staff-id">${member.WorkingID}</p>
          <div class="staff-details">
            <p class="name first-name">${member.Name}</p>
            <p class="email"><i class="fas fa-envelope"></i>${member.Email}</p>
            <p class="phone"><i class="fas fa-phone"></i>${member.Phone}</p>
          </div>
          <div class="button-wrapper">
            <button class="remove-button">X</button>
          </div>
        `;
        container.appendChild(memberElement);
      });
    } catch (error) {
      console.error("Error loading HR staff:", error);
      const container = document.querySelector('.hr-staff-content');
      container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Notifications functions
async function loadNotifications() {
  const response = await fetch('http://localhost:3000/admin/notifications', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const notifications = await response.json();
  const container = document.querySelector('.notifications-content');
  container.innerHTML = '';
  
  notifications.forEach(notification => {
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification';
    notificationElement.dataset.id = notification.NotificationID;
    notificationElement.innerHTML = `
      <h3 class="notification-title">To: ${notification.UserName}</h3>
      <p class="notification-description">${notification.Message.substring(0, 50)}${notification.Message.length > 50 ? '...' : ''}</p>
      <p class="notification-date">${new Date(notification.SendDate).toLocaleString()}</p>
      <div class="button-wrapper">
        <button class="remove-button">X</button>
      </div>
    `;
    container.appendChild(notificationElement);
  });
}

// Setup all event listeners
function setupEventListeners() {
    // Job Posts event listeners
    document.querySelector('.job-posts-container .search-bar input')?.addEventListener('input', searchJobs);
    
    // Categories event listeners
    document.querySelector('.categories-container .search-bar input')?.addEventListener('input', searchCategories);
    document.querySelector('.categories-container .create-button')?.addEventListener('click', createCategory);
    
    // HR Staff event listeners
    document.querySelector('.hr-staff-container .search-bar input')?.addEventListener('input', searchHRStaff);
    document.querySelector('.hr-staff-container .create-button')?.addEventListener('click', createHRStaff);
    
    // Notifications event listeners
    document.querySelector('.notifications-container .search-bar input')?.addEventListener('input', searchNotifications);
    
    // Delegated event listeners for dynamic elements
    document.querySelector('.job-posts-content')?.addEventListener('click', handleJobPostClick);
    document.querySelector('.categories-content')?.addEventListener('click', handleCategoryClick);
    document.querySelector('.hr-staff-content')?.addEventListener('click', handleHRStaffClick);
    document.querySelector('.notifications-content')?.addEventListener('click', handleNotificationClick);
    document.getElementById('logout-link')?.addEventListener('click', handleLogout);

    const reportsLink = document.getElementById('reports-link');
    if (reportsLink) {
        reportsLink.addEventListener('click', function(e) {
            e.preventDefault();
            showReportsModal(e);
        });
    }
}

function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('token');
    
    localStorage.clear();
    
    window.location.href = 'login.html';
    
}

// Search functions
function searchJobs(e) {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.job').forEach(job => {
    const title = job.querySelector('.job-title').textContent.toLowerCase();
    job.style.display = title.includes(term) ? 'flex' : 'none';
  });
}

function searchCategories(e) {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.category').forEach(category => {
    const title = category.querySelector('.category-title').textContent.toLowerCase();
    category.style.display = title.includes(term) ? 'block' : 'none';
  });
}

function searchHRStaff(e) {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.staff-member').forEach(member => {
    const name = member.querySelector('.name').textContent.toLowerCase();
    const id = member.querySelector('.staff-id').textContent.toLowerCase();
    member.style.display = (name.includes(term) || (id.includes(term)) ? 'block' : 'none');
  });
}

function searchNotifications(e) {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.notification').forEach(notification => {
    const title = notification.querySelector('.notification-title').textContent.toLowerCase();
    notification.style.display = title.includes(term) ? 'block' : 'none';
  });
}

// Create functions
async function createCategory() {
    const name = prompt("Enter Category Name:");
    if (!name) return;
    
    try {
        const response = await fetch('http://localhost:3000/admin/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ Name: name })
        });
        
        if (response.ok) {
            await loadCategories();
            alert('Category created successfully!');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create category');
        }
    } catch (error) {
        console.error('Error creating category:', error);
        alert(`Failed to create category: ${error.message}`);
    }
}

async function createHRStaff() {
    const name = prompt("Enter Staff Name:");
    if (!name) return;
    
    const email = prompt("Enter Email:");
    if (!email) return;
    
    const phone = prompt("Enter Phone:");
    if (!phone) return;
    
    const workingId = prompt("Enter Working ID:");
    if (!workingId) return;
    
    const password = prompt("Enter Password:");
    if (!password) return;
    
    try {
        const response = await fetch('http://localhost:3000/admin/hr-staff', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                Name: name,
                Email: email,
                Phone: phone,
                WorkingID: workingId,
                Password: password
            })
        });
        
        if (response.ok) {
            await loadHRStaff();
            alert('HR staff created successfully!');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create HR staff');
        }
    } catch (error) {
        console.error('Error creating HR staff:', error);
        alert(`Failed to create HR staff: ${error.message}`);
    }
}

// Click handlers for dynamic elements
function handleJobPostClick(e) {
    if (e.target.classList.contains('remove-button')) {
      const jobElement = e.target.closest('.job-card');
      
      if (!jobElement) {
        console.error('Could not find job card element');
        return;
      }
  
      const jobId = jobElement.dataset.id;
      
      if (!jobId) {
        console.error('No job ID found in data attributes');
        return;
      }
  
      deleteJob(jobId);
    }
}

function handleCategoryClick(e) {
    const categoryElement = e.target.closest('.category');
    const categoryId = categoryElement.dataset.id;
    
    if (e.target.classList.contains('edit-button')) {
        const currentName = categoryElement.querySelector('.category-title').textContent;
        const newName = prompt("Edit Category Name:", currentName);
        
        if (newName && newName !== currentName) {
            updateCategory(categoryId, newName);
        }
    } else {
        showJobsInCategory(categoryId, categoryElement.querySelector('.category-title').textContent);
    }
}


// Show jobs in category function
async function showJobsInCategory(categoryId, categoryName) {
    try {
        const response = await fetch(`http://localhost:3000/admin/categories/${categoryId}/jobs`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch jobs');

        const data = await response.json();
        const jobs = Array.isArray(data) ? data : (data.jobs || data.data || []);

        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-island">
                    <button class="close-modal">&times;</button>
                    <h3>Jobs in "${categoryName}"</h3>
                    <div class="jobs-list">
                        ${jobs.length > 0 ? 
                            jobs.map(job => `
                                <div class="job-in-category">
                                    <h4>${job.JobName}</h4>
                                    <p>${job.PositionType} • ${job.Location}</p>
                                    <small>Closes: ${new Date(job.CloseDate).toLocaleDateString()}</small>
                                </div>
                            `).join('') :
                            '<p class="no-jobs">No jobs in this category</p>'
                        }
                    </div>
                </div>
            </div>
        `;

        
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.querySelector('.close-modal').addEventListener('click', () => {
            document.querySelector('.modal-overlay').remove();
        });
    } catch (error) {
        console.error('Error:', error);
        alert(`Failed to load jobs: ${error.message}`);
    }
}

function handleHRStaffClick(e) {
    if (e.target.classList.contains('remove-button')) {
      const memberElement = e.target.closest('.staff-member');
      if (!memberElement) {
        console.error('Could not find HR staff element');
        return;
      }
      
      const memberId = memberElement.dataset.id;
      if (!memberId) {
        console.error('No HR staff ID found');
        return;
      }
      
      deleteHRStaff(memberId);
    }
}

function handleNotificationClick(e) {
  if (e.target.classList.contains('remove-button')) {
    const notificationElement = e.target.closest('.notification');
    const notificationId = notificationElement.dataset.id;
    deleteNotification(notificationId);
  }
}

// CRUD operations
async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    try {
      const response = await fetch(`http://localhost:3000/admin/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadJobs();
        alert('Job deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete job');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      alert(`Failed to delete job: ${error.message}`);
    }
}

async function updateCategory(categoryId, newName) {
    try {
      const response = await fetch(`http://localhost:3000/admin/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ Name: newName })
      });
      
      if (response.ok) {
        await loadCategories();
        alert('Category updated successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert(`Failed to update category: ${error.message}`);
    }
}


async function deleteHRStaff(memberId) {
    if (!confirm('Are you sure you want to delete this HR staff member?')) return;
    
    try {
      const response = await fetch(`http://localhost:3000/admin/hr-staff/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadHRStaff();
        alert('HR staff deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete HR staff');
      }
    } catch (error) {
      console.error('Error deleting HR staff:', error);
      alert(`Failed to delete HR staff: ${error.message}`);
    }
}

async function deleteNotification(notificationId) {
  if (!confirm('Are you sure you want to delete this notification?')) return;
  
  try {
    const response = await fetch(`/admin/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      await loadNotifications();
    } else {
      throw new Error('Failed to delete notification');
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    alert('Failed to delete notification');
  }
}

function showReportsModal(e) {
    const modal = document.getElementById('reports-modal');
    if (modal) {
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        
        
        document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
        
        
        modal.style.display = 'flex';
    } else {
        console.error('Reports modal not found');
    }
}

// Close modal
document.addEventListener('click', function(e) {
    const modal = document.getElementById('reports-modal');
    
    if (e.target.classList.contains('close-modal') || 
        (modal && e.target === modal)) {
        modal.style.display = 'none';
    }
});

// Report option selection
document.addEventListener('click', function(e) {
    const reportOption = e.target.closest('.report-option');
    if (reportOption) {
        e.preventDefault();
        const reportType = reportOption.dataset.type;
        const dateSelector = document.querySelector('.date-range-selector');
        
        if (dateSelector) {
            // Marks the selected report option
            document.querySelectorAll('.report-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            reportOption.classList.add('selected');
            
            // Shows date selector and stores report type
            dateSelector.style.display = 'block';
            dateSelector.dataset.reportType = reportType;
        }
    }
});

// Generate report button
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('generate-btn')) {
        e.preventDefault();
        const dateSelector = document.querySelector('.date-range-selector');
        if (!dateSelector) return;
        
        const reportType = dateSelector.dataset.reportType;
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;
        
        if (!reportType) {
            alert('Please select a report type first');
            return;
        }
        
        if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
        }
        
        generateReport(reportType, startDate, endDate);
    }
});

async function generateReport(type, startDate, endDate) {
    const loadingIndicator = document.getElementById('loading-indicator');
    try {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
        
        const response = await fetch(`http://localhost:3000/admin/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                reportType: type,
                startDate,
                endDate
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to generate report');
        }
        
        const reportData = await response.json();
        displayReport(reportData);
        
        const reportsModal = document.getElementById('reports-modal');
        if (reportsModal) {
            reportsModal.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error generating report:', error);
        alert(`Failed to generate report: ${error.message}`);
    } finally {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

function displayReport(data) {
    const { doc, fileName } = generatePDF(data);
    doc.save(fileName);
    alert(`Report downloaded as ${fileName}`);
}

function generatePDF(data) {
    const doc = new window.jsPDF();
    const { reportType, startDate, endDate, data: reportData } = data || {};
    
    if (!reportType || !startDate || !endDate || !reportData) {
        throw new Error('Invalid report data structure');
    }
    
    doc.setProperties({
        title: `${reportType} Recruitment Report`,
        subject: `Report for ${startDate} to ${endDate}`,
        author: 'TalentSync Admin'
    });
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`TalentSync ${reportType} Recruitment Report`, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, 14, 30);
    doc.text(`Generated on: ${formatDate(new Date())}`, 14, 38);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, 196, 42);
    
    switch(reportType) {
        case 'monthly':
            generateMonthlyPDF(doc, reportData, startDate, endDate);
            break;
        case 'yearly':
            generateYearlyPDF(doc, reportData, startDate, endDate);
            break;
        case 'category':
            generateCategoryPDF(doc, reportData, startDate, endDate);
            break;
    }
    
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }
    
    const fileName = `TalentSync_${reportType}_Report_${formatDate(new Date(), true)}.pdf`;
    return { doc, fileName };
}

function generateMonthlyPDF(doc, data, startDate, endDate) {
    doc.setFontSize(16);
    doc.text('Monthly Recruitment Metrics', 14, 50);
    
    doc.autoTable({
        startY: 60,
        head: [['Metric', 'Value']],
        body: [
            ['Total Applications', data.metrics.totalApplications],
            ['Hires', data.metrics.hires],
            ['Shortlisted', data.metrics.shortlisted],
            ['Screened Out', data.metrics.screenedOut],
            ['Hire Rate', `${((data.metrics.hires / data.metrics.totalApplications) * 100).toFixed(1)}%`],
            ['Average Salary', `$${data.metrics.avgSalary.toFixed(2)}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    doc.setFontSize(16);
    doc.text('Top Performing Jobs', 14, doc.lastAutoTable.finalY + 20);
    
    const topJobsData = data.topJobs.map(job => [
        job.JobName,
        job.applications,
        job.hires,
        `$${job.avgSalary.toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Job Title', 'Applications', 'Hires', 'Avg Salary']],
        body: topJobsData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
}

function generateYearlyPDF(doc, data, startDate, endDate) {
    doc.setFontSize(16);
    doc.text('Yearly Recruitment Trends', 14, 50);
    
    const monthlyData = data.monthlyTrends.map(month => [
        month.month,
        month.applications,
        month.hires,
        month.shortlisted
    ]);
    
    doc.autoTable({
        startY: 60,
        head: [['Month', 'Applications', 'Hires', 'Shortlisted']],
        body: monthlyData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    // Department stats
    doc.setFontSize(16);
    doc.text('Department Performance', 14, doc.lastAutoTable.finalY + 20);
    
    const deptData = data.departmentStats.map(dept => [
        dept.category,
        dept.applications,
        dept.hires,
        `$${dept.avgSalary.toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Department', 'Applications', 'Hires', 'Avg Salary']],
        body: deptData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    doc.setFontSize(16);
    doc.text('Yearly Summary', 14, doc.lastAutoTable.finalY + 20);
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Metric', 'Value']],
        body: [
            ['Total Applications', data.yearlySummary.totalApplications],
            ['Total Hires', data.yearlySummary.hires],
            ['Hire Rate', `${data.yearlySummary.hireRate}%`],
            ['Total Salary', `$${data.yearlySummary.totalSalary.toFixed(2)}`],
            ['Average Salary', `$${data.yearlySummary.avgSalary.toFixed(2)}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
}

function generateCategoryPDF(doc, data, startDate, endDate) {
    doc.setFontSize(16);
    doc.text('Category Analysis', 14, 50);
    
    const catData = data.categoryPerformance.map(cat => [
        cat.category,
        cat.applications,
        cat.hires,
        `${cat.hireRate}%`,
        `$${cat.avgSalary.toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: 60,
        head: [['Category', 'Applications', 'Hires', 'Hire Rate', 'Avg Salary']],
        body: catData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    doc.setFontSize(16);
    doc.text('Time to Hire by Category', 14, doc.lastAutoTable.finalY + 20);
    
    const timeData = data.timeToHire.map(item => [
        item.category,
        `${item.avgDaysToHire.toFixed(1)} days`
    ]);
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Category', 'Avg Time to Hire']],
        body: timeData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] }
    });
    
    if (data.sourcesByCategory && data.sourcesByCategory.length > 0) {
        doc.setFontSize(16);
        doc.text('Top Sources by Category', 14, doc.lastAutoTable.finalY + 20);
        
        const sourcesData = data.sourcesByCategory.map(source => [
            source.category,
            source.Source,
            source.count
        ]);
        
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 30,
            head: [['Category', 'Source', 'Count']],
            body: sourcesData,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] }
        });
    }
}

function formatDate(dateString, forFileName = false) {
    const date = new Date(dateString);
    if (forFileName) {
        return `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}