// src/App.jsx
import React from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import AppRouter from './routes/AppRouter';
import './App.css';

function App() {
  return (
    <div className="App">
      <Header />
      
      { }
      <main className="app-main container"> 
        <AppRouter />
      </main>
      
      <Footer />
    </div>
  );
}

export default App;