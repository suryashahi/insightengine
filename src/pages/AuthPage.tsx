import React, { useState } from "react";
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, KeyRound, ExternalLink } from "lucide-react";
import { api } from "../services/api";
import { User } from "../types";

interface AuthPageProps {
  onAuthSuccess: (user: User, token: string) => void;
  onBackToLanding: () => void;
}

export default function AuthPage({ onAuthSuccess, onBackToLanding }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [etherealUrl, setEtherealUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Authentication Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        // Log in
        const res = await api.login({ email, password });
        localStorage.setItem("token", res.token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onAuthSuccess(res.user, res.token);
      } else {
        // Register brand-new
        const res = await api.register({ email, password, name });
        localStorage.setItem("token", res.token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onAuthSuccess(res.user, res.token);
      }
    } catch (err: any) {
      console.error("Authentication failure:", err);
      setError(err?.message || "An unexpected security validation error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password Recovery Request Submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setEtherealUrl(null);
    setLoading(true);

    try {
      const res = await api.forgotPassword(email);
      setSuccessMessage(res.message);
      if (res.previewUrl) {
        setEtherealUrl(res.previewUrl);
      }
    } catch (err: any) {
      console.error("Password reset request error:", err);
      setError(err?.message || "Failed to trigger password recovery. Please verify your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020617] px-6 py-12 select-none">
      {/* Dynamic blurred blobs */}
      <div className="absolute top-[20%] left-[25%] w-[400px] h-[400px] rounded-full aurora-blob-1 -z-10" />
      <div className="absolute bottom-[20%] right-[25%] w-[400px] h-[400px] rounded-full aurora-blob-2 -z-10" />

      <div className="w-full max-w-md relative">
        {/* Back Link Header */}
        <button
          onClick={onBackToLanding}
          className="absolute -top-12 left-0 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
        >
          ← Go back home
        </button>

        {/* Card Panel */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800/60 shadow-2xl">
          {/* Logo Heading */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20 mb-4 cursor-pointer">
              {isForgotPassword ? (
                <KeyRound className="w-5 h-5 text-white animate-pulse" />
              ) : (
                <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
              {isForgotPassword
                ? "Recover Password"
                : isLogin
                ? "Welcome back"
                : "Create your account"}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              {isForgotPassword
                ? "Provide your email address below to trace your account credentials and establish a secure password update."
                : isLogin
                ? "Enter your credentials to access your document semantic vault."
                : "Register a secure research profile to begin loading and vectorizing documents."}
            </p>
          </div>

          {/* Form Area */}
          {isForgotPassword ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
              {/* Field: Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Status alerts */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium space-y-2">
                  <p>{successMessage}</p>
                </div>
              )}

              {/* Ethereal Mail fallback links for visual testing and seamless support validation */}
              {etherealUrl && (
                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs text-center font-medium">
                  <p className="mb-2 font-bold uppercase tracking-wider text-[10px] text-indigo-400">Sandbox Preview Outbox</p>
                  <p className="mb-2 text-[11px]">Since custom SMTP is unconfigured, the verification was generated in Ethereal Sandbox.</p>
                  <a
                    href={etherealUrl}
                    target="_blank"
                    rel="no-referrer"
                    className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
                  >
                    Open Mailbox Preview <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide glass-button-primary flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
                ) : (
                  <>
                    Send Recovery Email
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Go back to Login */}
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError(null);
                    setSuccessMessage(null);
                    setEtherealUrl(null);
                  }}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                >
                  ← Keep current password (Sign In)
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Field: Name */}
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Field: Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Field: Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Password Reset Trigger Link */}
              {isLogin && (
                <div className="text-center !mt-[14px] !mb-[22px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                      setSuccessMessage(null);
                      setEtherealUrl(null);
                    }}
                    className="text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              {/* Handle Error displays */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide glass-button-primary flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-purple-600 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Access Vault" : "Activate Profile"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Toggle Button */}
          {!isForgotPassword && (
            <div className="mt-6 text-center text-xs">
              <span className="text-slate-400">
                {isLogin ? "Don't have an account yet?" : "Already have an account?"}{" "}
              </span>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setError(null);
                }}
                className="font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
              >
                {isLogin ? "Create one" : "Sign in here"}
              </button>
            </div>
          )}
        </div>

        {/* Security Compliance Seal */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-500" /> Cryptographic secure data transmission active
        </div>

      </div>
    </div>
  );
}
