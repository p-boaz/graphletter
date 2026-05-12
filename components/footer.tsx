import Link from "next/link";
import { GITHUB_URL } from "@/lib/config/links";
const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-slate-200 border-t bg-white">
      <div className="ft-container py-8">
        <div className="ft-sans flex flex-col items-start gap-3 text-sm text-ft-black md:flex-row md:items-center md:justify-between">
          <div className="text-ft-black/70">Graphletter · MIT-licensed · © {CURRENT_YEAR}</div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/frameworks" className="hover:text-ft-pink">
              Frameworks
            </Link>
            <Link href="/research" className="hover:text-ft-pink">
              Research
            </Link>
            <Link href="/privacy" className="hover:text-ft-pink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ft-pink">
              Terms
            </Link>
            <Link href="/security" className="hover:text-ft-pink">
              Security
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ft-pink"
            >
              GitHub
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <a href="mailto:hello@graphletter.com" className="hover:text-ft-pink">
              hello@graphletter.com
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
