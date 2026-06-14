'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, Info, ShieldCheck } from 'lucide-react';

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setForm({ name: '', email: '', subject: '', message: '' });
      setSent(false);
      alert('Your query has been sent to RIT Academic Cell!');
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
          <ShieldCheck className="h-4 w-4" /> Academic Office Contact
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          Get in Touch with Academic Affairs
        </h1>
        <p className="mt-4 text-indigo-200/60 text-sm md:text-base leading-relaxed">
          Have questions regarding GPA calculation, subject code catalogs, credit allocations, or CGPA Calculator operations? Contact the RIT academic support wing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
        {/* Contact Info (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/[0.02] border border-indigo-500/10 rounded-3xl p-8 backdrop-blur-xl space-y-8">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-indigo-500/10 pb-3 flex items-center gap-2.5">
              <Info className="h-5.5 w-5.5 text-indigo-400" />
              RIT Contact Directory
            </h2>

            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="bg-indigo-500/10 p-3 rounded-2xl shrink-0 text-indigo-400">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Campus Address</h3>
                  <p className="text-indigo-200/65 text-sm leading-relaxed">
                    Ramco Institute of Technology,<br />
                    North Venganallur Village,<br />
                    Rajapalayam - 626117, Tamil Nadu.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-indigo-500/10 p-3 rounded-2xl shrink-0 text-indigo-400">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Academic Cell Numbers</h3>
                  <p className="text-indigo-200/65 text-sm leading-relaxed">
                    Office: +91-4563-263001<br />
                    Fax: +91-4563-263003
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-indigo-500/10 p-3 rounded-2xl shrink-0 text-indigo-400">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Official Inquiry Email</h3>
                  <a href="mailto:academic@ritrjpm.ac.in" className="text-indigo-400 hover:text-indigo-300 text-sm hover:underline">
                    academic@ritrjpm.ac.in
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Panel (3 Cols) */}
        <div className="lg:col-span-3">
          <div className="bg-white/[0.02] border border-indigo-500/10 rounded-3xl p-8 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-indigo-500/10 pb-3 flex items-center gap-2.5">
              <MessageSquare className="h-5.5 w-5.5 text-indigo-400" />
              Send Academic Query
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Name"
                    className="w-full bg-[#0d0736] border border-indigo-500/20 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="e.g. kishore@student.rit.edu.in"
                    className="w-full bg-[#0d0736] border border-indigo-500/20 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">Subject</label>
                <input 
                  type="text" 
                  required
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. GPA Calculation Discrepancy"
                  className="w-full bg-[#0d0736] border border-indigo-500/20 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">Query Message</label>
                <textarea 
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Describe your query in detail..."
                  className="w-full bg-[#0d0736] border border-indigo-500/20 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sent}
                className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all duration-300 disabled:opacity-50"
              >
                {sent ? (
                  <span>Dispatching Query...</span>
                ) : (
                  <>
                    <Send className="h-4.5 w-4.5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
