import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './components/PortfolioStore';
import { PriceProvider } from './components/PriceStore';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { ComparePage } from './pages/ComparePage';

const App: React.FC = () => (
  <StoreProvider>
    <PriceProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/p/:id" element={<PortfolioPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </PriceProvider>
  </StoreProvider>
);

export default App;
