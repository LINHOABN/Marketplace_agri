import { useState, useEffect, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Search, MessageSquare, Archive, Loader2, Trash2 } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { resolveMediaUrl } from "../utils/avatar";
import "./ConversationsPage.css";

export default function ConversationsPage({
  isSplitView,
  onSelectChat,
  selectedId,
  externalSocket,
}: any) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "archived">("all");
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("archived_conversations");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("archived_conversations", JSON.stringify(archivedIds));
  }, [archivedIds]);

  const loadConversations = async () => {
    try {
      const res = await api.get("/chat/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("Fetch Error:", err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const activeSocket = externalSocket;
    if (!activeSocket) return;

    const messageHandler = () => {
      loadConversations();
    };

    activeSocket.on("new-message", messageHandler);

    return () => {
      activeSocket.off("new-message", messageHandler);
    };
  }, [externalSocket]);

  const handleArchive = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (archivedIds.includes(id)) {
      setArchivedIds((prev) => prev.filter((i) => i !== id));
    } else {
      setArchivedIds((prev) => [...prev, id]);
    }
  };

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Voulez-vous vraiment supprimer cette conversation ? Cette action est irréversible.")) {
      try {
        await api.delete(`/chat/conversations/${id}`);
        // Mettre à jour la liste locale des conversations
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (selectedId === id && onSelectChat) {
          onSelectChat(null);
        }
      } catch (err) {
        console.error("Delete Error:", err);
        alert("Erreur lors de la suppression de la conversation.");
      }
    }
  };

  const filtered = conversations.filter((c) => {
    const matchesSearch = c.interlocutor_name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const isArchived = archivedIds.includes(c.id);
    return activeTab === "archived"
      ? matchesSearch && isArchived
      : matchesSearch && !isArchived;
  });

  return (
    <div className="conversations-wrapper">
      <div className="conv-header-universal">
        {!isSplitView && <h1 className="conv-title">Messages</h1>}
        <div className="search-conv-container" style={isSplitView ? { margin: '15px' } : {}}>
          <Search
            size={isSplitView ? 18 : 20}
            style={{ position: "absolute", left: isSplitView ? 26 : 14, top: isSplitView ? 25 : 12, color: "#999" }}
          />
          <input
            type="text"
            className="search-conv-input"
            style={isSplitView ? { padding: "10px 10px 10px 38px", margin: '10px' } : {}}
            placeholder={isSplitView ? "Rechercher..." : "Rechercher une personne..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="conv-tabs">
          <button
            className={`tab-item ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            Discussions
          </button>
          <button
            className={`tab-item ${activeTab === "archived" ? "active" : ""}`}
            onClick={() => setActiveTab("archived")}
          >
            Archives
          </button>
        </div>
      </div>

      <main className="conv-list">
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <Loader2 className="spinner" color="#2E7D32" size={32} />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((conv) => (
            <div
              key={conv.id}
              className={`conv-item ${selectedId === conv.id ? "active" : ""}`}
              onClick={() =>
                isSplitView
                  ? onSelectChat(conv.id)
                  : navigate(`/chat/${conv.id}`)
              }
            >
              <div className="conv-avatar-wrapper">
                <UserAvatar
                  name={conv.interlocutor_name}
                  avatarUrl={conv.interlocutor_avatar}
                  productImageUrl={conv.product_image}
                  size="md"
                  role={conv.interlocutor_role}
                />
              </div>

              <div className="conv-content">
                <div className="conv-top">
                  <span className="conv-name">{conv.interlocutor_name}</span>
                  <span className="conv-date">
                    {new Date(conv.timestamp || conv.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Référence produit style WhatsApp statut */}
                {conv.product_name && (
                  <div className="conv-product-ref">
                    {conv.product_image && resolveMediaUrl(conv.product_image) && (
                      <img
                        src={resolveMediaUrl(conv.product_image)!}
                        alt={conv.product_name}
                        className="conv-product-thumb"
                      />
                    )}
                    <div className="conv-product-ref-text">
                      <span className="conv-product-label"> Produit</span>
                      <span className="conv-product-ref-name">{conv.product_name}</span>
                    </div>
                  </div>
                )}

                <div className="conv-preview-row">
                  <p className="conv-last-message">
                    {conv.last_message || "Nouvelle conversation"}
                  </p>
                  {conv.unread_count > 0 && (
                    <span className="unread-badge">{conv.unread_count}</span>
                  )}
                </div>
              </div>

              <div className="action-btns">
                <button
                  className="btn-archive"
                  onClick={(e) => handleArchive(e, conv.id)}
                  title={activeTab === "archived" ? "Désarchiver" : "Archiver"}
                >
                  <Archive size={18} />
                </button>
                <button
                  className="btn-delete"
                  onClick={(e) => handleDelete(e, conv.id)}
                  title="Supprimer la conversation"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div
            style={{ textAlign: "center", padding: "80px 20px", color: "#BBB" }}
          >
            <MessageSquare size={56} strokeWidth={1} />
            <p style={{ marginTop: "16px", fontSize: "15px", color: "#999" }}>
              Aucune conversation trouvée
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
