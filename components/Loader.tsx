
import React from 'react';

interface LoaderProps {
  message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-8">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-50"></div>
        <div className="relative text-6xl animate-bounce">
          🎨
        </div>
        <div className="absolute -right-4 -top-4 text-4xl animate-bounce [animation-delay:0.2s]">
          ✨
        </div>
        <div className="absolute -left-4 -bottom-4 text-4xl animate-bounce [animation-delay:0.4s]">
          🌟
        </div>
      </div>
      <div className="bg-white px-6 py-4 rounded-2xl border-4 border-blue-200 shadow-lg -rotate-1">
        <p className="text-2xl md:text-3xl font-comic text-blue-600 text-center animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};

export default Loader;
