import React, { useEffect, useState } from "react";
import { Bot, Send, X, Loader2 } from "lucide-react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import "./AIAssistant.css";

type QuickAction = {
  label: string;
  type: "route" | "hint";
  value: string;
};

export default function AIAssistant() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "bot"; text: string; actions?: QuickAction[] }[]
  >([
    {
      role: "bot",
      text: "Bonjour ! Je suis AgriBot. Comment puis-je vous aider ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const res = await api.get("/ai/suggestions");
        setSuggestions(Array.isArray(res.data?.suggestions) ? res.data.suggestions : []);
      } catch {
        setSuggestions([]);
      }
    };
    loadSuggestions();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.text?.trim())
        .slice(-8)
        .map((m) => ({
          role: m.role === "bot" ? "assistant" : "user",
          content: m.text,
        }));
      const res = await api.post("/ai/chat", { message: userMsg, history });
      const actions = Array.isArray(res.data?.quick_actions) ? res.data.quick_actions : [];
      const nextSuggestions = Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
      if (nextSuggestions.length > 0) {
        setDynamicSuggestions(nextSuggestions);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: res.data.response || res.data.reply || "Je n'ai pas compris, pouvez-vous reformuler ?",
          actions,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Erreur de connexion." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="agribot-fab" onClick={() => setIsOpen(true)}>
        <Bot size={28} />
      </button>
      {isOpen && (
        <div className="agribot-window">
          <header className="agribot-header">
            <h4>AgriBot</h4>
            <button onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </header>
          <main className="agribot-messages">
            {messages.length <= 1 && (dynamicSuggestions.length > 0 || suggestions.length > 0) && (
              <div className="agribot-suggestions">
                {(dynamicSuggestions.length > 0 ? dynamicSuggestions : suggestions).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="agribot-suggestion"
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <React.Fragment key={i}>
                <div className={`msg-bubble ${m.role}`}>
                  {m.text}
                </div>
                {m.role === "bot" && m.actions && m.actions.length > 0 && (
                  <div className="agribot-actions">
                    {m.actions.map((a, idx) => (
                      <button
                        key={`${a.label}-${idx}`}
                        type="button"
                        className="agribot-action-btn"
                        onClick={() => {
                          if (a.type === "route") {
                            setIsOpen(false);
                            navigate(a.value);
                          } else {
                            setInput(a.value);
                          }
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
            {loading && (
              <div className="msg-bubble bot loading">
                <Loader2 className="spin" size={16} />
              </div>
            )}
          </main>
          <footer className="agribot-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={handleSend}>
              <Send size={18} />
            </button>
          </footer>
        </div>
      )}
    </>
  );
}
