'use client';

import { usePathname } from 'next/navigation';
import { Menu, Bell, Globe } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

type NavItem = {
  name: string;
  url: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

export function NavBar({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render wallet button after client-side hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className={cn("fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-xl bg-black/30 supports-[backdrop-filter]:bg-black/30 border-b border-white/10 px-6 md:px-8 lg:px-8 py-1.5 transition-all duration-300 ease-in-out", className)}>
      <div className="flex items-center justify-between w-full gap-8">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 cursor-pointer">
            <Image 
              src="/ElaraFiLogo.png" 
              alt="ElaraFi Logo" 
              width={32} 
              height={32} 
              className="rounded-full object-cover"
            />
            <span className="text-white text-xl font-semibold">ElaraFi</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden min-[1140px]:flex items-center gap-6">
            {items.map((item: NavItem) => {
              const isActive = pathname === item.url;

              return (
                <a
                  key={item.name}
                  href={item.url}
                  className={cn(
                    "text-sm font-semibold px-2 py-1.5 bg-transparent hover:text-white transition-colors cursor-pointer",
                    isActive ? "text-white" : "text-[#717171]"
                  )}
                >
                  {item.name}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Right: Wallet + Icons */}
        <div className="flex items-center gap-2">
          

          {/* Wallet Button - purple style */}
          {mounted && (
            <WalletMultiButton
              className={cn(
                "!inline-flex !items-center !justify-center !whitespace-nowrap !transition-colors",
                "!shadow !cursor-pointer !bg-[#A855F7] hover:!bg-[#9333EA] !text-white",
                "!font-bold !text-sm !rounded-lg !px-3 sm:!px-6 !py-3 !h-[42px] !border-none"
              )}
            />
          )}

          {/* Notification Icon */}
          <div className="hidden min-[510px]:flex gap-2">
            <button className="flex relative bg-[#2a1a3a] hover:bg-[#3a2450] rounded-lg p-[9px] cursor-pointer w-[42px] h-[42px] items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </button>
            
            {/* Globe/Language Icon */}
            <button className="flex relative bg-[#2a1a3a] hover:bg-[#3a2450] rounded-lg p-[9px] cursor-pointer w-[42px] h-[42px] items-center justify-center">
              <Globe className="w-5 h-5" style={{ color: '#A855F7' }} />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex min-[1140px]:hidden bg-[#2a1a3a] hover:bg-[#3a2450] rounded-lg p-[9px] cursor-pointer w-[42px] h-[42px] items-center justify-center"
          >
            <Menu className="h-5 w-5 text-white" />
          </button>
        </div>
        
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 backdrop-blur-xl bg-black/40 supports-[backdrop-filter]:bg-black/40 border-t border-white/10 shadow-lg min-[1140px]:hidden">
          <div className="px-4 py-3">
            {items.map((item: NavItem) => {
              const isActive = pathname === item.url;

              return (
                <a
                  key={item.name}
                  href={item.url}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "block px-4 py-3 text-sm font-semibold rounded-lg hover:bg-[#1C221C] transition-colors cursor-pointer",
                    isActive ? "text-white bg-[#1C221C]" : "text-[#717171]"
                  )}
                >
                  {item.name}
                </a>
              );
            })}

            {/* Mobile Wallet Button */}
            <div className="mt-3 px-4">
              {mounted && (
                <WalletMultiButton
                  className={cn(
                    "!w-full !justify-center !bg-[#A2DB5C] hover:!bg-[#8cc745]",
                    "!text-black !font-bold !text-sm !rounded-lg !px-6 !py-3 !h-[42px] !border-none"
                  )}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
