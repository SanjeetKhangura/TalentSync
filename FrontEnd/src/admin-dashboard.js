// JOB POSTS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
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
    });
});

// CATEGORIES QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    
    // Functionality to edit categories
    const attachEditFunctionality = (category) => {
        const editButton = category.querySelector('.edit-button');
        
        editButton.addEventListener('click', () => {
            const title = category.querySelector('.category-title').innerText;
            const description = category.querySelector('.category-description').innerText;
            const newTitle = prompt("Edit Category Title:", title);
            const newDescription = prompt("Edit Category Description", description);

            if (newTitle) {
                category.querySelector('.category-title').innerText = newTitle;
            }
            if (newDescription) {
                category.querySelector('.category-description').innerText = getBriefDescription(newDescription);
            }
        });
    };

    // Function to limit description with ellipsis
    const getBriefDescription = (description) => {
        const wordLimit = 20; // Sets word limit
        const words = description.split(' ');

        if (words.length > wordLimit) {
            return words.slice(0, wordLimit).join(' ') + ' ...';
        }
        return description;
    };

    // Functionality to remove categories
    const attachRemoveFunctionality = (category) => {
        const removeButton = category.querySelector('.remove-button');
        
        removeButton.addEventListener('click', () => {
            const title = category.querySelector('.category-title').innerText;
            if (confirm(`Deleting ${title}; Are you sure?`)) {
                category.remove();
            }
        });
    };

    // Attach functionality to existing categories
    document.querySelectorAll('.category').forEach(category => {
        attachEditFunctionality(category);
        attachRemoveFunctionality(category);
    });

    // Functionality to add new categories
    const createCategoryButton = document.querySelector('.categories-container .create-button');
    const categoriesContent = document.querySelector('.categories-content');

    createCategoryButton.addEventListener('click', () => {
        const categoryTitle = prompt("Enter Category Title:");
        const categoryDescription = prompt("Enter Category Description:");

        if (categoryTitle && categoryDescription) {
            const newCategoryDiv = document.createElement('div');
            newCategoryDiv.className = 'category';
            newCategoryDiv.innerHTML = `
                <h3 class="category-title">${categoryTitle}</h3>
                <p class="category-description">${getBriefDescription(categoryDescription)}</p>
                <div class="button-wrapper">
                    <button class="edit-button">Edit</button>
                    <button class="remove-button">X</button>
                </div>
            `;
            categoriesContent.appendChild(newCategoryDiv);
            attachEditFunctionality(newCategoryDiv);
            attachRemoveFunctionality(newCategoryDiv);
        }
    });

    // Functionality for search bar
    const searchInput = document.querySelector('.categories-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.category').forEach(category => {
            const title = category.querySelector('.category-title').innerText.toLowerCase();

            // Show or hide categories based on search term
            if (title.includes(searchTerm)) {
                category.style.display = 'block';
            } else {
                category.style.display = 'none';
            }
        });
    });
});

// NOTIFICATIONS QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    
    // Functionality to remove notifications
    const attachRemoveFunctionality = (notification) => {
        const removeButton = notification.querySelector('.remove-button');
        
        removeButton.addEventListener('click', () => {
                notification.remove();
        });
    };

    // Attach functionality to existing notifications
    document.querySelectorAll('.notification').forEach(notification => {
        attachRemoveFunctionality(notification);
    });

    // Functionality for search bar
    const searchInput = document.querySelector('.notifications-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.notification').forEach(notification => {
            const title = notification.querySelector('.notification-title').innerText.toLowerCase();

            // Show or hide notifications based on search term
            if (title.includes(searchTerm)) {
                notification.style.display = 'block';
            } else {
                notification.style.display = 'none';
            }
        });
    });
});

// HR STAFF QUADRANT FUNCTIONS
document.addEventListener("DOMContentLoaded", () => {
    // Functionality to edit staff members
    const attachEditFunctionality = (staffMember) => {
        const editButton = staffMember.querySelector('.edit-button');
        
        editButton.addEventListener('click', () => {
            const firstName = staffMember.querySelector('.name.first-name').innerText;
            const lastName = staffMember.querySelector('.name.last-name').innerText;
            const id = staffMember.querySelector('.staff-id').innerText;

            const newFirstName = prompt("Edit First Name:", firstName);
            const newLastName = prompt("Edit Last Name:", lastName);
            const newId = prompt("Edit ID:", id);

            if (newFirstName) {
                staffMember.querySelector('.name.first-name').innerText = newFirstName;
            }
            if (newLastName) {
                staffMember.querySelector('.name.last-name').innerText = newLastName;
            }
            if (newId) {
                staffMember.querySelector('.staff-id').innerText = newId;
            }
        });
    };

    // Functionality to remove staff members
    const attachRemoveFunctionality = (staffMember) => {
        const removeButton = staffMember.querySelector('.remove-button');
        
        removeButton.addEventListener('click', () => {
            const firstName = staffMember.querySelector('.name.first-name').innerText;
            const lastName = staffMember.querySelector('.name.last-name').innerText;
            const id = staffMember.querySelector('.staff-id').innerText;
            if (confirm(`Deleting ${id} - ${firstName} ${lastName}; Are you sure?`)) {
                staffMember.remove();
            }
        });
    };

    // Attach functionality to existing staff members
    document.querySelectorAll('.staff-member').forEach(staffMember => {
        attachEditFunctionality(staffMember);
        attachRemoveFunctionality(staffMember);
    });

    // Functionality to add new staff members
    const createStaffButton = document.querySelector('.hr-staff-container .create-button');
    const hrStaffContent = document.querySelector('.hr-staff-content');

    createStaffButton.addEventListener('click', () => {
        const id = prompt("Enter Staff ID:");
        const firstName = prompt("Enter First Name:");
        const lastName = prompt("Enter Last Name:");

        if (id && firstName && lastName) {
            const newStaffDiv = document.createElement('div');
            newStaffDiv.className = 'staff-member';
            newStaffDiv.innerHTML = `
                <div class="avatar"><i class="fas fa-user"></i></div>
                <p class="staff-id">${id}</p>
                <p class="name first-name">${firstName}</p>
                <p class="name last-name">${lastName}</p>
                <div class="button-wrapper">
                    <button class="edit-button"><i class="fas fa-pencil-alt"></i></button>
                    <button class="remove-button">X</button>
                </div>
            `;
            hrStaffContent.appendChild(newStaffDiv);
            attachEditFunctionality(newStaffDiv);
            attachRemoveFunctionality(newStaffDiv);
        }
    });

    // Functionality for search bar
    const searchInput = document.querySelector('.hr-staff-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.staff-member').forEach(staffMember => {
            const firstName = staffMember.querySelector('.name.first-name').innerText.toLowerCase();
            const lastName = staffMember.querySelector('.name.last-name').innerText.toLowerCase();
            const id = staffMember.querySelector('.staff-id').innerText.toLowerCase();

            // Show or hide staff members based on search term
            if (firstName.includes(searchTerm) || lastName.includes(searchTerm) || id.includes(searchTerm)) {
                staffMember.style.display = 'block';
            } else {
                staffMember.style.display = 'none';
            }
        });
    });
});