document.getElementById('signupForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  // Get form data
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const image = document.getElementById('image').files[0];
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const dob = document.getElementById('dob').value;
  const educationLevel = document.getElementById('educationLevel').value;
  const degreeField = document.getElementById('degreeField').value;
  const yearsExperience = document.getElementById('yearsExperience').value;

  // Combine education level and field
  const education = degreeField ? `${educationLevel} in ${degreeField}` : educationLevel;
  
  // Create work experience string
  const workExperience = `${yearsExperience} years of experience`;

  // Validate password match
  if (password !== confirmPassword) {
    document.getElementById('responseMessage').textContent = 'Passwords do not match.';
    return;
  }

  // Show loading indicator
  const submitButton = document.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Loading...';

  // Prepare the data to send to the server
  const formData = new FormData();
  formData.append('name', name);
  formData.append('email', email);
  formData.append('phone', phone);
  if (image) formData.append('image', image);
  formData.append('password', password);
  formData.append('confirmPassword', confirmPassword);
  formData.append('dob', dob);
  formData.append('education', education);
  formData.append('workExperience', workExperience);

  // Send the data to the backend
  try {
    const response = await fetch('http://localhost:3000/signup', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    // Reset button state
    submitButton.disabled = false;
    submitButton.textContent = 'Signup';

    // Display the response message
    if (response.ok) {
      document.getElementById('responseMessage').textContent = 'Signup successful! Redirecting to login...';
      // Redirect to the login page after 2 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } else {
      document.getElementById('responseMessage').textContent = result.message || 'Signup failed. Please try again.';
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('responseMessage').textContent = 'An error occurred. Please try again later.';
    submitButton.disabled = false;
    submitButton.textContent = 'Signup';
  }
});