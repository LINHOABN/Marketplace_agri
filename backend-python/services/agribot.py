"""
AgriBot — logique métier assistant IA AgriMarché.
OpenAI ou Gemini si clé configurée, sinon réponses locales (agriculture Cameroun).
"""
from __future__ import annotations

import os
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text

SYSTEM_PROMPT = """Tu es AgriBot, l'assistant officiel d'AgriMarché (marketplace agricole au Cameroun).

Règles :
- Réponds en français, de façon claire et concise (2 à 6 phrases sauf si l'utilisateur demande plus).
- Domaines : agriculture, élevage, pêche, maraîchage, prix du marché, commandes AgriMarché, livraison, paiement sécurisé (escrow), rôles acheteur/vendeur/livreur.
- Ne invente pas de prix précis ; oriente vers le catalogue et la négociation sur la plateforme.
- Si la question est hors sujet, redirige poliment vers l'agriculture ou l'utilisation d'AgriMarché.
- Ton chaleureux, professionnel ; tu peux utiliser occasionnellement une expression locale camerounaise légère."""

SUGGESTIONS_DEFAULT = [
    "Comment acheter en toute sécurité sur AgriMarché ?",
    "Quelles cultures planter en saison des pluies ?",
    "Comment devenir vendeur sur la plateforme ?",
    "Comment suivre ma commande ?",
]

SUGGESTIONS_BY_ROLE: dict[str, list[str]] = {
    "buyer": [
        "Où voir mes commandes en cours ?",
        "Comment négocier le prix avec un vendeur ?",
        "Le paiement est-il sécurisé jusqu'à la livraison ?",
    ],
    "seller": [
        "Comment publier un nouveau produit ?",
        "Comment accepter une commande vendeur ?",
        "Quand suis-je payé après une vente ?",
    ],
    "deliverer": [
        "Comment accepter une mission de livraison ?",
        "Quel statut mettre quand j'ai livré ?",
    ],
    "admin": [
        "Comment valider une demande de rôle vendeur ?",
    ],
}


def get_suggestions(role: str | None) -> list[str]:
    role_key = (role or "buyer").lower()
    extra = SUGGESTIONS_BY_ROLE.get(role_key, [])
    merged = SUGGESTIONS_DEFAULT + extra
    seen: set[str] = set()
    out: list[str] = []
    for s in merged:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out[:6]


def build_user_context(db: Session, user_id: str, role: str) -> str:
    """Résumé court pour personnaliser les réponses IA."""
    parts: list[str] = []
    try:
        user_row = db.execute(
            text(
                "SELECT full_name, location FROM users WHERE id = CAST(:uid AS uuid)"
            ),
            {"uid": user_id},
        ).mappings().first()
        if user_row:
            name = user_row.get("full_name") or "Utilisateur"
            loc = user_row.get("location") or "Cameroun"
            parts.append(f"Utilisateur connecté : {name}, rôle {role}, zone {loc}.")

        if role == "buyer":
            row = db.execute(
                text("""
                    SELECT COUNT(*)::int AS n FROM orders
                    WHERE buyer_id = CAST(:uid AS uuid)
                      AND status NOT IN ('cancelled', 'annule', 'annulé')
                """),
                {"uid": user_id},
            ).mappings().first()
            if row:
                parts.append(f"Commandes actives ou passées : {row['n']}.")
        elif role == "seller":
            row = db.execute(
                text("""
                    SELECT COUNT(*)::int AS n FROM orders o
                    JOIN shops s ON o.shop_id = s.id
                    WHERE s.seller_id = CAST(:uid AS uuid)
                      AND o.status IN ('pending', 'accepted', 'in_progress', 'shipped')
                """),
                {"uid": user_id},
            ).mappings().first()
            if row:
                parts.append(f"Commandes boutique en cours : {row['n']}.")
    except Exception:
        pass
    return " ".join(parts)


