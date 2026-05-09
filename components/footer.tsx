"use client";

import Image from "next/image";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex h-16 w-16 items-center justify-center">
              <Image
                src="/logo.svg"
                alt="Graphletter Logo"
                width={64}
                height={64}
                className="h-16 w-16"
              />
            </div>
            <span className="ft-serif font-bold text-lg">Graphletter</span>
          </div>

          {/* Project */}
          <div className="space-y-3">
            <h4 className="ft-serif font-semibold text-sm uppercase tracking-wider text-slate-400">
              Project
            </h4>
            <div className="flex flex-col space-y-2">
              <Link
                href="/frameworks"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-frameworks"
              >
                Frameworks
              </Link>
              <Link
                href="/how-it-works"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-how-it-works"
              >
                How It Works
              </Link>
              <Link
                href="/try-it-out"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-try-it-out"
              >
                Try It Out
              </Link>
              <Link
                href="/research"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-research"
              >
                Research
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="ft-serif font-semibold text-sm uppercase tracking-wider text-slate-400">
              Contact
            </h4>
            <a
              href="mailto:hello@graphletter.com"
              className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
            >
              hello@graphletter.com
            </a>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="ft-serif font-semibold text-sm uppercase tracking-wider text-slate-400">
              Resources
            </h4>
            <div className="flex flex-col space-y-2">
              <Link
                href="/how-it-works"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-documentation"
              >
                Documentation
              </Link>
              <Link
                href="/privacy"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-privacy"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-terms"
              >
                Terms of Service
              </Link>
              <a
                href="https://status.graphletter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ft-sans text-slate-300 text-sm hover:text-white transition-colors"
                data-testid="footer-link-status"
              >
                Status
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-slate-800 border-t pt-8">
          <div className="ft-sans text-slate-500 text-sm">&copy; {currentYear} Graphletter</div>
        </div>
      </div>
    </footer>
  );
}
