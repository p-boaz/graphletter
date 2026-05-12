"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FirstRunHero({ onUploadClick }: { onUploadClick?: () => void }) {
  return (
    <div
      className="rounded-2xl border border-ft-pink/30 bg-gradient-to-br from-ft-cream to-white p-8"
      data-testid="dashboard-first-run-hero"
    >
      <p className="ft-mono text-xs uppercase tracking-[0.2em] text-ft-pink">
        Welcome to Graphletter
      </p>
      <h2 className="ft-serif mt-3 text-2xl font-bold text-ft-black">
        Let&apos;s get your first control assessed.
      </h2>
      <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <FirstRunStep
          n={1}
          title="Upload a policy doc"
          body="A security policy, procedure, or standards document."
        />
        <FirstRunStep
          n={2}
          title="Pick an artifact type"
          body="Tells us which SCF controls to scope in."
        />
        <FirstRunStep
          n={3}
          title="See your first verdict"
          body="Pass / partial / fail with reasoning per objective."
        />
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        {onUploadClick ? (
          <Button onClick={onUploadClick} data-testid="first-run-upload-cta">
            Upload your first document
          </Button>
        ) : (
          <Button asChild data-testid="first-run-upload-cta">
            <Link href="/dashboard?upload=1">Upload your first document</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/try">Or run the sample demo first →</Link>
        </Button>
      </div>
    </div>
  );
}

function FirstRunStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="ft-mono text-xs text-ft-pink">STEP {n}</span>
      <h3 className="mt-1 font-semibold text-ft-black">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </li>
  );
}
