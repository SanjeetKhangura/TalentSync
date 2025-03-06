document.getElementById('applicationForm').addEventListener('submit', async function(event) {
    event.preventDefault();
  
    // Get form data
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const preferredJob = document.getElementById('preferredJob').value;
    const education = document.getElementById('education').value;
    const workExperience = document.getElementById('workExperience').value;
  
    // Prepare the data to send to the server
    const applicantData = {
      name,
      email,
      preferredJob,
      education,
      workExperience,
    };
  
    // Send the data to the backend
    try {
      const response = await fetch('http://localhost:3000/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(applicantData),
      });
  
      const result = await response.json();
  
      // Display the response message
      document.getElementById('responseMessage').textContent = result.message;
    } catch (error) {
      document.getElementById('responseMessage').textContent = 'Error submitting application.';
    }
  });
  