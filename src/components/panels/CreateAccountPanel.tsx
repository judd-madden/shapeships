/**
 * CREATE ACCOUNT PANEL
 * 
 * POST-ALPHA: Account Registration
 * Preserved but unreachable in Alpha v3
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface CreateAccountPanelProps {
  onNavigate: (panel: string) => void;
  onAccountCreated: () => void;
}

export function CreateAccountPanel({ onNavigate, onAccountCreated }: CreateAccountPanelProps) {
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
