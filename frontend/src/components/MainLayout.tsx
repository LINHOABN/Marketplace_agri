import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    Home,
    MessageSquare,
    Wallet,
    LogOut,
    Store,
    Truck,
    X,
    Package,
    Phone,
    ShieldCheck,
    Bell,
    Leaf,
    MoreHorizontal,
    PlusCircle
} from "lucide-react";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import api from "../api";
import "./MainLayout.css";

type NotificationItem = {
    id: string;
    title?: string;
    content: string;
    type?: string;
    target_id?: string;
    is_read?: boolean;
    created_at: string;
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const { currentUser, logout, getAvatarSrc, getInitials } = useUser();
    const location = useLocation();
    const navigate = useNavigate();
    const [headerHidden, setHeaderHidden] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const { incomingCall, setIncomingCall, socket, isConnected } = useSocket();

    const unreadNotifCount = notifications.filter((n) => !n.is_read).length;

    const handleAcceptIncomingCall = () => {
        if (!incomingCall) return;
        navigate("/conversations", {
            state: {
                openChatId: incomingCall.conversation_id,
                incomingCall: { ...incomingCall, accepted: true }
            }
        });
        setIncomingCall(null);
    };

    const handleRejectIncomingCall = () => {
        if (incomingCall && socket) {
            socket.emit("end-call", { to: incomingCall.from });
        }
        setIncomingCall(null);
    };

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await api.get("/notifications/");
            setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch {
            setNotifications([]);
        }
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [currentUser, fetchNotifications]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const resConv = await api.get("/chat/conversations");
                const list = Array.isArray(resConv.data) ? resConv.data : [];
                const total = list.reduce(
                    (sum: number, c: { unread_count?: number }) => sum + (c.unread_count || 0),
                    0
                );
                setUnreadMessages(total);
            } catch {
                setUnreadMessages(0);
            }
        };
        if (currentUser) fetchData();
    }, [currentUser, location.pathname]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setHeaderHidden(true);
            } else {
                setHeaderHidden(false);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    useEffect(() => {
        if (!socket) return;

        const updateUnread = (data: { total: number }) => {
            setUnreadMessages(data.total);
        };

        const handleNewMsg = () => {
            // Re-fetch count or wait for unread-count-update
            // (On préfère laisser le backend envoyer le total via unread-count-update)
        };

        socket.on("unread-count-update", updateUnread);
        socket.on("new-message", handleNewMsg);

        return () => {
            socket.off("unread-count-update", updateUnread);
            socket.off("new-message", handleNewMsg);
        };
    }, [socket]);

    const openNotifications = () => {
        setShowNotifPanel(true);
        fetchNotifications();
    };

    let menuItems = [
        { icon: <Home size={26} />, label: "Accueil", path: "/feed" },
        { icon: <PlusCircle size={26} />, label: "Stories", path: "/stories" },
        { icon: <MessageSquare size={26} />, label: "Messages", path: "/conversations" },
        { icon: <Wallet size={26} />, label: "Portefeuille", path: "/wallet" },
        { icon: <Bell size={26} />, label: "Notifications", onClick: openNotifications },
    ];

    if (currentUser?.role === "admin") {
        // Menu simplifié pour l'admin : Accueil, Admin, Messages, Notifications
        menuItems = [
            { icon: <Home size={26} />, label: "Accueil", path: "/feed" },
            { icon: <ShieldCheck size={26} />, label: "Admin", path: "/admin/dashboard" },
            { icon: <MessageSquare size={26} />, label: "Messages", path: "/conversations" },
            { icon: <Bell size={26} />, label: "Notifications", onClick: openNotifications },
        ];
    } else if (currentUser?.role === "seller") {
        menuItems.splice(1, 0, { icon: <Store size={26} />, label: "Ventes", path: "/seller/dashboard" });
    } else if (currentUser?.role === "deliverer") {
        menuItems.splice(1, 0, { icon: <Truck size={26} />, label: "Livraisons", path: "/deliverer/dashboard" });
    }

    const handleNotifClick = async (notif: NotificationItem) => {
        try {
            await api.post("/notifications/read");
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch { }
        setShowNotifPanel(false);
        if (notif.type === "order_update" || notif.type === "payment") {
            if (notif.target_id) navigate(`/order/tracking/${notif.target_id}`);
        } else if (notif.type === "message") {
            navigate("/conversations");
        }
    };

    return (
        <div className="main-layout">
            <header className={`global-header ${headerHidden ? "header-hidden" : ""}`}>
                <div className="header-left">
                    {currentUser ? (
                        <div className="header-profile-block-left" onClick={() => navigate("/profile")}>
                            <div className="header-avatar-wrapper">
                                {currentUser.avatar_url ? (
                                    <img src={getAvatarSrc(currentUser.avatar_url) || ""} alt="" className="header-avatar" />
                                ) : (
                                    <div className="header-avatar header-avatar-initials" style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'var(--primary-muted)', color: 'var(--primary)', fontWeight: 'bold'
                                    }}>
                                        {getInitials(currentUser.name)}
                                    </div>
                                )}
                                <ShieldCheck size={12} className="header-verified-icon" />
                            </div>
                            <div className="header-profile-info">
                                <span className="header-user-name">{currentUser.name}</span>
                                <span className="header-user-role">{currentUser.role}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="header-profile-block-left invite" onClick={() => navigate("/login")}>
                            <div className="header-avatar header-avatar-initials" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--primary-muted)', color: 'var(--primary)', fontWeight: 'bold'
                            }}>
                                INV
                            </div>
                            <div className="header-profile-info">
                                <span className="header-user-name">Invité</span>
                                <span className="header-user-role">S'identifier</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="header-center" onClick={() => navigate("/feed")}>
                    <Leaf size={24} className="mobile-logo-icon" />
                    <span className="global-logo-text">AgriMarché</span>
                </div>
                <div className="header-right" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
                    <div
                        title={isConnected ? "Connecté au serveur" : "Déconnecté"}
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: isConnected ? '#22c55e' : '#ef4444',
                            boxShadow: isConnected ? '0 0 8px rgba(34, 197, 94, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)',
                            transition: 'all 0.3s'
                        }}
                    />
                </div>
            </header>

            {showNotifPanel && (
                <>
                    <div className="global-notif-overlay" onClick={() => setShowNotifPanel(false)} />
                    <aside className="global-notif-panel">
                        <div className="global-notif-header">
                            <span>Notifications</span>
                            <button type="button" className="global-notif-close-btn" onClick={() => setShowNotifPanel(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="global-notif-body">
                            {notifications.length === 0 ? (
                                <p className="global-notif-empty">Aucune notification</p>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={String(n.id)}
                                        className={`global-notif-item ${!n.is_read ? "unread" : ""}`}
                                        onClick={() => handleNotifClick(n)}
                                    >
                                        <div className="global-notif-icon">
                                            <Package size={18} />
                                        </div>
                                        <div className="global-notif-text">
                                            <div className="global-notif-title">{n.title || "Notification"}</div>
                                            <div className="global-notif-content">{n.content}</div>
                                            <div className="global-notif-time">
                                                {new Date(n.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        {!n.is_read && <span className="global-notif-dot" />}
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>
                </>
            )}

            <aside className="bottom-nav permanent-collapsed-hover">
                <div className="sidebar-brand-desktop" onClick={() => navigate("/feed")}>
                    <span className="logo-short"><Leaf size={28} /></span>
                    <span className="logo-full">AgriMarché</span>
                </div>

                {currentUser && (
                    <div className="sidebar-user-profile" onClick={() => navigate("/profile")}>
                        <div className="sidebar-profile-info-top">
                            <div className="sidebar-avatar-outer">
                                <div className="sidebar-avatar-wrapper">
                                    {currentUser.avatar_url ? (
                                        <img src={getAvatarSrc(currentUser.avatar_url) || ""} alt="" className="sidebar-avatar" />
                                    ) : (
                                        <div className="sidebar-avatar-initials">
                                            {getInitials(currentUser.name)}
                                        </div>
                                    )}
                                    <div className="sidebar-verified-badge">
                                        <ShieldCheck size={10} color="white" />
                                    </div>
                                </div>
                            </div>
                            <div className="sidebar-profile-text">
                                <span className="sidebar-user-name">{currentUser.name}</span>
                                <div className="sidebar-role-indicator">
                                    <div className={`role-dot ${currentUser.role}`}></div>
                                    <span className="sidebar-user-role">{currentUser.role}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <nav className="nav-items-wrapper">
                    {/* Desktop View (Sidebar) logic remains similar but let's optimize the split for Mobile */}
                    <div className="mobile-only-nav">
                        {menuItems.slice(0, 4).map((item) => {
                            const isActive = item.path ? (location.pathname === item.path) : false;
                            return (
                                item.path ? (
                                    <Link key={item.path} to={item.path} className={`nav-item ${isActive ? "active" : ""}`}>
                                        <div className="nav-icon-wrapper">
                                            {item.icon}
                                            {item.path === "/conversations" && unreadMessages > 0 && <div className="nav-badge">{unreadMessages > 9 ? "9+" : unreadMessages}</div>}
                                        </div>
                                        <span className="nav-label">{item.label}</span>
                                    </Link>
                                ) : (
                                    <button key={item.label} onClick={item.onClick} className={`nav-item ${showNotifPanel ? "active" : ""}`}>
                                        <div className="nav-icon-wrapper">
                                            {item.icon}
                                            {item.label === "Notifications" && unreadNotifCount > 0 && <span className="nav-badge">{unreadNotifCount}</span>}
                                        </div>
                                        <span className="nav-label">{item.label}</span>
                                    </button>
                                )
                            );
                        })}

                        <button className="nav-item more-btn" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                            <MoreHorizontal size={26} />
                            <span className="nav-label">Plus</span>
                        </button>
                    </div>

                    {/* DESKTOP SIDEBAR MENU (Hidden on mobile) */}
                    <div className="desktop-only-menu">
                        {menuItems.map((item) => {
                            const isActive = item.path ? (location.pathname === item.path || location.pathname.startsWith(item.path + "/")) : false;
                            return (
                                item.path ? (
                                    <Link key={item.path} to={item.path} className={`nav-item ${isActive ? "active" : ""}`}>
                                        <div className="nav-icon-wrapper">
                                            {item.icon}
                                            {item.path === "/conversations" && unreadMessages > 0 && <div className="nav-badge">{unreadMessages}</div>}
                                            {item.label === "Notifications" && unreadNotifCount > 0 && <div className="nav-badge">{unreadNotifCount}</div>}
                                        </div>
                                        <span className="nav-label">{item.label}</span>
                                    </Link>
                                ) : (
                                    <button key={item.label} onClick={item.onClick} className="nav-item">
                                        <div className="nav-icon-wrapper">
                                            {item.icon}
                                            {item.label === "Notifications" && unreadNotifCount > 0 && <div className="nav-badge">{unreadNotifCount}</div>}
                                        </div>
                                        <span className="nav-label">{item.label}</span>
                                    </button>
                                )
                            );
                        })}

                        {currentUser ? (
                            <button className="nav-item logout-item" onClick={logout}>
                                <LogOut size={26} />
                                <span className="nav-label">Déconnexion</span>
                            </button>
                        ) : (
                            <button className="nav-item logout-item" onClick={() => navigate("/login")}>
                                <LogOut size={26} style={{ transform: 'rotate(180deg)' }} />
                                <span className="nav-label">Connexion</span>
                            </button>
                        )}
                    </div>
                </nav>

                {/* POPUP MENU FOR MOBILE "MORE" */}
                {showMoreMenu && (
                    <div className="mobile-more-menu-overlay" onClick={() => setShowMoreMenu(false)}>
                        <div className="mobile-more-menu" onClick={(e) => e.stopPropagation()}>
                            <div className="more-menu-header">Menu</div>
                            <div className="more-menu-grid">
                                <button className="more-menu-item" onClick={() => { navigate("/wallet"); setShowMoreMenu(false); }}>
                                    <Wallet size={20} />
                                    <span>Portefeuille</span>
                                </button>
                                <button className="more-menu-item" onClick={() => { openNotifications(); setShowMoreMenu(false); }}>
                                    <div className="icon-badge-wrapper">
                                        <Bell size={20} />
                                        {unreadNotifCount > 0 && <span className="badge-dot" />}
                                    </div>
                                    <span>Notifications</span>
                                </button>
                                <button className="more-menu-item logout" onClick={() => { logout(); setShowMoreMenu(false); }}>
                                    <LogOut size={20} />
                                    <span>Déconnexion</span>
                                </button>
                                <button className="more-menu-close" onClick={() => setShowMoreMenu(false)}>Fermer</button>
                            </div>
                        </div>
                    </div>
                )}

            </aside>

            <main className="content-area">
                {children}
            </main>

            {incomingCall && !incomingCall.accepted && !location.pathname.startsWith('/conversations') && (
                <div className="incoming-call-toast global-call">
                    <div className="caller-info">
                        <div className="caller-avatar">
                            <Phone size={24} className="animate-pulse" />
                        </div>
                        <div className="caller-text">
                            <p className="call-label">{incomingCall.type === "video" ? "Appel Vidéo Entrant" : "Appel Audio Entrant"}</p>
                            <p className="caller-name">{incomingCall.callerName || "Un interlocuteur"}</p>
                        </div>
                    </div>
                    <div className="call-actions">
                        <button className="btn-accept" onClick={handleAcceptIncomingCall} title="Accepter">
                            <Phone size={24} />
                        </button>
                        <button className="btn-reject" onClick={handleRejectIncomingCall} title="Refuser">
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
