import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Progress from './pages/Progress';
import Settings from './pages/Settings';
import Navbar from './components/Navbar';
import SignIn from './pages/SignIn.jsx';
import { useAuth } from './context/authContextShared';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/onboarding"
            element={(
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            )}
          />
          <Route
            path="/home"
            element={(
              <RequireAuth>
                <Home />
              </RequireAuth>
            )}
          />
          <Route
            path="/progress"
            element={(
              <RequireAuth>
                <Progress />
              </RequireAuth>
            )}
          />
          <Route
            path="/settings"
            element={(
              <RequireAuth>
                <Settings />
              </RequireAuth>
            )}
          />
        </Routes>
        <Navbar />
      </div>
    </Router>
  );
}

export default App;
