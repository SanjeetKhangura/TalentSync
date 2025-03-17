document.getElementById('loginForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  // Get form data
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // Show loading indicator
  const submitButton = document.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Loading...';

  // Prepare the data to send to the server
  const loginData = {
    email,
    password,
  };

  // Send the data to the backend
  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    const result = await response.json();

    // Reset button state
    submitButton.disabled = false;
    submitButton.textContent = 'Login';

    if (!response.ok) {
      throw new Error(result.message || 'Login failed. Please try again.');
    }

    // Display the response message
    document.getElementById('responseMessage').textContent = 'Login successful! Redirecting...';

    // Redirect based on user role
    if (result.role === 'Applicant') {
      window.location.href = 'applicant-dashboard.html';
    } else if (result.role === 'HR') {
      window.location.href = 'hr-dashboard.html';
    } else if (result.role === 'Admin') {
      window.location.href = 'admin-dashboard.html';
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('responseMessage').textContent = error.message || 'An error occurred. Please try again later.';
  }
});