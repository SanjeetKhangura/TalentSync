// JOB POSTS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    const getBriefDescription = (description) => {
        const wordLimit = 15;
        const words = description.split(' ');

        if (words.length > wordLimit) {
            return words.slice(0, wordLimit).join(' ') + ' ...';
        }
        return description;
    };

    const applicationsCount = {};

    // Function to update Applications section when a job is edited
    const updateApplicationsSection = (oldTitle, newTitle) => {
        if (!(newTitle in applicationsCount)) {
            applicationsCount[newTitle] = applicationsCount[oldTitle] || 0;
            delete applicationsCount[oldTitle];
        }

        const applicationDiv = [...document.querySelectorAll('.application')].find(app => {
            return app.querySelector('.application-title').innerText === oldTitle;
        });

        if (applicationDiv) {
            applicationDiv.querySelector('.application-title').innerText = newTitle;
            applicationDiv.querySelector('.application-description').innerText = `Applications: ${applicationsCount[newTitle]}`;
        } else {
            updateApplicationsSection(newTitle);
        }
    };

    const attachJobFunctions = (job) => {
        attachEditFunctionality(job);
        attachRemoveFunctionality(job);
    };

    const attachEditFunctionality = (job) => {
        const editButton = job.querySelector('.edit-button');

        editButton.addEventListener('click', () => {
            const title = job.querySelector('.job-title').innerText;
            const category = job.querySelector('.department').innerText.replace("Category: ", "");
            const email = job.querySelector('.email').innerText;
            const location = job.querySelector('.location').innerText;
            const jobType = job.querySelector('.job-type').innerText;
            const description = job.querySelector('.job-description').innerText;

            const newTitle = prompt("Edit Job Title:", title) || title;
            const newCategory = prompt("Edit Job Category:", category) || category;
            const newEmail = prompt("Edit Job Email:", email) || email;
            const newLocation = prompt("Edit Job Location:", location) || location;
            const newJobType = prompt("Edit Job Type | Education | Work Experience:", jobType) || jobType;
            const newDescription = prompt("Edit Job Description:", description) || description;

            job.querySelector('.job-title').innerText = newTitle;
            job.querySelector('.department').innerText = `Category: ${newCategory}`;
            job.querySelector('.email').innerHTML = `<i class="fas fa-envelope"></i>${newEmail}`;
            job.querySelector('.location').innerHTML = `<i class="fas fa-map-marker-alt"></i>${newLocation}`;
            job.querySelector('.job-type').innerHTML = `<i class="fas fa-info-circle"></i>${newJobType}`;
            job.querySelector('.job-description').innerText = getBriefDescription(newDescription);

            // Update applications section when a job is edited
            if (newTitle) {
                job.querySelector('.job-title').innerText = newTitle;
                updateApplicationsSection(title, newTitle);
            }
        });
    };

    // Creates new Job Post
    const createJobPostButton = document.querySelector('.job-posts-container .create-button');
    const jobPostsContent = document.querySelector('.job-posts-content');

    createJobPostButton.addEventListener('click', () => {
        const jobTitle = prompt("Enter Job Title:");
        const category = prompt("Enter Job Category:");
        const email = prompt("Enter Job Email:");
        const location = prompt("Enter Job Location:");
        const jobType = prompt("Enter Job Type | Education | Work Experience:");
        const jobDescription = prompt("Enter Job Description:");

        // Function to update Applications section when a job is created
        const createApplication = (jobTitle) => {
            const applicationsContainer = document.querySelector('.applications-container .applications-content');

            const newApplicationDiv = document.createElement('div');
            newApplicationDiv.className = 'application';
            newApplicationDiv.innerHTML = `
            <h3 class="application-title">${jobTitle}</h3>
            <p class="application-description">Applications: 0</p>
            <div class="button-wrapper">
                <button class="view-button">View</button>
            </div>
        `;

            applicationsContainer.appendChild(newApplicationDiv);
        };

        if (jobTitle && category && location && jobType && jobDescription) {
            const newJobDiv = document.createElement('div');
            newJobDiv.className = 'job';
            newJobDiv.innerHTML = `
                <h3 class="job-title">${jobTitle}</h3>
                <p class="department">Category: ${category}</p>
                <p class="email"><i class="fas fa-envelope"></i> ${email}</p>
                <p class="location"><i class="fas fa-map-marker-alt"></i>${location}</p>
                <p class="job-type"><i class="fas fa-info-circle"></i>${jobType}</p>
                <p class="job-description">Job Description: ${getBriefDescription(jobDescription)}</p>
                <div class="button-wrapper">
                    <button class="edit-button">Edit</button>
                    <button class="remove-button">X</button>
                </div>
            `;

            jobPostsContent.appendChild(newJobDiv);
            attachJobFunctions(newJobDiv);
            // Create a new application for the job post
            createApplication(jobTitle);
        }
    });

    // Search bar function
    const searchInput = document.querySelector('.job-posts-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.job').forEach(job => {
            const title = job.querySelector('.job-title').innerText.toLowerCase();
            job.style.display = title.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    document.querySelectorAll('.job').forEach(job => {
        attachJobFunctions(job);
    });
});

