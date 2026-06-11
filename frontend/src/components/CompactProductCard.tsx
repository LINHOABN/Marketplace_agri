import { Heart, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import "./CompactProductCard.css";

interface CompactProductCardProps {
    product: {
        id: string;
        name: string;
        price: number;
        image: string;
        sellerName: string;
        category?: string;
    };
}

export default function CompactProductCard({ product }: CompactProductCardProps) {
    const navigate = useNavigate();

    const getImageUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        if (url.startsWith("/uploads")) return url;
        return `${API_URL}${url}`;
    };

    const openProduct = () => navigate(`/product/${product.id}`);

    return (
        <div className="compact-product-card" onClick={openProduct}>
            <div className="compact-image-container">
                <img src={getImageUrl(product.image)} alt={product.name} className="compact-image" loading="lazy" />
                <button className="compact-like-btn" onClick={(e) => { e.stopPropagation(); }}>
                    <Heart size={14} />
                </button>
            </div>
            <div className="compact-info">
                <h3 className="compact-title">{product.name}</h3>
                <div className="compact-footer">
                    <span className="compact-price">{product.price.toLocaleString("fr-FR")} F</span>
                    <button className="compact-cart-btn" onClick={(e) => { e.stopPropagation(); openProduct(); }}>
                        <ShoppingCart size={14} />
                    </button>
                </div>
                <span className="compact-category">{product.category || ""}</span>
            </div>
        </div>
    );
}
