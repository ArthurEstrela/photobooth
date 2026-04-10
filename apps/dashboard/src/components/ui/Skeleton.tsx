import React from 'react';

export interface SkeletonProps {
  className?: string;
  rows?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  rows = 1,
}) => {
  if (rows > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`h-4 bg-gray-100 rounded-lg animate-pulse ${i === rows - 1 ? 'w-3/4' : 'w-full'} ${className}`}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`bg-gray-100 rounded-lg animate-pulse ${className}`}
    />
  );
};
