document.addEventListener("DOMContentLoaded", () => {
    console.log("Landing page loaded");

    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Modal functionality
    const signInBtns = document.querySelectorAll('.sign-in-btn');
    const modal = document.getElementById('loginModal');
    const closeBtn = modal.querySelector('.close-modal');

    signInBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Password toggle
    const eyeIcon = modal.querySelector('.eye');
    const passwordInput = modal.querySelector('#password');

    eyeIcon.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.remove('closed');
            eyeIcon.classList.add('open');
            eyeIcon.textContent = '👁️'; // or appropriate icon
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('open');
            eyeIcon.classList.add('closed');
            eyeIcon.textContent = '🙈'; // or appropriate icon
        }
    });

    // Form submission
    const loginForm = modal.querySelector('#loginForm');
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // For demo, redirect to resident dashboard
        window.location.href = 'residentDashboard.html';
    });
});