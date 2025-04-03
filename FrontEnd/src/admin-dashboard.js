//----------JOB POSTS QUADRANT FUNCTIONS----------//
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
                job.style.display = 'flex';
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

//----------CATEGORIES QUADRANT FUNCTIONS----------//
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

//----------NOTIFICATIONS QUADRANT FUNCTIONS----------//
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

//----------HR STAFF QUADRANT FUNCTIONS----------//
document.addEventListener("DOMContentLoaded", () => {
    // Function to attach edit functionality to each staff member
    const attachEditFunctionality = (staffMember) => {
        const editButton = staffMember.querySelector('.edit-button');

        // Add click event to edit staff member details
        editButton.addEventListener('click', () => {
            const firstName = staffMember.querySelector('.name.first-name').innerText.split(" ")[0];
            const lastName = staffMember.querySelector('.name.first-name').innerText.split(" ")[1];
            const id = staffMember.querySelector('.staff-id').innerText;
            const email = staffMember.querySelector('.email').innerText.slice(1);
            const phone = staffMember.querySelector('.phone').innerText.slice(1);

            // Prompts for new details
            const newFirstName = prompt("Edit First Name:", firstName);
            const newLastName = prompt("Edit Last Name:", lastName);
            const newId = prompt("Edit ID:", id);
            const newEmail = prompt("Edit Email:", email);
            const newPhone = prompt("Edit Phone:", phone);

            // Updates staff member details if provided
            if (newFirstName) {
                staffMember.querySelector('.name.first-name').innerText = `${newFirstName} ${newLastName}`;
            }
            if (newId) {
                staffMember.querySelector('.staff-id').innerText = newId;
            }
            if (newEmail) {
                staffMember.querySelector('.email').innerHTML = `<i class="fas fa-envelope"></i>${newEmail}`;
            }
            if (newPhone) {
                staffMember.querySelector('.phone').innerHTML = `<i class="fas fa-phone"></i>${newPhone}`;
            }
        });
    };

    // Function to attach remove functionality to each staff member
    const attachRemoveFunctionality = (staffMember) => {
        const removeButton = staffMember.querySelector('.remove-button');

        // Add click event to confirm and remove staff member
        removeButton.addEventListener('click', () => {
            const firstName = staffMember.querySelector('.name.first-name').innerText;
            const id = staffMember.querySelector('.staff-id').innerText;
            if (confirm(`Deleting ${id} - ${firstName}; Are you sure?`)) {
                staffMember.remove();
            }
        });
    };

    // Attach functionality to existing staff members
    document.querySelectorAll('.staff-member').forEach(staffMember => {
        attachEditFunctionality(staffMember);
        attachRemoveFunctionality(staffMember);
    });

    // Creates staff member button functionality
    const createStaffButton = document.querySelector('.hr-staff-container .create-button');
    const hrStaffContent = document.querySelector('.hr-staff-content');

    createStaffButton.addEventListener('click', () => {
        const id = prompt("Enter Staff ID:");
        const fullName = prompt("Enter Full Name:");
        const email = prompt("Enter Email:");
        const phone = prompt("Enter Phone:");

        // Add new staff member div if ID and name are provided
        if (id && fullName) {
            const newStaffDiv = document.createElement('div');
            newStaffDiv.className = 'staff-member';
            const [firstName, lastName] = fullName.split(' ');
            newStaffDiv.innerHTML = `
                <div class="avatar"><i class="fas fa-user-circle"></i></div>
                <p class="staff-id">${id}</p>
                <div class="staff-details">
                    <p class="name first-name">${firstName} ${lastName}</p>
                    <p class="email"><i class="fas fa-envelope"></i>@${email}</p>
                    <p class="phone"><i class="fas fa-phone"></i>+${phone}</p>
                </div>
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

    // Functionality for search bar in HR staff container
    const searchInput = document.querySelector('.hr-staff-container .search-bar input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        document.querySelectorAll('.staff-member').forEach(staffMember => {
            const name = staffMember.querySelector('.name.first-name').innerText.toLowerCase();
            const id = staffMember.querySelector('.staff-id').innerText.toLowerCase();

            // Show or hide staff members based on search term
            if (name.includes(searchTerm) || id.includes(searchTerm)) {
                staffMember.style.display = 'block';
            } else {
                staffMember.style.display = 'none';
            }
        });
    });
});