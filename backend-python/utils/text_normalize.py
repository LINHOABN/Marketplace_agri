"""Normalisation de texte pour recherche insensible aux accents."""
import unicodedata


def fold_accents(value: str) -> str:
    """Retire les accents : « tomate » matche aussi « tomate » saisi sans accent."""
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value)
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn")
