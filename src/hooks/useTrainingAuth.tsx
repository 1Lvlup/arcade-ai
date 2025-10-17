import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TrainingAuthContextType {
  isAuthenticated: boolean;
  adminKey: string | null;
  login: (key: string) => void;
  logout: () => void;
}

const TrainingAuthContext = createContext<TrainingAuthContextType | undefined>(undefined);

export function TrainingAuthProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState<string | null>(() => {
    return localStorage.getItem('training_admin_key');
  });

  const isAuthenticated = !!adminKey;

  const login = (key: string) => {
    localStorage.setItem('training_admin_key', key);
    setAdminKey(key);
  };

  const logout = () => {
    localStorage.removeItem('training_admin_key');
    setAdminKey(null);
  };

  return (
    <TrainingAuthContext.Provider value={{ isAuthenticated, adminKey, login, logout }}>
      {children}
    </TrainingAuthContext.Provider>
  );
}

export function useTrainingAuth() {
  const context = useContext(TrainingAuthContext);
  if (context === undefined) {
    throw new Error('useTrainingAuth must be used within a TrainingAuthProvider');
  }
  return context;
}
