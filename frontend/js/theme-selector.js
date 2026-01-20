/**
 * ============================================================================
 * GLOWUP - THEME SELECTOR
 * ============================================================================
 * Allows users to change the accent color from the UI
 * Colors are saved to localStorage and persist across sessions
 * ============================================================================
 */

// Preset color themes
const COLOR_THEMES = {
    beige: {
        name: 'Warm Beige',
        primary: '#d4a373',
        primaryLight: '#e8c9a8',
        primaryDark: '#b8956a',
        primaryRgb: '212, 163, 115',
        bgMain: '#fefae0',
        bgMainDark: '#1a1a1a'
    },
    rose: {
        name: 'Rose Gold',
        primary: '#B76E79',
        primaryLight: '#D4A5AD',
        primaryDark: '#8B4D55',
        primaryRgb: '183, 110, 121',
        bgMain: '#FDF5F6',
        bgMainDark: '#1a1818'
    },
    sage: {
        name: 'Sage Green',
        primary: '#9CAF88',
        primaryLight: '#B8C9A6',
        primaryDark: '#7A8D6A',
        primaryRgb: '156, 175, 136',
        bgMain: '#F5F7F2',
        bgMainDark: '#181a18'
    },
    blue: {
        name: 'Dusty Blue',
        primary: '#6B8E9B',
        primaryLight: '#9BB5BF',
        primaryDark: '#4D6B77',
        primaryRgb: '107, 142, 155',
        bgMain: '#F3F6F7',
        bgMainDark: '#18191a'
    },
    lavender: {
        name: 'Lavender',
        primary: '#9B8AA5',
        primaryLight: '#BFB2C7',
        primaryDark: '#7A6B85',
        primaryRgb: '155, 138, 165',
        bgMain: '#F7F5F8',
        bgMainDark: '#19181a'
    },
    coral: {
        name: 'Coral',
        primary: '#E07A5F',
        primaryLight: '#EAA08C',
        primaryDark: '#B85A42',
        primaryRgb: '224, 122, 95',
        bgMain: '#FEF6F4',
        bgMainDark: '#1a1818'
    },
    teal: {
        name: 'Teal',
        primary: '#5F9EA0',
        primaryLight: '#8FBFC0',
        primaryDark: '#457A7C',
        primaryRgb: '95, 158, 160',
        bgMain: '#F4F9F9',
        bgMainDark: '#181a1a'
    },
    plum: {
        name: 'Plum',
        primary: '#8E4585',
        primaryLight: '#B377AB',
        primaryDark: '#6A3364',
        primaryRgb: '142, 69, 133',
        bgMain: '#F9F4F8',
        bgMainDark: '#1a181a'
    }
};

/**
 * Initialize theme selector
 */
function initThemeSelector() {
    // Load saved theme
    const savedTheme = localStorage.getItem('glowup_color_theme') || 'beige';
    applyColorTheme(savedTheme);
    
    // Create theme selector UI
    createThemeSelectorUI();
}

/**
 * Apply a color theme
 */
function applyColorTheme(themeKey) {
    const theme = COLOR_THEMES[themeKey];
    if (!theme) return;
    
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    
    // Apply CSS variables
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-light', theme.primaryLight);
    root.style.setProperty('--color-primary-dark', theme.primaryDark);
    root.style.setProperty('--color-primary-rgb', theme.primaryRgb);
    root.style.setProperty('--shadow-glow', `0 0 30px rgba(${theme.primaryRgb}, 0.3)`);
    root.style.setProperty('--bg-hover', `rgba(${theme.primaryRgb}, 0.1)`);
    
    // Icon colors - use accent color!
    root.style.setProperty('--icon-star-color', theme.primary);
    root.style.setProperty('--icon-heart-color', theme.primary);
    root.style.setProperty('--icon-fire-color', theme.primary);
    root.style.setProperty('--icon-accent-color', theme.primary);
    
    // Apply background based on dark/light mode
    if (isDark && theme.bgMainDark) {
        root.style.setProperty('--bg-main', theme.bgMainDark);
    } else if (!isDark) {
        root.style.setProperty('--bg-main', theme.bgMain);
    }
    
    // Save preference
    localStorage.setItem('glowup_color_theme', themeKey);
    
    // Update active state in selector
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeKey);
    });
}

/**
 * Create the theme selector UI
 */
function createThemeSelectorUI() {
    // Create the theme selector container
    const selectorHTML = `
        <div class="theme-selector" id="themeSelector">
            <button class="theme-selector-trigger" id="themeSelectorTrigger" title="Change accent color">
                <i class="fas fa-palette"></i>
            </button>
            <div class="theme-selector-dropdown" id="themeSelectorDropdown">
                <div class="theme-dropdown-header">
                    <span>Accent Color</span>
                </div>
                <div class="theme-colors-grid">
                    ${Object.entries(COLOR_THEMES).map(([key, theme]) => `
                        <button 
                            class="theme-color-btn ${localStorage.getItem('glowup_color_theme') === key ? 'active' : ''}" 
                            data-theme="${key}"
                            title="${theme.name}"
                            style="--btn-color: ${theme.primary}"
                        >
                            <span class="color-preview" style="background: ${theme.primary}"></span>
                            <span class="color-name">${theme.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Insert into navbar actions (before theme toggle)
    const navbarActions = document.querySelector('.navbar-actions');
    if (navbarActions) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.insertAdjacentHTML('beforebegin', selectorHTML);
        } else {
            navbarActions.insertAdjacentHTML('afterbegin', selectorHTML);
        }
    }
    
    // Add event listeners
    const trigger = document.getElementById('themeSelectorTrigger');
    const dropdown = document.getElementById('themeSelectorDropdown');
    const selector = document.getElementById('themeSelector');
    
    if (trigger && dropdown) {
        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            selector.classList.toggle('open');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target)) {
                selector.classList.remove('open');
            }
        });
        
        // Theme color buttons
        document.querySelectorAll('.theme-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                applyColorTheme(btn.dataset.theme);
                selector.classList.remove('open');
            });
        });
    }
}

