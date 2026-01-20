"""
=============================================================================
BACKEND ÎMBUNĂTĂȚIT - Sistem de Recomandări Cosmetice
=============================================================================
Acest fișier extinde app.py original cu:
- Endpoint-uri pentru autentificare (register, login)
- Endpoint pentru recomandări care returnează JSON
- Gestionare îmbunătățită a sesiunilor
=============================================================================
"""

from flask import Flask, request, jsonify, session
import psycopg2
from flask_cors import CORS
import os
import csv
import json
import hashlib
import secrets
from datetime import datetime, timedelta
import pandas as pd
from recommendations import get_n_recommandation, filter, filter_out, User
import math

# ============================================================================
# CONFIGURARE APLICAȚIE FLASK
# ============================================================================

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Cheie secretă pentru sesiuni

# Permite CORS pentru frontend (care rulează pe alt port)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Configurare bază de date PostgreSQL
DB_HOST = os.getenv("DB_HOST", "db")
# DB_HOST = os.getenv("DATABASE_URL", "db")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")

# ============================================================================
# FUNCȚII HELPER PENTRU BAZA DE DATE
# ============================================================================

def get_db_connection():
    """Creează și returnează o conexiune la baza de date."""
    # return psycopg2.connect(
    #     host=DB_HOST, 
    #     dbname=DB_NAME, 
    #     user=DB_USER, 
    #     password=DB_PASS
    # )
    # Verifică dacă există DATABASE_URL (pentru Render/producție)
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # Render folosește postgres:// dar psycopg2 vrea postgresql://
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        return psycopg2.connect(database_url)
    else:
        # Local development (Docker)
        return psycopg2.connect(
            host=os.environ.get('DB_HOST', 'db'),
            database=os.environ.get('DB_NAME', 'glowup'),
            user=os.environ.get('DB_USER', 'glowup_user'),
            password=os.environ.get('DB_PASSWORD', 'glowup_password')
        )

def hash_password(password):
    """
    Criptează parola folosind SHA-256.
    
    În producție, folosește bcrypt sau argon2 pentru securitate mai bună!
    SHA-256 este folosit aici pentru simplitate.
    """
    return hashlib.sha256(password.encode()).hexdigest()

# Helper: convertește NaN în None pentru JSON valid
def clean_for_json(obj):
    """Convertește NaN și inf în None pentru JSON valid"""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_for_json(i) for i in obj]
    return obj

# ============================================================================
# INIȚIALIZARE BAZĂ DE DATE
# ============================================================================

def init_db():
    """
    Inițializează tabelele în baza de date.
    
    IMPORTANT: NU șterge datele existente! Creează tabelele doar dacă nu există.
    
    Tabele create:
    - products: Catalogul de produse cosmetice
    - users: Utilizatorii înregistrați cu profilul lor
    - recommendation_history: Istoricul recomandărilor
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Verifică dacă tabelele există deja
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'users'
        );
    """)
    tables_exist = cur.fetchone()[0]
    
    if tables_exist:
        print("ℹ️  Tabelele există deja - păstrăm datele existente!")
        cur.close()
        conn.close()
        return True  # Tabelele există, nu facem nimic
    
    print("🔧 Prima rulare - creăm tabelele...")
    
    # Tabel produse
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            product_id VARCHAR(36) PRIMARY KEY,
            product_name VARCHAR(500) NOT NULL,
            brand_name VARCHAR(500) NOT NULL,
            price REAL NOT NULL,
            out_of_stock INTEGER NOT NULL,
            ingredients VARCHAR(20000),
            highlights VARCHAR(5000),
            primary_category VARCHAR(200),
            secondary_category VARCHAR(200),
            rating REAL,
            reviews INTEGER,
            loves_count INTEGER,
            assigned_skin_type VARCHAR(100)
        );
    """)
    
    # Tabel utilizatori - cu parolă pentru autentificare
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name TEXT NOT NULL,
            -- Date Cold Start conform PDF --
            gender TEXT CHECK (gender IN ('male', 'female', 'other')),  
            age_range TEXT CHECK (age_range IN ('13-17', '18-25', '26-35', '36-45', '46-55', '55+')),
            skin_type TEXT CHECK (skin_type IN ('normal', 'dry', 'oily', 'combination')),
            allergies JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        );
    """)
    
    # Tabel pentru istoricul de recomandări (opțional, pentru analytics)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS recommendation_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            product_id VARCHAR(36),
            recommended_products JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Baza de date inițializată cu succes!")
    return False  # Tabele noi create


