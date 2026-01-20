/**
 * ============================================================================
 * GLOWUP - DASHBOARD JAVASCRIPT
 * ============================================================================
 * Acest fișier gestionează:
 * - Afișarea produselor
 * - Generarea și afișarea recomandărilor
 * - Filtrare și căutare
 * - Modal-uri pentru detalii produs
 * - Editare profil utilizator
 * ============================================================================
 */

// =============================================================================
// VARIABILE GLOBALE
// =============================================================================

// Utilizatorul curent
let currentUser = null;

// Produsul selectat pentru modal
let selectedProduct = null;

// Parametri paginare
let currentPage = 1;
const productsPerPage = 12;

// Cache pentru produse
let productsCache = [];

// =============================================================================
// INIȚIALIZARE DASHBOARD
// =============================================================================

/**
 * Inițializează dashboard-ul
 */
async function initDashboard() {
    // Verifică autentificarea
    currentUser = GlowUp.getUser();
    
    if (!currentUser) {
        GlowUp.redirectTo('index.html');
        return;
    }
    
    // Actualizează UI-ul cu datele utilizatorului
    updateUserUI();
    
    // Încarcă categoriile pentru filtre
    await loadCategories();
    
    // Încarcă recomandările personalizate
    await loadPersonalRecommendations();
    
    // Încarcă produsele
    await loadProducts();
    
    // Inițializează event listeners
    initEventListeners();
}

/**
 * Actualizează interfața cu datele utilizatorului
 */
function updateUserUI() {
    // Navbar
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const dropdownName = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');
    
    if (userAvatar) userAvatar.textContent = GlowUp.getInitials(currentUser.name);
    if (userName) userName.textContent = currentUser.name;
    if (dropdownName) dropdownName.textContent = currentUser.name;
    if (dropdownEmail) dropdownEmail.textContent = currentUser.email;
    
    // Sidebar - Profil Cold Start
    const profileSkinType = document.getElementById('profileSkinType');
    const profileAllergies = document.getElementById('profileAllergies');
    const profileAgeRange = document.getElementById('profileAgeRange');
    const profileGender = document.getElementById('profileGender');
    
    if (profileSkinType) {
        const skinTypeLabels = {
            'Normal': 'Normală',
            'Dry': 'Uscată',
            'Oily': 'Grasă',
            'Combination': 'Mixtă',
            'Sensitive': 'Sensibilă',
            // Lowercase pentru compatibilitate
            'normal': 'Normală',
            'dry': 'Uscată',
            'oily': 'Grasă',
            'combination': 'Mixtă',
            'sensitive': 'Sensibilă'
        };
        profileSkinType.textContent = skinTypeLabels[currentUser.skin_type] || '-';
    }
    
    if (profileAllergies) {
        const allergies = currentUser.allergies || [];
        if (allergies.length > 0) {
            // Afișăm primele 3 și "..." dacă sunt mai multe
            const displayAllergies = allergies.slice(0, 3);
            const text = displayAllergies.join(', ');
            profileAllergies.textContent = allergies.length > 3 
                ? `${text}... (+${allergies.length - 3})` 
                : text;
        } else {
            profileAllergies.textContent = 'Niciuna';
        }
    }
    
    if (profileAgeRange) {
        profileAgeRange.textContent = currentUser.age_range || '-';
    }
    
    if (profileGender) {
        const genderLabels = {
            'female': 'Feminin',
            'male': 'Masculin',
            'other': 'Altul'
        };
        profileGender.textContent = genderLabels[currentUser.gender] || '-';
    }
}

// =============================================================================
// ÎNCĂRCARE DATE
// =============================================================================

/**
 * Încarcă categoriile pentru dropdown
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
        console.error('Eroare la încărcarea categoriilor:', error);
    }
}

/**
 * Încarcă recomandările personalizate pentru utilizator
 */
