import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import MobileTabBar from '../mobile/MobileTabBar.jsx';

export default function Layout() {
  return (
    <>
      <Header />
      <main role="main">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
