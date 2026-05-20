document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        loginError.classList.add('d-none');
        
        const originalBtnHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Authenticating...';
        loginBtn.disabled = true;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success && data.redirect) {
                // Successful login
                window.location.href = data.redirect;
            } else {
                // Show error
                loginError.textContent = data.error || 'Invalid credentials.';
                loginError.classList.remove('d-none');
            }
        } catch (error) {
            loginError.textContent = 'Network error. Please try again later.';
            loginError.classList.remove('d-none');
        } finally {
            loginBtn.innerHTML = originalBtnHtml;
            loginBtn.disabled = false;
        }
    });
});
