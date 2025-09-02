// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Get all navigation links
    const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Header background on scroll
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(255, 255, 255, 0.98)';
            header.style.boxShadow = '0 2px 25px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
        }
    });
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.feature-card, .platform-card, .arch-layer, .stat-item');
    
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // Wheel animation interaction with your brand colors
    const floatingWheel = document.querySelector('.floating-wheel');
    
    if (floatingWheel) {
        floatingWheel.addEventListener('mouseenter', function() {
            this.style.animationPlayState = 'paused';
            this.style.transform = 'scale(1.1) translateY(-20px)';
        });
        
        floatingWheel.addEventListener('mouseleave', function() {
            this.style.animationPlayState = 'running';
            this.style.transform = 'scale(1)';
        });
        
        floatingWheel.addEventListener('click', function() {
            // Spin animation on click with CobyPicks colors
            this.style.animation = 'spin 1s ease-in-out, float 3s ease-in-out infinite 1s';
            
            // Add temporary color flash effect
            const tempOverlay = document.createElement('div');
            tempOverlay.style.position = 'absolute';
            tempOverlay.style.top = '0';
            tempOverlay.style.left = '0';
            tempOverlay.style.width = '100%';
            tempOverlay.style.height = '100%';
            tempOverlay.style.background = 'linear-gradient(45deg, #8E0B16, #FFC107)';
            tempOverlay.style.borderRadius = '50%';
            tempOverlay.style.opacity = '0';
            tempOverlay.style.animation = 'colorFlash 0.5s ease-in-out';
            tempOverlay.style.pointerEvents = 'none';
            
            this.appendChild(tempOverlay);
            
            setTimeout(() => {
                tempOverlay.remove();
            }, 500);
        });
    }
    
    // Counter animation for stats
    function animateCounter(element, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16);
        
        function updateCounter() {
            start += increment;
            if (start < target) {
                if (target === Infinity) {
                    element.textContent = '∞';
                } else {
                    element.textContent = Math.floor(start) + '+';
                }
                requestAnimationFrame(updateCounter);
            } else {
                if (target === Infinity) {
                    element.textContent = '∞';
                } else if (element.textContent.includes('24/7')) {
                    element.textContent = '24/7';
                } else {
                    element.textContent = target + '+';
                }
            }
        }
        
        updateCounter();
    }
    
    // Stats counter observer
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumber = entry.target.querySelector('.stat-number');
                const text = statNumber.textContent;
                
                if (text === '100+') {
                    animateCounter(statNumber, 100);
                } else if (text === '∞') {
                    statNumber.textContent = '∞';
                } else if (text === '2') {
                    animateCounter(statNumber, 2);
                } else if (text === '24/7') {
                    statNumber.textContent = '24/7';
                }
                
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    document.querySelectorAll('.stat-item').forEach(item => {
        statsObserver.observe(item);
    });
    
    // Parallax effect for hero section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroVisual = document.querySelector('.hero-visual');
        
        if (heroVisual) {
            const speed = scrolled * 0.5;
            heroVisual.style.transform = `translateY(${speed}px)`;
        }
    });
    
    // Button click effects
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255, 255, 255, 0.3)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Add CSS animations for new interactions
    const additionalStyles = document.createElement('style');
    additionalStyles.textContent = `
        @keyframes colorFlash {
            0% { opacity: 0; }
            50% { opacity: 0.3; }
            100% { opacity: 0; }
        }
        
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .wheel-category:hover .wheel-icon {
            animation: pulse 0.5s ease-in-out;
        }
        
        .feature-card:hover .feature-icon {
            transform: scale(1.1);
            background: linear-gradient(45deg, #8E0B16, #66181E);
        }
        
        .platform-card:hover {
            background: linear-gradient(135deg, #8E0B16 0%, #66181E 100%) !important;
        }
    `;
    document.head.appendChild(additionalStyles);
    
    // Feature cards hover effects
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
            this.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(-5px) scale(1)';
            this.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0.1)';
        });
    });
    
    // Platform cards interactive effects
    document.querySelectorAll('.platform-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.03)';
            this.style.boxShadow = '0 30px 60px rgba(102, 126, 234, 0.3)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
        });
    });
    
    // Demo video placeholder interaction
    const videoPlaceholder = document.querySelector('.video-placeholder');
    if (videoPlaceholder) {
        videoPlaceholder.addEventListener('click', function() {
            this.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 12px;">
                    <div style="text-align: center; color: white;">
                        <i class="fas fa-rocket" style="font-size: 3rem; margin-bottom: 20px; animation: bounce 1s infinite;"></i>
                        <p style="font-size: 1.2rem; margin: 0;">Demo Loading...</p>
                        <p style="font-size: 0.9rem; opacity: 0.8; margin: 10px 0 0 0;">Preparing your interactive experience</p>
                    </div>
                </div>
            `;
            
            // Add bounce animation
            const bounceStyle = document.createElement('style');
            bounceStyle.textContent = `
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }
            `;
            document.head.appendChild(bounceStyle);
        });
    }
    
    // Typing effect for hero title
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const originalText = heroTitle.innerHTML;
        heroTitle.innerHTML = '';
        
        let index = 0;
        function typeWriter() {
            if (index < originalText.length) {
                heroTitle.innerHTML += originalText.charAt(index);
                index++;
                setTimeout(typeWriter, 50);
            }
        }
        
        // Start typing effect after a short delay
        setTimeout(typeWriter, 500);
    }
    
    // Enhanced wheel gallery interactions
    document.querySelectorAll('.wheel-item').forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 8px 20px rgba(142, 11, 22, 0.2)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1.02)';
            this.style.boxShadow = 'none';
        });
        
        item.addEventListener('click', function() {
            // Add click animation
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'scale(1.05)';
            }, 100);
        });
    });
    
    // Enhanced admin demo interactions
    document.querySelectorAll('.admin-feature').forEach(feature => {
        feature.addEventListener('click', function() {
            // Simulate feature activation
            const icon = this.querySelector('i');
            icon.style.animation = 'pulse 0.5s ease-in-out';
            
            setTimeout(() => {
                icon.style.animation = '';
            }, 500);
        });
    });
    
    // Image picker wheel animation
    const imageWheel = document.querySelector('.image-wheel');
    if (imageWheel) {
        imageWheel.addEventListener('click', function() {
            this.style.animation = 'spin 2s ease-out';
            
            // Simulate image reveal after spin
            setTimeout(() => {
                const segments = this.querySelectorAll('.image-placeholder');
                segments.forEach(segment => {
                    segment.style.animation = 'bounce 0.5s ease-in-out';
                });
            }, 1800);
        });
    }
    
    // Add loading animation for the entire page
    window.addEventListener('load', function() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.5s ease-in-out';
        
        setTimeout(() => {
            document.body.style.opacity = '1';
        }, 100);
    });
    
    // Live Showcase Platform Selector
    const platformButtons = document.querySelectorAll('.platform-btn');
    const platformShowcases = document.querySelectorAll('.platform-showcase');
    
    platformButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetPlatform = this.getAttribute('data-platform');
            
            // Remove active class from all buttons
            platformButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Hide all showcases
            platformShowcases.forEach(showcase => showcase.classList.remove('active'));
            // Show target showcase
            const targetShowcase = document.getElementById(targetPlatform + '-showcase');
            if (targetShowcase) {
                targetShowcase.classList.add('active');
            }
        });
    });
    
    // Simulate spinning animation on mobile wheel
    const mobileWheels = document.querySelectorAll('.participant-wheel-circle');
    mobileWheels.forEach(wheel => {
        if (wheel.classList.contains('spinning')) {
            // Add periodic spinning effect
            setInterval(() => {
                wheel.style.animation = 'none';
                setTimeout(() => {
                    wheel.style.animation = 'spin 2s linear infinite';
                }, 100);
            }, 4000);
        }
    });
    
    // Demo wheel click interaction
    const demoWheels = document.querySelectorAll('.demo-wheel, .mobile-wheel-circle');
    demoWheels.forEach(wheel => {
        wheel.addEventListener('click', function() {
            this.style.animation = 'spin 1.5s ease-out';
            
            setTimeout(() => {
                this.style.animation = '';
            }, 1500);
        });
    });
    
    // Simulate real-time updates in showcase
    function simulateRealTimeUpdates() {
        const participantCounts = document.querySelectorAll('.participants-count, .live-indicator span');
        const sessionStatuses = document.querySelectorAll('.session-status.live');
        
        // Update participant counts occasionally
        setInterval(() => {
            participantCounts.forEach(count => {
                if (count.textContent.includes('participants')) {
                    const currentCount = parseInt(count.textContent.match(/\d+/)[0]);
                    const newCount = currentCount + Math.floor(Math.random() * 3) - 1;
                    if (newCount > 0) {
                        count.textContent = count.textContent.replace(/\d+/, newCount);
                    }
                }
            });
        }, 8000);
        
        // Add pulse effect to live indicators
        sessionStatuses.forEach(status => {
            setInterval(() => {
                status.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    status.style.transform = 'scale(1)';
                }, 300);
            }, 2000);
        });
    }
    
    // Start real-time simulation
    simulateRealTimeUpdates();
    
    // Enhanced mobile button interactions
    document.querySelectorAll('.mobile-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Simulate action based on button type
            if (this.classList.contains('primary')) {
                // Spin button clicked
                const wheel = this.closest('.mobile-content').querySelector('.mobile-wheel-circle');
                if (wheel) {
                    wheel.style.animation = 'spin 2s ease-out';
                    setTimeout(() => {
                        wheel.style.animation = '';
                    }, 2000);
                }
            }
        });
    });
    
    // Tab switching in mobile demo
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active from siblings
            this.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            // Add active to clicked tab
            this.classList.add('active');
        });
    });
    
    console.log('🎉 CobyPicks promotional site loaded successfully!');
    console.log('🎯 Features: Real-time collaboration, Auto-spin, Cross-platform sync');
    console.log('📱 Platforms: Web (Next.js) + Mobile (React Native/Expo)');
    console.log('🔥 Tech Stack: Firebase, TypeScript, Tailwind CSS, Radix UI');
    console.log('🎨 Brand Colors: Maroon Primary (#8E0B16), Accent (#FFC107)');
    console.log('⚡ Enhanced Features: 40+ Wheel Types, Advanced Admin, Image Wheels');
    console.log('🏫 Perfect for: Educational institutions, Organizations, Events');
    console.log('🚀 Live Showcase: Interactive web and mobile app demonstrations');
});