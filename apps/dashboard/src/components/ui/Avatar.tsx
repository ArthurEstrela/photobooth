import React, { useState } from 'react';

export interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover ${sizes[size]} ${className}`}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-primary text-white flex items-center justify-center font-semibold ${sizes[size]} ${className}`}
    >
      {initials(name)}
    </div>
  );
};
