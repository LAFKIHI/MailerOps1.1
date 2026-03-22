import React from 'react';
import * as LucideIcons from 'lucide-react';

interface AppIconProps {
  name: keyof typeof LucideIcons;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const AppIcon: React.FC<AppIconProps> = ({ name, size = 18, className, style }) => {
  const IconComponent = LucideIcons[name] as React.ElementType;
  
  if (!IconComponent) {
    return null;
  }

  return <IconComponent size={size} className={className} style={style} />;
};

export default AppIcon;
