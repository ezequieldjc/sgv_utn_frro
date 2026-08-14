import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

interface Props {
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { usuario, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  return children;
};
