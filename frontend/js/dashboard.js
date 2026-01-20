/**
 * ============================================================================
 * GLOWUP - DASHBOARD JAVASCRIPT
 * ============================================================================
 * This file handles:
 * - Product display
 * - Recommendation generation and display
 * - Filtering and search
 * - Product detail modals
 * - User profile editing
 * ============================================================================
 */

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

let currentUser = null;
let selectedProduct = null;
let currentPage = 1;
const productsPerPage = 12;
let productsCache = [];

// =============================================================================
// DASHBOARD INITIALIZATION
// =============================================================================

/**
 * Initializes the dashboard
 */
async function initDashboard() {
    currentUser = GlowUp.getUser();
    
    if (!currentUser) {
        GlowUp.redirectTo('index.html');
        return;
    }
    
    updateUserUI();
    await loadCategories();
    await loadPersonalRecommendations();
    await loadProducts();
    initEventListeners();
}

/**
 * Updates the UI with user data
 */
function updateUserUI() {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const dropdownName = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');
    
    if (userAvatar) userAvatar.textContent = GlowUp.getInitials(currentUser.name);
    if (userName) userName.textContent = currentUser.name;
    if (dropdownName) dropdownName.textContent = currentUser.name;
    if (dropdownEmail) dropdownEmail.textContent = currentUser.email;
    
    const profileSkinType = document.getElementById('profileSkinType');
    const profileAllergies = document.getElementById('profileAllergies');
    const profileAgeRange = document.getElementById('profileAgeRange');
    const profileGender = document.getElementById('profileGender');
    
    if (profileSkinType) {
        const skinTypeLabels = {
            'Normal': 'Normal',
            'Dry': 'Dry',
            'Oily': 'Oily',
            'Combination': 'Combination',
            'Sensitive': 'Sensitive',
            'normal': 'Normal',
            'dry': 'Dry',
            'oily': 'Oily',
            'combination': 'Combination',
            'sensitive': 'Sensitive'
        };
        profileSkinType.textContent = skinTypeLabels[currentUser.skin_type] || '-';
    }
    
    if (profileAllergies) {
        const allergies = currentUser.allergies || [];
        if (allergies.length > 0) {
            const displayAllergies = allergies.slice(0, 3);
            const text = displayAllergies.join(', ');
            profileAllergies.textContent = allergies.length > 3 
                ? `${text}... (+${allergies.length - 3})` 
                : text;
        } else {
            profileAllergies.textContent = 'None';
        }
    }
    
    if (profileAgeRange) {
        profileAgeRange.textContent = currentUser.age_range || '-';
    }
    
    if (profileGender) {
        const genderLabels = {
            'female': 'Female',
            'male': 'Male',
            'other': 'Other'
        };
        profileGender.textContent = genderLabels[currentUser.gender] || '-';
    }
}

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Loads categories for dropdown
 */
