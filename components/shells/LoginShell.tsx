/**
 * LOGIN SHELL
 * 
 * Canonical Shell for entry/authentication flows
 * Delegates to LoginScreen (Alpha v3) or auth panels (Post-Alpha)
 */

import React, { useState } from 'react';
import { LoginScreen } from '../../screens/LoginScreen';
import { EnterNamePanel } from '../panels/EnterNamePanel';
import { LoginPanel } from '../panels/LoginPanel';
import { CreateAccountPanel } from '../panels/CreateAccountPanel';
import { ForgotPasswordPanel } from '../panels/ForgotPasswordPanel';

interface LoginShellProps {
  onNavigate: (shell: string) => void;
  onNameSubmit: (displayName: string) => void;
  onLogin: (userData: any) => void;
  alphaDisableAuth: boolean;
}

export function LoginShell({ onNavigate, onNameSubmit, onLogin, alphaDisableAuth }: LoginShellProps) {
  // Alpha v3: Use canonical LoginScreen component
  if (alphaDisableAuth) {
    return <LoginScreen onPlay={onNameSubmit} />;
  }

  // Post-Alpha: Full auth flow with panels
  const [activePanel, setActivePanel] = useState('enterName');

  const renderPanel = () => {
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
      </div>
      {renderPanel()}
    </div>
  );
}
