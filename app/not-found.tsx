import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navigation />
      <main className="ft-container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="ft-mono text-sm uppercase tracking-[0.2em] text-ft-pink">404</p>
        <h1 className="ft-serif mt-4 text-4xl font-bold text-ft-black lg:text-5xl">
          Page not found
        </h1>
        <p className="ft-sans mt-3 max-w-md text-slate-600 leading-relaxed">
          The link you followed may be broken, or the page may have moved. If you arrived here from
          a link inside Graphletter, we&apos;d love to hear about it.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/try">Try the demo</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
