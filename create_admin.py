import os
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv(dotenv_path="backend-python/.env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/agrimarche_db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin():
    db = SessionLocal()
    email = "admin@agrimarche.com"
    password = "adminpassword123"
    full_name = "Administrateur AgriMarché"
    
    hashed_password = pwd_context.hash(password)
    
    try:
        # Check if exists
        res = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email}).first()
        if res:
            user_id = res[0]
            print(f"User {email} already exists with ID {user_id}")
        else:
            # Create user
            insert_query = text("""
                INSERT INTO users (full_name, email, password_hash, created_at)
                VALUES (:name, :email, :password, NOW())
                RETURNING id
            """)
            user_id = db.execute(insert_query, {"name": full_name, "email": email, "password": hashed_password}).scalar()
            print(f"Created user {email} with ID {user_id}")

        # Assign admin role
        db.execute(text("DELETE FROM user_roles WHERE user_id = :u_id"), {"u_id": user_id})
        db.execute(text("INSERT INTO user_roles (user_id, role) VALUES (:u_id, 'admin')"), {"u_id": user_id})
        
        db.commit()
        print(f"Role 'admin' assigned to user ID {user_id}")
        print("\nIDENTIFIANTS ADMIN :")
        print(f"Email: {email}")
        print(f"Mot de passe: {password}")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