// APPLICATIONS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.querySelector('.applications-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.application').forEach(application => {
            const title = application.querySelector('.application-title').innerText.toLowerCase();
            application.style.display = title.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    const filterButton = document.querySelector('.applications-container .filter-button');
    filterButton.addEventListener('click', () => {
        alert("Filters functionality not yet implemented.");
    });

    const viewButtons = document.querySelectorAll('.applications-container .view-button');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const applicationTitle = button.closest('.application').querySelector('.application-title').innerText;

            // Simulated data for applications count; replace with actual data
            const applicationCount = Math.floor(Math.random() * 10);
            alert(`Total applications for ${applicationTitle}: ${applicationCount}`);
        });
    });
});

// VIEW APPLICANTS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.querySelector('.view-applicants-container .search-bar input');
    const detailButtons = document.querySelectorAll('.details-button');
    const popup = document.getElementById('applicant-popup');
    const backdrop = document.getElementById('backdrop');

    // Function for showing the popup
    function showPopup(jobTitle) {
        popup.querySelector('.view-job-title').innerText = jobTitle;

        // Display the popup and the backdrop
        popup.style.display = 'block';
        backdrop.style.display = 'block';
    }

    function hidePopup() {
        popup.style.display = 'none';
        backdrop.style.display = 'none';
    }

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.user').forEach(user => {
            const name = user.querySelector('.name').innerText.toLowerCase();
            const jobTitle = user.querySelector('.view-job-title').innerText.toLowerCase();
            const dueDate = user.querySelector('.application-due-date').innerText.toLowerCase();
            const category = user.querySelector('.user-category').innerText.toLowerCase();

            const matches = name.includes(searchTerm) || jobTitle.includes(searchTerm) || dueDate.includes(searchTerm) || category.includes(searchTerm);
            user.style.display = matches ? 'flex' : 'none';
        });
    });

    detailButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const user = event.target.closest('.user');
            const applicantName = user.querySelector('.name').innerText;
            showPopup(applicantName); // Call updated showPopup
        });
    });

    // Close the popup if clicked outside of it
    window.addEventListener('click', (event) => {
        if (event.target === backdrop) { // Check if backdrop is clicked
            hidePopup();
        }
    });
});

// NOTIFICATIONS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    // Function to handle deleting notifications
    const attachRemoveNotificationFunctionality = (notification) => {
        const removeButton = notification.querySelector('.remove-button');

        removeButton.addEventListener('click', () => {
            const title = notification.querySelector('.notification-title').innerText;
            notification.remove(); // Remove the notification

        });
    };

    // Search bar functionality for notifications
    const searchInput = document.querySelector('.notifications-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();

        // Filter notifications based on the search term
        document.querySelectorAll('.notification').forEach(notification => {
            const title = notification.querySelector('.notification-title').innerText.toLowerCase();
            const description = notification.querySelector('.notification-description').innerText.toLowerCase();
            // Show notification if title or description matches the search term
            notification.style.display = title.includes(searchTerm) || description.includes(searchTerm) ? 'block' : 'none';
        });
    });

    // Attach removal functionality to all existing notifications
    document.querySelectorAll('.notification').forEach(notification => {
        attachRemoveNotificationFunctionality(notification);
    });
});