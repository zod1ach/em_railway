import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

type View = 'sign-in' | 'create-account' | 'reset-password' | 'reset-sent' | 'account-created';

interface SignInPageProps {
  heroImageSrc?: string;
  leftBackground?: React.ReactNode;
  rightBackground?: React.ReactNode;
  onSignIn?: (email: string, password: string) => Promise<void>;
  onCreateAccount?: (email: string, password: string) => Promise<void>;
  onResetPassword?: (email: string) => Promise<void>;
  error?: string;
  clearError?: () => void;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

export const SignInPage: React.FC<SignInPageProps> = ({
  heroImageSrc,
  leftBackground,
  rightBackground,
  onSignIn,
  onCreateAccount,
  onResetPassword,
  error,
  clearError,
}) => {
  const [view, setView] = useState<View>('sign-in');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchView = (v: View) => {
    clearError?.();
    setView(v);
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await onSignIn?.(fd.get('email') as string, fd.get('password') as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await onCreateAccount?.(fd.get('email') as string, fd.get('password') as string);
      setView('account-created');
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
      await onResetPassword?.(fd.get('email') as string);
      setView('reset-sent');
    } catch {
      // error handled via prop
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw] relative overflow-hidden">
      {/* Single wave background spanning the entire page */}
      {leftBackground && <div className="absolute inset-0 z-0">{leftBackground}</div>}

      {/* ElectroFish logo — top left */}
      <img
        src="/images/electrofish.png"
        alt="ElectroFish"
        className="animate-element animate-delay-200 absolute top-6 left-8 h-[72px] w-auto z-20 opacity-80"
      />

      {/* Left column */}
      <section className="flex-1 flex items-center justify-center p-8 relative">

        <div className="w-full max-w-md relative z-10">
          {/* ---- SIGN IN ---- */}
          {view === 'sign-in' && (
            <div className="flex flex-col gap-6" key="sign-in">
              <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
                <span className="font-light text-foreground tracking-tighter">Welcome</span>
              </h1>
              <p className="animate-element animate-delay-200 text-text-secondary italic">
                Dive in, flux meets the fish!
              </p>

              <form className="space-y-5" onSubmit={handleSignIn}>
                <div className="animate-element animate-delay-300">
                  <label className="text-sm font-medium text-muted mb-1.5 block">Email Address</label>
                  <GlassInputWrapper>
                    <input name="email" type="email" placeholder="Enter your email address" autoFocus required
                      className="w-full bg-transparent text-sm text-foreground p-4 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                  </GlassInputWrapper>
                </div>
                <div className="animate-element animate-delay-400">
                  <label className="text-sm font-medium text-muted mb-1.5 block">Password</label>
                  <GlassInputWrapper>
                    <div className="relative">
                      <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" required
                        className="w-full bg-transparent text-sm text-foreground p-4 pr-12 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                        {showPassword
                          ? <EyeOff className="w-5 h-5 text-muted hover:text-foreground transition-colors" />
                          : <Eye className="w-5 h-5 text-muted hover:text-foreground transition-colors" />}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="rememberMe" className="w-4 h-4 rounded border-border accent-violet-400" />
                    <span className="text-foreground/90">Keep me signed in</span>
                  </label>
                  <button type="button" onClick={() => switchView('reset-password')}
                    className="hover:underline text-violet-400 transition-colors">
                    Reset password
                  </button>
                </div>

                {error && (
                  <p className="text-sm text-error flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading}
                  className="animate-element animate-delay-600 w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Signing in...</> : 'Sign In'}
                </button>
              </form>

              <p className="animate-element animate-delay-700 text-center text-sm text-muted">
                Don't have an account?{' '}
                <button onClick={() => switchView('create-account')} className="text-violet-400 hover:underline transition-colors">
                  Create Account
                </button>
              </p>
            </div>
          )}

          {/* ---- CREATE ACCOUNT ---- */}
          {view === 'create-account' && (
            <div className="flex flex-col gap-6" key="create">
              <button onClick={() => switchView('sign-in')} className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors w-fit">
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
                      <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password (min 6 characters)" required minLength={6}
                        className="w-full bg-transparent text-sm text-foreground p-4 pr-12 rounded-2xl focus:outline-none placeholder:text-muted/60" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                        {showPassword
                          ? <EyeOff className="w-5 h-5 text-muted hover:text-foreground transition-colors" />
                          : <Eye className="w-5 h-5 text-muted hover:text-foreground transition-colors" />}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                {error && (
                  <p className="text-sm text-error flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Creating...</> : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-sm text-muted">
                Already have an account?{' '}
                <button onClick={() => switchView('sign-in')} className="text-violet-400 hover:underline transition-colors">
                  Sign In
                </button>
              </p>
            </div>
          )}

          {/* ---- ACCOUNT CREATED CONFIRMATION ---- */}
          {view === 'account-created' && (
            <div className="flex flex-col gap-6 text-center" key="created">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                <span className="text-3xl">✓</span>
              </div>
              <h1 className="text-4xl font-semibold">
                <span className="font-light text-foreground tracking-tighter">Check your email</span>
              </h1>
              <p className="text-text-secondary">
                We've sent a confirmation link to your email address. Please click it to activate your account.
              </p>
              <button onClick={() => switchView('sign-in')}
                className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors">
                Back to Sign In
              </button>
            </div>
          )}

          {/* ---- RESET PASSWORD ---- */}
          {view === 'reset-password' && (
            <div className="flex flex-col gap-6" key="reset">
              <button onClick={() => switchView('sign-in')} className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors w-fit">
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

                {error && (
                  <p className="text-sm text-error flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" /> Sending...</> : 'Send Reset Link'}
                </button>
              </form>
            </div>
          )}

          {/* ---- RESET SENT CONFIRMATION ---- */}
          {view === 'reset-sent' && (
            <div className="flex flex-col gap-6 text-center" key="sent">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto">
                <span className="text-3xl">✉</span>
              </div>
              <h1 className="text-4xl font-semibold">
                <span className="font-light text-foreground tracking-tighter">Check your email</span>
              </h1>
              <p className="text-text-secondary">
                If an account exists with that email, we've sent a password reset link.
              </p>
              <button onClick={() => switchView('sign-in')}
                className="w-full rounded-2xl bg-foreground py-4 font-medium text-background hover:bg-foreground/90 transition-colors">
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Right column: logo + plasma ball */}
      <section className="hidden md:block flex-1 pointer-events-none">
        {/* University logo — top right */}
        <img
          src="/images/Southampton_logo.png"
          alt="University of Southampton"
          className="animate-element animate-delay-500 absolute top-8 right-8 h-16 w-auto z-10 opacity-50 mix-blend-screen"
        />
        {/* Plasma ball — bottom right */}
        {heroImageSrc && (
          <img
            src={heroImageSrc}
            alt="Electromagnetic plasma"
            className="animate-slide-right animate-delay-300 absolute bottom-0 right-[5%] h-[67vh] w-auto z-10 drop-shadow-[0_0_60px_rgba(0,200,200,0.4)] opacity-70 mix-blend-screen pointer-events-none"
          />
        )}
      </section>
    </div>
  );
};
