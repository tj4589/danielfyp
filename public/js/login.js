document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const registerForm = document.getElementById('register-form');
    const regUsername = document.getElementById('reg-username');
    const regPassword = document.getElementById('reg-password');
    const registerBtn = document.getElementById('register-btn');
    const registerError = document.getElementById('register-error');
    const registerSuccess = document.getElementById('register-success');

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
                // Successful login - save token and role
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                localStorage.setItem('userId', data.id);
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

    // Toggle to show registration form
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('d-none');
            registerForm.classList.remove('d-none');
        });
    }
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
            registerError.classList.add('d-none');
            registerSuccess.classList.add('d-none');
        });
    }

    // Registration handler
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            registerError.classList.add('d-none');
            registerSuccess.classList.add('d-none');
            const orig = registerBtn.innerHTML;
            registerBtn.innerHTML = 'Creating...';
            registerBtn.disabled = true;
            try {
                const username = regUsername.value.trim();
                const password = regPassword.value;
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    registerSuccess.classList.remove('d-none');
                    // optionally auto-switch to login
                    setTimeout(() => {
                        registerForm.classList.add('d-none');
                        loginForm.classList.remove('d-none');
                    }, 1000);
                } else {
                    registerError.textContent = data.error || 'Registration failed.';
                    registerError.classList.remove('d-none');
                }
            } catch (err) {
                registerError.textContent = 'Network error. Try again later.';
                registerError.classList.remove('d-none');
            } finally {
                registerBtn.innerHTML = orig;
                registerBtn.disabled = false;
            }
        });
    }
});
