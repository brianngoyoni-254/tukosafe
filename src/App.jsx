import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
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

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/how" element={<HowItWorks />} />
            <Route path="/map" element={<LiveMap />} />
            <Route path="/outing" element={<Outing />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/help" element={<GetHelp />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contact" element={<ContactView />} />
            <Route path="/trust" element={<TrustPanel />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}