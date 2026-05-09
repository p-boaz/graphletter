"use client";

import { DemoSmartEvidenceUpload } from "@/components/demo-smart-evidence-upload";
import { SmartEvidenceUpload } from "@/components/smart-evidence-upload";
import { useAuth } from "@/lib/auth/auth-context";

export function TryItOutContent() {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
			</div>
		);
	}

	// Authenticated: show full upload flow
	if (user) {
		return (
			<>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
						<p className="font-semibold text-ft-black text-sm">
							1) Select artifact
						</p>
						<p className="mt-2 text-slate-600 text-sm">
							Pick the documentation artifact to scope control assessment.
						</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
						<p className="font-semibold text-ft-black text-sm">
							2) Upload evidence
						</p>
						<p className="mt-2 text-slate-600 text-sm">
							Upload policy/procedure files and extract text for graph mapping.
						</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
						<p className="font-semibold text-ft-black text-sm">
							3) Run assessment
						</p>
						<p className="mt-2 text-slate-600 text-sm">
							Start AI assessment across discovered SCF controls.
						</p>
					</div>
				</div>

				<div className="rounded-2xl border border-ft-pink/30 bg-white p-6 shadow-sm">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="max-w-2xl space-y-2">
							<h2 className="ft-serif text-2xl font-bold text-ft-black">
								Start Real Upload
							</h2>
							<p className="ft-sans text-slate-700 leading-relaxed">
								Open the real Smart Evidence Upload dialog and run the live
								workflow.
							</p>
						</div>
						<SmartEvidenceUpload />
					</div>
				</div>
			</>
		);
	}

	// Unauthenticated: show demo flow
	return (
		<div className="rounded-2xl border border-ft-pink/30 bg-white p-6 shadow-sm">
			<DemoSmartEvidenceUpload />
		</div>
	);
}
