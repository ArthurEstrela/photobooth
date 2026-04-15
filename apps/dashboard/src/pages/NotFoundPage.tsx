import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div className="text-center space-y-4">
      <p className="text-7xl font-black text-gray-200">404</p>
      <h1 className="text-xl font-semibold text-gray-900">Página não encontrada</h1>
      <p className="text-gray-500 text-sm">O endereço que você acessou não existe.</p>
      <Link
        to="/"
        className="inline-block mt-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Voltar ao início
      </Link>
    </div>
  </div>
);
