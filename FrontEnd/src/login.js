document.getElementById('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
  
    // Get form data
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
  
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
  
      // Display the response message
      if (response.ok) {
        document.getElementById('responseMessage').textContent = 'Login successful! Redirecting...';
        // Redirect to the dashboard or another page
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 2000);
      } else {
        document.getElementById('responseMessage').textContent = result.message || 'Login failed. Please try again.';
      }
    } catch (error) {
      console.error('Error:', error);
      document.getElementById('responseMessage').textContent = 'An error occurred. Please try again later.';
    }
  });