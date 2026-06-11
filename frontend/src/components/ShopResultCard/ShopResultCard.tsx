import { MapPin, BadgeCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config";
import "./ShopResultCard.css";

interface ShopResultCardProps {
    shop: {
        id: string;
        name: string;
        description?: string;
        logo_url?: string;
        seller_name: string;
        city?: string;
        specialties?: string;
    };
}

export default function ShopResultCard({ shop }: ShopResultCardProps) {
    const navigate = useNavigate();

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    return (
        <div className="shop-result-card" onClick={() => navigate(`/shop/${shop.id}`)}>
            <div className="shop-result-main">
                {shop.logo_url ? (
                    <img
                        src={shop.logo_url.startsWith("http") ? shop.logo_url : `${API_URL}${shop.logo_url}`}
                        alt={shop.name}
                        className="shop-result-logo"
                    />
                ) : (
                    <div className="shop-result-initials">
                        {getInitials(shop.name)}
                    </div>
                )}
                <div className="shop-result-info">
                    <div className="shop-result-name-row">
                        <h4 className="shop-result-name">{shop.name}</h4>
                        <BadgeCheck size={16} color="var(--primary)" fill="rgba(46, 125, 50, 0.1)" />
                    </div>
                    <p className="shop-result-seller">Par {shop.seller_name}</p>
                    {shop.specialties && (
                        <p className="shop-result-specialties">
                            Spécialités : {shop.specialties}
                        </p>
                    )}
                </div>
            </div>
            <div className="shop-result-footer">
                <div className="shop-result-loc">
                    <MapPin size={14} />
                    <span>{shop.city || "Douala, CM"}</span>
                </div>
                <button className="shop-result-btn">
                    <span>Visiter</span>
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
}
