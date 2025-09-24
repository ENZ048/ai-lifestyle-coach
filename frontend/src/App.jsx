import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';
import SignIn from './pages/SignIn.jsx';
import { useAuth } from './context/authContextShared';
import api from './lib/apiClient';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Authenticating..." />;
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const checkUserProfile = async () => {
      try {
        // Check if user has completed onboarding by trying to get their profile
        const response = await api.get('/profile');
        const data = response.data;
        setUserProfile(data && data.exists ? data.profile : null);
      } catch (error) {
        // If profile doesn't exist or error occurs, user needs onboarding
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    if (user) {
      checkUserProfile();
    }
  }, [user]);

  if (profileLoading) {
    return <LoadingSpinner message="Checking your profile..." />;
  }

  // If user doesn't have a profile, redirect to onboarding
  if (!userProfile) {
    return <Navigate to="/onboarding" replace />;
  }

  // User has completed onboarding, show main app
  return <Navigate to="/home" replace />;
}

function AppContent() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Only show navbar when user is authenticated and not on signin/onboarding
  const showNavbar = user && location.pathname !== '/signin' && location.pathname !== '/onboarding';

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Root route - determines where to send user based on auth and profile status */}
        <Route 
          path="/" 
          element={
            user ? <AuthenticatedApp /> : <Navigate to="/signin" replace />
          } 
        />
        
        {/* Sign in page - only accessible when not authenticated */}
        <Route 
          path="/signin" 
          element={
            user ? <Navigate to="/" replace /> : <SignIn />
          } 
        />
        
        {/* Onboarding - only accessible when authenticated but no profile */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        
        {/* Main app pages - only accessible when authenticated and profile exists */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/progress"
          element={
            <RequireAuth>
              <Progress />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
      </Routes>
      
      {showNavbar && <Navbar />}
    </div>
  );
}

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Starting up..." />;
  }

  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
