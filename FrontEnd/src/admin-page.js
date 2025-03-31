document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', function() {
        //Gets the parent job post or category
        const parent = this.parentElement;
        
        //Gets current title and description
        const titleElement = parent.querySelector('h5');
        const descriptionElement = parent.querySelector('p');
        
        //Asks admin for new title and description
        const newTitle = prompt("Edit the title:", titleElement.textContent);
        const newDescription = prompt("Edit the description:", descriptionElement.textContent);
            
        //Updates the title and description if new values are provided
            if (newTitle) {
                titleElement.textContent = newTitle;
            }
            if (newDescription) {
                descriptionElement.textContent = newDescription;
            }
            console.log('Updated item:', titleElement.textContent, descriptionElement.textContent);
    });
});