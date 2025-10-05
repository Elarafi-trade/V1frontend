/**
 * PairLogo Component
 * Displays a pair of crypto assets with their logos (e.g., BTC|SOL)
 * Styled similar to pear.garden
 */

import Image from 'next/image';

interface PairLogoProps {
  longSymbol: string;
  shortSymbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PairLogo({ 
  longSymbol, 
  shortSymbol, 
  size = 'md',
  className = '' 
}: PairLogoProps) {
  const sizeClasses = {
    sm: { img: 'w-4 h-4', text: 'text-xs', padding: 'px-2 py-1' },
    md: { img: 'w-5 h-5', text: 'text-sm', padding: 'px-2.5 py-1.5' },
    lg: { img: 'w-6 h-6', text: 'text-base', padding: 'px-3 py-2' },
  }[size];

  const imageSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  }[size];

  return (
    <div className={`
      flex items-center gap-1.5
      bg-gray-800/50 border border-gray-700 rounded-lg
      ${sizeClasses.padding}
      ${className}
    `}>
      {/* Long Asset */}
      <Image 
        src={`/${longSymbol.toLowerCase()}.png`}
        alt={longSymbol}
        width={imageSizes}
        height={imageSizes}
        className={`${sizeClasses.img} rounded-full`}
      />
      <span className={`font-medium ${sizeClasses.text}`}>
        {longSymbol}
      </span>
      
      {/* Divider */}
      <span className="text-gray-500 text-xs">|</span>
      
      {/* Short Asset */}
      <Image 
        src={`/${shortSymbol.toLowerCase()}.png`}
        alt={shortSymbol}
        width={imageSizes}
        height={imageSizes}
        className={`${sizeClasses.img} rounded-full`}
      />
      <span className={`font-medium ${sizeClasses.text}`}>
        {shortSymbol}
      </span>
    </div>
  );
}

