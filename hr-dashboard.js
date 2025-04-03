// JOB POSTS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    // Functionality to limit description with ellipsis
    const getBriefDescription = (description) => {
        const wordLimit = 15; // Sets word limit
        const words = description.split(' ');

        if (words.length > wordLimit) {
            return words.slice(0, wordLimit).join(' ') + ' ...';
        }
        return description;
    };

    // Functionality to edit job posts
    const attachEditFunctionality = (job) => {
        const editButton = job.querySelector('.edit-button');
        
        editButton.addEventListener('click', () => {
            const title = job.querySelector('.job-title').innerText;
            const category = job.querySelector('.department').innerText.replace("Category: ", "");
            const email = job.querySelector('.email').innerText;
            const location = job.querySelector('.location').innerText;
            const jobType = job.querySelector('.job-type').innerText;
            const description = job.querySelector('.job-description').innerText;

            const newTitle = prompt("Edit Job Title:", title);
            const newCategory = prompt("Edit Job Category:", category);
            const newEmail = prompt("Edit Job Email:", email);
            const newLocation = prompt("Edit Job Location:", location);
            const newJobType = prompt("Edit Job Type | Education | Work Experience:", jobType);
            const newDescription = prompt("Edit Job Description:", description);

            if (newTitle) {
                job.querySelector('.job-title').innerText = newTitle;
            }
            if (newCategory) {
                job.querySelector('.department').innerText = `Category: ${newCategory}`;
            }
            if (newEmail) {
                job.querySelector('.email').innerHTML = `<i class="fas fa-envelope"></i>${newEmail}`;
            }
            if (newLocation) {
                job.querySelector('.location').innerHTML = `<i class="fas fa-map-marker-alt"></i>${newLocation}`;
            }
            if (newJobType) {
                job.querySelector('.job-type').innerHTML = `<i class="fas fa-info-circle"></i>${newJobType}`;
            }
            if (newDescription) {
                job.querySelector('.job-description').innerText = getBriefDescription(newDescription);
            }
        });
    };

    // Functionality to remove job posts
    const attachRemoveFunctionality = (job) => {
        const removeButton = job.querySelector('.remove-button');
        
        removeButton.addEventListener('click', () => {
            const title = job.querySelector('.job-title').innerText;
            if (confirm(`Deleting ${title}; Are you sure?`)) {
                job.remove();
            }
        });
    };

    // Functionality to add new job posts
    const createJobPostButton = document.querySelector('.job-posts-container .create-button');
    const jobPostsContent = document.querySelector('.job-posts-content');

    createJobPostButton.addEventListener('click', () => {
        const jobTitle = prompt("Enter Job Title:");
        const category = prompt("Enter Job Category:");
        const email = prompt("Enter Job Email:");
        const location = prompt("Enter Job Location:");
        const jobType = prompt("Enter Job Type | Education | Work Experience:");
        const jobDescription = prompt("Enter Job Description:");

        if (jobTitle && category && location && jobType && jobDescription) {
            const newJobDiv = document.createElement('div');
            newJobDiv.className = 'job';
            newJobDiv.innerHTML = `
                <h3 class="job-title">${jobTitle}</h3>
                <p class="department">Category: ${category}</p>
                <p class="email"><i class="fas fa-envelope"></i> ${email}</p>
                <p class="location"><i class="fas fa-map-marker-alt"></i> ${location}</p>
                <p class="job-type"><i class="fas fa-info-circle"></i>${jobType}</p>
                <p class="job-description">Job Description: ${getBriefDescription(jobDescription)}</p>
                <div class="button-wrapper">
                    <button class="edit-button">Edit</button>
                    <button class="remove-button">X</button>
                </div>
            `;
            jobPostsContent.appendChild(newJobDiv);
            attachEditFunctionality(newJobDiv);
            attachRemoveFunctionality(newJobDiv);
        }
    });

    // Functionality for search bar
    const searchInput = document.querySelector('.job-posts-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.job').forEach(job => {
            const title = job.querySelector('.job-title').innerText.toLowerCase();
            // Show or hide job based on search term
            if (title.includes(searchTerm)) {
                job.style.display = 'flex'; // Change 'block' to 'flex' for better layout
            } else {
                job.style.display = 'none';
            }
        });
    });

    // Attach functionality to existing job posts
    document.querySelectorAll('.job').forEach(job => {
        attachRemoveFunctionality(job);
        attachEditFunctionality(job);
    });
});

// APPLICATIONS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    // Functionality for search bar
    const searchInput = document.querySelector('.applications-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.application').forEach(application => {
            const title = application.querySelector('.application-title').innerText.toLowerCase();

            // Show or hide applications based on search term
            if (title.includes(searchTerm)) {
                application.style.display = 'flex'; // Adjust to 'block' or 'flex' based on your CSS
            } else {
                application.style.display = 'none';
            }
        });
    });

    // Functionality for Filters
    const filterButton = document.querySelector('.applications-container .filter-button');
    filterButton.addEventListener('click', () => {
        alert("Filters functionality not yet implemented.");
        // Add Filter Code Here ***
    });

    // Functionality for View Button
    const viewButtons = document.querySelectorAll('.applications-container .view-button');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const applicationTitle = button.closest('.application').querySelector('.application-title').innerText;
            // Simulated data for applications count --> will be edited once HR is set up properly
            const applicationCount = Math.floor(Math.random() * 10); // Random count for demonstration
            
            alert(`Total applications for ${applicationTitle}: ${applicationCount}`);
        });
    });
});