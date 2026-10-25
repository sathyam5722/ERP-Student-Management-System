// Login button functionality kept safe
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const menuToggle = document.getElementById("menu-toggle");
    const navLinks = document.querySelector(".nav-links");
    const counters = document.querySelectorAll(".counter");
    const reveals = document.querySelectorAll(".reveal");

    // Login button - do not change existing functionality unless you want to add redirect later
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            console.log("Login button clicked");
        });
    }

    // Mobile menu toggle
    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            navLinks.classList.toggle("show");
        });
    }

    // Reveal on scroll
    const revealOnScroll = () => {
        reveals.forEach((element) => {
            const windowHeight = window.innerHeight;
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 100;

            if (elementTop < windowHeight - elementVisible) {
                element.classList.add("active");
            }
        });
    };

    window.addEventListener("scroll", revealOnScroll);
    revealOnScroll();

    // Counter animation
    let counterStarted = false;

    const runCounters = () => {
        const heroStats = document.querySelector(".hero-stats");
        if (!heroStats) return;

        const rect = heroStats.getBoundingClientRect();
        if (rect.top < window.innerHeight && !counterStarted) {
            counterStarted = true;

            counters.forEach((counter) => {
                const target = +counter.getAttribute("data-target");
                let count = 0;
                const increment = Math.ceil(target / 100);

                const updateCounter = () => {
                    count += increment;
                    if (count < target) {
                        counter.innerText = count;
                        requestAnimationFrame(updateCounter);
                    } else {
                        counter.innerText = target;
                    }
                };

                updateCounter();
            });
        }
    };

    window.addEventListener("scroll", runCounters);
    runCounters();

    // Close mobile menu after clicking any nav link
    document.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("show");
        });
    });
});