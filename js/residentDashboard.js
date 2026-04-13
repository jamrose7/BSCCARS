document.addEventListener("DOMContentLoaded", () => {

    console.log("Dashboard loaded");

    const logout = document.querySelector(".logout");

    logout.addEventListener("click", () => {
        const confirmLogout = confirm("Are you sure you want to logout?");
        
        if (confirmLogout) {
            window.location.href = "login.html";
        }
    });

});