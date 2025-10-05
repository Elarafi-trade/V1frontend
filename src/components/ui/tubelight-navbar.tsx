'use client';

import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
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

  // No theme changes here; dark mode is enforced at the root html

  return (
    <nav className={cn("fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full border backdrop-blur-lg bg-background/30 shadow-sm transition-all mx-auto max-w-5xl w-[90%]", className)}>
      <div className="container mx-auto flex justify-between items-center px-6 py-2">
        {/* Logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
          <Image 
            src="/ElaraFiLogo.png" 
            alt="ElaraFi Logo" 
            width={45} 
            height={45} 
            className="rounded-full object-cover"
          />
          <p className="text-white text-2xl font-bold">ElaraFi</p>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          {items.map((item: NavItem) => {
            const Icon = item.icon;
            const isActive = pathname === item.url;

            return (
              <Link
                key={item.name}
                href={item.url}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium rounded-full px-4 py-2 text-foreground/80 hover:bg-muted/50 transition-colors",
                  isActive && "text-purple-400 bg-purple-600/10"
                )}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Dark Mode Toggle */}
         

          {/* Wallet Button - only render on client to avoid hydration mismatch */}
          {mounted && (
            <WalletMultiButton
              style={{
                background: 'linear-gradient(to right, rgb(147, 51, 234), rgb(126, 34, 206))',
                color: 'white',
                fontWeight: 'bold'
              }}
              className={cn(
                "!rounded-full !bg-gradient-to-r !from-purple-600 !to-purple-700 !text-white hover:!from-purple-700 hover:!to-purple-800 !shadow-lg !shadow-purple-500/30",
                "!px-4 !py-2 !text-sm !font-bold !transition-all !border-none"
              )}
            />
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-full hover:bg-muted/50 transition-colors"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-14 mt-[20px] left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border/50 shadow-lg md:hidden rounded-xl">
          <div className="container mx-auto px-4 py-3">
            {items.map((item: NavItem) => {
              const Icon = item.icon;
              const isActive = pathname === item.url;

              return (
                <Link
                  key={item.name}
                  href={item.url}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50",
                    isActive && "text-purple-400 bg-purple-600/10"
                  )}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}

            {/* Wallet + Theme in Mobile */}
            <div className="mt-3 flex flex-col gap-2 px-4">
              {mounted && (
                <WalletMultiButton
                  style={{
                    background: 'linear-gradient(to right, rgb(147, 51, 234), rgb(126, 34, 206))',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  className={cn(
                    "!w-full !justify-center !rounded-full !bg-gradient-to-r !from-purple-600 !to-purple-700 !text-white hover:!from-purple-700 hover:!to-purple-800 !shadow-lg !shadow-purple-500/30",
                    "!px-4 !py-2 !text-sm !font-bold !transition-all !border-none"
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
