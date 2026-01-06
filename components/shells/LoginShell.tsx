import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { usePlayer } from '../../game/hooks/usePlayer';

// ============================================================================
// LOGIN SHELL
// ============================================================================
// Canonical Shell for entry/authentication flows
// Owns layout for login area, swaps panels based on Alpha vs Post-Alpha
// ============================================================================

interface LoginShellProps {
  onNavigate: (destination: string) => void;
  onNameSubmit: (displayName: string) => void;
  onLogin: (userData: any) => void;
  alphaDisableAuth: boolean;
}

export function LoginShell({ onNavigate, onNameSubmit, onLogin, alphaDisableAuth }: LoginShellProps) {
  const [activePanel, setActivePanel] = useState('enterName');

  const renderPanel = () => {
    // Alpha v3: Only EnterNamePanel is accessible
    if (alphaDisableAuth) {
      return <EnterNamePanel onSubmit={onNameSubmit} />;
    }

    // Post-Alpha: Full auth flow
    switch (activePanel) {
      case 'enterName':
        return <EnterNamePanel onSubmit={onNameSubmit} />;
      case 'login':
        return <LoginPanel 
          onNavigate={setActivePanel} 
          onLogin={onLogin} 
        />;
      case 'createAccount':
        return <CreateAccountPanel 
          onNavigate={setActivePanel} 
          onAccountCreated={() => setActivePanel('login')} 
        />;
      case 'forgotPassword':
        return <ForgotPasswordPanel onNavigate={setActivePanel} />;
      default:
        return <EnterNamePanel onSubmit={onNameSubmit} />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
        {alphaDisableAuth && (
          <p className="text-shapeships-grey-20 text-sm mt-2">Alpha v3 - Session Play</p>
        )}
      </div>
      {renderPanel()}
    </div>
  );
}

// ============================================================================
// LOGIN SHELL PANELS
// ============================================================================

// ALPHA v3: EnterNamePanel (Session-Only Entry)
function EnterNamePanel({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { player } = usePlayer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = displayName.trim() || player?.name || 'Player';
    setLoading(true);
    onSubmit(finalName);
  };

  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardHeader>
        <CardTitle className="text-shapeships-grey-90">Enter Your Name</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm text-shapeships-grey-90">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={player?.name || "Your name"}
              className="w-full px-3 py-2 border border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
            />
            <p className="text-xs text-shapeships-grey-50 mt-1">
              Session only - not stored after you close the browser
            </p>
          </div>
          
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-shapeships-blue text-shapeships-white hover:bg-shapeships-blue/90"
          >
            {loading ? 'Entering...' : 'Continue to Menu'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// POST-ALPHA: LoginPanel (Email/Password Authentication)
// Preserved but unreachable in Alpha v3
function LoginPanel({ onNavigate, onLogin }: { onNavigate: (panel: string) => void; onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      onLogin(data.user);
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAsGuest = () => {
    onLogin({ id: 'guest', email: 'guest@local' });
  };

  return (
    <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
      <CardContent className="p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block mb-1 text-shapeships-grey-90">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
            />
          </div>
          
          <div>
            <label className="block mb-1 text-shapeships-grey-90">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
            />
          </div>
          
          <Button type="submit" disabled={loading} className="w-full bg-shapeships-blue text-shapeships-white hover:bg-shapeships-blue/90">
            {loading ? 'Processing...' : 'Login'}
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          <Button 
            variant="outline" 
            onClick={() => onNavigate('createAccount')} 
            className="w-full border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10"
          >
            Create Account
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handlePlayAsGuest} 
            className="w-full border-shapeships-pastel-blue text-shapeships-blue hover:bg-shapeships-pastel-blue/10"
          >
            Play as Guest
          </Button>
        </div>

        <div className="mt-4 text-center">
          <button 
            type="button"
            onClick={() => onNavigate('forgotPassword')}
            className="text-sm underline text-shapeships-grey-70 hover:text-shapeships-grey-90"
          >
            Forgot Password
          </button>
        </div>

        {message && (
          <div className="mt-4 p-3 rounded-md text-sm bg-shapeships-pastel-red/20 text-shapeships-red border border-shapeships-pastel-red/30">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// POST-ALPHA: CreateAccountPanel (Account Registration)
// Preserved but unreachable in Alpha v3
function CreateAccountPanel({ onNavigate, onAccountCreated }: { onNavigate: (panel: string) => void; onAccountCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (response.ok) {
        setMessage('Account created successfully!');
        setTimeout(() => {
          onAccountCreated();
        }, 2000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" onClick={() => onNavigate('login')} className="mb-4 border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10 bg-shapeships-white/90">
        Back to Login
      </Button>

      <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        <CardContent className="p-6">
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="block mb-1 text-shapeships-grey-90">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>

            <div>
              <label className="block mb-1 text-shapeships-grey-90">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-shapeships-grey-90">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>
            
            <Button type="submit" disabled={loading} className="w-full bg-shapeships-green text-shapeships-white hover:bg-shapeships-green/90">
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm border ${
              message.includes('Error') 
                ? 'bg-shapeships-pastel-red/20 text-shapeships-red border-shapeships-pastel-red/30' 
                : 'bg-shapeships-pastel-green/20 text-shapeships-green border-shapeships-pastel-green/30'
            }`}>
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// POST-ALPHA: ForgotPasswordPanel (Password Reset)
// Preserved but unreachable in Alpha v3
function ForgotPasswordPanel({ onNavigate }: { onNavigate: (panel: string) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) throw error;
      setMessage('Password reset email sent!');
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="outline" onClick={() => onNavigate('login')} className="mb-4 border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10 bg-shapeships-white/90">
        Back to Login
      </Button>

      <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        <CardContent className="p-6">
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block mb-1 text-shapeships-grey-90">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border-shapeships-grey-20 rounded-md bg-shapeships-white text-shapeships-grey-90"
              />
            </div>
            
            <Button type="submit" disabled={loading} className="w-full bg-shapeships-orange text-shapeships-white hover:bg-shapeships-orange/90">
              {loading ? 'Sending...' : 'Send Reset Email'}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm border ${
              message.includes('Error') 
                ? 'bg-shapeships-pastel-red/20 text-shapeships-red border-shapeships-pastel-red/30' 
                : 'bg-shapeships-pastel-green/20 text-shapeships-green border-shapeships-pastel-green/30'
            }`}>
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
