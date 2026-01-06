/**
 * FORGOT PASSWORD PANEL
 * 
 * POST-ALPHA: Password Reset
 * Preserved but unreachable in Alpha v3
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { supabase } from '../../utils/supabase/client';

interface ForgotPasswordPanelProps {
  onNavigate: (panel: string) => void;
}

export function ForgotPasswordPanel({ onNavigate }: ForgotPasswordPanelProps) {
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
