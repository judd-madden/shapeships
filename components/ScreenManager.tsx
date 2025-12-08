import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import globalAssets from '../graphics/global/assets';

export default function ScreenManager({ onSwitchToDevMode }) {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [user, setUser] = useState(null);

  const navigateToScreen = (screen) => {
    setCurrentScreen(screen);
  };

  const handleSuccessfulLogin = (userData) => {
    setUser(userData);
    setCurrentScreen('mainMenu');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentScreen('login');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onNavigate={navigateToScreen} onLogin={handleSuccessfulLogin} />;
      case 'createAccount':
        return <CreateAccountScreen onNavigate={navigateToScreen} onAccountCreated={() => navigateToScreen('login')} />;
      case 'forgotPassword':
        return <ForgotPasswordScreen onNavigate={navigateToScreen} />;
      case 'mainMenu':
        return <MainMenuScreen onNavigate={navigateToScreen} onLogout={handleLogout} user={user} />;
      default:
        return <LoginScreen onNavigate={navigateToScreen} onLogin={handleSuccessfulLogin} />;
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ 
        backgroundImage: `url(${globalAssets.spaceBackground})`,
        backgroundColor: '#000033'
      }}
    >
      <div className="fixed top-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onSwitchToDevMode}
          className="bg-shapeships-white shadow-md border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10"
        >
          🔧 Dev Mode
        </Button>
      </div>
      {renderScreen()}
    </div>
  );
}

function LoginScreen({ onNavigate, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
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
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAsGuest = () => {
    onLogin({ id: 'guest', email: 'guest@local' });
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
      </div>

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
    </div>
  );
}

function CreateAccountScreen({ onNavigate, onAccountCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateAccount = async (e) => {
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
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <Button variant="outline" onClick={() => onNavigate('login')} className="mb-4 border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10 bg-shapeships-white/90">
          Back to Login
        </Button>
        <h1 className="text-white drop-shadow-lg">Create Account</h1>
      </div>

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

function ForgotPasswordScreen({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) throw error;
      setMessage('Password reset email sent!');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <Button variant="outline" onClick={() => onNavigate('login')} className="mb-4 border-shapeships-grey-20 text-shapeships-grey-90 hover:bg-shapeships-grey-20/10 bg-shapeships-white/90">
          Back to Login
        </Button>
        <h1 className="text-white drop-shadow-lg">Forgot Password</h1>
      </div>

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

function MainMenuScreen({ onNavigate, onLogout, user }) {
  return (
    <div className="container mx-auto p-6 max-w-md">
      <div className="mb-8">
        <h1 className="text-white drop-shadow-lg">Shapeships</h1>
        <p className="text-white/90 drop-shadow-md">Welcome, {user?.user_metadata?.name || user?.email || 'Guest'}</p>
      </div>

      <div className="space-y-4">
        <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <CardHeader>
            <CardTitle className="text-shapeships-grey-90">Game Modes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full bg-shapeships-green text-shapeships-white hover:bg-shapeships-green/90" disabled>
              Quick Match
            </Button>
            
            <Button className="w-full bg-shapeships-blue text-shapeships-white hover:bg-shapeships-blue/90" disabled>
              Create Custom Game
            </Button>
            
            <Button className="w-full bg-shapeships-purple text-shapeships-white hover:bg-shapeships-purple/90" disabled>
              Join Game by Code
            </Button>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <CardHeader>
            <CardTitle className="text-shapeships-grey-90">Game Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full border-shapeships-grey-20 text-shapeships-grey-70 hover:bg-shapeships-grey-20/10" disabled>
              How to Play
            </Button>
            
            <Button variant="outline" className="w-full border-shapeships-grey-20 text-shapeships-grey-70 hover:bg-shapeships-grey-20/10" disabled>
              Faction Guide
            </Button>
            
            <Button variant="outline" className="w-full border-shapeships-grey-20 text-shapeships-grey-70 hover:bg-shapeships-grey-20/10" disabled>
              Settings
            </Button>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-sm border-shapeships-grey-20/30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <CardContent className="p-4">
            <Button variant="outline" onClick={onLogout} className="w-full border-shapeships-red text-shapeships-red hover:bg-shapeships-pastel-red/10">
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}