/**
 * CSS for theme selector (inject into page)
 */
function injectThemeSelectorStyles() {
    const styles = `
        /* Icon color variables - use accent color */
        :root {
            --icon-star-color: var(--color-primary);
            --icon-heart-color: var(--color-primary);
            --icon-fire-color: var(--color-primary);
            --icon-accent-color: var(--color-primary);
        }
        
        /* Apply accent colors to icons */
        .stat-icon .fa-star,
        .meta-icon .fa-star,
        .rec-stats .fa-star {
            color: var(--icon-star-color) !important;
        }
        
        .stat-icon .fa-heart,
        .meta-icon .fa-heart,
        .rec-stats .fa-heart {
            color: var(--icon-heart-color) !important;
        }
        
        .card-badge .fa-fire,
        .product-badge .fa-fire,
        .card-badge .fa-star {
            color: var(--icon-fire-color) !important;
        }
        
        /* All other icons use accent color */
        .logo-icon i,
        .feature-icon i,
        .title-icon i,
        .sidebar-title i,
        .info-icon i,
        .panel-title i,
        .empty-icon i,
        .hover-label i,
        .btn-icon i {
            color: var(--icon-accent-color) !important;
        }
        
        /* Input icons slightly muted */
        .input-icon i {
            color: var(--color-primary-light) !important;
        }
        
        /* Theme Selector */
        .theme-selector {
            position: relative;
        }
        
        /* Match the style of btn-icon (dark mode toggle) */
        .theme-selector-trigger {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: var(--color-primary);
            color: var(--text-inverse, #fff);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all var(--transition-base);
            font-size: 1rem;
        }
        
        .theme-selector-trigger:hover {
            background: var(--color-primary-dark);
            transform: scale(1.05);
        }
        
        .theme-selector-dropdown {
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            width: 280px;
            background: var(--bg-card);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            border: 1px solid var(--border-color);
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all var(--transition-base);
            z-index: var(--z-dropdown);
            overflow: hidden;
        }
        
        .theme-selector.open .theme-selector-dropdown {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        
        .theme-dropdown-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-light);
            font-weight: 600;
            color: var(--text-primary);
            font-size: 0.875rem;
        }
        
        .theme-colors-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            padding: 12px;
        }
        
        .theme-color-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border: 2px solid transparent;
            border-radius: var(--radius-sm);
            background: var(--bg-input);
            cursor: pointer;
            transition: all var(--transition-fast);
        }
        
        .theme-color-btn:hover {
            background: var(--bg-hover);
            border-color: var(--btn-color);
        }
        
        .theme-color-btn.active {
            border-color: var(--btn-color);
            background: rgba(var(--color-primary-rgb), 0.1);
        }
        
        .color-preview {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .color-name {
            font-size: 0.75rem;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .theme-color-btn.active .color-name {
            color: var(--text-primary);
            font-weight: 500;
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
            .theme-selector-dropdown {
                width: 240px;
                right: -50px;
            }
            
            .theme-colors-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 6px;
                padding: 8px;
            }
            
            .theme-color-btn {
                padding: 8px 10px;
            }
            
            .color-preview {
                width: 20px;
                height: 20px;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Only on dashboard page
    if (document.body.classList.contains('dashboard-page')) {
        injectThemeSelectorStyles();
        initThemeSelector();
        
        // Listen for dark mode changes and re-apply color theme
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    const savedTheme = localStorage.getItem('glowup_color_theme') || 'beige';
                    applyColorTheme(savedTheme);
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
});

// Also apply saved theme on auth page
if (document.body.classList.contains('auth-page')) {
    const savedTheme = localStorage.getItem('glowup_color_theme') || 'beige';
    const theme = COLOR_THEMES[savedTheme];
    if (theme) {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-primary-light', theme.primaryLight);
        root.style.setProperty('--color-primary-dark', theme.primaryDark);
        root.style.setProperty('--color-primary-rgb', theme.primaryRgb);
        root.style.setProperty('--shadow-glow', `0 0 30px rgba(${theme.primaryRgb}, 0.3)`);
        root.style.setProperty('--bg-main', theme.bgMain);
        
        // Icon colors for auth page too
        root.style.setProperty('--icon-star-color', theme.primary);
        root.style.setProperty('--icon-heart-color', theme.primaryDark);
        root.style.setProperty('--icon-fire-color', theme.primary);
        root.style.setProperty('--icon-accent-color', theme.primary);
        
        // Inject icon styles for auth page
        const iconStyles = document.createElement('style');
        iconStyles.textContent = `
            .logo-icon i,
            .feature-icon i,
            .input-icon i,
            .float-item i {
                color: var(--icon-accent-color, var(--color-primary)) !important;
            }
        `;
        document.head.appendChild(iconStyles);
    }
}