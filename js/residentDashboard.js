document.addEventListener("DOMContentLoaded", () => {

    console.log("Dashboard loaded");

    const signout = document.querySelector(".signout");

    signout.addEventListener("click", () => {
        const confirmSignout = confirm("Are you sure you want to sign out?");
        
        if (confirmSignout) {
            window.location.href = "index.html";
        }
    });

});