async function loadPersonalRecommendations() {
    const container = document.getElementById('personalRecommendations');
    
    if (!currentUser?.id) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">ℹ️</span>
                <p>Completează-ți profilul pentru recomandări personalizate</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await GlowUp.apiRequest(`/recommendations/for-user/${currentUser.id}`);
        
        if (response.success && response.recommendations.length > 0) {
            container.innerHTML = response.recommendations
                .slice(0, 4) // Afișăm primele 4
                .map(product => createProductCard(product, true))
                .join('');
            
            // Adaugă event listeners pentru carduri
            addCardEventListeners(container);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>Nu am găsit recomandări. Încearcă să-ți completezi profilul!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Eroare la încărcarea recomandărilor:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Nu s-au putut încărca recomandările. Verifică conexiunea la server.</p>
            </div>
        `;
    }
}

/**
 * Încarcă lista de produse
 * 
 * @param {object} filters - Filtrele aplicate
 */
async function loadProducts(filters = {}) {
    const container = document.getElementById('productsGrid');
    const resultsCount = document.getElementById('resultsCount');
    
    // Afișează loading
    container.innerHTML = `
        <div class="loading-placeholder">
            <div class="spinner"></div>
            <p>Se încarcă produsele...</p>
        </div>
    `;
    
    try {
        // Construiește query params
        const params = new URLSearchParams({
            limit: productsPerPage,
            offset: (currentPage - 1) * productsPerPage,
            ...filters
        });
        
        const response = await GlowUp.apiRequest(`/products?${params.toString()}`);
        
        if (response.success) {
            productsCache = response.products;
            
            // Actualizează numărul de rezultate
            if (resultsCount) {
                resultsCount.textContent = `${response.total} produse`;
            }
            
            if (response.products.length > 0) {
                container.innerHTML = response.products
                    .map(product => createProductCard(product))
                    .join('');
                
                // Adaugă event listeners
                addCardEventListeners(container);
                
                // Generează paginare
                generatePagination(response.total);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">🔍</span>
                        <p>Nu am găsit produse cu aceste filtre</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Eroare la încărcarea produselor:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>Nu s-au putut încărca produsele. Verifică conexiunea la server.</p>
            </div>
        `;
    }
}

/**
 * Creează HTML-ul pentru un card de produs
 * 
 * @param {object} product - Datele produsului
 * @param {boolean} isRecommendation - Dacă e în secțiunea de recomandări
 * @returns {string} - HTML-ul cardului
 */
function createProductCard(product, isRecommendation = false) {
    const rating = product.rating ? product.rating.toFixed(1) : 'N/A';
    const loves = formatNumber(product.loves_count || 0);
    const price = product.price ? `$${product.price.toFixed(2)}` : 'N/A';
    
    // Badge-uri speciale
    let badge = '';
    if (product.loves_count > 50000) {
        badge = '<span class="card-badge">🔥 Popular</span>';
    } else if (isRecommendation) {
        badge = '<span class="card-badge">✨ Recomandat</span>';
    }
    
    // Tip piele
    const skinTypeLabels = {
        normal: 'Normală',
        dry: 'Uscată',
        oily: 'Grasă',
        combination: 'Mixtă',
        all: 'Toate'
    };
    const skinType = skinTypeLabels[product.skin_type?.toLowerCase()] || '';
    
    // Parsare highlights pentru hover
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
    
    // Parsare ingrediente pentru hover (primele 5)
    let ingredientsHtml = '';
    if (product.ingredients) {
        try {
            let ingredients = product.ingredients;
            if (typeof ingredients === 'string') {
                ingredients = ingredients.replace(/[\[\]']/g, '').split(',').map(i => i.trim()).filter(i => i);
            }
            if (ingredients.length > 0) {
                const topIngredients = ingredients.slice(0, 5).map(i => i.split(' ').slice(0, 2).join(' '));
                ingredientsHtml = `<p class="hover-ingredients"><strong>Ingrediente cheie:</strong> ${topIngredients.join(', ')}...</p>`;
            }
        } catch (e) {
            console.log('Error parsing ingredients:', e);
        }
    }
    
    // Categorie secundară
    const secondaryCategory = product.secondary_category ? escapeHtml(product.secondary_category) : '';
    
    return `
        <article class="product-card" data-product-id="${product.product_id}">
            <!-- Conținut principal vizibil -->
            <div class="card-main">
                <div class="card-header">
                    <span class="card-brand">${escapeHtml(product.brand_name)}</span>
                    ${badge}
                </div>
                
                <h3 class="card-name">${escapeHtml(product.product_name)}</h3>
                
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-icon">⭐</span>
                        <span class="stat-value">${rating}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">❤️</span>
                        <span class="stat-value">${loves}</span>
                    </div>
                </div>
                
                <div class="card-footer">
                    <span class="card-price">${price}</span>
                    ${skinType ? `<span class="card-skin-type">${skinType}</span>` : ''}
                </div>
            </div>
            
            <!-- Overlay cu detalii (apare la hover) -->
            <div class="card-hover-overlay">
                <div class="hover-content">
                    <p class="hover-category">
                        <span class="hover-label">📁</span> 
                        ${secondaryCategory || product.primary_category || 'Skincare'}
                    </p>
                    
                    ${highlightsHtml ? `<div class="hover-highlights">${highlightsHtml}</div>` : ''}
                    
                    ${ingredientsHtml}
                    
                    <button class="btn-view-details">
                        <span>👁️ Vezi Detalii</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Adaugă event listeners pentru cardurile de produse
 * 
 * @param {HTMLElement} container - Containerul cu carduri
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

/**
 * Generează butoanele de paginare
 * 
 * @param {number} total - Numărul total de produse
 */
function generatePagination(total) {
    const container = document.getElementById('pagination');
    const totalPages = Math.ceil(total / productsPerPage);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Buton Previous
    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}">←</button>`;
    }
    
    // Pagini
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
    
    // Buton Next
    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}">→</button>`;
    }
    
    container.innerHTML = html;
    
    // Event listeners pentru butoane
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
// MODAL PRODUS
// =============================================================================

