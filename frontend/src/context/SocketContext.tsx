import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "react-hot-toast";
import { useUser } from "../hooks/useUser";
import { SocketContext } from "./useSocket";
import { SOCKET_URL } from "../config";

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useUser();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [incomingCall, setIncomingCall] = useState<any | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            setIncomingCall(null);
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        // Prefer sessionStorage (multi-account) over localStorage
        const token =
            sessionStorage.getItem("access_token") ||
            localStorage.getItem("access_token");

        if (!token) return;

        // Connexion stable (Websocket privilégié pour le temps réel des appels)
        const newSocket = io(SOCKET_URL, {
            auth: { token },
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 20,
            reconnectionDelay: 3000,
        });

        newSocket.on("connect", () => {
            const userIdStr = String(currentUser.id);
            console.log("[Socket] Connected:", newSocket.id, "Joining as:", userIdStr);
            newSocket.emit("join", userIdStr);
            setIsConnected(true);
        });

        newSocket.on("reconnect", () => {
            const userIdStr = String(currentUser.id);
            console.log("[Socket] Reconnected. Re-joining as:", userIdStr);
            newSocket.emit("join", userIdStr);
        });

        // Ensure join is emitted even if connect happened before this effect fully registered
        if (newSocket.connected) {
            newSocket.emit("join", String(currentUser.id));
            setIsConnected(true);
        }

        newSocket.on("disconnect", (reason) => {
            console.log("[Socket] Disconnected:", reason);
            setIsConnected(false);
        });

        newSocket.on("new-message", (data: any) => {
            const currentPath = window.location.pathname;
            const isViewingChat =
                currentPath.includes("/conversations") ||
                currentPath.includes("/chat/");
            if (!isViewingChat) {
                toast(`💬 Nouveau message de ${data.sender_name || "un interlocuteur"}`, {
                    style: {
                        borderRadius: "10px",
                        background: "#1e293b",
                        color: "#f1f5f9",
                        border: "1px solid #334155",
                    },
                    duration: 4000,
                });
            }
        });

        newSocket.on("new-notification", (data: any) => {
            toast(`🔔 ${data.title || "Nouvelle notification"}`, {
                style: {
                    borderRadius: "10px",
                    background: "#1e293b",
                    color: "#f1f5f9",
                    border: "1px solid #334155",
                },
                duration: 5000,
            });
        });

        newSocket.on("incoming-call", (data: any) => {
            console.log("[Socket] Incoming call received:", data);
            setIncomingCall(data);

            // Notification immédiat même si le toast global de MainLayout échoue
            toast.success(`📞 Appel entrant de ${data.callerName || "un utilisateur"}`, {
                duration: 10000,
                position: "top-right",
                icon: '📞'
            });

            try {
                if (navigator.vibrate) {
                    navigator.vibrate([500, 200, 500, 200, 500]);
                }
            } catch (vibrateErr) {
                console.warn("Vibration blocked by browser policy:", vibrateErr);
            }
        });

        const heartbeat = setInterval(() => {
            if (newSocket.connected) {
                newSocket.emit("ping_alive");
            }
        }, 30000);

        newSocket.on("call-ended", () => {
            console.log("[Socket] Call ended event received");
            setIncomingCall(null);
        });

        newSocket.on("user-connected", (userIds: string[]) => {
            setOnlineUsers(userIds);
        });

        setSocket(newSocket);

        return () => {
            clearInterval(heartbeat);
            newSocket.disconnect();
            setSocket(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers, incomingCall, setIncomingCall, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
