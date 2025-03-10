document.getElementById('signupForm').addEventListener('submit', async function (event) {
    event.preventDefault();
  
    // Get form data
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
  
    // Validate password match
    if (password !== confirmPassword) {
      document.getElementById('responseMessage').textContent = 'Passwords do not match.';
      return;
    }
  
    // Prepare the data to send to the server
    const signupData = {
      name,
      email,
      password,
    };
  
    // Send the data to the backend
    try {
      const response = await fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
      });
  
      const result = await response.json();
  
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
    }
  });