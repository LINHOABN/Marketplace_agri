import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ConversationsPage from "./ConversationsPage";
import ChatPage from "./ChatPage";
import { Leaf, ShieldCheck, Sparkles } from "lucide-react";
import "./MessengerPage.css";
import { useSocket } from "../hooks/useSocket";
import { usePersistentState } from "../hooks/usePersistentState";

export default function MessengerPage() {
  const location = useLocation();
  const { socket, incomingCall: contextIncomingCall } = useSocket();
  const [selectedChatId, setSelectedChatId] = usePersistentState<string | null>(
    "messenger_selected_chat_id",
    (location.state as any)?.openChatId || null
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // L'appel peut venir soit du state de navigation (si on vient de cliquer sur le toast global)
  // soit directement du socket si on est déjà sur la page.
  const [incomingCall, setLocalIncomingCall] = useState<any | null>(
    (location.state as any)?.incomingCall || contextIncomingCall || null
  );

  // Synchronise l'appel entrant si le contexte change
  useEffect(() => {
    if (contextIncomingCall) {
      setLocalIncomingCall(contextIncomingCall);
    }
  }, [contextIncomingCall]);

  // Synchronise le chat sélectionné avec le state de navigation
  useEffect(() => {
    const state = location.state as any;
    if (state?.openChatId) {
      setSelectedChatId(state.openChatId);
    }
    if (state?.incomingCall) {
      setLocalIncomingCall(state.incomingCall);
    }
  }, [location.state]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  return (
    <div className="messenger-container dashboard-wrapper" style={{ padding: 0 }}>
      {/* Sidebar : Liste des conversations */}
      <aside
        className={`messenger-sidebar ${isMobile && selectedChatId ? "hidden" : ""}`}
      >
        <ConversationsPage
          isSplitView={true}
          onSelectChat={(id) => setSelectedChatId(id)}
          selectedId={selectedChatId}
          externalSocket={socket}
        />
      </aside>

      {/* Main : Fenêtre de discussion */}
      <main className={`messenger-main ${isMobile && !selectedChatId ? "hidden" : ""}`}>
        {selectedChatId ? (
          <ChatPage
            isSplitView={true}
            conversationId={selectedChatId}
            onBack={() => setSelectedChatId(null)}
            externalSocket={socket}
            externalIncomingCall={incomingCall}
            onClearIncomingCall={() => {
              // Clear current state to avoid recursion if needed
              if (location.state) (location.state as any).incomingCall = null;
            }}
          />
        ) : (
          <div className="no-chat-selected">
            <div
              style={{
                background: "rgba(46, 125, 50, 0.05)",
                width: "200px",
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                marginBottom: "2rem",
                position: 'relative'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px dashed var(--primary-light)',
                  animation: 'rotate 20s linear infinite'
                }}
              />
              <Leaf size={100} color="var(--primary)" style={{ opacity: 0.2 }} />
              <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'white', padding: '8px', borderRadius: '50%', boxShadow: 'var(--shadow-sm)' }}>
                <Sparkles size={18} color="#F59E0B" />
              </div>
            </div>

            <h2 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1rem", letterSpacing: '-0.04em' }}>
              agrimarche <span style={{ color: 'var(--primary)' }}>Chat</span>
            </h2>
            <p style={{ maxWidth: '400px', fontSize: "1.1rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Discutez directement avec les producteurs, ngociez les prix et organisez vos livraisons en toute scurit.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                <ShieldCheck size={18} /> Crypt de bout en bout
              </div>
              <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                <ShieldCheck size={18} /> AgriPay Protg
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
