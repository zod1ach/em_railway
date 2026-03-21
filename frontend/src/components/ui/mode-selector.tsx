import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wifi, WifiOff, Eye, EyeOff, ArrowLeft } from "lucide-react";
import HeroWave from "@/components/ui/dynamic-wave-canvas-background";

export type AppMode = "offline" | "team";

type Phase = "choose" | "login";
type LoginView = "sign-in" | "create-account" | "reset-password" | "reset-sent" | "account-created";

interface ModeSelectorProps {
  onSelect: (mode: AppMode) => void;
  onSignIn?: (email: string, password: string) => Promise<void>;
  onCreateAccount?: (email: string, password: string) => Promise<void>;
  onResetPassword?: (email: string) => Promise<void>;
  authError?: string;
  clearAuthError?: () => void;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

export function ModeSelector({
  onSelect,
  onSignIn,
  onCreateAccount,
  onResetPassword,
  authError,
  clearAuthError,
}: ModeSelectorProps) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [loginView, setLoginView] = useState<LoginView>("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchLoginView = (v: LoginView) => {
    clearAuthError?.();
    setLoginView(v);
  };

  const goBack = () => {
    clearAuthError?.();
    setPhase("choose");
    setLoginView("sign-in");
    setShowPassword(false);
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await onSignIn?.(fd.get("email") as string, fd.get("password") as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await onCreateAccount?.(fd.get("email") as string, fd.get("password") as string);
      setLoginView("account-created");
    } catch {
      // error handled via prop
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await onResetPassword?.(fd.get("email") as string);
      setLoginView("reset-sent");
    } catch {
      // error handled via prop
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw] relative overflow-hidden bg-background cursor-none">
      {/* Wave background */}
      <div className="absolute inset-0 z-0">
        <HeroWave />
      </div>

      {/* ElectroFish logo — top left */}
      <img
        src="/images/electrofish.png"
        alt="ElectroFish"
        className="absolute top-6 left-8 h-[72px] w-auto z-20 opacity-80"
      />

      {/* Left column — animated content */}
      <section className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md relative z-10">
          <AnimatePresence mode="wait">
            {phase === "choose" ? (
              /* ── Mode selection cards ── */
              <motion.div
                key="choose"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div className="mb-10">
                  <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                    <span className="font-light text-foreground tracking-tighter">Get Started</span>
                  </h1>
                  <p className="text-text-secondary italic mt-2">
                    Choose how you want to work
                  </p>
                </div>

                <div className="flex flex-col gap-8">
                  {/* Work Offline */}
                  <div
                    onClick={() => onSelect("offline")}
                    className="group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl bg-white px-7 text-black shadow-2xl transition-all hover:scale-[1.02] cursor-pointer border-[3px] border-transparent hover:border-red-400/60 hover:shadow-[0_0_30px_rgba(248,113,113,0.25),0_0_60px_rgba(248,113,113,0.1)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-widest opacity-50 group-hover:opacity-70 group-hover:font-bold transition-all">
                        No account needed
                      </span>
                      <span className="text-lg font-bold tracking-tight">
                        Work Offline
                      </span>
                      <span className="text-[11px] opacity-40 font-medium group-hover:opacity-60 group-hover:font-bold transition-all">
                        Unlimited projects &middot; Stored in browser
                      </span>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                      <WifiOff className="h-4 w-4 pointer-events-none" />
                    </div>
                  </div>

                  {/* Work with Team */}
                  <div
                    onClick={() => {
                      clearAuthError?.();
                      setPhase("login");
                    }}
                    className="group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl bg-white px-7 text-black shadow-2xl transition-all hover:scale-[1.02] cursor-pointer border-[3px] border-transparent hover:border-red-400/60 hover:shadow-[0_0_30px_rgba(248,113,113,0.25),0_0_60px_rgba(248,113,113,0.1)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-widest opacity-50 group-hover:opacity-70 group-hover:font-bold transition-all">
                        Sign in to collaborate
                      </span>
                      <span className="text-lg font-bold tracking-tight">
                        Work with Team
                      </span>
                      <span className="text-[11px] opacity-40 font-medium group-hover:opacity-60 group-hover:font-bold transition-all">
                        Create one, join many &middot; Cloud synced
                      </span>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                      <Wifi className="h-4 w-4 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ── Login form (slides up) ── */
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {/* ---- SIGN IN ---- */}
                {loginView === "sign-in" && (
                  <div className="flex flex-col gap-6">
                    <button onClick={goBack} className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors w-fit">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                      <span className="font-light text-foreground tracking-tighter">Welcome</span>
                    </h1>
                    <p className="text-text-secondary italic">
                      Dive in, flux meets the fish!
                    </p>

                    <form className="space-y-5" onSubmit={handleSignIn}>
                      <div>
                        <label className="text-sm font-medium text-muted mb-1.5 block">Email Address</label>
                        <GlassInputWrapper>
                          <input name="email" type="email" placeholder="Enter your email address" autoFocus required
                            className="w-full bg-transparent text-sm text-foreground p-4 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                        </GlassInputWrapper>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted mb-1.5 block">Password</label>
                        <GlassInputWrapper>
                          <div className="relative">
                            <input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" required
                              className="w-full bg-transparent text-sm text-foreground p-4 pr-12 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                              {showPassword
                                ? <EyeOff className="w-5 h-5 text-muted hover:text-foreground transition-colors" />
                                : <Eye className="w-5 h-5 text-muted hover:text-foreground transition-colors" />}
                            </button>
                          </div>
                        </GlassInputWrapper>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name="rememberMe" className="w-4 h-4 rounded border-border accent-violet-400" />
                          <span className="text-foreground/90">Keep me signed in</span>
                        </label>
                        <button type="button" onClick={() => switchLoginView("reset-password")}
                          className="hover:underline text-violet-400 transition-colors">
                          Reset password
                        </button>
                      </div>

                      {authError && (
                        <p className="text-sm text-error flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-error" />
                          {authError}
                        </p>
                      )}

                      <button type="submit" disabled={loading}
                        className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Signing in...</> : "Sign In"}
                      </button>
                    </form>

                    <p className="text-center text-sm text-muted">
                      Don't have an account?{" "}
                      <button onClick={() => switchLoginView("create-account")} className="text-violet-400 hover:underline transition-colors">
                        Create Account
                      </button>
                    </p>
                  </div>
                )}

                {/* ---- CREATE ACCOUNT ---- */}
                {loginView === "create-account" && (
                  <div className="flex flex-col gap-6">
                    <button onClick={() => switchLoginView("sign-in")} className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors w-fit">
                      <ArrowLeft className="w-4 h-4" /> Back to sign in
                    </button>
                    <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                      <span className="font-light text-foreground tracking-tighter">Create Account</span>
                    </h1>
                    <p className="text-text-secondary">Set up your new account</p>

                    <form className="space-y-5" onSubmit={handleCreate}>
                      <div>
                        <label className="text-sm font-medium text-muted mb-1.5 block">Email Address</label>
                        <GlassInputWrapper>
                          <input name="email" type="email" placeholder="Enter your email address" autoFocus required
                            className="w-full bg-transparent text-sm text-foreground p-4 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                        </GlassInputWrapper>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted mb-1.5 block">Password</label>
                        <GlassInputWrapper>
                          <div className="relative">
                            <input name="password" type={showPassword ? "text" : "password"} placeholder="Create a password (min 6 characters)" required minLength={6}
                              className="w-full bg-transparent text-sm text-foreground p-4 pr-12 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                              {showPassword
                                ? <EyeOff className="w-5 h-5 text-muted hover:text-foreground transition-colors" />
                                : <Eye className="w-5 h-5 text-muted hover:text-foreground transition-colors" />}
                            </button>
                          </div>
                        </GlassInputWrapper>
                      </div>

                      {authError && (
                        <p className="text-sm text-error flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-error" />
                          {authError}
                        </p>
                      )}

                      <button type="submit" disabled={loading}
                        className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Creating...</> : "Create Account"}
                      </button>
                    </form>

                    <p className="text-center text-sm text-muted">
                      Already have an account?{" "}
                      <button onClick={() => switchLoginView("sign-in")} className="text-violet-400 hover:underline transition-colors">
                        Sign In
                      </button>
                    </p>
                  </div>
                )}

                {/* ---- ACCOUNT CREATED CONFIRMATION ---- */}
                {loginView === "account-created" && (
                  <div className="flex flex-col gap-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                      <span className="text-3xl">✓</span>
                    </div>
                    <h1 className="text-4xl font-semibold">
                      <span className="font-light text-foreground tracking-tighter">Check your email</span>
                    </h1>
                    <p className="text-text-secondary">
                      We've sent a confirmation link to your email address. Please click it to activate your account.
                    </p>
                    <button onClick={() => switchLoginView("sign-in")}
                      className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors">
                      Back to Sign In
                    </button>
                  </div>
                )}

                {/* ---- RESET PASSWORD ---- */}
                {loginView === "reset-password" && (
                  <div className="flex flex-col gap-6">
                    <button onClick={() => switchLoginView("sign-in")} className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors w-fit">
                      <ArrowLeft className="w-4 h-4" /> Back to sign in
                    </button>
                    <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                      <span className="font-light text-foreground tracking-tighter">Reset Password</span>
                    </h1>
                    <p className="text-text-secondary">Enter your email and we'll send you a reset link</p>

                    <form className="space-y-5" onSubmit={handleReset}>
                      <div>
                        <label className="text-sm font-medium text-muted mb-1.5 block">Email Address</label>
                        <GlassInputWrapper>
                          <input name="email" type="email" placeholder="Enter your email address" autoFocus required
                            className="w-full bg-transparent text-sm text-foreground p-4 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                        </GlassInputWrapper>
                      </div>

                      {authError && (
                        <p className="text-sm text-error flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-error" />
                          {authError}
                        </p>
                      )}

                      <button type="submit" disabled={loading}
                        className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Sending...</> : "Send Reset Link"}
                      </button>
                    </form>
                  </div>
                )}

                {/* ---- RESET SENT CONFIRMATION ---- */}
                {loginView === "reset-sent" && (
                  <div className="flex flex-col gap-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto">
                      <span className="text-3xl">✉</span>
                    </div>
                    <h1 className="text-4xl font-semibold">
                      <span className="font-light text-foreground tracking-tighter">Check your email</span>
                    </h1>
                    <p className="text-text-secondary">
                      If an account exists with that email, we've sent a password reset link.
                    </p>
                    <button onClick={() => switchLoginView("sign-in")}
                      className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors">
                      Back to Sign In
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Right column — logo + plasma ball */}
      <section className="hidden md:block flex-1 pointer-events-none">
        <img
          src="/images/Southampton_logo.png"
          alt="University of Southampton"
          className="absolute top-8 right-8 h-16 w-auto z-10 opacity-50 mix-blend-screen"
        />
        <img
          src="/images/plasma-ball-removebg-preview.png"
          alt="Electromagnetic plasma"
          className="absolute bottom-0 right-[5%] h-[67vh] w-auto z-10 drop-shadow-[0_0_60px_rgba(0,200,200,0.4)] opacity-70 mix-blend-screen pointer-events-none"
        />
      </section>
    </div>
  );
}