async function loadCategories() {
    try {
        const response = await GlowUp.apiRequest('/categories');
        
        if (response.success && response.categories) {
            const select = document.getElementById('filterCategory');
            
            response.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Loads personalized recommendations for the user
 */
async function loadPersonalRecommendations() {
    const container = document.getElementById('personalRecommendations');
    
    if (!currentUser?.id) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon"><i class="fas fa-info-circle"></i></span>
                <p>Complete your profile for personalized recommendations</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await GlowUp.apiRequest(`/recommendations/for-user/${currentUser.id}`);
        
        if (response.success && response.recommendations.length > 0) {
            container.innerHTML = response.recommendations
                .slice(0, 4)
                .map(product => createProductCard(product, true))
                .join('');
            
            addCardEventListeners(container);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon"><i class="fas fa-search"></i></span>
                    <p>No recommendations found. Try completing your profile!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon"><i class="fas fa-exclamation-triangle"></i></span>
                <p>Could not load recommendations. Check server connection.</p>
            </div>
        `;
    }
}

/**
 * Loads the product list
 * @param {object} filters - Applied filters
 */
async function loadProducts(filters = {}) {
    const container = document.getElementById('productsGrid');
    const resultsCount = document.getElementById('resultsCount');
    
    container.innerHTML = `
        <div class="loading-placeholder">
            <div class="spinner"></div>
            <p>Loading products...</p>
        </div>
    `;
    
    try {
        const params = new URLSearchParams({
            limit: productsPerPage,
            offset: (currentPage - 1) * productsPerPage,
            ...filters
        });
        
        const response = await GlowUp.apiRequest(`/products?${params.toString()}`);
        
        if (response.success) {
            productsCache = response.products;
            
            if (resultsCount) {
                resultsCount.textContent = `${response.total} products`;
            }
            
            if (response.products.length > 0) {
                container.innerHTML = response.products
                    .map(product => createProductCard(product))
                    .join('');
                
                addCardEventListeners(container);
                generatePagination(response.total);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon"><i class="fas fa-search"></i></span>
                        <p>No products found with these filters</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading products:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon"><i class="fas fa-exclamation-triangle"></i></span>
                <p>Could not load products. Check server connection.</p>
            </div>
        `;
    }
}

/**
 * Creates HTML for a product card
 * @param {object} product - Product data
 * @param {boolean} isRecommendation - If it's in the recommendations section
 * @returns {string} - Card HTML
 */
function createProductCard(product, isRecommendation = false) {
    const rating = product.rating ? product.rating.toFixed(1) : 'N/A';
    const loves = formatNumber(product.loves_count || 0);
    const price = product.price ? `$${product.price.toFixed(2)}` : 'N/A';
    
    // Special badges
    let badge = '';
    if (product.loves_count > 50000) {
        badge = '<span class="card-badge"><i class="fas fa-fire"></i> Popular</span>';
    } else if (isRecommendation) {
        badge = '<span class="card-badge"><i class="fas fa-star"></i> Recommended</span>';
    }
    
    // Skin type labels
    const skinTypeLabels = {
        normal: 'Normal',
        dry: 'Dry',
        oily: 'Oily',
        combination: 'Combination',
        all: 'All'
    };
    const skinType = skinTypeLabels[product.skin_type?.toLowerCase()] || '';
    
    // Parse highlights for hover (NO INGREDIENTS)
    let highlightsHtml = '';
    if (product.highlights) {
        try {
            let highlights = product.highlights;
            if (typeof highlights === 'string') {
                highlights = highlights.replace(/[\[\]']/g, '').split(',').map(h => h.trim()).filter(h => h);
            }
            if (highlights.length > 0) {
                const topHighlights = highlights.slice(0, 4);
                highlightsHtml = topHighlights.map(h => `<span class="highlight-tag">${escapeHtml(h)}</span>`).join('');
            }
        } catch (e) {
            console.log('Error parsing highlights:', e);
        }
    }
    
    // Secondary category
    const secondaryCategory = product.secondary_category ? escapeHtml(product.secondary_category) : '';
    
    return `
        <article class="product-card" data-product-id="${product.product_id}">
            <!-- Main visible content -->
            <div class="card-main">
                <div class="card-header">
                    <span class="card-brand">${escapeHtml(product.brand_name)}</span>
                    ${badge}
                </div>
                
                <h3 class="card-name">${escapeHtml(product.product_name)}</h3>
                
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-icon"><i class="fas fa-star"></i></span>
                        <span class="stat-value">${rating}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon"><i class="fas fa-heart"></i></span>
                        <span class="stat-value">${loves}</span>
                    </div>
                </div>
                
                <div class="card-footer">
                    <span class="card-price">${price}</span>
                    ${skinType ? `<span class="card-skin-type">${skinType}</span>` : ''}
                </div>
            </div>
            
            <!-- Hover overlay with details -->
            <div class="card-hover-overlay">
                <div class="hover-content">
                    <p class="hover-category">
                        <span class="hover-label"><i class="fas fa-folder"></i></span> 
                        ${secondaryCategory || product.primary_category || 'Skincare'}
                    </p>
                    
                    ${highlightsHtml ? `<div class="hover-highlights">${highlightsHtml}</div>` : ''}
                    
                    <button class="btn-view-details">
                        <span><i class="fas fa-eye"></i> View Details</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Adds event listeners for product cards
 * @param {HTMLElement} container - Container with cards
 */
function addCardEventListeners(container) {
    const cards = container.querySelectorAll('.product-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const productId = card.dataset.productId;
            openProductModal(productId);
        });
    });
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Generates pagination buttons
 * @param {number} total - Total number of products
 */
function generatePagination(total) {
    const container = document.getElementById('pagination');
    const totalPages = Math.ceil(total / productsPerPage);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;
    }
    
    // Pages
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span class="page-dots">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="page-dots">...</span>`;
        }
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
    }
    
    container.innerHTML = html;
    
    // Event listeners for buttons
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.dataset.page);
            loadProducts(getActiveFilters());
            
            // Scroll to top of products
            document.querySelector('.products-section').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// =============================================================================
// PRODUCT MODAL
// =============================================================================

/**
 * Opens modal with product details
 * @param {string} productId - Product ID
 */
async function openProductModal(productId) {
    const modal = document.getElementById('productModal');
    
    try {
        const response = await GlowUp.apiRequest(`/product/${productId}`);
        
        if (response.success) {
            selectedProduct = response.product;
            
            // Populate modal with product data
            document.getElementById('modalBrand').textContent = selectedProduct.brand_name;
            document.getElementById('modalName').textContent = selectedProduct.product_name;
            document.getElementById('modalRating').textContent = selectedProduct.rating?.toFixed(1) || 'N/A';
            document.getElementById('modalReviews').textContent = formatNumber(selectedProduct.reviews || 0);
            document.getElementById('modalLoves').textContent = formatNumber(selectedProduct.loves_count || 0);
            document.getElementById('modalPrice').textContent = `$${selectedProduct.price?.toFixed(2) || '0.00'}`;
            document.getElementById('modalCategory').textContent = selectedProduct.primary_category || '-';
            document.getElementById('modalSkinType').textContent = getSkinTypeLabel(selectedProduct.skin_type);
            
            // Highlights / Tags
            const highlightsContainer = document.getElementById('modalHighlights');
            const highlights = parseHighlights(selectedProduct.highlights);
            
            if (highlights.length > 0) {
                highlightsContainer.innerHTML = highlights
                    .slice(0, 5)
                    .map(h => `<span class="highlight-tag">${escapeHtml(h)}</span>`)
                    .join('');
            } else {
                highlightsContainer.innerHTML = '<span class="highlight-tag">None specified</span>';
            }
            
            // Badge
            const badge = document.getElementById('modalBadge');
            if (selectedProduct.loves_count > 50000) {
                badge.innerHTML = '<i class="fas fa-fire"></i> Popular';
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
            
            // Reset recommendations
            document.getElementById('modalRecommendations').innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon"><i class="fas fa-lightbulb"></i></span>
                    <p>Click the button to generate personalized recommendations based on this product</p>
                </div>
            `;
            
            // Show modal
            modal.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Could not load product details', 'error');
    }
}

/**
 * Closes the product modal
 */
function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    selectedProduct = null;
}

/**
 * Generates and displays recommendations for selected product
 */
async function generateRecommendations() {
    if (!selectedProduct) return;
    
    const btn = document.getElementById('getRecommendationsBtn');
    const container = document.getElementById('modalRecommendations');
    const filterBySkinType = document.getElementById('filterBySkinType').checked;
    const filterByAllergies = document.getElementById('filterByAllergies').checked;
    
    // Loading state
    GlowUp.setButtonLoading(btn, true);
    container.innerHTML = `
        <div class="loading-placeholder">
            <div class="spinner"></div>
            <p>Generating recommendations...</p>
        </div>
    `;
    
    try {
        const response = await GlowUp.apiRequest('/recommendations', {
            method: 'POST',
            body: JSON.stringify({
                product_id: selectedProduct.product_id,
                user_id: currentUser?.id,
                count: 5,
                filter_skin_type: filterBySkinType,
                filter_allergies: filterByAllergies
            })
        });
        
        if (response.success && response.recommendations.length > 0) {
            container.innerHTML = response.recommendations
                .map(product => createRecommendationItem(product))
                .join('');
            
            // Add click listeners for each recommendation
            addRecommendationClickListeners(container);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon"><i class="fas fa-frown"></i></span>
                    <p>No recommendations found with these filters. Try disabling some filters.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error generating recommendations:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon"><i class="fas fa-exclamation-triangle"></i></span>
                <p>${error.message || 'An error occurred while generating recommendations'}</p>
            </div>
        `;
    } finally {
        GlowUp.setButtonLoading(btn, false);
    }
}

/**
 * Creates HTML for a recommendation item
 * @param {object} product - Product data
 * @returns {string} - Item HTML
 */
function createRecommendationItem(product) {
    const rating = product.rating ? product.rating.toFixed(1) : 'N/A';
    const loves = formatNumber(product.loves_count || 0);
    const price = product.price ? `$${product.price.toFixed(2)}` : 'N/A';
    
    return `
        <div class="recommendation-item" data-product-id="${product.product_id}">
            <div class="rec-header">
                <span class="rec-brand">${escapeHtml(product.brand_name)}</span>
                <span class="rec-price">${price}</span>
            </div>
            <h4 class="rec-name">${escapeHtml(product.product_name)}</h4>
            <div class="rec-stats">
                <span><i class="fas fa-star"></i> ${rating}</span>
                <span><i class="fas fa-heart"></i> ${loves}</span>
            </div>
        </div>
    `;
}

/**
 * Adds click listeners for recommended products
 * Opens modal for that product on click
 */
function addRecommendationClickListeners(container) {
    const items = container.querySelectorAll('.recommendation-item');
    
    items.forEach(item => {
        item.addEventListener('click', async () => {
            const productId = item.dataset.productId;
            console.log('Click on recommendation:', productId);
            await openProductModal(productId);
        });
    });
}

// =============================================================================
// PROFILE MODAL
// =============================================================================

/**
 * Opens the profile editing modal
 */
function openProfileModal() {
    console.log('openProfileModal() called');
    
    const modal = document.getElementById('profileModal');
    
    if (!modal) {
        console.error('Profile modal not found!');
        alert('Error: Profile modal not found!');
        return;
    }
    
    // Reset form
    document.querySelectorAll('input[name="edit_gender"]').forEach(radio => {
        radio.checked = false;
    });
    
    document.querySelectorAll('input[name="edit_age_range"]').forEach(radio => {
        radio.checked = false;
    });
    
    document.querySelectorAll('input[name="edit_skin_type"]').forEach(radio => {
        radio.checked = false;
    });
    
    document.querySelectorAll('input[name="edit_common_allergies"]').forEach(cb => {
        cb.checked = false;
    });
    
    const editAllergiesInput = document.getElementById('editAllergies');
    if (editAllergiesInput) editAllergiesInput.value = '';
    
    // Populate with current user data
    const editNameInput = document.getElementById('editName');
    if (editNameInput) editNameInput.value = currentUser?.name || '';
    
    if (currentUser?.gender) {
        const genderRadio = document.querySelector(`input[name="edit_gender"][value="${currentUser.gender}"]`);
        if (genderRadio) genderRadio.checked = true;
    }
    
    if (currentUser?.age_range) {
        const ageRadio = document.querySelector(`input[name="edit_age_range"][value="${currentUser.age_range}"]`);
        if (ageRadio) ageRadio.checked = true;
    }
    
    if (currentUser?.skin_type) {
        const skinRadio = document.querySelector(`input[name="edit_skin_type"][value="${currentUser.skin_type}"]`);
        if (skinRadio) skinRadio.checked = true;
    }
    
    // Set allergies
    const commonAllergens = ['alcohol', 'fragrance', 'phenoxyethanol', 'dimethicone', 'limonene', 'linalool', 'propylene glycol', 'salicylic acid', 'retinol', 'paraben'];
    const userAllergies = currentUser?.allergies || [];
    const otherAllergies = [];
    
    userAllergies.forEach(allergy => {
        const allergyLower = allergy.toLowerCase();
        const checkbox = document.querySelector(`input[name="edit_common_allergies"][value="${allergyLower}"]`);
        
        if (checkbox) {
            checkbox.checked = true;
        } else if (!commonAllergens.includes(allergyLower)) {
            otherAllergies.push(allergy);
        }
    });
    
    if (editAllergiesInput && otherAllergies.length > 0) {
        editAllergiesInput.value = otherAllergies.join(', ');
    }
    
    modal.classList.add('active');
}

/**
 * Closes the profile modal
 */
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Saves profile changes
 */
async function saveProfile(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('#profileForm button[type="submit"]');
    
    const name = document.getElementById('editName')?.value.trim();
    const gender = document.querySelector('input[name="edit_gender"]:checked')?.value || null;
    const ageRange = document.querySelector('input[name="edit_age_range"]:checked')?.value || null;
    const skinType = document.querySelector('input[name="edit_skin_type"]:checked')?.value || null;
    
    const commonAllergiesCheckboxes = document.querySelectorAll('input[name="edit_common_allergies"]:checked');
    const commonAllergies = Array.from(commonAllergiesCheckboxes).map(cb => cb.value);
    
    const additionalAllergiesInput = document.getElementById('editAllergies');
    const additionalAllergies = additionalAllergiesInput ? additionalAllergiesInput.value
        .split(',')
        .map(a => a.trim().toLowerCase())
        .filter(a => a.length > 0) : [];
    
    const allergies = [...new Set([...commonAllergies, ...additionalAllergies])];
    
    const updatedData = {
        name,
        gender,
        age_range: ageRange,
        skin_type: skinType,
        allergies
    };
    
    console.log('Saving profile:', updatedData);
    
    GlowUp.setButtonLoading(submitBtn, true);
    
    try {
        const response = await GlowUp.apiRequest(`/user/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData)
        });
        
        if (response.success) {
            // Update local user data
            currentUser = { ...currentUser, ...updatedData };
            GlowUp.saveUser(currentUser);
            
            updateUserUI();
            closeProfileModal();
            showToast('Profile updated successfully!', 'success');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Error updating profile', 'error');
    } finally {
        GlowUp.setButtonLoading(submitBtn, false);
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function initEventListeners() {
    // User menu toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.querySelector('.user-menu');
    
    if (userMenuBtn && userMenu) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('open');
        });
        
        document.addEventListener('click', () => {
            userMenu.classList.remove('open');
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            GlowUp.clearUser();
            GlowUp.redirectTo('index.html');
        });
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            // Update icon
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        });
    }
    
    // Search
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentPage = 1;
                loadProducts(getActiveFilters());
            }, 500);
        });
    }
    
    // Filters
    const filterCategory = document.getElementById('filterCategory');
    const filterSkinType = document.getElementById('filterSkinType');
    const filterPrice = document.getElementById('filterPrice');
    const filterInStock = document.getElementById('filterInStock');
    const clearFiltersBtn = document.getElementById('clearFilters');
    
    [filterCategory, filterSkinType, filterInStock].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                currentPage = 1;
                loadProducts(getActiveFilters());
            });
        }
    });
    
    if (filterPrice) {
        const priceValue = document.getElementById('priceValue');
        filterPrice.addEventListener('input', () => {
            if (priceValue) priceValue.textContent = `$${filterPrice.value}`;
        });
        filterPrice.addEventListener('change', () => {
            currentPage = 1;
            loadProducts(getActiveFilters());
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterCategory) filterCategory.value = '';
            if (filterSkinType) filterSkinType.value = '';
            if (filterPrice) {
                filterPrice.value = 500;
                const priceValue = document.getElementById('priceValue');
                if (priceValue) priceValue.textContent = '$500';
            }
            if (filterInStock) filterInStock.checked = false;
            if (searchInput) searchInput.value = '';
            
            currentPage = 1;
            loadProducts();
        });
    }
    
    // Sort
    const sortSelect = document.getElementById('sortProducts');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const sortBy = sortSelect.value;
            
            productsCache.sort((a, b) => {
                switch (sortBy) {
                    case 'rating':
                        return (b.rating || 0) - (a.rating || 0);
                    case 'price-asc':
                        return (a.price || 0) - (b.price || 0);
                    case 'price-desc':
                        return (b.price || 0) - (a.price || 0);
                    case 'popularity':
                    default:
                        return (b.loves_count || 0) - (a.loves_count || 0);
                }
            });
            
            // Re-render
            const container = document.getElementById('productsGrid');
            container.innerHTML = productsCache.map(p => createProductCard(p)).join('');
            addCardEventListeners(container);
        });
    }
    
    // Product Modal
    const closeModal = document.getElementById('closeModal');
    const productModal = document.getElementById('productModal');
    const getRecsBtn = document.getElementById('getRecommendationsBtn');
    
    if (closeModal) {
        closeModal.addEventListener('click', closeProductModal);
    }
    
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target === productModal) {
                closeProductModal();
            }
        });
    }
    
    if (getRecsBtn) {
        getRecsBtn.addEventListener('click', generateRecommendations);
    }
    
    // Profile Modal
    const editProfileBtn = document.getElementById('editProfileBtn');
    const openProfileBtn = document.getElementById('openProfile');
    const closeProfileModalBtn = document.getElementById('closeProfileModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const profileModal = document.getElementById('profileModal');
    const profileForm = document.getElementById('profileForm');
    
    console.log('Profile Modal init:', {
        editProfileBtn: !!editProfileBtn,
        openProfileBtn: !!openProfileBtn,
        profileModal: !!profileModal,
        profileForm: !!profileForm
    });
    
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Click on Edit Profile (sidebar)');
            openProfileModal();
        });
    } else {
        console.warn('editProfileBtn not found!');
    }
    
    if (openProfileBtn) {
        openProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Click on My Profile (dropdown)');
            document.querySelector('.user-menu')?.classList.remove('open');
            openProfileModal();
        });
    } else {
        console.warn('openProfile button not found!');
    }
    
    if (closeProfileModalBtn) {
        closeProfileModalBtn.addEventListener('click', closeProfileModal);
    }
    
    if (cancelProfileEdit) {
        cancelProfileEdit.addEventListener('click', closeProfileModal);
    }
    
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeProfileModal();
            }
        });
    }
    
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }
    
    // Escape key for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeProfileModal();
        }
    });
}

/**
 * Gets active filters
 * @returns {object} - Filter object
 */
function getActiveFilters() {
    const filters = {};
    
    const search = document.getElementById('searchInput')?.value.trim();
    const category = document.getElementById('filterCategory')?.value;
    const skinType = document.getElementById('filterSkinType')?.value;
    const maxPrice = document.getElementById('filterPrice')?.value;
    const inStock = document.getElementById('filterInStock')?.checked;
    
    if (search) filters.search = search;
    if (category) filters.category = category;
    if (skinType) filters.skin_type = skinType;
    if (maxPrice && maxPrice !== '500') filters.max_price = parseFloat(maxPrice);
    if (inStock) filters.in_stock = true;
    
    console.log('Active filters:', filters);
    
    return filters;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Formats a large number (e.g., 50000 -> 50K)
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Safe text
 */
function escapeHtml(text) {
    if (!text) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Parses highlights from string (can be JSON array or simple string)
 * @param {string} highlights - String to parse
 * @returns {array} - Array of highlights
 */
function parseHighlights(highlights) {
    if (!highlights) return [];
    
    try {
        const parsed = JSON.parse(highlights.replace(/'/g, '"'));
        return Array.isArray(parsed) ? parsed : [highlights];
    } catch {
        return [highlights];
    }
}

/**
 * Gets label for skin type
 * @param {string} skinType - Skin type code
 * @returns {string} - Label
 */
function getSkinTypeLabel(skinType) {
    const labels = {
        normal: 'Normal',
        dry: 'Dry',
        oily: 'Oily',
        combination: 'Combination',
        all: 'All types'
    };
    return labels[skinType?.toLowerCase()] || skinType || '-';
}

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type (success, error, warning)
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-times-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    container.appendChild(toast);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const isDashboard = document.body.classList.contains('dashboard-page');
    
    if (isDashboard) {
        initDashboard();
    }
});