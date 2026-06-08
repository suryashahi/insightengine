import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import { api } from "../services/api";

interface ResetPasswordPageProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ResetPasswordPage({ token, onSuccess, onCancel }: ResetPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long for security compliance.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please ensure both fields are identical.");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword({ token, password });
      setResetCompleted(true);
    } catch (err: any) {
      console.error("Password reset failure:", err);
      setError(err?.message || "Invalid, expired, or already used password reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020617] px-6 py-12 select-none w-screen h-screen overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[20%] left-[25%] w-[400px] h-[400px] rounded-full aurora-blob-1 -z-10" />
      <div className="absolute bottom-[20%] right-[25%] w-[400px] h-[400px] rounded-full aurora-blob-2 -z-10" />

      <div className="w-full max-w-md relative">
        <div className="glass-panel p-8 rounded-3xl border border-slate-800/60 shadow-2xl relative">
          
          {resetCompleted ? (
            /* Success State */
            <div className="text-center py-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3">
                Password Reset Successfully
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-8 max-w-sm">
                Your new security password hashes have been encrypted and saved. You can now use your updated credentials to open your RAG Semantic Vault.
              </p>
              
              <button
                onClick={onSuccess}
                className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide glass-button-primary flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                Proceed to Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Password Input Form */
            <div>
              <div className="flex flex-col items-center text-center mb-8">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20 mb-4">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                  Update Password
                </h2>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Establish a secure new password for your account profile. Older sessions will be invalidated.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Field: New Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">New Password</label>
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

                {/* Field: Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Handle Errors */}
                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
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
                      Confirm New Password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Cancel Reset operation */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel and visit login page
                </button>
              </div>
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
