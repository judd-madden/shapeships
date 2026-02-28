/**
 * LOGIN PANEL
 * 
 * POST-ALPHA: Email/Password Authentication
 * Preserved but unreachable in Alpha v3
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { supabase } from '../../utils/supabase/client';

interface LoginPanelProps {
  onNavigate: (panel: string) => void;
  onLogin: (userData: any) => void;
}

export function LoginPanel({ onNavigate, onLogin }: LoginPanelProps) {
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
