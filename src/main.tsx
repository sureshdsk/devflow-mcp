import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Providers } from '@/components/providers';
import { KanbanBoard } from '@/components/kanban-board';
import SpecPage from '@/pages/spec-page';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<KanbanBoard />} />
          <Route path="/specs/:name" element={<SpecPage />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);
