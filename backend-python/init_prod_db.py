import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

def init_db():
    if not db_url:
        print("DATABASE_URL non trouvée.")
        return
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("1. Création des ENUMS...")
        enums = {
            "user_role": "('buyer', 'seller', 'deliverer', 'admin')",
            "order_status": "('pending', 'accepted', 'in_progress', 'delivered', 'cancelled', 'disputed', 'prepared', 'completed', 'shipped')",
            "post_type": "('permanent', 'story')",
            "dispute_status": "('open', 'resolved', 'rejected')",
            "invoice_status": "('generated', 'sent', 'downloaded')",
            "product_unit": "('kg', 'sac', 'piece', 'litre')",
            "transaction_status": "('pending', 'completed', 'failed')",
            "transaction_type": "('deposit', 'withdrawal', 'escrow_lock', 'escrow_release', 'commission', 'refund')"
        }
        
        for name, values in enums.items():
            cur.execute(f"""
                DO $$ BEGIN
                    CREATE TYPE {name} AS ENUM {values};
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """)

        print("2. Création des TABLES...")
        
        # Extension pour UUID si nécessaire
        cur.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

        tables = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(255),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                location VARCHAR(255),
                description TEXT,
                avatar_url TEXT,
                managed_by_id UUID,
                id_card_url TEXT,
                selfie_url TEXT,
                is_verified BOOLEAN DEFAULT false,
                verification_submitted_at TIMESTAMP,
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS user_roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role user_role NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                UNIQUE(user_id, role)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS shops (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                logo_url VARCHAR(255),
                banner_url VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                status VARCHAR(50) DEFAULT 'active',
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                specialties TEXT
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                icon_url VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price NUMERIC NOT NULL,
                unit product_unit NOT NULL,
                quantity_available NUMERIC NOT NULL,
                image_url VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                location VARCHAR(255),
                media_urls TEXT[] DEFAULT '{}',
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS posts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type post_type NOT NULL,
                content TEXT NOT NULL,
                media_url VARCHAR(255),
                category VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                expires_at TIMESTAMP WITH TIME ZONE
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS product_reviews (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                target_id VARCHAR(255)
            );
            """
        ]

        for table_sql in tables:
            cur.execute(table_sql)

        print("3. Ajout de CATEGORIES de base...")
        # S'assurer que le nom est unique avant le ON CONFLICT
        cur.execute("ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);")
    except Exception as e:
        if "already exists" not in str(e): print(f"Note constraint: {e}")

    try:
        base_cats = ['Fruits & Légumes', 'Céréales', 'Élevage', 'Matériel Agricole', 'Engrais', 'Services']
        for cat in base_cats:
            cur.execute("INSERT INTO categories (name) VALUES (%s) ON CONFLICT (name) DO NOTHING;", (cat,))

        print("\n>>> SUCCÈS : Base de données initialisée avec toutes les tables critiques.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"\n>>> ERREUR : {e}")

if __name__ == "__main__":
    init_db()
