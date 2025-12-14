import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import Profile from './components/Profile';
import VehicleForm from './components/VehicleForm';
import Header from './components/Header';
import Home from './components/Home';
import Admin from './components/Admin';
import './styles.css';

export default function App(){
  return (
    <div>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/vehicle" element={<VehicleForm />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  )
}
