// apps/totem/src/components/DeliveryScreen.tsx

import React from 'react';
import QRCode from 'qrcode.react';

interface DeliveryScreenProps {
  sessionId: string;
}

const DeliveryScreen: React.FC<DeliveryScreenProps> = ({ sessionId }) => {
  // Cloud URL where the photo will be available
  const cloudUrl = `https://photobooth-saas.com/p/${sessionId}`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f0f4f8',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '3rem', color: '#2d3748', marginBottom: '1rem' }}>
        Obrigado! 📸
      </h1>
      
      <p style={{ fontSize: '1.5rem', color: '#4a5568', marginBottom: '2rem' }}>
        Sua foto está sendo impressa e subindo para a nuvem.
      </p>

      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '15px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <QRCode 
          value={cloudUrl} 
          size={256} 
          level="H"
          includeMargin={true}
        />
      </div>

      <p style={{ marginTop: '2rem', color: '#718096' }}>
        Escaneie para baixar sua foto digital
      </p>

      <div style={{ marginTop: '3rem', fontSize: '1.2rem', fontWeight: 'bold', color: '#3182ce' }}>
        Voltando ao início em instantes...
      </div>
    </div>
  );
};

export default DeliveryScreen;
