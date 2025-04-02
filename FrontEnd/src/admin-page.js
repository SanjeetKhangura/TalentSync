document.addEventListener("DOMContentLoaded", () => {
    // Edit functionality for job posts and categories
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', () => {
            const item = button.parentElement;
            const title = item.children[0].innerText;
            const newTitle = prompt("Edit title:", title);
            if (newTitle) {
                item.children[0].innerText = newTitle;
            }
        });
    });

    // Remove functionality for notifications
    document.querySelectorAll('.remove-button').forEach(button => {
        button.addEventListener('click', () => {
            const notification = button.parentElement;
            notification.remove();
        });
    });

    // Search functionality for Job Posts
    const jobSearchInput = document.querySelector('.job-posts .search-bar input');
    jobSearchInput.addEventListener('keyup', () => {
        const filter = jobSearchInput.value.toLowerCase();
        const jobs = document.querySelectorAll('.job');
        jobs.forEach(job => {
            const title = job.children[0].innerText.toLowerCase();
            job.style.display = title.includes(filter) ? "" : "none";
        });
    });

    // Search functionality for Categories
    const categorySearchInput = document.querySelector('.categories-container .search-bar input');
    categorySearchInput.addEventListener('keyup', () => {
        const filter = categorySearchInput.value.toLowerCase();
        const categories = document.querySelectorAll('.category');
        categories.forEach(category => {
            const title = category.children[0].innerText.toLowerCase();
            category.style.display = title.includes(filter) ? "" : "none";
        });
    });

    // Search functionality for HR Staff
    const hrSearchInput = document.querySelector('.hr-staff .search-bar input');
    hrSearchInput.addEventListener('keyup', () => {
        const filter = hrSearchInput.value.toLowerCase();
        const staffMembers = document.querySelectorAll('.staff-member');
        staffMembers.forEach(member => {
            const name = member.innerText.toLowerCase();
            member.style.display = name.includes(filter) ? "" : "none";
        });
    });

    // Search functionality for Notifications
    const notificationSearchInput = document.querySelector('.notifications .search-bar input');
    notificationSearchInput.addEventListener('keyup', () => {
        const filter = notificationSearchInput.value.toLowerCase();
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            const description = notification.innerText.toLowerCase();
            notification.style.display = description.includes(filter) ? "" : "none";
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    // Existing event listeners...

    // Create new staff member functionality
    const createButton = document.querySelector('.create-button');
    const hrStaffContent = document.querySelector('.hr-staff-content');

    createButton.addEventListener('click', () => {
        const staffID = prompt("Enter Staff Member ID:");
        const staffName = prompt("Enter Staff Member Name:");

        if (staffID && staffName) {
            const staffMemberDiv = document.createElement('div');
            staffMemberDiv.className = 'staff-member';
            staffMemberDiv.innerHTML = `
                <div class="avatar"><i class="fas fa-user"></i></div>
                <p># ${staffID}</p>
                <p>${staffName}</p>
            `;

            hrStaffContent.appendChild(staffMemberDiv);
        }
    });

    // Add search functionality for HR Staff -- unchanged
    const hrSearchInput = document.querySelector('.hr-staff-container .search-bar input');
    hrSearchInput.addEventListener('keyup', () => {
        const filter = hrSearchInput.value.toLowerCase();
        const staffMembers = hrStaffContent.querySelectorAll('.staff-member');
        staffMembers.forEach(member => {
            const name = member.innerText.toLowerCase();
            member.style.display = name.includes(filter) ? "" : "none";
        });
    });
});