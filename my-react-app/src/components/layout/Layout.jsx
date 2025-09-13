import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

export default function Layout() {
  return (
    <div
      className="app-shell"
      style={{
        /* растянуться на всю ширину/высоту и перекрыть любые гриды родителя */
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100vw',
        gridColumn: '1 / -1',
      }}
    >
      <Header />
      <main id="content" style={{ flex: 1, width: '100%' }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
