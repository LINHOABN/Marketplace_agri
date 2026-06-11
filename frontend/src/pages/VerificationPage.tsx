import { useState } from "react";
import { ChevronLeft, ShieldCheck, Upload, Camera, CheckCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";

export default function VerificationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    const requestedRole = query.get("role");

    const [idCardFile, setIdCardFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleUpload = async () => {
        if (!idCardFile || !selfieFile) {
            toast.error("Veuillez sélectionner les deux images.");
            return;
        }

        setIsUploading(true);
        try {
            console.log("Début de l'envoi KYC...");

            // 1. Upload ID Card
            console.log("Envoi pièce d'identité...");
            const formDataId = new FormData();
            formDataId.append("file", idCardFile);
            const resId = await api.post("/media/upload", formDataId, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const idUrl = resId.data.url;
            console.log("Pièce d'identité ok:", idUrl);

            // 2. Upload Selfie
            console.log("Envoi selfie...");
            const formDataSelfie = new FormData();
            formDataSelfie.append("file", selfieFile);
            const resSelfie = await api.post("/media/upload", formDataSelfie, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const selfieUrl = resSelfie.data.url;
            console.log("Selfie ok:", selfieUrl);

            // 3. Submit to Auth API
            console.log("Enregistrement du profil...");
            await api.post("/auth/verify-profile", {
                id_card_url: idUrl,
                selfie_url: selfieUrl
            });

            // 4. Automatic Role Request if needed
            if (requestedRole) {
                console.log("Envoi de la demande de rôle:", requestedRole);
                await api.post("/auth/request-role", { requested_role: requestedRole });
            }

            console.log("KYC Terminé avec succès !");
            toast.success(requestedRole ? "Documents et demande envoyés !" : "Documents envoyés avec succès !");
            setIsSubmitted(true);
        } catch (err: any) {
            console.error("KYC Error Details:", err.response?.data || err.message || err);
            toast.error(`Erreur lors de l'envoi: ${err.response?.data?.detail || "Vérifiez votre connexion"}`);
        } finally {
            setIsUploading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="dashboard-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                <CheckCircle size={80} color="var(--primary)" style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ fontWeight: 800 }}>Merci !</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
                    Vos documents ont été envoyés à l'administrateur. Nous reviendrons vers vous dès que votre identité sera confirmée.
                </p>
                <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => navigate("/")}>Retour à l'accueil</button>
            </div>
        );
    }

    return (
        <div className="dashboard-wrapper">
            <header className="dashboard-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate(-1)} className="btn-icon"><ChevronLeft /></button>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Vérification d'identité</h1>
            </header>

            <main className="dashboard-content" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <ShieldCheck color="var(--primary)" size={32} />
                    <p style={{ fontSize: '14px', margin: 0 }}>
                        La vérification de votre compte augmente votre crédibilité sur AgriMarché et permet de sécuriser vos transactions.
                    </p>
                </div>

                <div className="form-section" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '1rem' }}>1. Pièce d'identité (Recto)</h3>
                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '1rem' }}>CNI, Passeport ou Permis de conduire.</p>
                    <label className="upload-box" style={{
                        display: 'block',
                        border: '2px dashed #ddd',
                        borderRadius: 'var(--radius-md)',
                        padding: '2rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden'
                    }}>
                        <input type="file" hidden accept="image/*" onChange={(e) => setIdCardFile(e.target.files?.[0] || null)} />
                        {idCardFile ? (
                            <img src={URL.createObjectURL(idCardFile)} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                        ) : (
                            <>
                                <Upload size={32} color="#999" style={{ marginBottom: '0.5rem' }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>Cliquer pour télécharger</p>
                            </>
                        )}
                    </label>
                </div>

                <div className="form-section" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '1rem' }}>2. Selfie de confirmation</h3>
                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '1rem' }}>Prenez une photo de vous tenant votre pièce d'identité.</p>
                    <label className="upload-box" style={{
                        display: 'block',
                        border: '2px dashed #ddd',
                        borderRadius: 'var(--radius-md)',
                        padding: '2rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden'
                    }}>
                        <input type="file" hidden accept="image/*" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
                        {selfieFile ? (
                            <img src={URL.createObjectURL(selfieFile)} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                        ) : (
                            <>
                                <Camera size={32} color="#999" style={{ marginBottom: '0.5rem' }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>Prendre/Télécharger un selfie</p>
                            </>
                        )}
                    </label>
                </div>

                <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '1rem', fontWeight: 800 }}
                    disabled={isUploading || !idCardFile || !selfieFile}
                    onClick={handleUpload}
                >
                    {isUploading ? "Envoi en cours..." : "Soumettre pour vérification"}
                </button>
            </main>
        </div>
    );
}
