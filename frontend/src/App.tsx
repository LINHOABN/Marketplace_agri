// =============================================================================
// App.tsx — Le Cerveau de Navigation du Frontend (React Router)
// =============================================================================
//
// CE FICHIER FAIT QUOI ?
//   C'est la racine de l'application visuelle. Il :
//   1. Définit toutes les URLs (Chemins) accessibles : /login, /feed, /profile...
//   2. Protège les accès : seules les personnes connectées voient les pages internes.
//   3. Gère le Layout : définit ce qui reste fixe (la barre latérale) 
//      et ce qui change (le contenu au milieu).
//
// POUR MODIFIER :
// - Créer une nouvelle page (ex: /about) → 
//     1. Importez votre composant : `import AboutPage from "./pages/AboutPage";`
//     2. Ajoutez la route : `<Route path="/about" element={<AboutPage />} />`
// - Changer la page de démarrage → modifiez le `path="/"` ou la redirection initiale.
// - Modifier le design global (Barre latérale) → modifiez le composant `MainLayout`.
// =============================================================================

import { BrowserRouter, Routes, Route, useParams, useLocation, useNavigate } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";

// Imports de toutes les pages du projet
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import WelcomePage from "./pages/WelcomePage";
import FeedPage from "./pages/FeedPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import EditProductPage from "./pages/EditProductPage";
import MainLayout from "./components/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import AIAssistant from "./components/AIAssistant";
import AdminDashboard from "./pages/AdminDashboard";
import ProfilePage from "./pages/ProfilePage";
import SellerDashboard from "./pages/SellerDashboard";
import WalletPage from "./pages/WalletPage";
import SearchPage from "./pages/SearchPage";
import StoriesPage from "./pages/StoriesPage";
import MessengerPage from "./pages/MessengerPage";
import DelivererDashboard from "./pages/DelivererDashboard";
import SearchResultsPage from "./pages/SearchResultsPage";
import CreateProductPage from "./pages/CreateProductPage";
import ShopPage from "./pages/ShopPage";
import OrderCreationPage from "./pages/OrderCreationPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import PaymentPage from "./pages/PaymentPage";
import HistoryPage from "./pages/HistoryPage";
import DisputePage from "./pages/DisputePage";
import ReviewPage from "./pages/ReviewPage.tsx";
import SettingsPage from "./pages/SettingsPage";
import AdminDetailPage from "./pages/AdminDetailPage";
import AdminTipsPage from "./pages/AdminTipsPage";
import AdminRoleRequestsPage from "./pages/AdminRoleRequestsPage";
import VerificationPage from "./pages/VerificationPage";
import ShopSettingsPage from "./pages/ShopSettingsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminWalletPage from "./pages/AdminWalletPage";
import FinanceSimulatorPage from "./pages/FinanceSimulatorPage";

import { useEffect } from "react";
import api from "./api";

function ChatRedirect() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isNew = location.pathname.includes("/new/");

    if (!isNew) {
      // Cas simple : on a déjà un ID de conversation
      navigate("/conversations", { state: { openChatId: id }, replace: true });
      return;
    }

    // Cas "new" : id est probablement un SELLER_ID. 
    // On doit créer une conversation (le backend gère le "get or create").
    const initChat = async () => {
      try {
        // Le endpoint /shops/{id} accepte aussi bien un ID Boutique qu'un ID Vendeur
        const shopRes = await api.get(`/shops/${id}`);
        const shopId = shopRes.data?.id;

        // Pareil pour les produits
        const productsRes = await api.get(`/shops/${shopId}/products`);
        const firstProduct = productsRes.data?.[0];

        if (!firstProduct) {
          toast.error("Vendeur sans produits. Impossible d'initier une discussion produit.");
          navigate(-1);
          return;
        }

        const convRes = await api.post("/chat/conversations", {
          product_id: firstProduct.id,
          seller_id: id
        });

        navigate("/conversations", { state: { openChatId: String(convRes.data.id) }, replace: true });
      } catch (err) {
        console.error("Chat init error:", err);
        toast.error("Erreur lors de l'ouverture de la discussion.");
        navigate("/feed");
      }
    };

    initChat();
  }, [id, location.pathname, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
      <div className="loader"></div>
      <p style={{ fontWeight: 800, color: 'var(--primary)' }}>Ouverture de la discussion...</p>
    </div>
  );
}

import { useGeolocation } from "./hooks/useGeolocation";

function GlobalServices() {
  useGeolocation(); // Active le suivi GPS globalement
  return null;
}

