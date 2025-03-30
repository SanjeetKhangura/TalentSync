document.getElementById('loginForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  // Get form elements
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const responseMessage = document.getElementById('responseMessage');
  const submitButton = document.querySelector('button[type="submit"]');

  // Clear previous messages
  responseMessage.textContent = '';
  responseMessage.className = '';

  // Validate inputs
  if (!emailInput.value || !passwordInput.value) {
    showError('Please fill in all fields');
    return;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailInput.value)) {
    showError('Please enter a valid email address');
    return;
  }

  // Show loading state
  submitButton.disabled = true;
  submitButton.textContent = 'Loading...';

  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });

    const result = await response.json();

    // Handle response
    if (!response.ok) {
      throw new Error(result.message || 'Login failed. Please try again.');
    }

    // Store token securely
    localStorage.setItem('token', result.token);
    console.log('Login successful, token stored');

    // Show success message
    showSuccess('Login successful! Redirecting...');

    // Redirect based on role
    setTimeout(() => {
      if (result.redirect) {
        window.location.href = result.redirect;
      } else {
        // Fallback if redirect URL not provided
        const dashboardMap = {
          'Applicant': 'applicant-dashboard.html',
          'HR': 'hr-dashboard.html',
          'Admin': 'admin-dashboard.html'
        };
        window.location.href = dashboardMap[result.role] || 'login.html';
      }
    }, 1500);

  } catch (error) {
    console.error('Login error:', error);
    showError(error.message || 'An error occurred during login.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Login';
  }

  // Helper functions
  function showError(message) {
    responseMessage.textContent = message;
    responseMessage.classList.add('error-message');
  }

  function showSuccess(message) {
    responseMessage.textContent = message;
    responseMessage.classList.add('success-message');
  }
});