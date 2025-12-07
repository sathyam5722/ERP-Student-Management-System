// // Smooth scroll animation
// document.querySelectorAll('.nav-links a').forEach(link => {
//     link.addEventListener('click', e => {
//         e.preventDefault();
//         let target = document.querySelector(e.target.getAttribute('href'));
//         target.scrollIntoView({ behavior: "smooth" });
//     });
// });

// // Button animation
// const button = document.querySelector(".cta-btn");
// button.addEventListener("click", () => {
//     alert("Welcome to the College ERP System!");
// });
// Initialize everything on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap tooltips (from previous code)
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Smooth scroll animation (your existing code)
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            let target = document.querySelector(e.target.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    // Button animation and redirect (your existing code, updated to redirect instead of alert)
    const button = document.querySelector(".cta-btn");
    if (button) {  // Check if the button exists to avoid errors
        button.addEventListener("click", () => {
            // Simulate loading (for UX, like the other buttons)
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
            setTimeout(() => {
                // Redirect to next page (replace with actual URL or file path)
                window.location.href = "file:///C:/Users/Admin/Desktop/ERP1/ERP/Front%20End/index2.html"; 
                // e.g., '/cta-portal' or 'https://example.com/cta'//
            }, 1000);
        });
    }

    // AMCEC and AMCDC button handlers (from previous updates)
    document.getElementById('amcec-btn').addEventListener('click', function() {
        // Simulate loading
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        setTimeout(() => {
            // Redirect to next page
            window.location.href = 'amcec.html'; // Customize as needed
        }, 1000);
    });

    document.getElementById('amcdc-btn').addEventListener('click', function() {
        // Simulate loading
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
        setTimeout(() => {
            // Redirect to next page
            window.location.href = 'amcdc.html'; // Customize as needed
        }, 1000);
    });

    // Optional: Add fade-in animation on scroll or load (from previous code)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in');
            }
        });
    });
    observer.observe(document.querySelector('.welcome-card'));
});
document.addEventListener('DOMContentLoaded', function() {
    // ... your existing code ...

    // Login button handler
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn && loginBtn.tagName === 'BUTTON') {  // Check if it's a button element
        loginBtn.addEventListener('click', function() {
            // Simulate loading
            this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
            setTimeout(() => {
                // Redirect to login page
                window.location.href = "file:///C:/Users/Admin/Desktop/ERP1/ERP/Front%20End/login.html"; // Use relative path
            }, 1000);
        });
    }

    // ... rest of your existing code ...
});