// ─── STRUCTURE COMMUNE (WRAPPER) ─────────────────────────────────────────────
// Encapsule les pages privées pour leur donner une barre latérale (MainLayout)
// et vérifier que l'utilisateur est bien connecté (ProtectedRoute).
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <GlobalServices />
      <Routes>
        {/* --- ROUTES PUBLIQUES (accessibles sans compte) --- */}
        <Route path="/" element={<PublicOnlyRoute><WelcomePage /></PublicOnlyRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/product/:id" element={<MainLayout><ProductDetailPage /></MainLayout>} />
        <Route path="/shop/:id" element={<MainLayout><ShopPage /></MainLayout>} />
        <Route path="/search" element={<MainLayout><SearchPage /></MainLayout>} />
        <Route path="/search/results" element={<MainLayout><SearchResultsPage /></MainLayout>} />

        {/* --- ROUTES PRIVÉES (Acheteur / Vendeur / Livreur) --- */}
        {/* On entoure chaque page privée de <AppLayout> pour avoir le menu constant */}
        <Route path="/feed" element={<AppLayout><FeedPage /></AppLayout>} />


        {/* Routes pour le chat (redirection vers messagerie) */}
        <Route path="/chat/:id" element={<ProtectedRoute><ChatRedirect /></ProtectedRoute>} />
        <Route path="/chat/new/:id" element={<ProtectedRoute><ChatRedirect /></ProtectedRoute>} />

        {/* --- AJOUTEZ VOS NOUVELLES ROUTES CI-DESSOUS --- */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><MainLayout><AdminDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/admin/detail/:section" element={<ProtectedRoute requireAdmin><MainLayout><AdminDetailPage /></MainLayout></ProtectedRoute>} />
        <Route path="/admin/role-requests" element={<ProtectedRoute requireAdmin><MainLayout><AdminRoleRequestsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/admin/tips" element={<ProtectedRoute requireAdmin><MainLayout><AdminTipsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><MainLayout><AdminSettingsPage /></MainLayout></ProtectedRoute>} />
        <Route path="/admin/wallet" element={<ProtectedRoute requireAdmin><MainLayout><AdminWalletPage /></MainLayout></ProtectedRoute>} />
        <Route path="/admin/finance-simulator" element={<ProtectedRoute requireAdmin><MainLayout><FinanceSimulatorPage /></MainLayout></ProtectedRoute>} />
        <Route path="/profile" element={<AppLayout><ProfilePage /></AppLayout>} />
        <Route path="/seller/dashboard" element={<ProtectedRoute allowedRoles={['seller']}><MainLayout><SellerDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/deliverer/dashboard" element={<ProtectedRoute allowedRoles={['deliverer']}><MainLayout><DelivererDashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/wallet" element={<AppLayout><WalletPage /></AppLayout>} />
        <Route path="/stories" element={<AppLayout><StoriesPage /></AppLayout>} />
        <Route path="/conversations" element={<AppLayout><MessengerPage /></AppLayout>} />
        <Route path="/product/create" element={<AppLayout><CreateProductPage /></AppLayout>} />
        <Route path="/product/edit/:id" element={<AppLayout><EditProductPage /></AppLayout>} />
        <Route path="/shop/:id" element={<AppLayout><ShopPage /></AppLayout>} />
        <Route path="/order/create/:productId" element={<AppLayout><OrderCreationPage /></AppLayout>} />
        <Route path="/order/tracking/:orderId" element={<AppLayout><OrderTrackingPage /></AppLayout>} />
        <Route path="/payment/:orderId" element={<AppLayout><PaymentPage /></AppLayout>} />
        <Route path="/history" element={<AppLayout><HistoryPage /></AppLayout>} />
        <Route path="/dispute/:orderId" element={<AppLayout><DisputePage /></AppLayout>} />
        <Route path="/review" element={<AppLayout><ReviewPage /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
        <Route path="/verify-profile" element={<AppLayout><VerificationPage /></AppLayout>} />
        <Route path="/seller/shop-settings" element={<ProtectedRoute allowedRoles={['seller']}><MainLayout><ShopSettingsPage /></MainLayout></ProtectedRoute>} />

      </Routes>

      {/* COMPOSANTS GLOBAUX (toujours présents) */}
      {/* Toaster : affiche les petites bulles de succès/erreur en haut */}
      <Toaster position="top-center" reverseOrder={false} />

      {/* Assistant IA AgriBot : le bouton flottant présent sur tout le site */}
      <AIAssistant />
    </BrowserRouter>
  );
}

export default App;
