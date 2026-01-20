/**
 * ============================================================================
 * GLOWUP - MAIN JAVASCRIPT APPLICATION
 * ============================================================================
 * This file handles:
 * - Authentication (Login & Register)
 * - User session management
 * - Global utility functions
 * ============================================================================
 */

// =============================================================================
// API CONFIGURATION
// =============================================================================

const API_BASE_URL = 'https://sr-cosmetice.onrender.com/api';

// =============================================================================
// GLOBAL GLOWUP OBJECT - Available for all JS files
// =============================================================================

window.GlowUp = {
    API_BASE_URL: API_BASE_URL,
    
    /**
     * Makes HTTP requests to the API
     */
    apiRequest: async function(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        };
        
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };
        
        try {
            const response = await fetch(url, finalOptions);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },
    
    /**
     * Saves user data to localStorage
     */
    saveUser: function(userData) {
        localStorage.setItem('glowup_user', JSON.stringify(userData));
    },
    
    /**
     * Gets user data from localStorage
     */
    getUser: function() {
        const userData = localStorage.getItem('glowup_user');
        return userData ? JSON.parse(userData) : null;
    },
    
    /**
     * Clears user data (logout)
     */
    clearUser: function() {
        localStorage.removeItem('glowup_user');
    },
    
    /**
     * Checks if user is authenticated
     */
    isLoggedIn: function() {
        return this.getUser() !== null;
    },
    
    /**
     * Redirects to another page
     */
    redirectTo: function(page) {
        window.location.href = page;
    },
    
    /**
     * Shows a message in the specified form
     */
    showMessage: function(elementId, message, type = 'error') {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.className = `form-message ${type}`;
            messageEl.hidden = false;
            
            setTimeout(() => {
                messageEl.hidden = true;
            }, 5000);
        }
    },
    
    /**
     * Hides a message
     */
    hideMessage: function(elementId) {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.hidden = true;
        }
    },
    
    /**
     * Shows/Hides loading state on a button
     */
    setButtonLoading: function(button, loading) {
        if (!button) return;
        
        const textEl = button.querySelector('.btn-text');
        const loaderEl = button.querySelector('.btn-loader');
        
        if (loading) {
            button.disabled = true;
            if (textEl) textEl.hidden = true;
            if (loaderEl) loaderEl.hidden = false;
        } else {
            button.disabled = false;
            if (textEl) textEl.hidden = false;
            if (loaderEl) loaderEl.hidden = true;
        }
    },
    
    /**
     * Gets initials from name
     */
    getInitials: function(name) {
        if (!name) return 'U';
        
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
};

console.log('GlowUp object initialized:', Object.keys(window.GlowUp));

// =============================================================================
// AUTH PAGE FUNCTIONS
// =============================================================================

/**
 * Evaluates password strength
 */
function evaluatePasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
}

/**
 * Initializes auth page functionality
 */
