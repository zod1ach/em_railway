import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SignInPage } from '@/components/ui/sign-in';
import HeroWave from '@/components/ui/dynamic-wave-canvas-background';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState('');

  const handleSignIn = async (email: string, password: string) => {
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      return;
    }
    onLogin();
  };

  const handleCreateAccount = async (email: string, password: string) => {
    setError('');
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleResetPassword = async (email: string) => {
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (err) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        heroImageSrc="/images/plasma-ball-removebg-preview.png"
        leftBackground={<HeroWave />}
        rightBackground={<HeroWave />}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
        onResetPassword={handleResetPassword}
        error={error}
        clearError={() => setError('')}
      />
    </div>
  );
}
