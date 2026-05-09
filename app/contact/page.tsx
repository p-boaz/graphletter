import { Footer } from "@/components/footer";
import { Navigation } from "@/components/navigation";

export default function ContactPage() {
	return (
		<div className="min-h-screen bg-white">
			<Navigation />

			<section className="bg-gradient-to-br from-ft-cream to-white py-20">
				<div className="ft-container">
					<div className="max-w-4xl space-y-6">
						<h1
							className="ft-headline text-4xl lg:text-5xl"
							data-testid="contact-page-heading"
						>
							Contact Graphletter
						</h1>
						<p className="ft-sans text-lg text-slate-700 leading-relaxed">
							Need help with implementation, framework coverage, or product
							access? Use the channels below and include your organization,
							primary framework focus, and target timeline so we can route your
							request quickly.
						</p>
						<p
							className="ft-sans text-sm text-slate-600"
							data-testid="contact-response-time"
						>
							Typical response time: within 1 business day.
						</p>
					</div>
				</div>
			</section>

			<section className="py-16">
				<div className="ft-container">
					<div className="grid gap-6 md:grid-cols-3">
						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h2 className="ft-serif text-xl font-semibold text-ft-black">
								General Inquiries
							</h2>
							<p className="ft-sans mt-3 text-sm text-slate-600 leading-relaxed">
								Questions about Graphletter capabilities, roadmap, and setup.
							</p>
							<a
								href="mailto:hello@graphletter.com?subject=Graphletter%20Inquiry"
								className="mt-4 inline-flex text-ft-pink font-medium underline underline-offset-4 hover:text-ft-black transition-colors"
								data-testid="contact-email-general"
							>
								hello@graphletter.com
							</a>
						</div>

						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h2 className="ft-serif text-xl font-semibold text-ft-black">
								Product Demos
							</h2>
							<p className="ft-sans mt-3 text-sm text-slate-600 leading-relaxed">
								Request a walkthrough focused on your evidence workflow and
								compliance obligations.
							</p>
							<a
								href="mailto:hello@graphletter.com?subject=Graphletter%20Demo%20Request"
								className="mt-4 inline-flex text-ft-pink font-medium underline underline-offset-4 hover:text-ft-black transition-colors"
								data-testid="contact-email-demo"
							>
								Request a demo
							</a>
						</div>

						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h2 className="ft-serif text-xl font-semibold text-ft-black">
								Security Reports
							</h2>
							<p className="ft-sans mt-3 text-sm text-slate-600 leading-relaxed">
								Share responsible disclosures and security concerns with
								relevant context and reproduction details.
							</p>
							<a
								href="mailto:hello@graphletter.com?subject=Security%20Disclosure"
								className="mt-4 inline-flex text-ft-pink font-medium underline underline-offset-4 hover:text-ft-black transition-colors"
								data-testid="contact-email-security"
							>
								Send a security report
							</a>
						</div>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
}
