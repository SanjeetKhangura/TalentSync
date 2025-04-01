document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', () => {
            const job = button.parentElement;
            const title = job.children[0].innerText;
            const newTitle = prompt("Edit job title:", title);
            if (newTitle) {
                job.children[0].innerText = newTitle;
            }
        });
    });

    document.querySelectorAll('.remove-button').forEach(button => {
        button.addEventListener('click', () => {
            const notification = button.parentElement;
            notification.remove();
        });
    });
});
