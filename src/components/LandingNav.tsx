"use client";
import { Home, TrendingUp, Bot, LayoutDashboard } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"

const LandingNav = () => {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Trade', url: '/Trade', icon: TrendingUp },
    { name: 'Agent', url: '/Agent', icon: Bot },
    { name: 'Dashboard', url: '/Dashboard', icon: LayoutDashboard }
  ]

  return <NavBar items={navItems} />
}

export default LandingNav;
