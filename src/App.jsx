import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import LiveMap from './pages/LiveMap';
import Outing from './pages/Outing';
import CheckIn from './pages/CheckIn';
import GetHelp from './pages/GetHelp';
import Contacts from './pages/Contacts';
import ContactView from './pages/ContactView';
import TrustPanel from './pages/TrustPanel';
import Safety from './pages/Safety';
import About from './pages/About';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import { ForgotPassword, ResetPassword } from './pages/AccountRecovery';
import { DataProvider } from './context/DataContext';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <DataProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth pages — no layout chrome */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Everything else uses the Layout */}
            <Route
              path="*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/how" element={<HowItWorks />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/safety" element={<Safety />} />

                    {/* Protected routes */}
                    <Route path="/map" element={<RequireAuth><LiveMap /></RequireAuth>} />
                    <Route path="/outing" element={<RequireAuth><Outing /></RequireAuth>} />
                    <Route path="/checkin" element={<RequireAuth><CheckIn /></RequireAuth>} />
                    <Route path="/help" element={<RequireAuth><GetHelp /></RequireAuth>} />
                    <Route path="/contacts" element={<RequireAuth><Contacts /></RequireAuth>} />
                    <Route path="/contact" element={<RequireAuth><ContactView /></RequireAuth>} />
                    <Route path="/trust" element={<RequireAuth><TrustPanel /></RequireAuth>} />
                    <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </BrowserRouter>
        </DataProvider>
      </AppProvider>
    </AuthProvider>
  );
}