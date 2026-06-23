'use client';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  ChevronRight,
  ArrowRight,
  FileSpreadsheet,
  ShieldCheck,
  Building,
  Mail,
  User,
  TrendingUp,
  Award,
  Sparkles,
  BookOpen,
  Zap
} from 'lucide-react';
import { api, Department } from '@/lib/api';

export default function Home() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(api.getCurrentUser());
    const fetchDepts = async () => {
      try {
        const data = await api.getPublicDepartments();
        setDepartments(data);
      } catch (err) {
        console.error('Failed to load departments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDepts();
  }, []);

  const features = [
    {
      icon: <GraduationCap className="h-6 w-6 text-sky-400" />,
      title: "Instant GPA Calculator",
      desc: "Select courses from the curriculum catalog and enter grades for instant, accurate GPA calculations.",
      gradient: "from-sky-500/15 to-sky-600/5",
      border: "border-sky-500/15",
      glow: "hover:shadow-sky-500/12"
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-blue-400" />,
      title: "CGPA Tracking",
      desc: "Track cumulative academic performance across all semesters with comprehensive CGPA computation and PDF reports.",
      gradient: "from-blue-500/15 to-blue-600/5",
      border: "border-blue-500/15",
      glow: "hover:shadow-blue-500/12"
    },
    {
      icon: <FileSpreadsheet className="h-6 w-6 text-amber-400" />,
      title: "Reports",
      desc: "Download certified rank lists and PDF summaries for department reviews, HOD reviews, and academic records.",
      gradient: "from-amber-500/15 to-amber-600/5",
      border: "border-amber-500/15",
      glow: "hover:shadow-amber-500/12"
    },
    {
      icon: <BookOpen className="h-6 w-6 text-emerald-400" />,
      title: "Syllabus Catalog",
      desc: "Regulation-wise subject catalog with credits management for R21, R25, and upcoming regulations.",
      gradient: "from-emerald-500/15 to-emerald-600/5",
      border: "border-emerald-500/15",
      glow: "hover:shadow-emerald-500/12"
    }
  ];

  const stats = [
    { value: "8+", label: "Departments" },
    { value: "8",  label: "Semesters"  },
    { value: "100%", label: "Accurate" },
    { value: "PDF", label: "Reports"   },
  ];

  return (
    <div className="bg-[#040f24] overflow-x-hidden min-h-screen text-white">

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-16 flex items-center justify-center overflow-hidden">
        {/* Background orbs */}
        <div className="orb orb-sky w-[550px] h-[550px] top-16 left-1/2 -translate-x-1/2 opacity-55" />
        <div className="orb orb-blue w-[320px] h-[320px] top-1/3 left-1/4 opacity-35" style={{animationDelay:'2s'}} />
        <div className="orb orb-emerald w-[260px] h-[260px] top-1/3 right-1/4 opacity-25" style={{animationDelay:'4s'}} />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-8 animate-fade-in-down">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            Ramco Institute of Technology — Academic Portal
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-4 animate-fade-in-up font-['Outfit']">
            Academic{' '}
            <span className="gradient-text animate-glow-text">GPA &amp; CGPA</span>{' '}
            Portal
          </h1>

          <p className="text-sm md:text-base text-sky-200/50 max-w-2xl mx-auto leading-relaxed mb-8 animate-fade-in animate-delay-100">
            A professional grading portal for precise GPA and CGPA calculations, regulation-wise subject management,
            verification-ready reports, and department analytics for staff and administrators.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12 animate-fade-in animate-delay-200">
            <Link
              to="/calculator/gpa"
              id="gpa-calc-btn"
              className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/25 transition-all duration-200 hover:-translate-y-1 hover:shadow-sky-500/40 text-sm"
            >
              <GraduationCap className="h-5 w-5" />
              <span>GPA Calculator</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/calculator/cgpa"
              id="cgpa-calc-btn"
              className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3 bg-white/[0.05] hover:bg-white/[0.09] text-white border border-sky-500/22 hover:border-sky-400/40 rounded-xl font-bold transition-all duration-200 hover:-translate-y-1 text-sm"
            >
              <TrendingUp className="h-5 w-5 text-sky-400" />
              <span>CGPA Calculator</span>
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-in animate-delay-300">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="glass-card-premium rounded-2xl p-4 text-center hover:-translate-y-1 transition-transform duration-200"
              >
                <div className="display-number text-3xl font-black mb-0.5 gradient-text">{stat.value}</div>
                <div className="text-xs text-sky-300/55 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/8 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-14 animate-fade-in animate-delay-100">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-widest mb-5">
              <Zap className="h-3.5 w-3.5" />
              Platform Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4 font-['Outfit']">
              Built for Academic Excellence
            </h2>
            <p className="text-sky-200/45 max-w-xl mx-auto text-sm leading-relaxed">
              Simple, accurate tools for students and faculty to compute and report academic performance with precision.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                style={{animationDelay: `${i * 80}ms`}}
                className={`group relative glass-card rounded-2xl p-6 hover:border-sky-500/28 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${f.glow} animate-fade-in-up`}
              >
                <div className={`bg-gradient-to-br ${f.gradient} border ${f.border} p-3 rounded-xl w-fit mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2 group-hover:text-sky-200 transition-colors font-['Outfit']">{f.title}</h3>
                <p className="text-sky-200/40 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Departments Section ── */}
      <section id="departments" className="py-20 relative scroll-mt-20">
        <div className="orb orb-blue w-[420px] h-[420px] top-1/2 right-0 -translate-y-1/2 opacity-25" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-widest mb-5">
              <Building className="h-3.5 w-3.5" />
              Academic Departments
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4 font-['Outfit']">
              Our Academic Ecosystem
            </h2>
            <p className="text-sky-200/45 max-w-xl mx-auto text-sm leading-relaxed">
              Explore departments and their Head of Department contacts.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[...Array(8)].map((_, idx) => (
                <div key={idx} className="skeleton rounded-2xl h-44" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {departments.map((dept, i) => (
                <div
                  key={dept._id}
                  style={{animationDelay: `${i * 60}ms`}}
                  className="group glass-card hover:border-sky-500/28 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between animate-fade-in-up hover:shadow-lg hover:shadow-sky-500/8"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="badge-indigo">{dept.code}</span>
                      <Building className="h-4 w-4 text-sky-400/40 group-hover:text-sky-400 transition-colors" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-200 transition-colors mb-1 leading-snug font-['Outfit']">
                      {dept.name}
                    </h3>
                  </div>

                  <div className="border-t border-sky-500/10 pt-3 mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-sky-300/60">
                      <User className="h-3 w-3 text-sky-400" />
                      <span>HOD: <span className="font-semibold text-white">{dept.hodName}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-sky-300/60">
                      <Mail className="h-3 w-3 text-sky-400" />
                      <a href={`mailto:${dept.email}`} className="hover:text-white transition-colors truncate">
                        {dept.email}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Admin CTA ── */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-[#040f24] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <div className="glass-card-premium rounded-3xl p-8 sm:p-10 animate-fade-in-up animate-pulse-glow">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full text-amber-400 text-xs font-semibold uppercase tracking-widest mb-6">
              <Award className="h-3.5 w-3.5" />
              Staff &amp; Administrators
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 font-['Outfit']">
              Access the Secure Staff Portal
            </h2>
            <p className="text-sky-200/45 max-w-lg mx-auto mb-8 text-sm leading-relaxed">
              Log in to manage department courses, view analytics, calculate GPA/CGPA, and generate reports.
            </p>
            <Link
              to={user
                ? (user.role === 'super_admin' ? "/dashboard"
                  : user.role === 'dept_admin' ? "/dashboard/staff"
                  : "/dashboard/subjects")
                : "/login"}
              id="admin-login-cta"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/25 transition-all duration-200 hover:-translate-y-1 hover:shadow-sky-500/40 text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Access Portal Dashboard</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
