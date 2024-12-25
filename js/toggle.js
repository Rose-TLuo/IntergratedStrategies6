function toggleMenu() {
    const menu = document.querySelector('.nav-menu');
    menu.classList.toggle('active');
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.querySelector('.nav-menu');
    const button = document.querySelector('.nav-button');

    if (!menu.contains(event.target) && !button.contains(event.target) && menu.classList.contains('active')) {
        menu.classList.remove('active');
    }
});