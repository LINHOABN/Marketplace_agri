from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
import socketio
from pathlib import Path
from typing import Set, Dict

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Create Socket.io server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from uuid import UUID

# Override JSONResponse to handle UUIDs globally
class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return super().render(jsonable_encoder(content, custom_encoder={UUID: str}))

app = FastAPI(title="AgriMarché API", version="2.0.0", default_response_class=CustomJSONResponse)

# Store socket users: userId (as string) -> Set of socketId
socket_users: Dict[str, Set[str]] = {}

# Make socket_users and sio available to routers
app.state.sio = sio
app.state.socket_users = socket_users

from routers import feed, auth, media, products, posts, chat, orders, payments, wallet, ai, search, seller, shops, notifications, disputes, invoices, delivery, admin, system, admin_tips, categories, simulator
from fastapi import APIRouter

api_router = APIRouter(prefix="/api")

api_router.include_router(feed.router)
api_router.include_router(auth.router)
api_router.include_router(media.router)
api_router.include_router(products.router)
api_router.include_router(posts.router)
api_router.include_router(chat.router, prefix="/chat")
api_router.include_router(orders.router)
api_router.include_router(payments.router)
api_router.include_router(wallet.router)
api_router.include_router(ai.router)
api_router.include_router(search.router)
api_router.include_router(seller.router)
api_router.include_router(shops.router)
api_router.include_router(notifications.router)
api_router.include_router(disputes.router)
api_router.include_router(invoices.router)
api_router.include_router(delivery.router)
api_router.include_router(admin.router)
api_router.include_router(system.router)
api_router.include_router(admin_tips.router)
api_router.include_router(categories.router)
api_router.include_router(simulator.router)

app.include_router(api_router)

# Mount uploads directory for static files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="api_uploads")

# Le montage manuel est supprimé car on va envelopper l'app entière
# app.mount("/socket.io", socket_app)

# Socket.io Events
@sio.event
async def connect(sid, environ, auth=None):
    print(f"[Socket] Connected: {sid}")
    # Handle auto-join from auth token if present
    if auth and 'token' in auth:
        from jose import jwt
        from utils.security import SECRET_KEY, ALGORITHM
        try:
            payload = jwt.decode(auth['token'], SECRET_KEY, algorithms=[ALGORITHM])
            user_id = str(payload.get("id") or payload.get("sub"))
            
            if user_id and user_id != 'None':
                await sio.enter_room(sid, user_id)
                if user_id not in socket_users:
                    socket_users[user_id] = set()
                socket_users[user_id].add(sid)
                print(f"[Socket] Auto-join: User {user_id} rejoint SID {sid}")
            else:
                print(f"[Socket] Echec Auth: user_id non trouve dans le payload")
        except Exception as e:
            print(f"[Socket] Echec Auth: {str(e)}")
    else:
        print(f"[Socket] Connexion sans token pour {sid}")

@sio.event
async def join(sid, userId):
    try:
        user_id = str(userId)
        await sio.enter_room(sid, user_id)
        if user_id not in socket_users:
            socket_users[user_id] = set()
        socket_users[user_id].add(sid)
        print(f"[Socket] User {user_id} manually joined room via {sid}")
    except Exception as e:
        print(f"[Socket] Join error: {e}")

@sio.event
async def disconnect(sid):
    print(f"[Socket] Disconnected: {sid}")
    # Remove sid from socket_users
    for user_id in list(socket_users.keys()):
        if sid in socket_users[user_id]:
            socket_users[user_id].remove(sid)
            if not socket_users[user_id]:
                del socket_users[user_id]

# Capture de tous les événements pour diagnostic ultime
@sio.on('*')
async def catch_all(event, sid, data):
    print(f"[DEBUG] Event recu: {event} de SID: {sid}")

@sio.on('call-user')
async def call_user_handler(sid, data):
    target_id = str(data.get("to"))
    from_id = str(data.get("from_id", "Unknown"))
    call_type = data.get("type", "unknown")
    print(f"[Signal] Appel {call_type} de {from_id} vers {target_id} (SID {sid})")
    
    online_sids = socket_users.get(target_id, set())
    if not online_sids:
        print(f"[Signal] Cible {target_id} NON connectee")
    else:
        print(f"[Signal] Cible {target_id} en ligne ({len(online_sids)} sockets)")

    await sio.emit('incoming-call', {
        **data,
        'from': sid,
        'from_id': from_id
    }, room=target_id)

@sio.on('answer-call')
async def answer_call_handler(sid, data):
    target_sid = data.get("to") # Socket ID (for back-compat)
    target_id = data.get("to_id") # User ID
    print(f"[Signal] Reponse (Answer) de {sid} vers {target_id or target_sid}")
    
    # On émet prioritairement vers la room de l'utilisateur (UserID)
    target = str(target_id) if target_id else target_sid
    await sio.emit('call-answered', {
        'answer': data.get('answer'),
        'from': sid
    }, room=target)

@sio.on('ice-candidate')
async def ice_candidate_handler(sid, data):
    target_id = str(data.get("to"))
    print(f"[Signal] ICE Candidate de {sid} vers {target_id}")
    # On émet vers la room (userId ou SID)
    await sio.emit('ice-candidate', {
        'candidate': data.get('candidate'),
        'from': sid
    }, room=target_id)

@sio.on('end-call')
async def end_call_handler(sid, data):
    target_id = str(data.get("to"))
    print(f"[Signal] Fin d'appel de {sid} vers {target_id}")
    await sio.emit('call-ended', {'from': sid}, room=target_id)

@sio.event
async def ping_alive(sid):
    # Just an acknowledgment to keep the connection active
    pass

# CORS Configuration
raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

# On ajoute explicitement l'origine du screenshot pour être sûr
vercel_preview = "https://marketplace-agri-1f87jxvep-negoabbaabed923-8552s-projects.vercel.app"
if vercel_preview not in allowed_origins:
    allowed_origins.append(vercel_preview)

cors_params = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if "*" in allowed_origins:
    cors_params["allow_origin_regex"] = ".*"
    print(f"[CORS] Mode Wildcard active (allow_origin_regex='.*')")
else:
    cors_params["allow_origins"] = allowed_origins
    print(f"[CORS] Origins autorisees: {allowed_origins}")

app.add_middleware(CORSMiddleware, **cors_params)

@app.get("/")
async def root():
    return {
        "message": "AgriMarché Python Backend is Running",
        "status": "online",
        "version": "2.0.0"
    }

# ⚠️ CRITIQUE : L'app combinée DOIT être exposée au niveau du module.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"--- DIAGNOSTIC SYSTEME ---")
    print(f"Routes Auth chargees: /auth/login, /auth/me, /auth/verify-profile...")
    print(f"Routes Media chargees: /media/upload...")
    print(f"Démarrage sur http://localhost:{port}")
    uvicorn.run(socket_app, host="0.0.0.0", port=port)
