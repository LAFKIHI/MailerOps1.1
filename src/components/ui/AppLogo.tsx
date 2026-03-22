import React from 'react';

interface AppLogoProps {
  size?: number;
}

const AppLogo: React.FC<AppLogoProps> = ({ size = 32 }) => {
  return (
    <div 
      className="rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-black shadow-lg shadow-primary/25"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      M
    </div>
  );
};

export default AppLogo;
