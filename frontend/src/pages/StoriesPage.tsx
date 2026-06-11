import { useState, useEffect, useRef } from "react";
import api from "../api";
import { PlusCircle, Trash2, ChevronLeft, ChevronRight, Send, Edit3, CheckCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import { useUser } from "../hooks/useUser";
import ConfirmModal from "../components/ConfirmModal";
import "./StoriesPage.css";

export default function StoriesPage() {
    const { currentUser, getAvatarSrc } = useUser();
    const [products, setProducts] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingStory, setUploadingStory] = useState(false);
    const [selectedStoryUser, setSelectedStoryUser] = useState<any>(null);
    const [activeStoryIndex, setActiveStoryIndex] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState("");

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: "danger" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { },
        type: "warning"
    });

    const isVideo = (url: string) => {
        if (!url) return false;
        const extension = url.split("?")[0].split(".").pop()?.toLowerCase();
        return ["mp4", "webm", "ogg", "mov", "avi", "quicktime"].includes(extension || "");
    };

    const fetchStories = async () => {
        try {
            const response = await api.get("/feed");
            setProducts(response.data.items || []);
        } catch (error) {
            console.log("Erreur chargement stories");
        }
    };

    useEffect(() => {
        fetchStories();
    }, []);

    const handleStoryUpload = async (mediaFile?: File) => {
        if (!mediaFile && !statusText.trim()) return;
        setUploadingStory(true);
        const formData = new FormData();
        if (mediaFile) formData.append("media", mediaFile);
        formData.append("content", statusText.trim() || (mediaFile ? "Ma nouvelle story" : ""));

        try {
            await api.post("/posts/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success(mediaFile ? "Story publiée !" : "Statut publié !");
            setStatusText("");
            fetchStories();
        } catch (err) {
            toast.error("Erreur lors de la publication");
        } finally {
            setUploadingStory(false);
        }
    };

    const handleDeleteStory = async () => {
        const storyId = selectedStoryUser.stories[activeStoryIndex].id;
        setConfirmConfig({
            isOpen: true,
            title: "Supprimer la story",
            message: "Voulez-vous vraiment supprimer cette story ?",
            type: "danger",
            onConfirm: async () => {
                try {
                    await api.delete(`/posts/${storyId}`);
                    toast.success("Story supprimée");
                    setSelectedStoryUser(null);
                    fetchStories();
                } catch (err) {
                    toast.error("Erreur lors de la suppression");
                }
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleSaveEdit = async () => {
        const story = selectedStoryUser.stories[activeStoryIndex];
        try {
            const formData = new FormData();
            formData.append("content", editContent);
            await api.put(`/posts/${story.id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("Story mise à jour");
            setIsEditing(false);
            fetchStories();
            // Mettre à jour l'état local immédiatement
            const updatedStories = [...selectedStoryUser.stories];
            updatedStories[activeStoryIndex] = { ...story, content: editContent };
            setSelectedStoryUser({ ...selectedStoryUser, stories: updatedStories });
        } catch (err) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const storiesByUser = products
        .filter((item) => item.item_type === "post" && item.type === "story")
        .reduce((acc: any, story) => {
            const uid = story.user_id;
            if (!acc[uid]) {
                acc[uid] = {
                    user_id: uid,
                    author_name: story.author_name || "Utilisateur",
                    author_avatar: story.author_avatar,
                    stories: [],
                };
            }
            acc[uid].stories.push(story);
            return acc;
        }, {});

    const groupedStories: any[] = Object.values(storiesByUser);
    const myStoryGroup = currentUser ? groupedStories.find((g: any) => String(g.user_id) === String(currentUser.id)) : null;
    const otherStories = currentUser ? groupedStories.filter((g: any) => String(g.user_id) !== String(currentUser.id)) : groupedStories;

    return (
        <div className="feed-page-wrapper stories-page-container dashboard-wrapper">
            <ConfirmModal {...confirmConfig} onCancel={() => setConfirmConfig(p => ({ ...p, isOpen: false }))} />

            {/* Zone de création de statut moderne */}
            <section className="status-creator-wrapper">
                <div className="status-creator-card">
                    <div className="status-input-row">
                        <div className="status-avatar-circle">
                            <img src={getAvatarSrc(currentUser?.avatar_url)} alt="Profile" />
                        </div>
                        <textarea
                            className="status-textarea"
                            placeholder={`Quoi de neuf, ${currentUser?.name || 'ami'} ?`}
                            value={statusText}
                            onChange={(e) => setStatusText(e.target.value)}
                        />
                    </div>
                    <div className="status-footer-row">
                        <button
                            className="status-action-btn media-btn"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <PlusCircle size={20} />
                            <span>Photo / Vidéo</span>
                        </button>
                        <button
                            className="status-publish-btn"
                            disabled={uploadingStory || !statusText.trim()}
                            onClick={() => handleStoryUpload()}
                        >
                            {uploadingStory ? "Chargement..." : "Publier"}
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </section>

            <section className="stories-grid-layout">
                <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,video/*" onChange={(e) => handleStoryUpload(e.target.files?.[0])} />

                {/* Card "Ma Story" */}
                <div className="story-item-card add-story-card" onClick={() => myStoryGroup ? (setSelectedStoryUser(myStoryGroup), setActiveStoryIndex(0)) : fileInputRef.current?.click()}>
                    <div className="story-bg-layer">
                        {currentUser?.avatar_url ? (
                            <img src={getAvatarSrc(currentUser.avatar_url)} alt="Me" />
                        ) : (
                            <div className="story-placeholder-gradient" />
                        )}
                    </div>
                    <div className="story-overlay-layer" />
                    <div className="story-content-layer">
                        <div className="story-add-icon">
                            <PlusCircle size={26} color="#fff" />
                        </div>
                        <span className="story-username-label">Ma Story</span>
                    </div>
                </div>

                {/* Liste des stories des autres */}
                {otherStories.map((group: any) => (
                    <div key={group.user_id} className="story-item-card" onClick={() => { setSelectedStoryUser(group); setActiveStoryIndex(0); }}>
                        <div className="story-bg-layer">
                            {group.stories[0].media_url ? (
                                isVideo(group.stories[0].media_url) ? (
                                    <video src={getAvatarSrc(group.stories[0].media_url)} />
                                ) : (
                                    <img src={getAvatarSrc(group.stories[0].media_url)} alt="Preview" />
                                )
                            ) : (
                                <div className="story-text-preview-bg">
                                    {group.stories[0].content}
                                </div>
                            )}
                        </div>
                        <div className="story-overlay-layer" />
                        <div className="story-content-layer">
                            <div className="story-user-avatar">
                                <img src={getAvatarSrc(group.author_avatar)} alt={group.author_name} />
                            </div>
                            <span className="story-username-label">{group.author_name}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* Viewer de Story */}
            {selectedStoryUser && (
                <div className="story-viewer-modal-root" onClick={() => setSelectedStoryUser(null)}>
                    <div className="story-viewer-container" onClick={(e) => e.stopPropagation()}>
                        <div className="story-viewer-top-bar">
                            <div className="story-author-info">
                                <img src={getAvatarSrc(selectedStoryUser.author_avatar)} alt="Avatar" />
                                <span>{selectedStoryUser.author_name}</span>
                            </div>
                            <div className="story-top-actions">
                                {currentUser && String(selectedStoryUser.user_id) === String(currentUser.id) && (
                                    <>
                                        {!isEditing ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditing(true);
                                                    setEditContent(selectedStoryUser.stories[activeStoryIndex].content || "");
                                                }}
                                                className="story-edit-btn"
                                            >
                                                <Edit3 size={20} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                                                className="story-save-btn"
                                            >
                                                <CheckCircle size={20} />
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStory(); }} className="story-delete-btn">
                                            <Trash2 size={20} />
                                        </button>
                                    </>
                                )}
                                <button className="story-close-x" onClick={() => { setSelectedStoryUser(null); setIsEditing(false); }}>×</button>
                            </div>
                        </div>
                        <div className="story-viewer-main-content">
                            {activeStoryIndex > 0 && (
                                <button className="story-nav-arrow story-prev" onClick={() => setActiveStoryIndex(v => v - 1)}>
                                    <ChevronLeft size={42} />
                                </button>
                            )}

                            <div className="story-active-display">
                                {selectedStoryUser.stories[activeStoryIndex].media_url ? (
                                    isVideo(selectedStoryUser.stories[activeStoryIndex].media_url) ? (
                                        <video src={getAvatarSrc(selectedStoryUser.stories[activeStoryIndex].media_url)} autoPlay controls muted loop className="story-full-media" />
                                    ) : (
                                        <img src={getAvatarSrc(selectedStoryUser.stories[activeStoryIndex].media_url)} alt="Full Story" className="story-full-media" />
                                    )
                                ) : (
                                    <div className="story-full-text-mode">
                                        {selectedStoryUser.stories[activeStoryIndex].content}
                                    </div>
                                )}
                                {isEditing ? (
                                    <div className="story-edit-input-container" onClick={(e) => e.stopPropagation()} style={{
                                        position: 'absolute',
                                        bottom: '80px',
                                        left: '20px',
                                        right: '20px',
                                        background: 'rgba(255,255,255,0.9)',
                                        padding: '10px',
                                        borderRadius: '12px',
                                        zIndex: 10
                                    }}>
                                        <input
                                            type="text"
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            autoFocus
                                            className="story-edit-input"
                                            style={{
                                                width: '100%',
                                                border: 'none',
                                                background: 'transparent',
                                                padding: '8px',
                                                fontSize: '16px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                ) : (
                                    selectedStoryUser.stories[activeStoryIndex].content && (
                                        <div className="story-media-caption">
                                            {selectedStoryUser.stories[activeStoryIndex].content}
                                        </div>
                                    )
                                )}
                            </div>

                            {activeStoryIndex < selectedStoryUser.stories.length - 1 && (
                                <button className="story-nav-arrow story-next" onClick={() => setActiveStoryIndex(v => v + 1)}>
                                    <ChevronRight size={42} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
