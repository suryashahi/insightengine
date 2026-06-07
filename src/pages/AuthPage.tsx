import React, { useState } from "react";
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../services/api";
import { User } from "../types";

interface AuthPageProps {
  onAuthSuccess: (user: User, token: string) => void;
  onBackToLanding: () => void;
}

export default function AuthPage({ onAuthSuccess, onBackToLanding }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        // Register standard Login request
        const res = await api.login({ email, password });
        localStorage.setItem("token", res.token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onAuthSuccess(res.user, res.token);
      } else {
        // Register standard Register request
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
              <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              {isLogin
                ? "Enter your credentials to access your document semantic vault."
                : "Register a secure research profile to begin loading and vectorizing documents."}
            </p>
          </div>

          {/* Form */}
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

            {/* Password Reset Structure Info */}
            {isLogin && (
              <div className="text-center !mt-[14px] !mb-[22px]">
                <button
                  type="button"
                  onClick={() => alert("Password reset workflow configuration: Please contact system support or register a new custom account.")}
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
                  {isLogin ? "Access Intelligence" : "Activate Secure Profile"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Button */}
          <div className="mt-6 text-center text-xs">
            <span className="text-slate-400">
              {isLogin ? "Don't have an account yet?" : "Already have an account?"}{" "}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            >
              {isLogin ? "Create one" : "Sign in here"}
            </button>
          </div>
        </div>

        {/* Security Compliance Seal */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-500" /> Cryptographic secure data transmission active
        </div>

      </div>
    </div>
  );
}
