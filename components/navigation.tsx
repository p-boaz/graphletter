"use client";

import { BarChart3, LogOut, Menu, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { authUrl } from "@/lib/auth/auth-tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";

const MOBILE_NAV_SHEET_ID = "primary-mobile-navigation-sheet";
let lastClientPathname: string | null = null;
const isProtectedPath = (path: string | null) =>
  Boolean(path?.startsWith("/dashboard") || path?.startsWith("/profile"));

export function Navigation() {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const [awaitingAuthCarryover, setAwaitingAuthCarryover] = useState(
    () => isProtectedPath(lastClientPathname) && !isProtectedPath(pathname) && !loading && !user
  );
  const previousPathnameRef = useRef<string | null>(lastClientPathname);
  const supabase = createClient();
  const isProtectedRoute = isProtectedPath(pathname);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    if (isProtectedPath(previousPathname) && !isProtectedRoute && !loading && !user) {
      setAwaitingAuthCarryover(true);
    }
  }, [isProtectedRoute, loading, user]);

  useEffect(() => {
    if (!awaitingAuthCarryover) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAwaitingAuthCarryover(false);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [awaitingAuthCarryover]);

  useEffect(() => {
    if (user || loading || isProtectedRoute) {
      setAwaitingAuthCarryover(false);
    }
  }, [isProtectedRoute, loading, user]);

  useEffect(() => {
    previousPathnameRef.current = pathname;
    lastClientPathname = pathname;
  }, [pathname]);

  const showAuthLoadingState = loading || awaitingAuthCarryover || (isProtectedRoute && !user);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const navigationItems = [{ href: "/try", label: "Try" }];
  const GITHUB_URL = "https://github.com/p-boaz/graphletter";

  return (
    <header
      data-testid="primary-navigation"
      className="sticky top-0 z-50 w-full border-slate-200/80 border-b bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90"
    >
      <div className="ft-container py-2">
        <div className="ft-card flex h-20 items-center justify-between rounded-2xl border-2 border-ft-pink bg-white/90 px-6 shadow-lg backdrop-blur-md">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3" data-testid="nav-logo">
              <div className="flex h-20 w-20 items-center justify-center">
                <Image
                  src="/logo.svg"
                  alt="Graphletter Logo"
                  width={80}
                  height={80}
                  className="h-20 w-20"
                />
              </div>
              <span className="ft-serif text-2xl font-bold tracking-tight text-ft-black">
                Graphletter
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-6 md:flex">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`ft-nav-link text-base outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2 ${!isProtectedRoute && pathname === item.href ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-github"
              className="ft-nav-link text-base outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2"
            >
              GitHub
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {showAuthLoadingState ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || "/placeholder-user.jpg"}
                        alt={user.email || ""}
                      />
                      <AvatarFallback>{user.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="font-medium text-sm leading-none">
                        {user.user_metadata?.full_name || "User"}
                      </p>
                      <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth" className="text-slate-500">
                  Sign in
                </Link>
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-controls={MOBILE_NAV_SHEET_ID}
                  data-testid="nav-mobile-toggle"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                id={MOBILE_NAV_SHEET_ID}
                side="right"
                className="w-[300px] rounded-l-2xl border-l-2 border-ft-pink bg-white px-6 py-8 shadow-lg sm:w-[400px]"
              >
                <nav className="mt-8 flex flex-col space-y-6">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`ft-nav-link text-lg outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2 ${!isProtectedRoute && pathname === item.href ? "active" : ""}`}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="nav-mobile-github"
                    className="ft-nav-link text-lg outline-none focus-visible:ring-2 focus-visible:ring-ft-pink focus-visible:ring-offset-2"
                    onClick={() => setIsOpen(false)}
                  >
                    GitHub
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                  <div className="mt-6 flex flex-col space-y-3 border-slate-200 border-t pt-6">
                    <Link
                      href="/auth"
                      data-testid="nav-mobile-signin"
                      className="block rounded-md px-4 py-2 text-slate-700 hover:bg-slate-100"
                      onClick={() => setIsOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      href={authUrl("signup")}
                      data-testid="nav-mobile-signup"
                      className="block rounded-md bg-ft-pink px-4 py-2 text-center font-semibold text-white"
                      onClick={() => setIsOpen(false)}
                    >
                      Sign up free
                    </Link>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
