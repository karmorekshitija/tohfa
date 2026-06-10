// Tohfa Shared Component Inclusion Script
document.addEventListener("DOMContentLoaded", () => {
    // Get the base directory of this script so we fetch components from the same folder
    const scriptSrc = import.meta.url;
    let baseDir = '.';
    if (scriptSrc && scriptSrc.includes('/')) {
        baseDir = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
    }

    const navbarContainer = document.getElementById("tohfa-navbar");
    const footerContainer = document.getElementById("tohfa-footer");

    // Load Navbar
    if (navbarContainer) {
        fetch(`${baseDir}/tohfa-navbar.html`)
            .then(response => {
                if (!response.ok) throw new Error("Navbar failed to load from: " + `${baseDir}/tohfa-navbar.html`);
                return response.text();
            })
            .then(html => {
                navbarContainer.innerHTML = html;
            })
            .catch(err => {
                console.error("Error loading navbar:", err);
                // Fallback attempt using standard relative path just in case
                fetch("/components/tohfa-navbar.html")
                    .then(res => res.text())
                    .then(html => { navbarContainer.innerHTML = html; })
                    .catch(e => console.error("Fallback navbar load failed:", e));
            });
    }

    // Load Footer
    if (footerContainer) {
        fetch(`${baseDir}/tohfa-footer.html`)
            .then(response => {
                if (!response.ok) throw new Error("Footer failed to load from: " + `${baseDir}/tohfa-footer.html`);
                return response.text();
            })
            .then(html => {
                footerContainer.innerHTML = html;
            })
            .catch(err => {
                console.error("Error loading footer:", err);
                // Fallback attempt using standard relative path just in case
                fetch("/components/tohfa-footer.html")
                    .then(res => res.text())
                    .then(html => { footerContainer.innerHTML = html; })
                    .catch(e => console.error("Fallback footer load failed:", e));
            });
    }
});