def import_csv(filename="store_products.csv"):
    """
    Importă produsele din fișierul CSV în baza de date.
    
    Parametri:
    - filename: Calea către fișierul CSV cu produse
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        with open(filename, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            count = 0
            
            for row in reader:
                cur.execute(
                    "SELECT product_id FROM products WHERE product_id=%s;", 
                    (row['product_id'],)
                )
                
                if cur.fetchone() is None:
                    cur.execute("""
                        INSERT INTO products (
                            product_id, product_name, brand_name, price, 
                            out_of_stock, ingredients, highlights,
                            primary_category, secondary_category, rating,
                            reviews, loves_count, assigned_skin_type
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        row['product_id'], 
                        row['product_name'], 
                        row['brand_name'], 
                        float(row['price_usd']) if row['price_usd'] else 0,
                        int(row['out_of_stock']) if row['out_of_stock'] else 0,
                        row.get('ingredients', ''),
                        row.get('highlights', ''),
                        row.get('primary_category', ''),
                        row.get('secondary_category', ''),
                        float(row['rating']) if row.get('rating') else None,
                        int(float(row['reviews'])) if row.get('reviews') else 0,
                        int(row['loves_count']) if row.get('loves_count') else 0,
                        row.get('assigned_skin_type', '')
                    ))
                    count += 1
                    
        conn.commit()
        print(f"✅ {count} produse importate cu succes!")
        
    except FileNotFoundError:
        print(f"⚠️ Fișierul {filename} nu a fost găsit!")
    except Exception as e:
        print(f"❌ Eroare la import: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


# ============================================================================
# ENDPOINT-URI API - AUTENTIFICARE
# ============================================================================

@app.route("/api/register", methods=['POST'])
def register():
    """
    Înregistrează un utilizator nou cu date Cold Start.
    
    Body JSON așteptat (conform PDF - Soluția Cold Start):
    {
        "email": "user@example.com",
        "password": "parola123",
        "name": "Nume Utilizator",
        "gender": "female",           // female, male, other
        "age_range": "26-35",         // 13-17, 18-25, 26-35, 36-45, 46-55, 55+
        "skin_type": "combination",   // normal, dry, oily, combination
        "allergies": ["parabeni", "parfum"]  // lista de alergeni
    }
    
    Returnează:
    - 201: Utilizator creat cu succes
    - 400: Date lipsă sau email deja există
    - 500: Eroare server
    """
    data = request.json
    
    # Validare date obligatorii
    if not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({
            "success": False,
            "error": "Email, parola și numele sunt obligatorii!"
        }), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Verifică dacă email-ul există deja
        cur.execute("SELECT id FROM users WHERE email = %s", (data['email'],))
        if cur.fetchone():
            return jsonify({
                "success": False,
                "error": "Email-ul este deja înregistrat!"
            }), 400
        
        # Criptează parola
        password_hash = hash_password(data['password'])
        
        # Inserează utilizatorul cu date Cold Start
        cur.execute("""
            INSERT INTO users (email, password_hash, name, gender, age_range, skin_type, allergies)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            data['email'],
            password_hash,
            data['name'],
            data.get('gender'),
            data.get('age_range'),  # Interval vârstă conform PDF
            data.get('skin_type'),
            json.dumps(data.get('allergies', []))
        ))
        
        user_id = cur.fetchone()[0]
        conn.commit()
        
        print(f"✅ Utilizator nou creat (Cold Start): {data['email']}")
        print(f"   - Gen: {data.get('gender')}")
        print(f"   - Vârstă: {data.get('age_range')}")
        print(f"   - Tip piele: {data.get('skin_type')}")
        print(f"   - Alergii: {data.get('allergies', [])}")
        
        return jsonify({
            "success": True,
            "message": "Cont creat cu succes! Profilul Cold Start a fost salvat.",
            "user_id": user_id
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
        
    finally:
        cur.close()
        conn.close()


@app.route("/api/forgot-password", methods=['POST'])
def forgot_password():
    """
    Inițiază procesul de resetare a parolei.
    
    În producție, acest endpoint ar:
    1. Verifica dacă email-ul există în baza de date
    2. Genera un token unic de resetare
    3. Trimite un email cu link-ul de resetare
    
    Pentru demo, doar simulăm procesul.
    """
    data = request.json
    email = data.get('email', '').strip()
    
    if not email:
        return jsonify({
            "success": False,
            "error": "Adresa de email este obligatorie!"
        }), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Verifică dacă email-ul există (dar nu dezvăluim asta din motive de securitate)
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        
        if user:
            # În producție: generează token, salvează în DB, trimite email
            print(f"📧 Cerere resetare parolă pentru: {email}")
            # token = secrets.token_urlsafe(32)
            # send_reset_email(email, token)
        
        # Întotdeauna returnăm succes (pentru a nu dezvălui dacă email-ul există)
        return jsonify({
            "success": True,
            "message": "Dacă există un cont cu această adresă, vei primi un email cu instrucțiuni."
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "A apărut o eroare. Te rugăm să încerci din nou."
        }), 500
        
    finally:
        cur.close()
        conn.close()


@app.route("/api/login", methods=['POST'])
def login():
    """
    Autentifică un utilizator și returnează datele Cold Start.
    
    Body JSON așteptat:
    {
        "email": "user@example.com",
        "password": "parola123"
    }
    
    Returnează:
    - 200: Login reușit + datele utilizatorului (inclusiv Cold Start)
    - 401: Credențiale invalide
    """
    data = request.json
    
    if not data.get('email') or not data.get('password'):
        return jsonify({
            "success": False,
            "error": "Email și parola sunt obligatorii!"
        }), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        password_hash = hash_password(data['password'])
        
        cur.execute("""
            SELECT id, email, name, gender, age_range, skin_type, allergies 
            FROM users 
            WHERE email = %s AND password_hash = %s
        """, (data['email'], password_hash))
        
        user = cur.fetchone()
        
        if user:
            # Actualizează last_login
            cur.execute(
                "UPDATE users SET last_login = %s WHERE id = %s",
                (datetime.now(), user[0])
            )
            conn.commit()
            
            return jsonify({
                "success": True,
                "message": "Login reușit!",
                "user": {
                    "id": user[0],
                    "email": user[1],
                    "name": user[2],
                    "gender": user[3],
                    "age_range": user[4],  # Interval vârstă Cold Start
                    "skin_type": user[5],
                    "allergies": user[6] if user[6] else []
                }
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Email sau parolă incorectă!"
            }), 401
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
        
    finally:
        cur.close()
        conn.close()


@app.route("/api/user/<int:user_id>", methods=['GET'])
def get_user(user_id):
    """Returnează datele unui utilizator după ID (inclusiv Cold Start)."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, email, name, gender, age_range, skin_type, allergies 
            FROM users WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        
        if user:
            return jsonify({
                "success": True,
                "user": {
                    "id": user[0],
                    "email": user[1],
                    "name": user[2],
                    "gender": user[3],
                    "age_range": user[4],  # Interval vârstă Cold Start
                    "skin_type": user[5],
                    "allergies": user[6] if user[6] else []
                }
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Utilizator negăsit!"
            }), 404
            
    finally:
        cur.close()
        conn.close()


@app.route("/api/user/<int:user_id>", methods=['PUT'])
def update_user(user_id):
    """Actualizează profilul Cold Start al unui utilizator."""
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Construiește query-ul de update dinamic
        updates = []
        values = []
        
        if 'name' in data:
            updates.append("name = %s")
            values.append(data['name'])
        if 'gender' in data:
            updates.append("gender = %s")
            values.append(data['gender'])
        if 'age_range' in data:  # Interval vârstă Cold Start
            updates.append("age_range = %s")
            values.append(data['age_range'])
        if 'skin_type' in data:
            updates.append("skin_type = %s")
            values.append(data['skin_type'])
        if 'allergies' in data:
            updates.append("allergies = %s")
            values.append(json.dumps(data['allergies']))
            
        if not updates:
            return jsonify({
                "success": False,
                "error": "Niciun câmp de actualizat!"
            }), 400
            
        values.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        
        cur.execute(query, values)
        conn.commit()
        
        print(f"✅ Profil Cold Start actualizat pentru user {user_id}")
        
        return jsonify({
            "success": True,
            "message": "Profil Cold Start actualizat cu succes!"
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
        
    finally:
        cur.close()
        conn.close()


# ============================================================================
# ENDPOINT-URI API - PRODUSE
# ============================================================================

@app.route("/api/health")
def health():
    """Verifică dacă serverul funcționează."""
    return jsonify({"status": "ok", "message": "Serverul funcționează! 🎉"})


@app.route("/api/products")
def list_products():
    """
    Returnează lista de produse.
    
    Query parameters opționale:
    - limit: Număr maxim de produse (default: 50)
    - offset: Pentru paginare
    - category: Filtrează după categorie
    - skin_type: Filtrează după tip de piele
    - search: Caută în numele produsului
    """
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    category = request.args.get('category', '')
    skin_type = request.args.get('skin_type', '')
    search = request.args.get('search', '')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        query = """
            SELECT product_id, product_name, brand_name, price, 
                   primary_category, secondary_category, rating, 
                   reviews, loves_count, assigned_skin_type, highlights, ingredients
            FROM products 
            WHERE out_of_stock = 0
        """
        params = []
        
        if category:
            query += " AND (primary_category ILIKE %s OR secondary_category ILIKE %s)"
            params.extend([f'%{category}%', f'%{category}%'])
            
        if skin_type:
            query += " AND assigned_skin_type ILIKE %s"
            params.append(f'%{skin_type}%')
            
        if search:
            query += " AND (product_name ILIKE %s OR brand_name ILIKE %s)"
            params.extend([f'%{search}%', f'%{search}%'])
            
        query += " ORDER BY loves_count DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        
        products = []
        for row in cur.fetchall():
            products.append({
                "product_id": row[0],
                "product_name": row[1],
                "brand_name": row[2],
                "price": row[3],
                "primary_category": row[4],
                "secondary_category": row[5],
                "rating": row[6],
                "reviews": row[7],
                "loves_count": row[8],
                "skin_type": row[9],
                "highlights": row[10],
                "ingredients": row[11]
            })
        
        # Obține și numărul total pentru paginare
        cur.execute("SELECT COUNT(*) FROM products WHERE out_of_stock = 0")
        total = cur.fetchone()[0]
        
        return jsonify({
            "success": True,
            "products": products,
            "total": total,
            "limit": limit,
            "offset": offset
        })
        
    finally:
        cur.close()
        conn.close()


@app.route("/api/product/<product_id>")
def get_product(product_id):
    """Returnează detaliile unui produs specific."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT product_id, product_name, brand_name, price, 
                   ingredients, highlights, primary_category, 
                   secondary_category, rating, reviews, loves_count,
                   assigned_skin_type
            FROM products WHERE product_id = %s
        """, (product_id,))
        
        row = cur.fetchone()
        
        if row:
            return jsonify({
                "success": True,
                "product": {
                    "product_id": row[0],
                    "product_name": row[1],
                    "brand_name": row[2],
                    "price": row[3],
                    "ingredients": row[4],
                    "highlights": row[5],
                    "primary_category": row[6],
                    "secondary_category": row[7],
                    "rating": row[8],
                    "reviews": row[9],
                    "loves_count": row[10],
                    "skin_type": row[11]
                }
            })
        else:
            return jsonify({
                "success": False,
                "error": "Produs negăsit!"
            }), 404
            
    finally:
        cur.close()
        conn.close()


@app.route("/api/categories")
def get_categories():
    """Returnează lista de categorii disponibile."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT DISTINCT primary_category 
            FROM products 
            WHERE primary_category IS NOT NULL AND primary_category != ''
            ORDER BY primary_category
        """)
        
        categories = [row[0] for row in cur.fetchall()]
        
        return jsonify({
            "success": True,
            "categories": categories
        })
        
    finally:
        cur.close()
        conn.close()


# ============================================================================
# ENDPOINT-URI API - RECOMANDĂRI
# ============================================================================

@app.route("/api/recommendations", methods=['POST'])
def get_recommendations():
    """
    Generează recomandări personalizate pentru un produs.
    
    Body JSON așteptat:
    {
        "product_id": "P433469",           // ID-ul produsului de referință
        "user_id": 1,                      // Optional: pentru personalizare
        "count": 5,                        // Optional: număr de recomandări (default: 5)
        "filter_skin_type": true,          // Optional: filtrează după tipul de piele
        "filter_allergies": true,          // Optional: exclude alergeni
        "filter_keyword": "hypoallergenic" // Optional: keyword suplimentar
    }
    
    Returnează:
    - Lista de produse recomandate cu detalii complete
    """
    data = request.json
    product_id = data.get('product_id')
    user_id = data.get('user_id')
    count = data.get('count', 5)
    filter_skin_type = data.get('filter_skin_type', False)
    filter_allergies = data.get('filter_allergies', False)
    filter_keyword = data.get('filter_keyword', '')
    
    if not product_id:
        return jsonify({
            "success": False,
            "error": "product_id este obligatoriu!"
        }), 400
    
    try:
        # Încarcă DataFrame-ul cu produse
        df_products = pd.read_csv("store_products.csv", dtype=str, low_memory=False)
        
        # Verifică dacă produsul există
        if product_id not in df_products['product_id'].values:
            return jsonify({
                "success": False,
                "error": f"Produsul {product_id} nu a fost găsit!"
            }), 404
        
        # Obține informații despre utilizator dacă este specificat
        user_skin_type = None
        user_allergies = []
        
        if user_id:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "SELECT skin_type, allergies FROM users WHERE id = %s",
                (user_id,)
            )
            user_data = cur.fetchone()
            if user_data:
                user_skin_type = user_data[0]
                user_allergies = user_data[1] if user_data[1] else []
            cur.close()
            conn.close()
        
        # Aplică filtre
        df_filtered = df_products.copy()
        
        # Filtru pentru keyword
        if filter_keyword:
            df_filtered = filter(df_filtered, column="highlights", keyword=filter_keyword)
        
        # Filtru pentru tipul de piele
        if filter_skin_type and user_skin_type:
            # Păstrează produsele potrivite pentru tipul de piele al utilizatorului
            df_filtered = df_filtered[
                (df_filtered['assigned_skin_type'].str.lower() == user_skin_type.lower()) |
                (df_filtered['assigned_skin_type'].str.lower() == 'all') |
                (df_filtered['assigned_skin_type'].isna()) |
                (df_filtered['assigned_skin_type'] == '')
            ]
        
        # Filtru pentru alergii
        if filter_allergies and user_allergies:
            for allergen in user_allergies:
                df_filtered = filter_out(df_filtered, column="ingredients", keyword=allergen)
        
        # Verifică dacă mai sunt produse după filtrare
        if len(df_filtered) < 2:
            return jsonify({
                "success": False,
                "error": "Nu sunt suficiente produse după aplicarea filtrelor!"
            }), 400
        
        # Verifică dacă produsul de referință este încă în DataFrame
        if product_id not in df_filtered['product_id'].values:
            df_filtered = pd.concat([
                df_products[df_products['product_id'] == product_id],
                df_filtered
            ]).drop_duplicates()
        
        # Generează recomandări
        recommendation_indices = get_n_recommandation(
            df_filtered, 
            "ingredients", 
            "highlights", 
            product_id, 
            count
        )
        
        # Construiește răspunsul cu detalii despre produsele recomandate
        recommendations = []
        for idx in recommendation_indices:
            product = df_filtered.iloc[idx]
            recommendations.append({
                "product_id": product['product_id'],
                "product_name": product['product_name'],
                "brand_name": product['brand_name'],
                "price": float(product['price_usd']) if pd.notna(product['price_usd']) else 0,
                "rating": float(product['rating']) if pd.notna(product['rating']) else None,
                "reviews": int(float(product['reviews'])) if pd.notna(product['reviews']) else 0,
                "loves_count": int(product['loves_count']) if pd.notna(product['loves_count']) else 0,
                "skin_type": product['assigned_skin_type'],
                "highlights": product['highlights'],
                "primary_category": product['primary_category'],
                "secondary_category": product['secondary_category']
            })
        
        # Obține informații despre produsul de referință
        ref_product = df_products[df_products['product_id'] == product_id].iloc[0]
        reference_product = {
            "product_id": ref_product['product_id'],
            "product_name": ref_product['product_name'],
            "brand_name": ref_product['brand_name'],
            "price": float(ref_product['price_usd']) if pd.notna(ref_product['price_usd']) else 0,
        }
        
        # Salvează în istoric (opțional)
        if user_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO recommendation_history (user_id, product_id, recommended_products)
                    VALUES (%s, %s, %s)
                """, (user_id, product_id, json.dumps([r['product_id'] for r in recommendations])))
                conn.commit()
                cur.close()
                conn.close()
            except:
                pass  # Nu blocăm dacă salvarea eșuează
        
        # return jsonify({
        #     "success": True,
        #     "reference_product": reference_product,
        #     "recommendations": recommendations,
        #     "filters_applied": {
        #         "skin_type": user_skin_type if filter_skin_type else None,
        #         "allergies": user_allergies if filter_allergies else [],
        #         "keyword": filter_keyword if filter_keyword else None
        #     }
        # })
        return jsonify({
            "success": True,
            "reference_product": reference_product,
            "recommendations": clean_for_json(recommendations),
            "filters_applied": {
                "skin_type": user_skin_type if filter_skin_type else None,
                "allergies": user_allergies if filter_allergies else [],
                "keyword": filter_keyword if filter_keyword else None
            }
        })
        # return jsonify({"success": True, "recommendations": clean_for_json(recommendations)})
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/recommendations/for-user/<int:user_id>", methods=['GET'])
def get_personalized_recommendations(user_id):
    """
    Generează recomandări personalizate bazate pe profilul utilizatorului.
    
    Returnează produse populare potrivite pentru tipul de piele al utilizatorului.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Obține profilul utilizatorului
        cur.execute(
            "SELECT skin_type, allergies FROM users WHERE id = %s",
            (user_id,)
        )
        user_data = cur.fetchone()
        
        if not user_data:
            return jsonify({
                "success": False,
                "error": "Utilizator negăsit!"
            }), 404
        
        user_skin_type = user_data[0]
        user_allergies = user_data[1] if user_data[1] else []
        
        # Query pentru produse potrivite
        query = """
            SELECT product_id, product_name, brand_name, price, 
                   rating, reviews, loves_count, assigned_skin_type,
                   highlights, primary_category
            FROM products 
            WHERE out_of_stock = 0
        """
        params = []
        
        if user_skin_type:
            query += """
                AND (assigned_skin_type ILIKE %s 
                     OR assigned_skin_type ILIKE %s 
                     OR assigned_skin_type IS NULL 
                     OR assigned_skin_type = '')
            """
            params.extend([f'%{user_skin_type}%', '%all%'])
        
        query += " ORDER BY loves_count DESC, rating DESC LIMIT 20"
        
        cur.execute(query, params)
        
        products = []
        for row in cur.fetchall():
            # Verifică alergii în ingredients (simplificat)
            products.append({
                "product_id": row[0],
                "product_name": row[1],
                "brand_name": row[2],
                "price": row[3],
                "rating": row[4],
                "reviews": row[5],
                "loves_count": row[6],
                "skin_type": row[7],
                "highlights": row[8],
                "primary_category": row[9]
            })
        
        return jsonify({
            "success": True,
            "user_profile": {
                "skin_type": user_skin_type,
                "allergies_count": len(user_allergies)
            },
            "recommendations": products
        })
        
    finally:
        cur.close()
        conn.close()


# ============================================================================
# PORNIRE SERVER
# ============================================================================

if __name__ == "__main__":
    print("🚀 Inițializare server...")
    tables_existed = init_db()
    
    if not tables_existed:
        # Prima rulare - importăm produsele
        import_csv("store_products.csv")
    else:
        # Verifică dacă există produse
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM products;")
            product_count = cur.fetchone()[0]
            cur.close()
            conn.close()
            
            if product_count == 0:
                print("⚠️  Tabela products e goală - importăm produsele...")
                import_csv("store_products.csv")
            else:
                print(f"ℹ️  {product_count} produse găsite în baza de date")
        except Exception as e:
            print(f"⚠️  Eroare la verificare produse: {e}")
            import_csv("store_products.csv")
    
    print("🌐 Serverul pornește pe http://localhost:5003")
    app.run(host="0.0.0.0", port=5003, debug=True)