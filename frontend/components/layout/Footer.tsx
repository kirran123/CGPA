import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Mail, Phone, MapPin, Globe } from 'lucide-react';
import FooterCredit from './FooterCredit';

export default function Footer() {
  return (
    <footer className="bg-[#030e1f] border-t border-sky-900/40 text-sky-200">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* RIT Branding */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                <img src="/rit-logo.jpg" alt="RIT Logo" className="h-11 w-11 object-contain" />
              </div>
              <span className="text-white font-bold text-xl tracking-wide font-['Outfit']">
                Ramco Institute of Technology
              </span>
            </div>
            <p className="text-sm text-sky-300/70 leading-relaxed max-w-xl">
              RIT is a prestigious institution committed to providing high-quality engineering education. 
              Our CGPA Calculator streamlines grade calculations and activity log analytics for students, 
              staff, and administrators.
            </p>
          </div>

          {/* Contact Details */}
          <div>
            <h3 className="text-white font-semibold text-base mb-4 tracking-wide">Contact Us</h3>
            <ul className="space-y-3.5 text-sm">
              <li className="flex gap-3 items-start">
                <MapPin className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                <span className="text-sky-300/70 leading-snug">
                  North Venganallur Village,<br />
                  Rajapalayam – 626 117,<br />
                  Virudhunagar District, Tamil Nadu.
                </span>
              </li>
              <li className="flex gap-3 items-center">
                <Phone className="h-5 w-5 text-sky-400 shrink-0" />
                <a href="tel:04563233400" className="text-sky-300/70 hover:text-white transition-colors duration-200">
                  04563 233400
                </a>
              </li>
              <li className="flex gap-3 items-center">
                <Mail className="h-5 w-5 text-sky-400 shrink-0" />
                <a href="mailto:rit@ritrjpm.ac.in" className="text-sky-300/70 hover:text-white transition-colors duration-200">
                  rit@ritrjpm.ac.in
                </a>
              </li>
              <li className="flex gap-3 items-center">
                <Globe className="h-5 w-5 text-sky-400 shrink-0" />
                <a
                  href="https://www.ritrjpm.ac.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-300/70 hover:text-white transition-colors duration-200"
                >
                  www.ritrjpm.ac.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider & Copyright */}
        <div className="border-t border-sky-900/40 mt-10 pt-6 text-center text-xs text-sky-400/50 space-y-2">
          <p>© {new Date().getFullYear()} Ramco Institute of Technology. All Rights Reserved.</p>
          <p>Developed for academic GPA &amp; CGPA performance tracking.</p>
          <FooterCredit className="border-t-0 py-0" />
        </div>
      </div>
    </footer>
  );
}
