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

    const eyeIcon = modal.querySelector('.eye');
    const passwordInput = modal.querySelector('#password');

    eyeIcon.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.remove('closed');
            eyeIcon.classList.add('open');
            eyeIcon.textContent = '👁️'; 
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('open');
            eyeIcon.classList.add('closed');
            eyeIcon.textContent = '🙈'; 
        }
    });

  
    const signinForm = modal.querySelector('#signinForm');
    signinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        window.location.href = 'residentDashboard.html';
    });
});