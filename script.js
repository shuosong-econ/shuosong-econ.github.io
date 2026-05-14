// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Navbar Scroll Effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('bg-white/80', 'backdrop-blur-md', 'shadow-sm', 'py-4');
        navbar.classList.remove('py-6');
    } else {
        navbar.classList.remove('bg-white/80', 'backdrop-blur-md', 'shadow-sm', 'py-4');
        navbar.classList.add('py-6');
    }
});

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
});

// Hero Animations
const tl = gsap.timeline();

tl.to('.hero-text', {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: 'power3.out',
    stagger: 0.2
})
    .to('.hero-visual', {
        opacity: 1,
        scale: 1,
        duration: 1,
        ease: 'elastic.out(1, 0.5)'
    }, '-=0.5')
    .from('.floating-badge', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.7)'
    }, '-=0.5');

// Floating Animation for Hero Image
gsap.to('.hero-visual img', {
    y: -15,
    duration: 3,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
});

// Scroll Animations for Sections
const sections = document.querySelectorAll('section');

sections.forEach(section => {
    const header = section.querySelector('.section-header');
    if (header) {
        gsap.to(header, {
            scrollTrigger: {
                trigger: section,
                start: 'top 80%',
            },
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out'
        });
    }
});

// Paper Cards Stagger
gsap.utils.toArray('.paper-card').forEach((card, i) => {
    gsap.to(card, {
        scrollTrigger: {
            trigger: card,
            start: 'top 85%',
        },
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: i * 0.1,
        ease: 'power2.out'
    });
});

// Gallery Photos Stagger
gsap.utils.toArray('.photo-item').forEach((photo, i) => {
    gsap.to(photo, {
        scrollTrigger: {
            trigger: photo,
            start: 'top 85%',
        },
        opacity: 1,
        y: 0,
        duration: 0.8,
        delay: i * 0.1,
        ease: 'power2.out'
    });
});

// Book Cards Stagger
gsap.utils.toArray('.book-card').forEach((card, i) => {
    gsap.to(card, {
        scrollTrigger: {
            trigger: card,
            start: 'top 85%',
        },
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: i * 0.1,
        ease: 'power2.out'
    });
});

// Essai Items Stagger
gsap.utils.toArray('.essai-item').forEach((item, i) => {
    gsap.to(item, {
        scrollTrigger: {
            trigger: item,
            start: 'top 85%',
        },
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay: i * 0.1,
        ease: 'power2.out'
    });
});