def _normalize_history(history: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not history:
        return []
    out: list[dict[str, str]] = []
    for item in history[-10:]:
        role = item.get("role", "user")
        content = (item.get("content") or item.get("text") or "").strip()
        if not content:
            continue
        if role not in ("user", "assistant", "bot"):
            role = "user"
        if role == "bot":
            role = "assistant"
        out.append({"role": role, "content": content[:2000]})
    return out


def _detect_intent(message: str) -> str:
    msg = (message or "").lower()
    if re.search(r"\b(bonjour|salut|hello|bonsoir)\b", msg):
        return "greeting"
    if re.search(r"\b(commande|suivre|statut|mes achats|achat)\b", msg):
        return "orders"
    if re.search(r"\b(payer|paiement|escrow|sécuris|securis|litige|rembourse)\b", msg):
        return "payment"
    if re.search(r"\b(vendeur|vendre|publier|boutique|produit)\b", msg):
        return "sell"
    if re.search(r"\b(livreur|livraison|mission|en route|livré|livre)\b", msg):
        return "delivery"
    if re.search(r"\b(maïs|mais|riz|manioc|plantain|tomate|oignon|culture|semis)\b", msg):
        return "crop"
    if re.search(r"\b(élevage|elevage|poulet|bœuf|boeuf|vache|chèvre|chevre|porc)\b", msg):
        return "livestock"
    if re.search(r"\b(pas d.?argent|sans argent|gratuit|budget)\b", msg):
        return "budget"
    return "general"


def _intent_actions(intent: str, role: str | None) -> list[dict[str, str]]:
    role_key = (role or "").lower()
    actions_map: dict[str, list[dict[str, str]]] = {
        "orders": [
            {"label": "Voir mes achats", "type": "route", "value": "/history"},
            {"label": "Ouvrir le fil", "type": "route", "value": "/feed"},
        ],
        "payment": [
            {"label": "Voir mes achats", "type": "route", "value": "/history"},
            {"label": "Centre de litiges", "type": "hint", "value": "Ouvre une commande puis clique sur Litige."},
        ],
        "sell": [
            {"label": "Devenir vendeur", "type": "route", "value": "/profile"},
            {"label": "Créer un produit", "type": "route", "value": "/product/create"},
            {"label": "Tableau vendeur", "type": "route", "value": "/seller/dashboard"},
        ],
        "delivery": [
            {"label": "Tableau livreur", "type": "route", "value": "/deliverer/dashboard"},
            {"label": "Voir commandes", "type": "route", "value": "/history"},
        ],
        "crop": [
            {"label": "Rechercher produits", "type": "route", "value": "/search"},
            {"label": "Voir le fil agricole", "type": "route", "value": "/feed"},
        ],
        "livestock": [
            {"label": "Rechercher sur le marché", "type": "route", "value": "/search"},
            {"label": "Ouvrir le chat vendeurs", "type": "route", "value": "/conversations"},
        ],
        "budget": [
            {"label": "Conseils gratuits", "type": "hint", "value": "Utilise AgriBot en mode local, sans clé API."},
            {"label": "Explorer produits", "type": "route", "value": "/feed"},
        ],
    }
    actions = actions_map.get(intent, [{"label": "Aller au fil", "type": "route", "value": "/feed"}])
    if role_key == "deliverer":
        actions = [{"label": "Tableau livreur", "type": "route", "value": "/deliverer/dashboard"}] + actions
    elif role_key == "seller":
        actions = [{"label": "Tableau vendeur", "type": "route", "value": "/seller/dashboard"}] + actions
    return actions[:4]


def _local_reply(message: str, context: str = "") -> str:
    """Réponses utiles sans API externe."""
    msg = message.lower().strip()
    ctx = f"\n{context}" if context else ""

    if re.search(r"\b(bonjour|salut|hello|bonsoir)\b", msg):
        return (
            "Bonjour ! Je suis AgriBot, votre assistant AgriMarché. "
            "Je peux vous aider sur les cultures, l'élevage, les achats sécurisés "
            "et l'utilisation de la plateforme. Que souhaitez-vous savoir ?"
        )

    if re.search(r"\b(commande|suivre|livraison|statut)\b", msg):
        return (
            "Pour suivre une commande : allez dans **Profil → Mes achats** (acheteur) "
            "ou **Tableau de bord vendeur** (vendeur). Les statuts vont de la confirmation "
            "à la préparation, l'expédition et la livraison. Le paiement reste en séquestre "
            "(escrow) jusqu'à réception."
            + ctx
        )

    if re.search(r"\b(payer|paiement|escrow|sécuris|securis|argent)\b", msg):
        return (
            "Sur AgriMarché, votre paiement est protégé : l'argent est bloqué en escrow "
            "jusqu'à ce que vous confirmiez la réception (ou que la livraison soit validée). "
            "En cas de litige, utilisez le centre de réclamation depuis votre commande."
            + ctx
        )

    if re.search(r"\b(vendeur|vendre|boutique|publier|produit)\b", msg):
        return (
            "Pour vendre : demandez le rôle **vendeur** dans votre profil, puis "
            "**Créer un produit** avec photos, prix et stock. Une boutique est créée "
            "automatiquement si vous n'en avez pas encore."
            + ctx
        )

    if re.search(r"\b(maïs|mais|riz|manioc|plantain|tomate|oignon)\b", msg):
        return (
            "Pour le maraîchage au Cameroun, adaptez la variété à votre zone (Centre, Littoral, "
            "Ouest, etc.) et à la saison. Sur AgriMarché, comparez les offres locales et "
            "discutez avec le vendeur via le chat avant d'acheter."
            + ctx
        )

    if re.search(r"\b(élevage|elevage|poulet|bœuf|vache|chèvre|porc)\b", msg):
        return (
            "L'élevage demande alimentation, hygiène et suivi sanitaire régulier. "
            "Vous trouverez animaux et intrants sur le fil d'actualité et la recherche AgriMarché. "
            "Privilégiez les vendeurs vérifiés et les avis clients."
            + ctx
        )

    if re.search(r"\b(livreur|livraison|mission)\b", msg):
        return (
            "En tant que livreur : consultez **Missions** pour accepter une course, "
            "passez le statut à **en route** puis **livré** pour déclencher la libération "
            "des fonds escrow (vendeur et livreur)."
            + ctx
        )

    return (
        "Merci pour votre question. En mode hors-ligne, je peux vous orienter sur "
        "les commandes, les paiements sécurisés, la vente et les cultures au Cameroun. "
        "Pour une réponse plus détaillée, configurez une clé **OPENAI_API_KEY** ou "
        "**GEMINI_API_KEY** côté serveur. "
        "Sinon, précisez votre besoin (ex. « comment acheter du maïs » ou « statut commande »)."
        + ctx
    )


def _local_payload(message: str, context: str = "", role: str | None = None) -> dict[str, Any]:
    intent = _detect_intent(message)
    text = _local_reply(message, context)
    return {
        "response": text,
        "source": "local",
        "intent": intent,
        "quick_actions": _intent_actions(intent, role),
        "suggestions": get_suggestions(role),
    }


async def _call_openai(
    messages: list[dict[str, str]], api_key: str, model: str
) -> str:
    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "max_tokens": 600,
                "temperature": 0.7,
            },
        )
        res.raise_for_status()
        data = res.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_gemini(
    messages: list[dict[str, str]], api_key: str, model: str
) -> str:
    contents = []
    for m in messages:
        if m["role"] == "system":
            continue
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    system = next((m["content"] for m in messages if m["role"] == "system"), SYSTEM_PROMPT)
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={api_key}"
    )
    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(
            url,
            json={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": contents,
                "generationConfig": {"maxOutputTokens": 600, "temperature": 0.7},
            },
        )
        res.raise_for_status()
        data = res.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise ValueError("Réponse Gemini vide")
        parts = candidates[0].get("content", {}).get("parts") or []
        return "".join(p.get("text", "") for p in parts).strip()


