import { Leaf, Send, MessageCircle, Globe } from 'lucide-react';
import './Footer.css';

const Footer: React.FC = () => {
    return (
        <footer className="agrimarche-footer">
            <div className="footer-top">
                <div className="footer-columns">
                    {/* Colonne 1: À propos */}
                    <div className="footer-column">
                        <h3>À propos d'AgriMarché</h3>
                        <ul>
                            <li><a href="/about">Qui sommes-nous ?</a></li>
                            <li><a href="/mission">Notre mission</a></li>
                            <li><a href="/terms">Conditions d'utilisation</a></li>
                            <li><a href="/privacy">Politique de confidentialité</a></li>
                            <li><a href="/legal">Mentions légales</a></li>
                        </ul>
                    </div>

                    {/* Colonne 2: Marché Agricole */}
                    <div className="footer-column">
                        <h3>Marché Agricole</h3>
                        <ul>
                            <li><a href="/search?type=product">Acheter</a></li>
                            <li><a href="/seller/setup">Vendre</a></li>
                            <li><a href="/categories">Toutes les catégories</a></li>
                            <li><a href="/search?sort=popular">Produits populaires</a></li>
                            <li><a href="/search?sort=newest">Produits récents</a></li>
                        </ul>
                    </div>

                    {/* Colonne 3: Assistance */}
                    <div className="footer-column">
                        <h3>Assistance</h3>
                        <ul>
                            <li><a href="/help">Centre d'aide</a></li>
                            <li><a href="/faq">FAQ</a></li>
                            <li><a href="/contact">Contact</a></li>
                            <li><a href="/report">Signaler un problème</a></li>
                            <li><a href="/ai-assistant">Assistance IA</a></li>
                        </ul>
                    </div>

                    {/* Colonne 4: Ressources */}
                    <div className="footer-column">
                        <h3>Ressources</h3>
                        <ul>
                            <li><a href="/tips">Conseils agricoles</a></li>
                            <li><a href="/blog">Blog</a></li>
                            <li><a href="/news">Actualités agricoles</a></li>
                            <li><a href="/guide-vendeur">Guide du vendeur</a></li>
                            <li><a href="/guide-acheteur">Guide de l'acheteur</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <div className="footer-bottom-content">
                    <div className="footer-info">
                        <div className="footer-logo">
                            <Leaf size={24} />
                            <span>AgriMarché © 2026</span>
                        </div>
                        <p className="mission-text">
                            Plateforme numérique de mise en relation entre producteurs, éleveurs et acheteurs.
                        </p>
                    </div>

                    <div className="footer-socials">
                        <a href="https://facebook.com" aria-label="Facebook"><Globe size={20} /></a>
                        <a href="https://wa.me/..." aria-label="WhatsApp"><MessageCircle size={20} /></a>
                        <a href="https://t.me/..." aria-label="Telegram"><Send size={20} /></a>
                        <a href="https://linkedin.com" aria-label="LinkedIn"><Globe size={20} /></a>
                    </div>

                    <div className="footer-version">
                        <span>Version 1.0</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
