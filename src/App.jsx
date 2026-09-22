import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleRoute from '@/components/RoleRoute';
import { CartProvider } from '@/lib/CartContext';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AcceptInvite from '@/pages/AcceptInvite';
import ConfirmEmail from '@/pages/ConfirmEmail';

// Shared
import HomeRouter from '@/components/HomeRouter';
import Notifications from '@/pages/Notifications';

// Customer pages
import Cart from '@/pages/customer/Cart';
import Checkout from '@/pages/customer/Checkout';
import OrderSuccess from '@/pages/customer/OrderSuccess';
import MyOrders from '@/pages/customer/MyOrders';
import TrackOrder from '@/pages/customer/TrackOrder';

// Distributor pages
import DistributorDashboard from '@/pages/distributor/DistributorDashboard';
import DistributorOrderDetail from '@/pages/distributor/DistributorOrderDetail';
import DistributorCustody from '@/pages/distributor/DistributorCustody';

// Driver pages
import DriverDashboard from '@/pages/driver/DriverDashboard';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminInventory from '@/pages/admin/AdminInventory';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />

      {/* Public routes */}
      <Route path="/" element={<HomeRouter />} />
      <Route path="/cart" element={<RoleRoute allowedRoles={["customer"]} allowUnauthenticated><Cart /></RoleRoute>} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        {/* Customer routes */}
        <Route path="/checkout" element={<RoleRoute allowedRoles={["customer"]}><Checkout /></RoleRoute>} />
        <Route path="/order-success/:id" element={<RoleRoute allowedRoles={["customer"]}><OrderSuccess /></RoleRoute>} />
        <Route path="/my-orders" element={<RoleRoute allowedRoles={["customer"]}><MyOrders /></RoleRoute>} />
        <Route path="/track-order/:id" element={<RoleRoute allowedRoles={["customer"]}><TrackOrder /></RoleRoute>} />

        {/* Shared routes */}
        <Route path="/notifications" element={<RoleRoute allowedRoles={["customer", "distributor", "driver", "admin"]}><Notifications /></RoleRoute>} />

        {/* Distributor routes */}
        <Route path="/distributor" element={<RoleRoute allowedRoles={["distributor"]}><DistributorDashboard /></RoleRoute>} />
        <Route path="/distributor/order/:id" element={<RoleRoute allowedRoles={["distributor"]}><DistributorOrderDetail /></RoleRoute>} />
        <Route path="/distributor/custody" element={<RoleRoute allowedRoles={["distributor"]}><DistributorCustody /></RoleRoute>} />

        {/* Driver routes */}
        <Route path="/driver" element={<RoleRoute allowedRoles={["driver"]}><DriverDashboard /></RoleRoute>} />

        {/* Admin routes */}
        <Route path="/admin" element={<RoleRoute allowedRoles={["admin"]}><AdminDashboard /></RoleRoute>} />
        <Route path="/admin/orders" element={<RoleRoute allowedRoles={["admin"]}><AdminOrders /></RoleRoute>} />
        <Route path="/admin/users" element={<RoleRoute allowedRoles={["admin"]}><AdminUsers /></RoleRoute>} />
        <Route path="/admin/products" element={<RoleRoute allowedRoles={["admin"]}><AdminProducts /></RoleRoute>} />
        <Route path="/admin/inventory" element={<RoleRoute allowedRoles={["admin"]}><AdminInventory /></RoleRoute>} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename="/gazak-go">
          <ScrollToTop />
          <CartProvider>
            <AuthenticatedApp />
          </CartProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
