import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import SendFiles from './pages/SendFiles.jsx';
import ReceiveFiles from './pages/ReceiveFiles.jsx';
import SendText from './pages/SendText.jsx';
import ReceiveText from './pages/ReceiveText.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/send-files" element={<SendFiles />} />
        <Route path="/receive-files" element={<ReceiveFiles />} />
        <Route path="/send-text" element={<SendText />} />
        <Route path="/receive-text" element={<ReceiveText />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <BottomNav />
    </>
  );
}
