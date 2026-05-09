export function getFrameworkDescription(frameworkName: string): string {
	const normalizedName = frameworkName.toLowerCase();

	if (normalizedName.includes("hipaa")) {
		return "Healthcare privacy and security safeguards for protecting PHI across administrative, physical, and technical controls.";
	}

	if (normalizedName.includes("pci dss")) {
		return "Payment card security requirements for merchants and service providers handling cardholder data environments.";
	}

	if (normalizedName.includes("nist 800-53")) {
		return "Federal security and privacy control baseline for information systems and high-assurance governance programs.";
	}

	if (normalizedName.includes("nist 800-171")) {
		return "Protection requirements for controlled unclassified information in nonfederal systems and contractor environments.";
	}

	if (normalizedName.includes("soc 2")) {
		return "Trust Services Criteria focused on security, availability, processing integrity, confidentiality, and privacy assurance.";
	}

	if (normalizedName.includes("iso 27001")) {
		return "ISMS management-system requirements for risk treatment, control design, and continual security improvement.";
	}

	if (normalizedName.includes("gdpr")) {
		return "EU privacy obligations for lawful processing, data-subject rights, and accountability across personal data lifecycles.";
	}

	if (normalizedName.includes("ccm") || normalizedName.includes("csa")) {
		return "Cloud security control framework for shared-responsibility architecture, assurance, and third-party risk reduction.";
	}

	if (normalizedName.includes("cis")) {
		return "Prescriptive cybersecurity safeguards for hardening systems, reducing attack paths, and improving control maturity.";
	}

	return `${frameworkName} requirements normalized to SCF controls for consistent evidence assessment and cross-framework traceability.`;
}