async def generate_reply(
    message: str,
    history: list[dict[str, str]] | None = None,
    user_context: str = "",
    user_role: str | None = None,
) -> dict[str, Any]:
    message = (message or "").strip()
    if not message:
        return _local_payload(
            "bonjour",
            user_context,
            user_role,
        )

    hist = _normalize_history(history)
    context_block = f"\n\nContexte utilisateur : {user_context}" if user_context else ""
    system = SYSTEM_PROMPT + context_block

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    api_messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    api_messages.extend(hist)
    api_messages.append({"role": "user", "content": message})
    intent = _detect_intent(message)
    actions = _intent_actions(intent, user_role)
    suggestions = get_suggestions(user_role)

    if openai_key:
        try:
            text = await _call_openai(api_messages, openai_key, openai_model)
            return {
                "response": text,
                "source": "openai",
                "intent": intent,
                "quick_actions": actions,
                "suggestions": suggestions,
            }
        except Exception as e:
            print(f"AgriBot OpenAI error: {e}")

    if gemini_key:
        try:
            text = await _call_gemini(api_messages, gemini_key, gemini_model)
            return {
                "response": text,
                "source": "gemini",
                "intent": intent,
                "quick_actions": actions,
                "suggestions": suggestions,
            }
        except Exception as e:
            print(f"AgriBot Gemini error: {e}")

    return _local_payload(message, user_context, user_role)
