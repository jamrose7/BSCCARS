document.addEventListener("DOMContentLoaded", () => {

    const form = document.querySelector("form");
    const passwordInput = document.querySelector("input[type='password']");
    const eye = document.querySelector(".eye");

    eye.addEventListener("click", () => {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
        } else {
            passwordInput.type = "password";
        }
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const username = form.querySelector("input[type='text']").value;
        const password = passwordInput.value;

        if (username === "" || password === "") {
            alert("Please fill in all fields.");
            return;
        }

        alert("Login successful!");
        
        window.location.href = "user-dashboard.html";
    });

});