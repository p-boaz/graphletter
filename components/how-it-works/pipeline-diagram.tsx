export function PipelineDiagram() {
  const steps = [
    { n: 1, t: "Upload", d: "A policy, procedure, or evidence file." },
    { n: 2, t: "Read", d: "We read your document and index every statement." },
    { n: 3, t: "Match to controls", d: "Your document type tells us which controls to check." },
    { n: 4, t: "AI assess", d: "Objectives evaluated with reasoning." },
    { n: 5, t: "Score", d: "Evidence strength rolled up per control." },
    { n: 6, t: "Coverage report", d: "Gaps + recommendations per framework." },
  ];
  return (
    <ol
      data-testid="pipeline-diagram"
      className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
    >
      {steps.map((s, i) => (
        <li
          key={s.n}
          className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4"
        >
          <span className="ft-mono text-xs text-ft-pink">STEP {s.n}</span>
          <h3 className="mt-1 break-words font-semibold text-ft-black">{s.t}</h3>
          <p className="mt-1 break-words text-xs text-slate-600">{s.d}</p>
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-[-10px] hidden -translate-y-1/2 text-slate-400 lg:block"
            >
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
