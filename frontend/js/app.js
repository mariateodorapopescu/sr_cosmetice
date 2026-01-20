/**
 * ============================================================================
 * GLOWUP - APLICAȚIE JAVASCRIPT PRINCIPALĂ
 * ============================================================================
 * Acest fișier gestionează:
 * - Autentificare (Login & Register)
 * - Gestionare sesiune utilizator
 * - Funcții utilitare globale
 * ============================================================================
 */

// =============================================================================
// CONFIGURARE API
// =============================================================================

const API_BASE_URL = 'http://localhost:5003/api';

// =============================================================================
// OBIECT GLOBAL GLOWUP - Disponibil pentru toate fișierele JS
// =============================================================================

window.GlowUp = {
    API_BASE_URL: API_BASE_URL,
    
    /**
     * Funcție pentru a face cereri HTTP către API
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
                throw new Error(data.error || 'A apărut o eroare');
            }
            
            return data;
        } catch (error) {
            console.error(`Eroare API [${endpoint}]:`, error);
            throw error;
        }
    },
    
    /**
     * Salvează datele utilizatorului în localStorage
     */
    saveUser: function(userData) {
        localStorage.setItem('glowup_user', JSON.stringify(userData));
    },
    
    /**
     * Obține datele utilizatorului din localStorage
     */
    getUser: function() {
        const userData = localStorage.getItem('glowup_user');
        return userData ? JSON.parse(userData) : null;
    },
    
    /**
     * Șterge datele utilizatorului (logout)
     */
    clearUser: function() {
        localStorage.removeItem('glowup_user');
    },
    
    /**
     * Verifică dacă utilizatorul este autentificat
     */
    isLoggedIn: function() {
        return this.getUser() !== null;
    },
    
    /**
     * Redirecționează către o altă pagină
     */
    redirectTo: function(page) {
        window.location.href = page;
    },
    
    /**
     * Afișează un mesaj în formularul specificat
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
     * Ascunde un mesaj
     */
    hideMessage: function(elementId) {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.hidden = true;
        }
    },
    
    /**
     * Afișează/Ascunde loading-ul pe un buton
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
     * Obține inițialele din nume
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

console.log('✅ GlowUp object initialized:', Object.keys(window.GlowUp));

// =============================================================================
// FUNCȚII PENTRU PAGINA DE AUTH
// =============================================================================

/**
 * Evaluează puterea parolei
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
 * Inițializează funcționalitatea paginii de autentificare
 */
