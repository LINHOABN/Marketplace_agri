"""
Script d'initialisation de la base de données AgriMarché.
Crée toutes les tables, enums et extensions nécessaires.
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Charge les variables d'environnement
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERREUR : DATABASE_URL non trouvée.")
    exit(1)

engine = create_engine(DATABASE_URL)

SQL_STATEMENTS = [
    # 1. Extensions
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",

    # 2. Enums
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN CREATE TYPE dispute_status AS ENUM ('open', 'resolved', 'rejected'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN CREATE TYPE invoice_status AS ENUM ('generated', 'sent', 'downloaded'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'in_progress', 'delivered', 'cancelled', 'disputed', 'prepared', 'completed', 'shipped'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN CREATE TYPE post_type AS ENUM ('permanent', 'story'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN CREATE TYPE product_unit AS ENUM ('kg', 'sac', 'piece', 'litre'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'escrow_lock', 'escrow_release', 'commission', 'refund'); END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'deliverer', 'admin'); END IF; END $$;",

    # 3. Tables (Indépendantes ou peu de dépendances)
    """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        avatar_url TEXT,
        location VARCHAR(255),
        description TEXT,
        id_card_url TEXT,
        selfie_url TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        managed_by_id UUID,
        verification_submitted_at TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon_url VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # 4. Tables dépendantes des users
    """
    CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role user_role NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, role)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance NUMERIC DEFAULT 0.00,
        escrow_balance NUMERIC DEFAULT 0.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,

    # 5. Boutique et Produits
    """
    CREATE TABLE IF NOT EXISTS shops (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        logo_url VARCHAR(255),
        banner_url VARCHAR(255),
        status VARCHAR(30) DEFAULT 'active',
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        specialties TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL,
        unit product_unit NOT NULL,
        quantity_available NUMERIC NOT NULL,
        image_url VARCHAR(255),
        media_urls TEXT[] DEFAULT '{}',
        location VARCHAR(255),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        managed_by_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,

    # 6. Commandes et Transactions
    """
    CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_id UUID REFERENCES users(id),
        shop_id UUID REFERENCES shops(id),
        product_id UUID REFERENCES products(id),
        status order_status DEFAULT 'pending',
        total_amount NUMERIC NOT NULL,
        quantity NUMERIC DEFAULT 1,
        delivery_address TEXT,
        delivery_fee NUMERIC DEFAULT 0,
        commission_amount NUMERIC DEFAULT 0,
        seller_amount NUMERIC DEFAULT 0,
        payment_method VARCHAR(50),
        deliverer_id UUID REFERENCES users(id),
        delivery_vendor_id UUID,
        delivery_lat DOUBLE PRECISION,
        delivery_lng DOUBLE PRECISION,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID REFERENCES wallets(id),
        user_id UUID REFERENCES users(id),
        order_id UUID REFERENCES orders(id),
        type transaction_type NOT NULL,
        amount NUMERIC NOT NULL,
        status transaction_status DEFAULT 'pending',
        reference VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # 7. Communications
    """
    CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user1_id UUID REFERENCES users(id),
        user2_id UUID REFERENCES users(id),
        product_id UUID REFERENCES products(id),
        deleted_by_user1 BOOLEAN DEFAULT FALSE,
        deleted_by_user2 BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id),
        receiver_id UUID REFERENCES users(id),
        content TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'text',
        is_read BOOLEAN DEFAULT FALSE,
        audio_url TEXT,
        media_url TEXT,
        offer_price NUMERIC,
        offer_status VARCHAR(20) DEFAULT 'pending',
        offer_quantity NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,

    # 8. Autres (Audit, Admin, Settings)
    """
    CREATE TABLE IF NOT EXISTS platform_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) UNIQUE NOT NULL,
        value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        target_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS role_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        requested_role VARCHAR(50) NOT NULL,
        status VARCHAR(30) DEFAULT 'pending',
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(128) NOT NULL,
        device_label VARCHAR(255),
        ip_address VARCHAR(64),
        user_agent TEXT,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        last_used_at TIMESTAMP DEFAULT NOW()
    );
    """
]

def run():
    print(f"Connexion à la base de données sur Render...")
    with engine.connect() as conn:
        for stmt in SQL_STATEMENTS:
            try:
                # Nettoyer et exécuter
                stmt_clean = stmt.strip()
                if stmt_clean:
                    conn.execute(text(stmt_clean))
                    conn.commit()
                    print(f"OK : {stmt_clean[:50]}...")
            except Exception as e:
                print(f"ERREUR/IGNORÉ : {str(e)[:100]}...")
                
    print("\nInitialisation terminée avec succès !")

if __name__ == "__main__":
    run()
