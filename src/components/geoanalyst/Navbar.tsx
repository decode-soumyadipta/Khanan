'use client';

import React from 'react';
import { Menu, Globe, FileText, Mail, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const GeoAnalystNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <nav className="bg-[#16151D] shadow-xl border-b border-white/10 h-20">
      <div className="max-w-full px-4 sm:px-6 h-full">
        <div className="flex justify-between items-center h-full">
          {/* Government Branding */}
          <div className="flex items-center space-x-5">
            <div className="flex items-center space-x-3">
              <img
                src="https://doc.ux4g.gov.in/assets/img/icon/in-flag.png"
                alt="Indian flag"
                className="h-5 w-8 rounded-sm object-cover"
                loading="lazy"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold uppercase tracking-wider text-white">
                  Government of India
                </span>
                <span className="text-xs text-white/60 font-medium tracking-wide">
                  Ministry of Electronics & IT
                </span>
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-4 border-l border-white/10 pl-5">
              <img
                src="https://doc.ux4g.gov.in/assets/img/logo/national-emblem.png"
                alt="National emblem"
                className="h-10 w-auto"
                loading="lazy"
              />
              <img
                src="https://doc.ux4g.gov.in/assets/img/logo/company-logo.png"
                alt="Department logo"
                className="h-10 w-auto"
                loading="lazy"
              />
              <img
                src="https://doc.ux4g.gov.in/assets/img/logo/g20-summit.png"
                alt="G20 summit"
                className="h-10 w-auto"
                loading="lazy"
              />
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <a
              href="#dashboard"
              className="text-white/80 hover:text-white transition-colors duration-200 font-semibold text-sm uppercase tracking-wide flex items-center space-x-2 group"
            >
              <Globe size={16} className="text-white/70 group-hover:text-white transition-colors" />
              <span>Dashboard</span>
            </a>
            <a
              href="#about"
              className="text-white/80 hover:text-white transition-colors duration-200 font-semibold text-sm uppercase tracking-wide flex items-center space-x-2 group"
            >
              <FileText size={16} className="text-white/70 group-hover:text-white transition-colors" />
              <span>About</span>
            </a>
            <a
              href="#contact"
              className="text-white/80 hover:text-white transition-colors duration-200 font-semibold text-sm uppercase tracking-wide flex items-center space-x-2 group"
            >
              <Mail size={16} className="text-white/70 group-hover:text-white transition-colors" />
              <span>Contact</span>
            </a>

            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-white/15">
                <span className="text-white text-sm font-medium">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-white/80 hover:text-white transition-colors duration-200 font-semibold text-sm uppercase tracking-wide flex items-center space-x-2 group"
                >
                  <LogOut size={16} className="text-white/70 group-hover:text-white transition-colors" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="text-white/80 hover:text-white transition-colors duration-200 p-2"
            >
              <Menu size={24} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default GeoAnalystNavbar;
