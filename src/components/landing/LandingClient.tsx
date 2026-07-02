"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  Shield, 
  User, 
  Users, 
  Layers, 
  FileText, 
  Calendar, 
  MessageSquare, 
  Heart, 
  ArrowRight, 
  CheckCircle, 
  Sparkles, 
  Lock, 
  ChevronRight, 
  Clock, 
  Stethoscope, 
  MapPin, 
  PhoneCall, 
  Laptop 
} from "lucide-react";

type BrandingConfig = {
  appName: string;
  slogan: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
};

type LandingConfig = {
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  featureCards: Array<{ title: string; description: string }>;
};

type OrgConfig = {
  orgName: string;
  legalName: string;
  website: string;
};

interface LandingClientProps {
  branding: BrandingConfig;
  landing: LandingConfig;
  org: OrgConfig;
  initialTab?: "patient" | "ehr";
}

export default function LandingClient({ branding, landing, org, initialTab = "patient" }: LandingClientProps) {
  const router = useRouter();
  
  // Tab Management: "patient" | "ehr"
  const [activeTab, setActiveTab] = useState<"patient" | "ehr">(initialTab);

  // Form states - Patient Portal
  const [mrn, setMrn] = useState("");
  const [dob, setDob] = useState("");
  const [patientError, setPatientError] = useState<string | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);

  // Form states - EHR Provider/Staff Portal
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ehrError, setEhrError] = useState<string | null>(null);
  const [ehrLoading, setEhrLoading] = useState(false);

  // Quick stats counter / live indicators
  const clinicStats = [
    { label: "Active Doctors & Staff", value: "24", icon: Users, color: "text-teal-600 bg-teal-50" },
    { label: "Average Wait Time", value: "< 8 Mins", icon: Clock, color: "text-emerald-600 bg-emerald-50" },
    { label: "Satisfied Patients", value: "99.4%", icon: Heart, color: "text-pink-600 bg-pink-50" },
    { label: "Lab Results Delivered", value: "14,280+", icon: Activity, color: "text-blue-600 bg-blue-50" },
  ];

  const services = [
    {
      title: "Primary & Family Care",
      desc: "Comprehensive check-ups, preventative care, and clinical oversight designed around you.",
      badge: "In-Office & Home Care",
      color: "from-teal-500 to-emerald-500"
    },
    {
      title: "Physical Therapy & Rehab",
      desc: "Targeted post-operative healing and personalized biomechanical recovery plans.",
      badge: "Orthopedic Focus",
      color: "from-emerald-500 to-teal-600"
    },
    {
      title: "Aesthetic Medicine & Wellness",
      desc: "Top-tier skin rejuvenation, laser treatments, PRP therapies, and custom medical wellness plans.",
      badge: "Aesthetic Excellence",
      color: "from-teal-600 to-cyan-600"
    },
    {
      title: "Advanced Wound Management",
      desc: "Hyperbaric clinical dressings, diabetic ulcer recovery, and dedicated vascular nursing.",
      badge: "Chronic & Acute Wound",
      color: "from-cyan-600 to-slate-700"
    }
  ];

  // Helper Demo Account quick-fills
  const demoPatients = [
    { name: "Eleanor Adams", mrn: "AC-100000", dob: "1958-04-12", age: "68", label: "Elderly Care" },
    { name: "Marcus Brown", mrn: "AC-100001", dob: "1979-09-30", age: "47", label: "Sports Rehab" },
    { name: "Sofia Chen", mrn: "AC-100002", dob: "1992-06-18", age: "34", label: "Aesthetics Consult" },
  ];

  const demoStaff = [
    { name: "Dr. Mariuska", role: "MD Provider", email: "mariuska.aristica@proactivemedical.com", pass: "apex123" },
    { name: "Front Desk Lopez", role: "Reception", email: "front.lopez@proactivemedical.com", pass: "apex123" },
    { name: "Administrator", role: "Admin Full", email: "admin@proactivemedical.com", pass: "apex123" },
    { name: "Nurse Kim", role: "Care Nurse", email: "nurse.kim@proactivemedical.com", pass: "apex123" },
  ];

  const fillPatient = (selectedMrn: string, selectedDob: string) => {
    setMrn(selectedMrn);
    setDob(selectedDob);
    setPatientError(null);
  };

  const fillStaff = (selectedEmail: string, selectedPass: string) => {
    setEmail(selectedEmail);
    setPassword(selectedPass);
    setEhrError(null);
  };

  async function handlePatientLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!mrn || !dob) {
      setPatientError("Please fill out both fields.");
      return;
    }
    setPatientLoading(true);
    setPatientError(null);

    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mrn: mrn.trim(), dob }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPatientError(data?.error ?? "Invalid Medical Record Number (MRN) or Date of Birth.");
        setPatientLoading(false);
        return;
      }

      router.push("/portal/dashboard");
      router.refresh();
    } catch {
      setPatientError("Connection issue. Please try again.");
      setPatientLoading(false);
    }
  }

  async function handleEhrLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setEhrError("Please enter your credentials.");
      return;
    }
    setEhrLoading(true);
    setEhrError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEhrError(data?.error ?? "Invalid email or security password.");
        setEhrLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setEhrError("Credentials verification timed out. Please try again.");
      setEhrLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-teal-200">
      
      {/* HEADER NAVBAR */}
      <header id="site-header" className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/powered-by-proactiveums-attached.png"
              alt="ProactiveClinics"
              className="h-10 sm:h-12 w-auto object-contain max-w-[240px] sm:max-w-[320px]"
              loading="eager"
            />
          </div>

          <div className="flex items-center gap-3">
            <a 
              href={`tel:${branding.supportPhone}`} 
              className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100/70 hover:bg-slate-100 px-3.5 py-2 rounded-lg transition-colors border border-slate-200"
            >
              <PhoneCall className="h-3.5 w-3.5 text-teal-600 animate-bounce" />
              <span>Immediate Support: {branding.supportPhone}</span>
            </a>
            
            <button 
              onClick={() => {
                const element = document.getElementById("auth-gateway");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-primary flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs sm:text-sm shadow-md shadow-teal-600/20"
            >
              <span>Access Portals</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION WITH DUAL PORTAL GATEWAY */}
      <section className="relative overflow-hidden pt-8 sm:pt-16 pb-12 sm:pb-24 bg-gradient-to-b from-slate-50 via-teal-50/20 to-white">
        {/* Floating gradient circles */}
        <div className="absolute -top-40 -left-40 h-[450px] w-[450px] rounded-full bg-teal-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute top-1/2 right-0 h-[400px] w-[400px] rounded-full bg-emerald-400/10 blur-[80px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            {/* LEFT COLUMN: BRAND PROPOSAL & LIVE STATS */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-100/50">
                <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                <span>Next-Generation Healthcare Management</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  {landing?.heroTitle ? (
                    landing.heroTitle
                  ) : (
                    <>
                      Your Health. <br className="hidden md:inline" />
                      <span className="bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 bg-clip-text text-transparent">
                        Unified & Connected.
                      </span>
                    </>
                  )}
                </h1>
                <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
                  {landing?.heroSubtitle || `Welcome to the digital nervous system of ${branding?.appName || "ProactiveClinics"}. Our patient-centered portal and provider EHR harmonize clinical documentation, real-time lab results routing, and care messaging into one beautifully streamlined experience.`}
                </p>
              </div>

              {/* LIVE OPS INDICATORS */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg">
                {clinicStats.map((stat, i) => {
                  const IconComponent = stat.icon;
                  return (
                    <div 
                      key={i} 
                      className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 sm:gap-3.5"
                    >
                      <div className={`p-2.5 rounded-lg ${stat.color} shrink-0`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{stat.value}</div>
                        <div className="text-[10px] sm:text-xs text-slate-500 font-medium">{stat.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* INTEGRATIONS PROOF BAR */}
              <div className="border-t border-slate-200/60 pt-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Licensed Outbound Diagnostics Network</p>
                <div className="flex flex-wrap items-center gap-4 text-slate-600 font-bold text-sm">
                  <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Labcorp Link & Web Services Active</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Real-time HL7 Parsing</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PORTAL LOGIN SYSTEM (THE EYE-CATCHING HUB) */}
            <div id="auth-gateway" className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 to-emerald-500/5 rounded-3xl blur-2xl" />
              
              <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                
                {/* INTERACTIVE TABS HEADER */}
                <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTab("patient");
                      setPatientError(null);
                      setEhrError(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold tracking-tight transition-all ${
                      activeTab === "patient"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
                    }`}
                  >
                    <User className={`h-4 w-4 ${activeTab === "patient" ? "text-teal-600" : ""}`} />
                    <span>Patient Portal</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("ehr");
                      setPatientError(null);
                      setEhrError(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold tracking-tight transition-all ${
                      activeTab === "ehr"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
                    }`}
                  >
                    <Laptop className={`h-4 w-4 ${activeTab === "ehr" ? "text-teal-600" : ""}`} />
                    <span>PortalEHR (Staff)</span>
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <AnimatePresence mode="wait">
                    {activeTab === "patient" ? (
                      <motion.div
                        key="patient-tab"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1">
                          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>Patient Portal Sign In</span>
                          </h2>
                          <p className="text-xs text-slate-500">
                            Enter your unique credentials to view appointments, test results, and message your doctor.
                          </p>
                        </div>

                        {/* PATIENT LOGIN FORM */}
                        <form onSubmit={handlePatientLogin} className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1" htmlFor="patient-mrn">
                              Medical Record Number (MRN)
                            </label>
                            <input
                              id="patient-mrn"
                              type="text"
                              className="input w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                              placeholder="e.g. AC-100000"
                              value={mrn}
                              onChange={(e) => setMrn(e.target.value)}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1" htmlFor="patient-dob">
                              Date of Birth
                            </label>
                            <input
                              id="patient-dob"
                              type="date"
                              className="input w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                              value={dob}
                              onChange={(e) => setDob(e.target.value)}
                              required
                            />
                          </div>

                          {patientError && (
                            <div className="rounded-xl bg-rose-50 text-rose-700 border border-rose-100 p-3 text-xs flex items-start gap-2">
                              <span className="font-bold text-rose-800 shrink-0">⚠️ Error:</span>
                              <span>{patientError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={patientLoading}
                            className="btn-primary w-full py-2.5 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-1.5 hover:shadow-lg transition-all"
                          >
                            {patientLoading ? (
                              <>
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Securing Connection…</span>
                              </>
                            ) : (
                              <>
                                <span>Access Patient Portal</span>
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        </form>

                        {/* QUICK ACCESS PATIENTS ACCORDION */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-teal-600" />
                            <span>Demo Patient Accounts (Fast Login)</span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                            {demoPatients.map((dp, i) => (
                              <button
                                key={i}
                                onClick={() => fillPatient(dp.mrn, dp.dob)}
                                type="button"
                                className={`flex items-center justify-between text-left p-2 rounded-lg text-xs border transition-all ${
                                  mrn === dp.mrn
                                    ? "bg-white border-teal-500 ring-2 ring-teal-500/10"
                                    : "bg-white/80 border-slate-200/60 hover:bg-white hover:border-slate-300"
                                }`}
                              >
                                <div>
                                  <span className="font-semibold text-slate-800">{dp.name}</span>
                                  <span className="text-[10px] text-slate-500 block">MRN: {dp.mrn} · DOB: {dp.dob}</span>
                                </div>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">
                                  {dp.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="ehr-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1">
                          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>PortalEHR Provider Suite</span>
                          </h2>
                          <p className="text-xs text-slate-500">
                            Authorized clinician and administrative access to clinical encounters, charting, scheduling, and billing systems.
                          </p>
                        </div>

                        {/* EHR STAFF LOGIN FORM */}
                        <form onSubmit={handleEhrLogin} className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1" htmlFor="staff-email">
                              Provider Email
                            </label>
                            <input
                              id="staff-email"
                              type="email"
                              className="input w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                              placeholder="email@proactivemedical.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1" htmlFor="staff-pass">
                              Security Password
                            </label>
                            <input
                              id="staff-pass"
                              type="password"
                              className="input w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                          </div>

                          {ehrError && (
                            <div className="rounded-xl bg-rose-50 text-rose-700 border border-rose-100 p-3 text-xs flex items-start gap-2">
                              <span className="font-bold text-rose-800 shrink-0">⚠️ Access Denied:</span>
                              <span>{ehrError}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={ehrLoading}
                            className="btn-primary w-full py-2.5 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-1.5 hover:shadow-lg transition-all"
                          >
                            {ehrLoading ? (
                              <>
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Authenticating Security Credentials…</span>
                              </>
                            ) : (
                              <>
                                <span>Sign In to EHR Portal</span>
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        </form>

                        {/* QUICK ACCESS STAFF ACCORDION */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-teal-600" />
                            <span>Clinical Staff Roles (Fast Sign In)</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            {demoStaff.map((staff, i) => (
                              <button
                                key={i}
                                onClick={() => fillStaff(staff.email, staff.pass)}
                                type="button"
                                className={`flex flex-col text-left p-2 rounded-lg text-[11px] border bg-white transition-all ${
                                  email === staff.email
                                    ? "border-teal-500 ring-2 ring-teal-500/10"
                                    : "border-slate-200/60 hover:border-slate-300"
                                }`}
                              >
                                <span className="font-bold text-slate-800 leading-tight truncate w-full">{staff.name}</span>
                                <span className="text-[10px] text-teal-700 font-medium">{staff.role}</span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 text-center leading-tight">
                            Demo password is <span className="font-mono bg-slate-200 px-1 py-0.2 rounded font-bold text-slate-600">apex123</span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DETAILED CLINICAL SERVICES AREA */}
      <section id="clinical-services" className="bg-white border-y border-slate-100 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 sm:mb-16">
            <span className="text-teal-600 text-xs font-bold uppercase tracking-widest">Medical Disciplines</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Integrated Specialties. Personalized Care.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              ProactiveClinics operate cohesive multidisciplinary centers. Through our patient portal, individuals instantly book, message, and view custom clinical encounter documentation across all departments.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {services.map((svc, i) => (
              <div 
                key={i} 
                className="group relative bg-slate-50/50 hover:bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 hover:border-teal-100 hover:shadow-lg hover:shadow-teal-600/5 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${svc.color} group-hover:w-20 transition-all`} />
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                    {svc.badge}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight group-hover:text-teal-600 transition-colors">
                    {svc.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {svc.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Referrals Integrated</span>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* VALUE PROP & FEATURES MATRIX (Care Intelligence) */}
      <section className="bg-gradient-to-b from-white via-slate-50/40 to-slate-50 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Visual Panel Mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-teal-400/20 to-emerald-400/10 rounded-2xl blur-3xl" />
              <div className="relative bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 border border-slate-800">
                
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-500" />
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-400 font-mono ml-2">proactive-system-core.sh</span>
                  </div>
                  <span className="text-[10px] text-teal-400 font-mono bg-teal-950 px-2 py-0.5 rounded-md border border-teal-800/50">
                    SECURE JWT SEC_V2
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-teal-400 bg-teal-950/40 border border-teal-900/30 p-2.5 rounded-lg">
                    <span>Clinical Outbound Labs Router</span>
                    <span className="animate-pulse">● LIVE</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed font-mono">
                    $ curl -X POST /api/orders/labcorp -H &quot;Authorization: EHR-Admin&quot; <br />
                    {"{"} ok: true, routed: 12, destination: &quot;Labcorp Link Web Services&quot; {"}"}
                  </p>
                </div>

                {/* Simulated HL7 patient record stream */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 font-mono text-[10px] sm:text-xs text-slate-300 space-y-1">
                  <div className="text-emerald-400">&gt; HL7_PARSER: Inbound lab report loaded from Labcorp.</div>
                  <div className="text-slate-500">PID|1||AC-100000||Adams^Eleanor||19580412|F</div>
                  <div className="text-slate-500">OBR|1||228301^Labcorp|||202607011210</div>
                  <div className="text-slate-500">OBX|1|NM|8462^Potassium||4.2|mmol/L|3.5-5.2|N</div>
                  <div className="text-teal-400 font-semibold">&gt; SUCCESS: Parsed report populated to Patient Eleanor Adams.</div>
                </div>

                {/* Patient self service alert */}
                <div className="bg-teal-950/40 border border-teal-900 p-3 rounded-lg flex items-center justify-between text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-teal-400" />
                    <span>Real-time Secure Messaging</span>
                  </div>
                  <span className="text-[10px] bg-teal-500 text-slate-950 font-bold px-2 py-0.5 rounded">Enabled</span>
                </div>

              </div>
            </div>

            {/* Structured Features Explanation */}
            <div className="space-y-6">
              <span className="text-teal-600 text-xs font-bold uppercase tracking-widest">Care Coordination Engine</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Unified Experience for Patients, Nurses, and Staff.
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                By combining clinical operations (EHR) with patient self-service (Patient Portal), ProactiveClinics dramatically improves clinical compliance, decreases missed sessions, and speeds up results delivery.
              </p>

              <div className="space-y-4">
                {landing?.featureCards && landing.featureCards.length > 0 ? (
                  landing.featureCards.map((card, idx) => (
                    <div key={idx} className="flex items-start gap-3.5">
                      <div className="p-1 rounded-full bg-teal-50 text-teal-600 mt-1 shrink-0">
                        <CheckCircle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{card.title}</h4>
                        <p className="text-xs sm:text-sm text-slate-500">{card.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-3.5">
                      <div className="p-1 rounded-full bg-teal-50 text-teal-600 mt-1 shrink-0">
                        <CheckCircle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Direct Patient Self-Scheduling</h4>
                        <p className="text-xs sm:text-sm text-slate-500">Patients securely select convenient appointment slots across categories like physical therapy, primary checkups, and aesthetic therapy.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="p-1 rounded-full bg-teal-50 text-teal-600 mt-1 shrink-0">
                        <CheckCircle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Automated Lab Routing to Labcorp</h4>
                        <p className="text-xs sm:text-sm text-slate-500">Providers transmit lab orders electronically via Labcorp Web Services with real-time tracking, receiving digital results directly into the medical chart.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3.5">
                      <div className="p-1 rounded-full bg-teal-50 text-teal-600 mt-1 shrink-0">
                        <CheckCircle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Encrypted Messaging & Document Exchange</h4>
                        <p className="text-xs sm:text-sm text-slate-500">Secure end-to-end patient-to-provider chats. Share instructions, lab result sheets, medical intake documents, and payment invoices.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CLINIC HOURS, LOCATION & MAP DETAILS */}
      <section className="bg-slate-900 text-slate-200 py-12 sm:py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-teal-400 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Main Headquarters Location</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pl-7">
                Proactive Medical Plaza<br />
                9500 Bandera Road, Suite 104<br />
                San Antonio, TX 78250
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-400 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Clinical & Telehealth Hours</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pl-7">
                Monday — Friday: 8:00 AM — 6:00 PM EST<br />
                Saturday (Urgent / Virtual Only): 9:00 AM — 2:00 PM EST<br />
                Sunday: Closed (24/7 Portal Message Intake Active)
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-teal-400 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">EHR Compliance & Security</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pl-7">
                Fully HIPAA compliant transmission frameworks. AES-256 data rest encryption, audited access logs, and mandatory multi-factor session handshakes.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-850 py-6 sm:py-8 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left space-y-1.5">
            <p className="text-sm font-bold text-slate-200">
              {org.orgName}
            </p>
            <p className="text-slate-500 leading-tight">
              Licensed healthcare services provider registered in the State of Florida. Legal name: {org.legalName}.
            </p>
            <p className="text-slate-500 leading-tight">
              Developer Support: <a href={`mailto:${branding.supportEmail}`} className="text-teal-400 hover:underline">{branding.supportEmail}</a> · Tel: {branding.supportPhone}
            </p>
          </div>

          <div className="text-center md:text-right space-y-2">
            <div className="flex justify-center md:justify-end gap-3 font-semibold text-slate-300">
              <button 
                onClick={() => {
                  const element = document.getElementById("auth-gateway");
                  element?.scrollIntoView({ behavior: "smooth" });
                  setActiveTab("patient");
                }}
                className="hover:text-teal-400 transition-colors"
              >
                Patient Login
              </button>
              <span>·</span>
              <button 
                onClick={() => {
                  const element = document.getElementById("auth-gateway");
                  element?.scrollIntoView({ behavior: "smooth" });
                  setActiveTab("ehr");
                }}
                className="hover:text-teal-400 transition-colors"
              >
                Clinical EHR Login
              </button>
            </div>
            <p className="text-slate-600 text-[10px] uppercase tracking-wider">
              © {new Date().getFullYear()} {org.legalName} · All Rights Reserved
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
