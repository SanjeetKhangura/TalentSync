document.addEventListener("DOMContentLoaded", () => {
    // Edit button functionality for job posts and categories
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

    // Remove button functionality for notifications
    document.querySelectorAll('.remove-button').forEach(button => {
        button.addEventListener('click', () => {
            const notification = button.parentElement;
            notification.remove();
        });
    });

    // Search bar functionality for Job Posts
    const jobSearchInput = document.querySelector('.job-posts .search-bar input');
    jobSearchInput.addEventListener('keyup', () => {
        const filter = jobSearchInput.value.toLowerCase();
        const jobs = document.querySelectorAll('.job');
        jobs.forEach(job => {
            const title = job.children[0].innerText.toLowerCase();
            job.style.display = title.includes(filter) ? "" : "none";
        });
    });

    // Search bar functionality for Categories
    const categorySearchInput = document.querySelector('.categories-container .search-bar input');
    categorySearchInput.addEventListener('keyup', () => {
        const filter = categorySearchInput.value.toLowerCase();
        const categories = document.querySelectorAll('.category');
        categories.forEach(category => {
            const title = category.children[0].innerText.toLowerCase();
            category.style.display = title.includes(filter) ? "" : "none";
        });
    });
});