/**
 * Deschide modalul cu detaliile unui produs
 * 
 * @param {string} productId - ID-ul produsului
 */
async function openProductModal(productId) {
    const modal = document.getElementById('productModal');
    
    try {
        const response = await GlowUp.apiRequest(`/product/${productId}`);
        
        if (response.success) {
            selectedProduct = response.product;
            
            // Populează modalul cu datele produsului
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
                highlightsContainer.innerHTML = '<span class="highlight-tag">Niciuna specificată</span>';
            }
            
            // Badge
            const badge = document.getElementById('modalBadge');
            if (selectedProduct.loves_count > 50000) {
                badge.textContent = '🔥 Popular';
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
            
            // Resetează recomandările
            document.getElementById('modalRecommendations').innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💡</span>
                    <p>Apasă butonul pentru a genera recomandări personalizate bazate pe acest produs</p>
                </div>
            `;
            
            // Afișează modalul
            modal.classList.add('active');
        }
    } catch (error) {
        console.error('Eroare la încărcarea produsului:', error);
        showToast('Nu s-au putut încărca detaliile produsului', 'error');
    }
}

/**
 * Închide modalul produsului
 */
function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    selectedProduct = null;
}

/**
 * Generează și afișează recomandări pentru produsul selectat
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
            <p>Se generează recomandări...</p>
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
            
            // Adaugă event listeners pentru click pe fiecare recomandare
            addRecommendationClickListeners(container);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">😕</span>
                    <p>Nu am găsit recomandări cu aceste filtre. Încearcă să dezactivezi unele filtre.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Eroare la generarea recomandărilor:', error);
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>${error.message || 'A apărut o eroare la generarea recomandărilor'}</p>
            </div>
        `;
    } finally {
        GlowUp.setButtonLoading(btn, false);
    }
}

/**
 * Adaugă event listeners pentru click pe produsele recomandate
 * La click se deschide modalul pentru acel produs
 */
function addRecommendationClickListeners(container) {
    const items = container.querySelectorAll('.recommendation-item');
    
    items.forEach(item => {
        item.addEventListener('click', async () => {
            const productId = item.dataset.productId;
            console.log('📦 Click pe recomandare:', productId);
            
            // Deschide modalul pentru noul produs
            await openProductModal(productId);
        });
    });
}

/**
 * Creează HTML pentru un item de recomandare
 * 
 * @param {object} product - Datele produsului recomandat
 * @returns {string} - HTML-ul itemului
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
                <span>⭐ ${rating}</span>
                <span>❤️ ${loves}</span>
            </div>
        </div>
    `;
}

// =============================================================================
// MODAL EDITARE PROFIL
// =============================================================================

/**
 * Deschide modalul de editare profil
 */
function openProfileModal() {
    console.log('🔓 openProfileModal() apelată');
    
    const modal = document.getElementById('profileModal');
    
    if (!modal) {
        console.error('❌ Modal profil nu a fost găsit! (id="profileModal")');
        alert('Eroare: Modal profil nu a fost găsit!');
        return;
    }
    
    console.log('✅ Modal găsit, clasele actuale:', modal.className);
    
    // ===== RESETARE COMPLETĂ A FORMULARULUI =====
    
    // Resetează toate radio buttons pentru gen
    document.querySelectorAll('input[name="edit_gender"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Resetează toate radio buttons pentru interval vârstă
    document.querySelectorAll('input[name="edit_age_range"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Resetează toate radio buttons pentru tip piele
    document.querySelectorAll('input[name="edit_skin_type"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Resetează toate checkbox-urile de alergeni comuni
    document.querySelectorAll('input[name="edit_common_allergies"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Resetează input-ul de alte alergii
    const editAllergiesInput = document.getElementById('editAllergies');
    if (editAllergiesInput) editAllergiesInput.value = '';
    
    // ===== POPULARE CU DATELE UTILIZATORULUI =====
    
    console.log('📊 Date utilizator curent:', currentUser);
    
    // Nume
    const editNameInput = document.getElementById('editName');
    if (editNameInput) editNameInput.value = currentUser?.name || '';
    
    // Selectează genul (radio button)
    if (currentUser?.gender) {
        const genderRadio = document.querySelector(`input[name="edit_gender"][value="${currentUser.gender}"]`);
        if (genderRadio) {
            genderRadio.checked = true;
            console.log('✅ Gen setat:', currentUser.gender);
        }
    }
    
    // Selectează intervalul de vârstă (radio button)
    if (currentUser?.age_range) {
        const ageRangeRadio = document.querySelector(`input[name="edit_age_range"][value="${currentUser.age_range}"]`);
        if (ageRangeRadio) {
            ageRangeRadio.checked = true;
            console.log('✅ Interval vârstă setat:', currentUser.age_range);
        }
    }
    
    // Selectează tipul de piele
    if (currentUser?.skin_type) {
        const skinTypeRadio = document.querySelector(`input[name="edit_skin_type"][value="${currentUser.skin_type}"]`);
        if (skinTypeRadio) {
            skinTypeRadio.checked = true;
            console.log('✅ Tip piele setat:', currentUser.skin_type);
        }
    }
    
    // Bifează alergenii comuni existenți și colectează restul
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
    
    // Alte alergii în input text
    if (editAllergiesInput) editAllergiesInput.value = otherAllergies.join(', ');
    
    // Afișează modalul
    modal.classList.add('active');
    
    console.log('✅ Modal deschis! Clase după adăugare:', modal.className);
}

/**
 * Închide modalul de editare profil
 */
function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

/**
 * Salvează modificările profilului - COLD START DATA
 */
async function saveProfile(e) {
    e.preventDefault();
    
    const form = document.getElementById('profileForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validare nume
    const nameValue = document.getElementById('editName').value.trim();
    if (!nameValue) {
        showToast('Numele este obligatoriu!', 'error');
        document.getElementById('editName').focus();
        return;
    }
    
    GlowUp.setButtonLoading(submitBtn, true);
    
    // Colectăm alergenii comuni (checkboxuri)
    const commonAllergiesCheckboxes = document.querySelectorAll('input[name="edit_common_allergies"]:checked');
    const commonAllergies = Array.from(commonAllergiesCheckboxes).map(cb => cb.value);
    
    // Colectăm alergiile suplimentare din input text
    const editAllergiesInput = document.getElementById('editAllergies');
    const additionalAllergies = editAllergiesInput ? editAllergiesInput.value
        .split(',')
        .map(a => a.trim().toLowerCase())
        .filter(a => a.length > 0) : [];
    
    // Combinăm toate alergiile (fără duplicate)
    const allAllergies = [...new Set([...commonAllergies, ...additionalAllergies])];
    
    const updatedData = {
        name: nameValue,
        gender: document.querySelector('input[name="edit_gender"]:checked')?.value || null,
        age_range: document.querySelector('input[name="edit_age_range"]:checked')?.value || null,
        skin_type: document.querySelector('input[name="edit_skin_type"]:checked')?.value || null,
        allergies: allAllergies
    };
    
    console.log('📝 Actualizare profil Cold Start:', updatedData);
    
    try {
        // Încearcă să salveze pe server
        const response = await GlowUp.apiRequest(`/user/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData)
        });
        
        if (response.success) {
            // Actualizează datele locale
            currentUser = { ...currentUser, ...updatedData };
            GlowUp.saveUser(currentUser);
            
            // Actualizează UI
            updateUserUI();
            
            // Reîncarcă recomandările cu noile date
            loadPersonalRecommendations();
            
            showToast('Profilul a fost actualizat cu succes! 🎉', 'success');
            closeProfileModal();
        } else {
            throw new Error(response.error || 'Eroare la salvare');
        }
    } catch (error) {
        console.warn('⚠️ Eroare API, salvare locală:', error);
        
        // Fallback: salvează local dacă API-ul nu e disponibil
        currentUser = { ...currentUser, ...updatedData };
        GlowUp.saveUser(currentUser);
        
        // Actualizează UI oricum
        updateUserUI();
        
        // Încearcă să reîncarce recomandările
        try {
            loadPersonalRecommendations();
        } catch (e) {
            console.warn('Nu s-au putut reîncărca recomandările');
        }
        
        showToast('Profilul a fost salvat local! 💾', 'success');
        closeProfileModal();
    } finally {
        GlowUp.setButtonLoading(submitBtn, false);
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

/**
 * Inițializează toate event listeners
 */
function initEventListeners() {
    // --- User Menu Dropdown ---
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.querySelector('.user-menu');
    
    if (userMenuBtn && userMenu) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('open');
        });
        
        // Închide dropdown când se face click în afară
        document.addEventListener('click', () => {
            userMenu.classList.remove('open');
        });
    }
    
    // --- Logout ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            GlowUp.clearUser();
            GlowUp.redirectTo('index.html');
        });
    }
    
    // --- Theme Toggle ---
    const themeToggle = document.getElementById('themeToggle');
    
    // Funcție pentru setarea temei (consistentă cu auth page)
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }
    
    // Aplică tema salvată la încărcare
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });
    }
    
    // --- Căutare ---
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                currentPage = 1;
                loadProducts(getActiveFilters());
            }, 300); // Debounce 300ms
        });
        
        // Focus pe search cu Ctrl+K sau Cmd+K (Mac)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select(); // Selectează textul existent
            }
            
            // Escape pentru a ieși din search
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
            }
        });
        
        // Afișează hint la focus
        searchInput.addEventListener('focus', () => {
            searchInput.parentElement.classList.add('focused');
        });
        
        searchInput.addEventListener('blur', () => {
            searchInput.parentElement.classList.remove('focused');
        });
    }
    
    // --- Filtre ---
    const filterCategory = document.getElementById('filterCategory');
    const filterSkinType = document.getElementById('filterSkinType');
    const filterPrice = document.getElementById('filterPrice');
    const filterInStock = document.getElementById('filterInStock');
    const resetFilters = document.getElementById('resetFilters');
    
    // Schimbare categorie
    if (filterCategory) {
        filterCategory.addEventListener('change', () => {
            currentPage = 1;
            loadProducts(getActiveFilters());
        });
    }
    
    // Schimbare tip piele
    if (filterSkinType) {
        filterSkinType.addEventListener('change', () => {
            currentPage = 1;
            loadProducts(getActiveFilters());
        });
    }
    
    // Schimbare preț
    if (filterPrice) {
        filterPrice.addEventListener('input', (e) => {
            document.getElementById('priceValue').textContent = `$${e.target.value}`;
        });
        
        filterPrice.addEventListener('change', () => {
            currentPage = 1;
            loadProducts(getActiveFilters());
        });
    }
    
    // Reset filtre
    if (resetFilters) {
        resetFilters.addEventListener('click', () => {
            console.log('🔄 Resetare filtre...');
            
            // Resetează categoria
            if (filterCategory) filterCategory.value = '';
            
            // Resetează tipul de piele
            if (filterSkinType) filterSkinType.value = '';
            
            // Resetează prețul
            if (filterPrice) {
                filterPrice.value = 200;
                const priceValue = document.getElementById('priceValue');
                if (priceValue) priceValue.textContent = '$200';
            }
            
            // Resetează checkbox "în stoc"
            if (filterInStock) filterInStock.checked = false;
            
            // Resetează căutarea
            if (searchInput) searchInput.value = '';
            
            // Resetează sortarea
            const sortProducts = document.getElementById('sortProducts');
            if (sortProducts) sortProducts.value = 'popularity';
            
            // Resetează pagina
            currentPage = 1;
            
            // Reîncarcă produsele
            loadProducts();
            
            // Feedback vizual
            showToast('Filtrele au fost resetate! 🔄', 'success');
        });
    }
    
    // --- Sort Products ---
    const sortProducts = document.getElementById('sortProducts');
    if (sortProducts) {
        sortProducts.addEventListener('change', () => {
            // Sortarea se face client-side pentru simplitate
            // În producție, ar trebui făcută server-side
            const sortBy = sortProducts.value;
            
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
            
            // Re-renderează
            const container = document.getElementById('productsGrid');
            container.innerHTML = productsCache.map(p => createProductCard(p)).join('');
            addCardEventListeners(container);
        });
    }
    
    // --- Modal Produs ---
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
    
    // --- Modal Profil ---
    const editProfileBtn = document.getElementById('editProfileBtn');
    const openProfileBtn = document.getElementById('openProfile');
    const closeProfileModalBtn = document.getElementById('closeProfileModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const profileModal = document.getElementById('profileModal');
    const profileForm = document.getElementById('profileForm');
    
    console.log('🔧 Inițializare Modal Profil:', {
        editProfileBtn: !!editProfileBtn,
        openProfileBtn: !!openProfileBtn,
        profileModal: !!profileModal,
        profileForm: !!profileForm
    });
    
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📝 Click pe Editează Profil (sidebar)');
            openProfileModal();
        });
    } else {
        console.warn('⚠️ Butonul editProfileBtn nu a fost găsit!');
    }
    
    if (openProfileBtn) {
        openProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📝 Click pe Profilul Meu (dropdown)');
            document.querySelector('.user-menu')?.classList.remove('open');
            openProfileModal();
        });
    } else {
        console.warn('⚠️ Butonul openProfile nu a fost găsit!');
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
    
    // --- Escape key pentru modal-uri ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeProfileModal();
        }
    });
}

/**
 * Obține filtrele active
 * 
 * @returns {object} - Obiect cu filtrele
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
    
    console.log('🔍 Filtre active:', filters);
    
    return filters;
}

// =============================================================================
// UTILITĂȚI
// =============================================================================

/**
 * Formatează un număr mare (ex: 50000 -> 50K)
 * 
 * @param {number} num - Numărul de formatat
 * @returns {string} - Numărul formatat
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
 * Escape HTML pentru prevenirea XSS
 * 
 * @param {string} text - Textul de escapiat
 * @returns {string} - Textul sigur
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
 * Parse highlights din string (poate fi JSON array sau string simplu)
 * 
 * @param {string} highlights - String-ul de parseat
 * @returns {array} - Array de highlights
 */
function parseHighlights(highlights) {
    if (!highlights) return [];
    
    try {
        // Încearcă să parseze ca JSON
        const parsed = JSON.parse(highlights.replace(/'/g, '"'));
        return Array.isArray(parsed) ? parsed : [highlights];
    } catch {
        // Dacă nu e JSON valid, returnează ca array cu un element
        return [highlights];
    }
}

/**
 * Obține label-ul pentru tipul de piele
 * 
 * @param {string} skinType - Codul tipului de piele
 * @returns {string} - Label-ul în română
 */
function getSkinTypeLabel(skinType) {
    const labels = {
        normal: 'Normală',
        dry: 'Uscată',
        oily: 'Grasă',
        combination: 'Mixtă',
        all: 'Toate tipurile'
    };
    return labels[skinType?.toLowerCase()] || skinType || '-';
}

/**
 * Afișează un toast notification
 * 
 * @param {string} message - Mesajul de afișat
 * @param {string} type - Tipul (success, error, warning)
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close">×</button>
    `;
    
    container.appendChild(toast);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto-remove după 5 secunde
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// =============================================================================
// INIȚIALIZARE
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Verifică dacă suntem pe pagina dashboard
    const isDashboard = document.body.classList.contains('dashboard-page');
    
    if (isDashboard) {
        initDashboard();
    }
});