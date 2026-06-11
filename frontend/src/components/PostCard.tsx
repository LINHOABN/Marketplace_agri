import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserAvatar from "./UserAvatar";
import { Heart, MessageCircle, Share2, Trash2, Send } from "lucide-react";
import { API_URL } from "../config";
import { useUser } from "../hooks/useUser";
import api from "../api";
import "./PostCard.css";

export default function PostCard({ post }: { post: any }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  // Ownership: compare authenticated user ID with post author ID (string UUID comparison)
  const isAuthor = !!(currentUser && currentUser.id && post.user_id &&
    String(currentUser.id) === String(post.user_id));

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);

  const handleDelete = async () => {
    if (!window.confirm("Supprimer cette publication ?")) return;
    try {
      await api.delete(`/posts/${post.id}`);
      window.location.reload();
    } catch (err) {
      alert("Erreur lors de la suppression");
    }
  };

  const handleLike = async () => {
    if (liked) return;
    try {
      await api.post(`/posts/${post.id}/like`, {});
      setLiked(true);
      setLikeCount((prev: number) => prev + 1);
    } catch (err) {
      // Silencieux
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/posts/${post.id}/comment`, { content: commentText });
      setComments((prev) => [...prev, { ...res.data, author_name: currentUser?.name || "Vous" }]);
      setCommentText("");
    } catch (err) {
      // Silencieux
    }
  };

  // Date and time formatting
  const time =
    new Date(post.created_at).toLocaleDateString() +
    " " +
    new Date(post.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const isVideo = (url: string) => {
    if (!url) return false;
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    return ["mp4", "webm", "ogg", "mov", "avi"].includes(ext || "");
  };

  const getMediaUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_URL}${url}`;
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-avatar-container" onClick={() => navigate(`/shop/${post.shop_id || post.user_id}`)} style={{ cursor: 'pointer' }}>
          <UserAvatar
            name={post.author_name}
            avatarUrl={post.author_avatar}
            role={post.author_role}
            size="md"
          />
        </div>
        <div className="post-author-info">
          <div className="post-author-top">
            <span className="post-author-name">{isAuthor ? <strong style={{ color: "var(--primary)" }}>Vous</strong> : post.author_name}</span>
            {post.author_role && (
              <span className={`post-role-tag ${post.author_role}`}>
                {post.author_role === "seller" ? "Vendeur Certifi" : post.author_role === "deliverer" ? "Livreur" : ""}
              </span>
            )}
          </div>
          <span className="post-time">{time}</span>
        </div>
        {isAuthor && (
          <button className="delete-post-btn" onClick={handleDelete}>
            <Trash2 size={18} color="#FF4444" />
          </button>
        )}
      </div>

      {post.content && <div className="post-content">{post.content}</div>}

      {post.media_url && (
        isVideo(post.media_url) ? (
          <video
            src={getMediaUrl(post.media_url)}
            controls
            muted
            playsInline
            className="post-media"
            preload="metadata"
          />
        ) : (
          <img
            src={getMediaUrl(post.media_url)}
            alt="Publication"
            className="post-media"
          />
        )
      )}

      <div className="post-actions">
        <button
          className={`post-action-btn ${liked ? "liked" : ""}`}
          onClick={handleLike}
        >
          <Heart size={18} fill={liked ? "#E53935" : "none"} color={liked ? "#E53935" : "#666"} />
          {likeCount > 0 ? likeCount : "J'aime"}
        </button>
        <button
          className="post-action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle size={18} />
          Commenter
        </button>
        <button className="post-action-btn" style={{ marginLeft: "auto" }}>
          <Share2 size={18} />
          Partager
        </button>
      </div>

      {showComments && (
        <div className="post-comments-section">
          {comments.map((c, i) => (
            <div key={i} className="post-comment-item">
              <span className="comment-author">{c.author_name}</span>
              <span className="comment-text">{c.content}</span>
            </div>
          ))}
          <div className="comment-input-row">
            <input
              type="text"
              className="comment-input"
              placeholder="crire un commentaire..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleComment()}
            />
            <button className="comment-send-btn" onClick={handleComment}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