function initAuthPage() {
    // Verifică dacă utilizatorul este deja logat
    if (GlowUp.isLoggedIn()) {
        GlowUp.redirectTo('dashboard.html');
        return;
    }
    
    // Referințe către elemente DOM
    const tabButtons = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    
    // --- Funcție pentru schimbarea tab-urilor ---
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
    
    // --- Tab-uri Login/Register ---
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchToTab(btn.dataset.tab);
        });
    });
    
    // --- Link-uri "Cont nou" / "Ai deja cont" ---
    const goToRegisterBtn = document.getElementById('goToRegister');
    const goToLoginBtn = document.getElementById('goToLogin');
    
    if (goToRegisterBtn) {
        goToRegisterBtn.addEventListener('click', () => switchToTab('register'));
    }
    
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', () => switchToTab('login'));
    }
    
    // --- Toggle vizibilitate parolă ---
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const inputWrapper = btn.closest('.input-wrapper');
            const input = inputWrapper.querySelector('input[type="password"], input[type="text"]');
            const eyeIcon = btn.querySelector('.eye-icon') || btn;
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeIcon.textContent = '🙈';
                btn.classList.add('visible');
                btn.title = 'Ascunde parola';
            } else {
                input.type = 'password';
                eyeIcon.textContent = '👁️';
                btn.classList.remove('visible');
                btn.title = 'Arată parola';
            }
        });
    });
    
    // --- Modal "Am uitat parola" ---
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeForgotModal = document.getElementById('closeForgotModal');
    const backToLoginFromForgot = document.getElementById('backToLoginFromForgot');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    
    function openForgotModal() {
        if (forgotPasswordModal) {
            forgotPasswordModal.classList.add('active');
        }
    }
    
    function closeForgotModalFunc() {
        if (forgotPasswordModal) {
            forgotPasswordModal.classList.remove('active');
            if (forgotPasswordForm) forgotPasswordForm.reset();
            GlowUp.hideMessage('forgotMessage');
        }
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
    
    if (backToLoginFromForgot) {
        backToLoginFromForgot.addEventListener('click', closeForgotModalFunc);
    }
    
    if (forgotPasswordModal) {
        forgotPasswordModal.addEventListener('click', (e) => {
            if (e.target === forgotPasswordModal) {
                closeForgotModalFunc();
            }
        });
    }
    
    // Submit forgot password form
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
            const email = document.getElementById('forgotEmail').value;
            
            GlowUp.setButtonLoading(submitBtn, true);
            
            // Simulăm trimiterea email-ului
            setTimeout(() => {
                GlowUp.setButtonLoading(submitBtn, false);
                GlowUp.showMessage('forgotMessage', 
                    `📧 Dacă există un cont cu adresa ${email}, vei primi un email cu instrucțiuni de resetare.`, 
                    'success'
                );
                
                setTimeout(() => {
                    closeForgotModalFunc();
                }, 3000);
            }, 1500);
        });
    }
    
    // --- Toggle Theme (Light/Dark) ---
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
    
    // Aplică tema salvată
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // --- Indicator putere parolă ---
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
                weak: 'Slabă',
                medium: 'Medie',
                strong: 'Puternică'
            };
            strengthText.textContent = texts[strength];
        });
    }
    
    // --- Formularul de LOGIN ---
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
                    GlowUp.showMessage('loginMessage', 'Autentificare reușită! Redirecționare...', 'success');
                    
                    setTimeout(() => {
                        GlowUp.redirectTo('dashboard.html');
                    }, 1000);
                }
            } catch (error) {
                GlowUp.showMessage('loginMessage', error.message || 'Eroare la autentificare');
            } finally {
                GlowUp.setButtonLoading(submitBtn, false);
            }
        });
    }
    
    // --- Wizard Register - Navigare între pași ---
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    const steps = document.querySelectorAll('.register-steps .step');
    const stepContents = document.querySelectorAll('.form-step');
    
    console.log('🔧 Wizard init:', {
        nextButtons: nextButtons.length,
        prevButtons: prevButtons.length,
        steps: steps.length,
        stepContents: stepContents.length
    });
    
    function goToStep(stepNumber) {
        console.log('📍 Navigare la pasul:', stepNumber);
        
        steps.forEach((step, index) => {
            step.classList.toggle('active', index < stepNumber);
            step.classList.toggle('completed', index < stepNumber - 1);
        });
        
        stepContents.forEach(content => {
            const isActive = content.dataset.step === stepNumber.toString();
            content.classList.toggle('active', isActive);
            console.log(`   Step ${content.dataset.step}: ${isActive ? 'ACTIVE' : 'hidden'}`);
        });
    }
    
    nextButtons.forEach(btn => {
        console.log('➡️ Atașez listener pentru btn-next:', btn.dataset.next);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const nextStep = parseInt(btn.dataset.next);
            console.log('➡️ Click pe Next, merg la pasul:', nextStep);
            goToStep(nextStep);
        });
    });
    
    prevButtons.forEach(btn => {
        console.log('⬅️ Atașez listener pentru btn-prev:', btn.dataset.prev);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const prevStep = parseInt(btn.dataset.prev);
            console.log('⬅️ Click pe Prev, merg la pasul:', prevStep);
            goToStep(prevStep);
        });
    });
    
    // --- Formularul de REGISTER ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            
            // Colectăm datele din toate cele 3 pași
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            
            // Date Cold Start - Pasul 2
            const gender = document.querySelector('input[name="gender"]:checked')?.value || null;
            const ageRange = document.querySelector('input[name="age_range"]:checked')?.value || null;
            
            // Date Cold Start - Pasul 3
            const skinType = document.querySelector('input[name="skin_type"]:checked')?.value || null;
            
            // Colectăm alergenii comuni (checkboxuri)
            const commonAllergiesCheckboxes = document.querySelectorAll('input[name="common_allergies"]:checked');
            const commonAllergies = Array.from(commonAllergiesCheckboxes).map(cb => cb.value);
            
            // Colectăm alergiile suplimentare din input text
            const additionalAllergiesInput = document.getElementById('additionalAllergies');
            const additionalAllergies = additionalAllergiesInput ? additionalAllergiesInput.value
                .split(',')
                .map(a => a.trim().toLowerCase())
                .filter(a => a.length > 0) : [];
            
            // Combinăm toate alergiile (fără duplicate)
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
            
            console.log('📝 Date înregistrare (Cold Start):', userData);
            
            GlowUp.setButtonLoading(submitBtn, true);
            
            try {
                const response = await GlowUp.apiRequest('/register', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                
                if (response.success) {
                    GlowUp.showMessage('registerMessage', 'Cont creat cu succes! Te poți autentifica acum.', 'success');
                    
                    setTimeout(() => {
                        switchToTab('login');
                        registerForm.reset();
                        goToStep(1);
                    }, 2000);
                }
            } catch (error) {
                GlowUp.showMessage('registerMessage', error.message || 'Eroare la înregistrare');
            } finally {
                GlowUp.setButtonLoading(submitBtn, false);
            }
        });
    }
}

// =============================================================================
// INIȚIALIZARE LA ÎNCĂRCAREA PAGINII
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Verifică pe ce pagină suntem
    const isAuthPage = document.getElementById('loginForm') !== null;
    
    if (isAuthPage) {
        initAuthPage();
    }
});