function initAuthPage() {
    // Check if user is already logged in
    if (GlowUp.isLoggedIn()) {
        GlowUp.redirectTo('dashboard.html');
        return;
    }
    
    // DOM element references
    const tabButtons = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    
    // Tab switching function
    function switchToTab(tabName) {
        tabButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabName);
        });
        
        if (tabName === 'login') {
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        }
    }
    
    // Login/Register tabs
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchToTab(btn.dataset.tab);
        });
    });
    
    // "New account" / "Already have account" links
    const goToRegisterBtn = document.getElementById('goToRegister');
    const goToLoginBtn = document.getElementById('goToLogin');
    
    if (goToRegisterBtn) {
        goToRegisterBtn.addEventListener('click', () => switchToTab('register'));
    }
    
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', () => switchToTab('login'));
    }
    
    // Toggle password visibility
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            } else {
                input.type = 'password';
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });
    
    // Forgot password modal
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotModal = document.getElementById('forgotPasswordModal');
    const closeForgotModal = document.getElementById('closeForgotModal');
    const cancelForgotBtn = document.getElementById('cancelForgot');
    const forgotForm = document.getElementById('forgotForm');
    
    function openForgotModal() {
        if (forgotModal) forgotModal.classList.add('active');
    }
    
    function closeForgotModalFunc() {
        if (forgotModal) forgotModal.classList.remove('active');
    }
    
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            openForgotModal();
        });
    }
    
    if (closeForgotModal) {
        closeForgotModal.addEventListener('click', closeForgotModalFunc);
    }
    
    if (cancelForgotBtn) {
        cancelForgotBtn.addEventListener('click', closeForgotModalFunc);
    }
    
    if (forgotModal) {
        forgotModal.addEventListener('click', (e) => {
            if (e.target === forgotModal) {
                closeForgotModalFunc();
            }
        });
    }
    
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            const email = document.getElementById('forgotEmail').value;
            
            GlowUp.setButtonLoading(submitBtn, true);
            
            // Simulate email sending
            setTimeout(() => {
                GlowUp.setButtonLoading(submitBtn, false);
                GlowUp.showMessage('forgotMessage', 
                    `If an account exists with ${email}, you will receive reset instructions.`, 
                    'success'
                );
                
                setTimeout(() => {
                    closeForgotModalFunc();
                }, 3000);
            }, 1500);
        });
    }
    
    // Theme toggle (Light/Dark)
    const themeToggle = document.getElementById('themeToggleAuth');
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }
    
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    }
    
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Password strength indicator
    const registerPasswordInput = document.getElementById('registerPassword');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (registerPasswordInput && strengthBar && strengthText) {
        registerPasswordInput.addEventListener('input', (e) => {
            const password = e.target.value;
            
            if (password.length === 0) {
                strengthBar.className = 'strength-bar';
                strengthText.textContent = '';
                return;
            }
            
            const strength = evaluatePasswordStrength(password);
            strengthBar.className = `strength-bar ${strength}`;
            
            const texts = {
                weak: 'Weak',
                medium: 'Medium',
                strong: 'Strong'
            };
            strengthText.textContent = texts[strength];
        });
    }
    
    // LOGIN form
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            GlowUp.setButtonLoading(submitBtn, true);
            
            try {
                const response = await GlowUp.apiRequest('/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                
                if (response.success) {
                    GlowUp.saveUser(response.user);
                    GlowUp.showMessage('loginMessage', 'Login successful! Redirecting...', 'success');
                    
                    setTimeout(() => {
                        GlowUp.redirectTo('dashboard.html');
                    }, 1000);
                }
            } catch (error) {
                GlowUp.showMessage('loginMessage', error.message || 'Authentication error');
            } finally {
                GlowUp.setButtonLoading(submitBtn, false);
            }
        });
    }
    
    // Register wizard - step navigation
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    const steps = document.querySelectorAll('.register-steps .step');
    const stepContents = document.querySelectorAll('.form-step');
    
    console.log('Wizard init:', {
        nextButtons: nextButtons.length,
        prevButtons: prevButtons.length,
        steps: steps.length,
        stepContents: stepContents.length
    });
    
    function goToStep(stepNumber) {
        console.log('Navigating to step:', stepNumber);
        
        steps.forEach((step, index) => {
            step.classList.toggle('active', index < stepNumber);
            step.classList.toggle('completed', index < stepNumber - 1);
        });
        
        stepContents.forEach(content => {
            const isActive = content.dataset.step === stepNumber.toString();
            content.classList.toggle('active', isActive);
        });
    }
    
    nextButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const nextStep = parseInt(btn.dataset.next);
            goToStep(nextStep);
        });
    });
    
    prevButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const prevStep = parseInt(btn.dataset.prev);
            goToStep(prevStep);
        });
    });
    
    // REGISTER form
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            
            // Collect data from all 3 steps
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            
            // Cold Start data - Step 2
            const gender = document.querySelector('input[name="gender"]:checked')?.value || null;
            const ageRange = document.querySelector('input[name="age_range"]:checked')?.value || null;
            
            // Cold Start data - Step 3
            const skinType = document.querySelector('input[name="skin_type"]:checked')?.value || null;
            
            // Collect common allergens (checkboxes)
            const commonAllergiesCheckboxes = document.querySelectorAll('input[name="common_allergies"]:checked');
            const commonAllergies = Array.from(commonAllergiesCheckboxes).map(cb => cb.value);
            
            // Collect additional allergies from text input
            const additionalAllergiesInput = document.getElementById('additionalAllergies');
            const additionalAllergies = additionalAllergiesInput ? additionalAllergiesInput.value
                .split(',')
                .map(a => a.trim().toLowerCase())
                .filter(a => a.length > 0) : [];
            
            // Combine all allergies (no duplicates)
            const allergies = [...new Set([...commonAllergies, ...additionalAllergies])];
            
            const userData = {
                name,
                email,
                password,
                gender,
                age_range: ageRange,
                skin_type: skinType,
                allergies
            };
            
            console.log('Registration data (Cold Start):', userData);
            
            GlowUp.setButtonLoading(submitBtn, true);
            
            try {
                const response = await GlowUp.apiRequest('/register', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                
                if (response.success) {
                    GlowUp.showMessage('registerMessage', 'Account created successfully! You can now log in.', 'success');
                    
                    setTimeout(() => {
                        switchToTab('login');
                        registerForm.reset();
                        goToStep(1);
                    }, 2000);
                }
            } catch (error) {
                GlowUp.showMessage('registerMessage', error.message || 'Registration error');
            } finally {
                GlowUp.setButtonLoading(submitBtn, false);
            }
        });
    }
}

// =============================================================================
// PAGE LOAD INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    const isAuthPage = document.getElementById('loginForm') !== null;
    
    if (isAuthPage) {
        initAuthPage();
    }
});