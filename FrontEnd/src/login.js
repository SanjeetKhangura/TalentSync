document.getElementById('loginForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const responseMessage = document.getElementById('responseMessage');
  const submitButton = document.querySelector('button[type="submit"]');

  // Clear previous messages
  responseMessage.textContent = '';
  responseMessage.className = 'message';

  // Validate inputs
  if (!emailInput.value || !passwordInput.value) {
    showError('Please fill in all fields');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailInput.value)) {
    showError('Please enter a valid email address');
    return;
  }

  // Show loading state
  submitButton.disabled = true;
  submitButton.textContent = 'Loading...';

  try {
    console.log('Sending login request...');
    const startTime = Date.now();
    
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

    console.log(`Response received after ${Date.now() - startTime}ms`);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server did not return JSON');
    }

    const result = await response.json();
    console.log('Login result:', result);

    if (!response.ok) {
      throw new Error(result.message || `Login failed with status ${response.status}`);
    }

    // Store token securely
    localStorage.setItem('token', result.token);
    console.log('Token stored, redirecting...');

    showSuccess('Login successful! Redirecting...');
    
    // Immediate redirect without timeout
    window.location.href = result.redirect || 'login.html';

  } catch (error) {
    console.error('Login error details:', {
      error: error.message,
      stack: error.stack
    });
    
    showError(error.message || 'An error occurred during login.');
    
    // Reset button even on error
    submitButton.disabled = false;
    submitButton.textContent = 'Login';
  }

  function showError(message) {
    responseMessage.textContent = message;
    responseMessage.classList.add('error-message');
  }

  function showSuccess(message) {
    responseMessage.textContent = message;
    responseMessage.classList.add('success-message');
  }
});