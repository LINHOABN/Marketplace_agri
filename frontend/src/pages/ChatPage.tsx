import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import RecordRTC from "recordrtc";
import {
  Send,
  Mic,
  Camera,
  Phone,
  Video,
  Paperclip,
  MoreVertical,
  X,
  ShoppingBag,
  ChevronLeft,
  Trash2,
  CheckCircle,
  Handshake,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";
import UserAvatar from "../components/UserAvatar";
import { resolveMediaUrl } from "../utils/avatar";
import "./ChatPage.css";
import { useSocket } from "../context/SocketContext";

import { API_URL } from "../config";

export default function ChatPage({
  isSplitView,
  conversationId,
  onBack,
  externalSocket,
  externalIncomingCall,
  onClearIncomingCall,
}: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);
  const isInitiatorRef = useRef(false);

  // Negotiation state
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [interlocutor, setInterlocutor] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callConnected, setCallConnected] = useState(false);
  const [connState, setConnState] = useState<string>("new");
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: "image" | "video" | null }>({ url: "", type: null });

  // Confirm Modal state
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

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Utiliser le socket du contexte global en priorité (plus fiable)
  // L'externalSocket est gardé comme fallback pour la compatibilité
  const { socket: contextSocket } = useSocket();
  const socket = contextSocket || externalSocket;

  // 1. Charger l'historique des messages et les détails de la conversation (Indépendant du Socket)
  useEffect(() => {
    if (!conversationId) return;

    const fetchChat = async () => {
      // Réinitialiser les données pour éviter l'affichage de l'ancienne conversation
      setMessages([]);
      setInterlocutor(null);

      try {
        const res = await api.get(`/chat/${conversationId}/messages`);
        setMessages(res.data.messages || []);
        console.log("Chat data received:", res.data.conversation);
        setInterlocutor(res.data.conversation);
        setCurrentUserId(res.data.currentUserId);

        // Marquer comme lu au chargement
        await api.post(`/chat/${conversationId}/read`).catch(() => { });
      } catch (err) {
        console.error("Chat error fetching", conversationId, err);
      }
    };
    fetchChat();
  }, [conversationId]);

  // Demander permission notifications
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 2. Configurer les couteurs de Socket temps rel (Quand le Socket est disponible)
  useEffect(() => {
    if (!conversationId || !socket) return;

    const answerHandler = async (data: any) => {
      console.log("[Call] AnswerHandler reçu du serveur:", data);
      if (peerConnection.current) {
        if (peerConnection.current.signalingState === "stable") {
          console.warn("[Call] PC est déjà STABLE, réponse ignorée.");
          return;
        }
        try {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(data.answer),
          );
          console.log("[Call] Remote description SET (Answer) - Etat PC passé à STABLE");

          while (iceQueue.current.length > 0) {
            const candidate = iceQueue.current.shift();
            if (candidate) {
              await peerConnection.current
                .addIceCandidate(new RTCIceCandidate(candidate))
                .catch((e) =>
                  console.error("Error adding queued candidate", e),
                );
            }
          }
        } catch (err) {
          console.error("Error in answerHandler during setRemoteDescription", err);
          setCallError("Échec de la poignée de main WebRTC (SDP mismatch)");
        }
      } else {
        console.warn("[Call] peerConnection.current est NULL lors du answerHandler!");
      }
    };

    const iceHandler = async (data: any) => {
      if (
        peerConnection.current &&
        peerConnection.current.remoteDescription &&
        peerConnection.current.remoteDescription.type
      ) {
        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(data.candidate),
          );
        } catch (err) {
          console.error("Error adding ice candidate", err);
        }
      } else {
        iceQueue.current.push(data.candidate);
      }
    };

    const endHandler = () => endCall();

    const messageHandler = (msg: any) => {
      if (msg.conversation_id === conversationId) {
        setMessages((prev) => {
          if (prev.some(m => String(m.id) === String(msg.id))) return prev;
          return [...prev, msg];
        });
        // Marquer comme lu si on est déjà sur la conversation
        api.post(`/chat/${conversationId}/read`).catch(() => { });
      } else {
        // Notification navigateur si onglet inactif ou sur une autre page
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Nouveau message AgriMarché", {
            body: msg.content,
            icon: "/leaf-logo.png" // Chemin imaginaire mais propre
          });
        }
      }
    };
    socket.on("new-message", messageHandler);
    socket.on("call-answered", answerHandler);
    socket.on("ice-candidate", iceHandler);
    socket.on("call-ended", endHandler);

    const offerUpdatedHandler = (data: any) => {
      if (data.conversation_id === conversationId) {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(data.message_id)
            ? { ...m, offer_status: data.status }
            : m
        ));
        toast.success(`Offre ${data.status === 'accepted' ? 'acceptée' : 'refusée'}`);
      }
    };
    socket.on("offer-updated", offerUpdatedHandler);

    // Handle beforeunload to end call if user refreshes or closes tab
    const handleBeforeUnload = () => {
      endCall();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      endCall(); // Clean up call on unmount
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socket.off("call-answered", answerHandler);
      socket.off("ice-candidate", iceHandler);
      socket.off("call-ended", endHandler);
      socket.off("new-message", messageHandler);
      socket.off("offer-updated", offerUpdatedHandler);
    };
  }, [conversationId, socket]);


  // Handle external incoming call - DEFERRED until socket and interlocutor are ready
  useEffect(() => {
    if (externalIncomingCall && socket?.connected && interlocutor) {
      setIncomingCall(externalIncomingCall);
      if (externalIncomingCall.accepted) {
        // Small delay to ensure WebRTC state is ready after navigation
        const timer = setTimeout(() => {
          answerCall(externalIncomingCall);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        setIsCalling(true);
        setCallType(externalIncomingCall.type);
      }
    }
  }, [externalIncomingCall, socket?.connected, interlocutor]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Robust stream attachment for Remote Video
  useEffect(() => {
    const attachStream = async () => {
      if (remoteStream && remoteVideoRef.current && isCalling) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          console.log("[Call] Attacher remoteStream au video element");
          remoteVideoRef.current.srcObject = remoteStream;
          try {
            await remoteVideoRef.current.play();
            console.log("[Call] Lecture remoteVideo reussie");
          } catch (e) {
            console.warn("[Call] Echec lecture auto remoteVideo:", e);
          }
        }
      }
    };
    attachStream();
  }, [remoteStream, isCalling]);

  // Robust stream attachment for Local Video
  useEffect(() => {
    if (localStream && localVideoRef.current && isCalling) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, isCalling]);

  // Robust stream attachment for Remote Audio
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current && isCalling) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.warn("[Call] Echec lecture remoteAudio:", e));
      }
    }
  }, [remoteStream, isCalling]);

  const handleSendText = async () => {
    if (!text.trim()) return;
    try {
      const res = await api.post("/chat/messages", {
        conversation_id: conversationId,
        content: text,
        type: "text",
      });
      setMessages(prev => [...prev, res.data]);
      setText("");
    } catch (err) {
      toast.error("Échec de l'envoi");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : null;
    if (!type) {
      toast.error("Format non supporté (images et vidéos uniquement)");
      return;
    }

    setPreviewMedia({ url: URL.createObjectURL(file), type });
  };

  const handleSendMedia = async () => {
    if (!previewMedia.url || !mediaInputRef.current?.files?.[0]) return;
    const file = mediaInputRef.current.files[0];

    setIsUploading(true);
    const loadingId = toast.loading("Envoi du média...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await api.post("/chat/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const res = await api.post("/chat/messages", {
        conversation_id: conversationId,
        content: previewMedia.type === "image" ? "Photo" : "Vidéo",
        type: previewMedia.type,
        media_url: uploadRes.data.url,
      });

      setMessages(prev => [...prev, res.data]);
      setPreviewMedia({ url: "", type: null });
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      toast.success("Média envoyé !", { id: loadingId });
    } catch (err) {
      toast.error("Erreur lors de l'envoi du média", { id: loadingId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendOffer = async () => {
    if (!offerPrice || isNaN(Number(offerPrice))) {
      toast.error("Veuillez entrer un prix valide.");
      return;
    }
    const qty = Number(offerQuantity) || 1;
    try {
      const res = await api.post("/chat/messages", {
        conversation_id: conversationId,
        content: `Je propose ${offerPrice} FCFA x ${qty} pour ce produit.`,
        type: "offer",
        offer_price: Number(offerPrice),
        offer_quantity: qty
      });
      setMessages(prev => [...prev, res.data]);
      setIsOfferModalOpen(false);
      setOfferPrice("");
      setOfferQuantity("1");
      toast.success("Proposition envoyée !");
    } catch (err) {
      toast.error("Échec de l'envoi de l'offre");
    }
  };

  const handleOfferAction = async (messageId: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/chat/offer-action/${messageId}?action=${action}`);
      setMessages(messages.map(m => String(m.id) === String(messageId) ? { ...m, offer_status: action === 'accept' ? 'accepted' : 'rejected' } : m));
      toast.success(action === 'accept' ? "Offre acceptée !" : "Offre refusée");
    } catch (err) {
      toast.error("Erreur lors de la réponse");
    }
  };

  const handlePayOffer = (msg: any) => {
    if (!interlocutor || !interlocutor.product_id) {
      toast.error("Données du produit manquantes");
      return;
    }

    // On essaie de récupérer le prix par tous les noms possibles (snake_case ou camelCase)
    const negotiatedPrice = msg.offer_price ?? msg.offerPrice;
    const negotiatedQty = msg.offer_quantity ?? msg.offerQuantity;

    // On prépare l'objet produit attendu par OrderCreationPage
    const productToPay = {
      id: interlocutor.product_id,
      name: interlocutor.product_name,
      originalPrice: Number(interlocutor.product_price),
      price: (negotiatedPrice !== undefined && negotiatedPrice !== null) ? Number(negotiatedPrice) : Number(interlocutor.product_price),
      image: interlocutor.product_image,
      unit: interlocutor.product_unit,
      stock: 999,
      isNegotiated: true
    };

    const finalQty = (negotiatedQty !== undefined && negotiatedQty !== null) ? Number(negotiatedQty) : 1;

    navigate(`/order/create/${interlocutor.product_id}`, {
      state: {
        product: productToPay,
        negotiatedQuantity: finalQty
      }
    });
  };

  // Open negotiation modal if redirected from ProductDetail
  useEffect(() => {
    if (location.state?.startNegotiation) {
      setIsOfferModalOpen(true);
      // Nettoyer l'état pour ne pas rouvrir au prochain rendu
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newRecorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/webm",
      });
      newRecorder.startRecording();
      setRecorder(newRecorder);
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone non accessible");
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const stopRecording = () => {
    if (!recorder) return;
    recorder.stopRecording(async () => {
      const blob = recorder.getBlob();
      setIsRecording(false);
      try {
        const formData = new FormData();
        formData.append("file", blob, "audio_message.webm");
        const uploadRes = await api.post("/chat/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        const res = await api.post("/chat/messages", {
          conversation_id: conversationId,
          content: "Audio message",
          type: "audio",
          audio_url: uploadRes.data.url,
        });
        setMessages([...messages, res.data]);
      } catch (err) {
        console.error("Audio error");
      }
      setRecorder(null);
    });
  };

  const startCall = async (type: "audio" | "video") => {
    console.log("[Call] startCall déclenché, socket:", socket?.id, "connecté:", socket?.connected);
    if (!socket || !socket.connected) {
      toast.error("Connexion au serveur perdue. Veuillez actualiser la page.");
      console.error("[Call] Échec: socket null ou déconnecté");
      return;
    }
    isInitiatorRef.current = true;
    setCallType(type);
    setIsCalling(true);
    setCallError(null);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === "video",
      });
      setLocalStream(stream);
    } catch (err: any) {
      console.warn("Media devices not accessible, proceeding without local media:", err);
      setCallError("Caméra/Microphone non accessibles ou bloqués (insecure HTTP ou périphérique manquant)");
    }

    try {
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:stun.ekiga.net" },
        ],
      });

      peerConnection.current.onconnectionstatechange = () => {
        setConnState(peerConnection.current?.connectionState || "unknown");
      };

      if (stream) {
        stream.getTracks().forEach((track) => peerConnection.current?.addTrack(track, stream!));
      }

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate)
          socket.emit("ice-candidate", {
            to: interlocutor.interlocutor_id,
            candidate: event.candidate,
          });
      };
      peerConnection.current.ontrack = (event) => {
        console.log("[Call] ontrack event received:", event.streams[0] ? "Stream present" : "No stream, using track");

        // On récupère ou crée un flux
        const stream = event.streams[0] || new MediaStream();
        if (!event.streams[0] && !stream.getTracks().find(t => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }

        // On force la création d'un NOUVEAU MediaStream pour forcer React à détecter le changement
        // et ré-attacher srcObject si nécessaire.
        const freshStream = new MediaStream(stream.getTracks());
        setRemoteStream(freshStream);
        setCallConnected(true);

        // Tentative de lecture automatique forcée si possible
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = freshStream;
          remoteVideoRef.current.play().catch(e => console.warn("Auto-play video blocked:", e));
        }
      };

      const getUserName = () => {
        try {
          const u = localStorage.getItem("user") || sessionStorage.getItem("user");
          return u ? JSON.parse(u).name : "Un utilisateur";
        } catch (e) {
          return "Un utilisateur";
        }
      };

      toast.loading("Initialisation de l'appel...", { id: "call-init" });
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === "video"
      });
      await peerConnection.current.setLocalDescription(offer);

      const callPayload = {
        to: interlocutor.interlocutor_id,
        from_id: currentUserId,
        offer,
        type,
        conversation_id: conversationId,
        callerName: getUserName(),
      };

      console.log("[Call] Émission call-user:", callPayload);
      toast.success("Signal d'appel envoyé au serveur !", { id: "call-init" });
      socket.emit("call-user", callPayload);
    } catch (err: any) {
      console.error("Call initialization failed completely", err);
      toast.error("Erreur technique : " + (err.message || "Échec de l'appel"), { id: "call-init" });
      setCallError("Échec complet du démarrage de l'appel");
    }
  };

  const answerCall = async (callData: any = incomingCall) => {
    if (!callData || !socket) return;
    isInitiatorRef.current = false;
    setIsCalling(true);
    setCallType(callData.type);
    setCallError(null);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callData.type === "video",
      });
      setLocalStream(stream);
    } catch (err: any) {
      console.warn("Answer media acquisition failed, proceeding without local media:", err);
      setCallError("Votre caméra/micro est inaccessible. L'autre personne ne vous entendra/verra pas.");
    }

    try {
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          { urls: "stun:stun.ekiga.net" },
        ],
      });

      peerConnection.current.onconnectionstatechange = () => {
        setConnState(peerConnection.current?.connectionState || "unknown");
      };

      if (stream) {
        stream.getTracks().forEach((track) => peerConnection.current?.addTrack(track, stream!));
      }

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          const target = callData.from_id || callData.from; // On préfère l'ID utilisateur
          socket.emit("ice-candidate", {
            to: target,
            candidate: event.candidate,
          });
        }
      };
      peerConnection.current.ontrack = (event) => {
        console.log("[Call] ontrack event received (answer):", event.streams[0] ? "Stream present" : "No stream, using track");

        const stream = event.streams[0] || new MediaStream();
        if (!event.streams[0] && !stream.getTracks().find(t => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }

        const freshStream = new MediaStream(stream.getTracks());
        setRemoteStream(freshStream);
        setCallConnected(true);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = freshStream;
          remoteVideoRef.current.play().catch(e => console.warn("Auto-play video blocked (answer):", e));
        }
      };

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(callData.offer),
      );

      while (iceQueue.current.length > 0) {
        const cand = iceQueue.current.shift();
        if (cand) {
          await peerConnection.current
            .addIceCandidate(new RTCIceCandidate(cand))
            .catch((e) => console.error("Error flushing candidate", e));
        }
      }

      const answer = await peerConnection.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callData.type === "video"
      });
      await peerConnection.current.setLocalDescription(answer);

      const targetId = callData.from_id;
      const targetSid = callData.from;

      console.log(`[Call] Réponse envoyée vers UserID: ${targetId}, SID: ${targetSid}`);
      socket.emit("answer-call", {
        to: targetSid,
        to_id: targetId,
        answer
      });
      setIncomingCall(null);
      if (onClearIncomingCall) onClearIncomingCall();
    } catch (err) {
      console.error("Answer connection failed completely", err);
      setCallError("Échec complet de connexion de l'appel");
    }
  };

  const endCall = () => {
    console.log("[Call] endCall called, resetting states...");

    // ⚠️ IMPORTANT: Capturer la cible AVANT de réinitialiser les états
    // car les états sont effacés ci-dessous et on perdrait les infos
    const targetId = interlocutor?.interlocutor_id || incomingCall?.from_id;
    const shouldNotify = isCalling || callConnected;

    // Arrêter les pistes locales
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }

    // Fermer la connexion pair-à-pair
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    // Réinitialiser tous les états
    isInitiatorRef.current = false;
    setIsCalling(false);
    setCallConnected(false);
    setCallType(null);
    setIncomingCall(null);
    setCallError(null);
    setLocalStream(null);
    setRemoteStream(null);
    setConnState("new");
    if (onClearIncomingCall) onClearIncomingCall();

    // Envoyer le signal de fin d'appel à l'autre participant
    if (shouldNotify && socket && targetId) {
      console.log(`[Call] Emitting end-call to UserID: ${targetId}`);
      socket.emit("end-call", { to: String(targetId) });
    }

    if (callType !== null) {
      const logContent = callConnected
        ? `${callType === "video" ? "📹 Appel vidéo terminé" : "📞 Appel audio terminé"}`
        : `${callType === "video" ? "📹 Appel vidéo manqué" : "📞 Appel audio manqué"}`;
      saveCallLog(logContent);
    }
  };

  const saveCallLog = async (logContent: string) => {
    try {
      const res = await api.post("/chat/messages", {
        conversation_id: conversationId,
        content: logContent,
        type: "call",
      });
      setMessages((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Error saving call log:", err);
    }
  };

  const handleDeleteChat = async () => {
    setShowMenu(false);
    setConfirmConfig({
      isOpen: true,
      title: "Supprimer la discussion ?",
      message: "Voulez-vous vraiment supprimer cette conversation ? Cette action est irréversible.",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/chat/conversations/${conversationId}`);
          if (onBack) {
            onBack();
          } else {
            navigate("/conversations");
          }
          toast.success("Discussion supprimée");
        } catch (err) {
          console.error("Delete Error:", err);
          toast.error("Erreur suppression");
        }
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  if (isCalling) {
    return (
      <div
        className="call-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          overflow: "hidden",
          background:
            callType === "video"
              ? "#000"
              : "linear-gradient(135deg, #075E54 0%, #128C7E 100%)",
        }}
      >
        {callType === "video" && (
          <div
            className="video-call-container"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 1,
            }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                backgroundColor: "#1a1a1a" // Background subtil en cas de chargement
              }}
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "120px",
                height: "160px",
                borderRadius: "12px",
                border: "2px solid white",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* UI Layer : superposé à la vidéo, transparent */}
        <div
          className="call-ui-layer"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 2,
            pointerEvents: "none", // Transparent aux clics sauf éléments actifs
          }}
        >
          {/* En-tête : nom + statut (visible si pas en vidéo connectée) */}
          {!(callType === "video" && callConnected) && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "40px 20px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                color: "white",
                pointerEvents: "auto",
              }}
            >
              <div style={{ marginBottom: "15px" }}>
                <UserAvatar
                  name={interlocutor?.interlocutor_name}
                  avatarUrl={interlocutor?.interlocutor_avatar}
                  productImageUrl={interlocutor?.product_image}
                  size="lg"
                  className="call-avatar-user"
                />
              </div>
              <h2 style={{ margin: "0 0 5px 0", fontSize: "24px" }}>
                {interlocutor?.interlocutor_name || "Chargement..."}
              </h2>
              <p style={{ margin: 0, opacity: 0.8 }}>
                {incomingCall && !incomingCall.accepted
                  ? "Appel entrant..."
                  : callConnected
                    ? "Appel connecté"
                    : "Appel en cours..."}
              </p>
              {callError && (
                <div style={{
                  marginTop: "15px",
                  padding: "8px 12px",
                  backgroundColor: "rgba(239, 68, 68, 0.35)",
                  border: "1px solid #EF4444",
                  borderRadius: "8px",
                  color: "#FCA5A5",
                  fontSize: "12px",
                  textAlign: "center",
                  maxWidth: "260px"
                }}>
                  {callError}
                </div>
              )}
            </div>
          )}

          <audio ref={remoteAudioRef} autoPlay />

          {/* Contrôles : flottants en bas, superposés à la vidéo */}
          <div
            className="call-controls"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "20px",
              display: "flex",
              gap: "20px",
              justifyContent: "center",
              alignItems: "center",
              background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)",
              pointerEvents: "auto",
            }}
          >
            {callConnected && (
              <button
                onClick={() => {
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play();
                  }
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.muted = false;
                    remoteAudioRef.current.play();
                  }
                }}
                style={{
                  padding: "15px 25px",
                  borderRadius: "35px",
                  border: "none",
                  background: "#25D366",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 15px rgba(37, 211, 102, 0.4)",
                }}
              >
                Son / Vidéo
              </button>
            )}
            {incomingCall && !incomingCall.accepted ? (
              <>
                <button
                  onClick={() => answerCall()}
                  className="call-btn-accept"
                >
                  <Phone />
                </button>
                <button onClick={endCall} className="call-btn-end">
                  <X />
                </button>
              </>
            ) : (
              <button onClick={endCall} className="call-btn-end">
                <X />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page-wrapper">
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
      <header className="chat-header">
        {isSplitView && onBack && (
          <button onClick={onBack} className="icon-btn mobile-only">
            <ChevronLeft />
          </button>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: 1,
          }}
        >
          <UserAvatar
            name={interlocutor?.interlocutor_name}
            avatarUrl={interlocutor?.interlocutor_avatar}
            productImageUrl={interlocutor?.product_image}
            size="sm"
            role={interlocutor?.interlocutor_role}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 750, fontSize: "16px", color: "#111", display: 'flex', alignItems: 'center', gap: '6px' }}>
              {interlocutor?.interlocutor_name || "Vendeur agrimarche"}
              {interlocutor?.interlocutor_role === "seller" && (
                <CheckCircle size={14} color="var(--primary)" fill="rgba(var(--primary-rgb), 0.1)" />
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#666", display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={`post-role-tag ${interlocutor?.interlocutor_role}`}>
                {interlocutor?.interlocutor_role === "seller" ? "Vendeur" : interlocutor?.interlocutor_role === "deliverer" ? "Livreur" : "Acheteur"}
              </span>
              <span></span>
              <span>{interlocutor?.interlocutor_city || "Cameroun"}</span>
            </div>
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" onClick={() => startCall("audio")}>
            <Phone size={20} />
          </button>
          <button className="icon-btn" onClick={() => startCall("video")}>
            <Video size={20} />
          </button>
          <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
            <MoreVertical size={20} />
          </button>
          {showMenu && (
            <div className="chat-dropdown-menu">
              <button className="dropdown-item delete-btn" onClick={handleDeleteChat}>
                <Trash2 size={16} /> Supprimer la discussion
              </button>
            </div>
          )}
        </div>
      </header>

      {interlocutor?.product_name && (
        <div className="chat-product-banner">
          <img
            src={resolveMediaUrl(interlocutor.product_image) || ""}
            alt={interlocutor.product_name}
            className="chat-product-img"
          />
          <div className="chat-product-info">
            <h4>{interlocutor.product_name}</h4>
            <p className="chat-product-price">
              {interlocutor.product_price ? Number(interlocutor.product_price).toLocaleString() : '---'} FCFA / {interlocutor.product_unit || "kg"}
            </p>
          </div>
          <button
            className="btn-chat-view-product"
            onClick={() => navigate(`/product/${interlocutor.product_id}`)}
          >
            <ShoppingBag size={16} /> Voir le produit
          </button>
        </div>
      )}

      <div className="message-list" ref={scrollRef}>
        {/* Encadr produit intgr dans la discussion - style WhatsApp Reply / Product Attachment */}
        {interlocutor?.product_name && (
          <div className="chat-inline-product-card">
            <div className="chat-inline-product-header">
              <span className="chat-inline-product-badge">Annonce concerne</span>
            </div>
            <div className="chat-inline-product-content">
              <img
                src={resolveMediaUrl(interlocutor.product_image) || ""}
                alt={interlocutor.product_name}
                className="chat-inline-product-thumb"
              />
              <div className="chat-inline-product-info">
                <h4 className="chat-inline-product-title">{interlocutor.product_name}</h4>
                <p className="chat-inline-product-price">
                  {interlocutor.product_price ? Number(interlocutor.product_price).toLocaleString() : '---'} FCFA / {interlocutor.product_unit || "kg"}
                </p>
              </div>
              <button
                className="chat-inline-product-action"
                onClick={() => navigate(`/product/${interlocutor.product_id}`)}
              >
                Voir
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-bubble ${msg.sender_id === currentUserId ? "msg-sent" : "msg-received"}`}
          >

            {msg.type === "audio" ? (
              <div className="audio-message-container">
                <audio
                  controls
                  className="whatsapp-audio-player"
                  src={
                    msg.audio_url?.startsWith("http")
                      ? msg.audio_url
                      : `${API_URL}${msg.audio_url}`
                  }
                />
              </div>
            ) : msg.type === "call" ? (
              <div className="msg-content call-log-msg">
                <span>{msg.content}</span>
              </div>
            ) : msg.type === "offer" ? (
              <div className={`offer-bubble ${msg.offer_status}`}>
                <div className="offer-header">
                  <Handshake size={18} />
                  <span>Proposition de prix</span>
                </div>
                <div className="offer-amount">
                  {msg.offer_price ? Number(msg.offer_price).toLocaleString() : '---'} FCFA
                  {msg.offer_quantity && <span style={{ fontSize: '14px', color: '#666', marginLeft: '8px' }}>x {msg.offer_quantity}</span>}
                </div>
                {msg.offer_quantity && (
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                    Total : {(msg.offer_price * msg.offer_quantity).toLocaleString()} FCFA
                  </div>
                )}
                <p className="offer-text">{msg.content}</p>

                {msg.offer_status === 'pending' && msg.sender_id !== currentUserId && (
                  <div className="offer-actions">
                    <button className="btn-reject" onClick={() => handleOfferAction(msg.id, 'reject')}>Refuser</button>
                    <button className="btn-accept" onClick={() => handleOfferAction(msg.id, 'accept')}>Accepter</button>
                  </div>
                )}

                {msg.offer_status !== 'pending' && (
                  <>
                    <div className={`offer-badge ${msg.offer_status}`}>
                      {msg.offer_status === 'accepted' ? 'Offre Acceptée' : 'Offre Refusée'}
                    </div>
                    {msg.offer_status === 'accepted' && String(currentUserId) !== String(interlocutor?.product_seller_id) && (
                      <button
                        className="btn-pay-negotiated"
                        onClick={() => handlePayOffer(msg)}
                        style={{
                          width: '100%',
                          marginTop: '10px',
                          padding: '12px',
                          borderRadius: '12px',
                          border: 'none',
                          background: 'var(--primary)',
                          color: 'white',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.2)'
                        }}
                      >
                        <DollarSign size={18} /> Procéder au paiement
                      </button>
                    )}
                    <button
                      className="btn-view-product-bubble"
                      onClick={() => navigate(`/product/${interlocutor.product_id}`)}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '8px',
                        borderRadius: '10px',
                        border: '1px solid #E0E0E0',
                        background: 'white',
                        color: '#666',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <ShoppingBag size={14} /> Voir l'annonce
                    </button>
                  </>
                )}
              </div>
            ) : msg.type === "image" ? (
              <div className="media-message-container">
                <img
                  src={msg.media_url?.startsWith("http") ? msg.media_url : `${API_URL}${msg.media_url}`}
                  alt="shared"
                  className="chat-media-img"
                  onClick={() => window.open(msg.media_url?.startsWith("http") ? msg.media_url : `${API_URL}${msg.media_url}`, '_blank')}
                />
              </div>
            ) : msg.type === "video" ? (
              <div className="media-message-container">
                <video
                  controls
                  className="chat-media-video"
                  src={msg.media_url?.startsWith("http") ? msg.media_url : `${API_URL}${msg.media_url}`}
                />
              </div>
            ) : (
              <div className="msg-content">{msg.content}</div>
            )}
            <span className="msg-timestamp">
              {new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>

      <footer className="chat-footer">
        <input
          type="file"
          ref={mediaInputRef}
          hidden
          accept="image/*,video/*"
          onChange={handleFileSelect}
        />
        <button className="icon-btn" onClick={() => mediaInputRef.current?.click()}>
          <Paperclip size={22} />
        </button>
        <div className="input-container">
          {isRecording ? (
            <div className="recording-status">
              <span className="recording-dot"></span>
              <span className="recording-text">
                Enregistrement {formatTime(recordingTime)}
              </span>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="crivez un message..."
                className="chat-text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendText()}
              />
              <button className="icon-btn">
                <Camera size={22} />
              </button>
            </>
          )}
        </div>
        {text ? (
          <button className="btn-send-whatsapp" onClick={handleSendText}>
            <Send size={20} />
          </button>
        ) : (
          <button
            className={`btn-send-whatsapp ${isRecording ? "recording" : ""}`}
            onClick={() => (isRecording ? stopRecording() : startRecording())}
          >
            {isRecording ? <Send size={20} /> : <Mic size={20} />}
          </button>
        )}
      </footer>

      {isOfferModalOpen && (
        <div className="offer-modal-overlay">
          <div className="offer-modal-content">
            <div className="offer-modal-header">
              <h3>Proposer un prix</h3>
              <button onClick={() => setIsOfferModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="offer-modal-body">
              {!interlocutor ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  <div className="loader-spinner" style={{ margin: '0 auto 10px' }}></div>
                  <p>Chargement des détails du produit...</p>
                </div>
              ) : (
                <>
                  <div className="offer-product-mini">
                    <img src={resolveMediaUrl(interlocutor?.product_image)} alt="" />
                    <div>
                      <p className="name">{interlocutor?.product_name}</p>
                      <p className="price">Prix actuel : {interlocutor?.product_price?.toLocaleString()} FCFA</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="offer-input-group" style={{ marginBottom: 0 }}>
                      <label>Prix (FCFA)</label>
                      <div className="input-with-icon">
                        <DollarSign size={18} />
                        <input
                          type="number"
                          placeholder="8500"
                          value={offerPrice}
                          onChange={(e) => setOfferPrice(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="offer-input-group" style={{ marginBottom: 0 }}>
                      <label>Quantité</label>
                      <div className="input-with-icon">
                        <ShoppingBag size={18} />
                        <input
                          type="number"
                          placeholder="1"
                          value={offerQuantity}
                          onChange={(e) => setOfferQuantity(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {offerPrice && offerQuantity && (
                    <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(46,125,50,0.05)', borderRadius: '12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#666', display: 'block' }}>Montant Total Proposé</span>
                      <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>
                        {(Number(offerPrice) * Number(offerQuantity)).toLocaleString()} FCFA
                      </strong>
                    </div>
                  )}

                  <div className="offer-notice">
                    <AlertCircle size={14} />
                    <p>Le vendeur recevra votre offre et pourra l'accepter ou la refuser.</p>
                  </div>

                  <button
                    className="btn-modal-view-product"
                    onClick={() => navigate(`/product/${interlocutor.product_id}`)}
                    style={{
                      width: '100%',
                      marginTop: '15px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid var(--primary)',
                      background: 'white',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <ShoppingBag size={16} /> Voir les détails du produit
                  </button>
                </>
              )}
            </div>
            <div className="offer-modal-footer">
              <button className="btn-cancel" onClick={() => setIsOfferModalOpen(false)}>Annuler</button>
              <button className="btn-submit" onClick={handleSendOffer}>Envoyer l'offre</button>
            </div>
          </div>
        </div>
      )}

      {previewMedia.url && (
        <div className="media-preview-overlay">
          <div className="media-preview-content">
            <header>
              <h3>Aperçu du média</h3>
              <button className="close-preview" onClick={() => setPreviewMedia({ url: "", type: null })}><X /></button>
            </header>
            <div className="preview-body">
              {previewMedia.type === "image" ? (
                <img src={previewMedia.url} alt="preview" />
              ) : (
                <video src={previewMedia.url} controls />
              )}
            </div>
            <footer>
              <button
                className="btn-send-media"
                onClick={handleSendMedia}
                disabled={isUploading}
              >
                {isUploading ? "Envoi..." : "Envoyer"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
