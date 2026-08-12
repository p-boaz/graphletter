# Probe eyeball sheet v2 — production-path run (22-08 revision)

Rendered from scripts/out/assessment-probe-2026-07-08T22-08-13-621Z.jsonl. contract_v1 cells exercise the REAL production functions. Read each document: which column sounds like a competent assessor?

## password-standard × IAC-02

### OLD (first 2,000 chars only)

**Maturity: L1** (confidence 0.63)

> The evidence demonstrates an organization-wide administrative control for password management, including minimum password length, reuse restrictions, and MFA where possible. This supports the existence of basic Identification & Authentication governance. However, the evidence does not demonstrate unique identity management, centralized IAM/AAA, RBAC, provisioning/deprovisioning, privileged access governance, or audit capabilities. Because the control evidence is limited to a password standard and does not show consistent centralized management of authentication, authorization, and auditing, the maturity aligns best to Level 1 rather than Level 2 or 3.

Recommended: Implement and document a centralized IAM/AAA capability for organizational users and service/process accounts. | Define and evidence RBAC for user, group, system, and privileged accounts. | Document provisioning, modification, and deprovisioning workflows tied to HR or authoritative personnel sources.

- **PARTIAL** (0.58): The standard applies to organizational users and references access to computing resources, but it does not explicitly require unique user identification for system, application, or service users.
- **PASS** (0.83): The evidence defines password requirements and requires MFA whenever possible, supporting authentication of users prior to system access.
- **FAIL** (0.9): The evidence does not address processes acting on behalf of users or their association to uniquely identified and authenticated users.
- **FAIL** (0.9): No evidence is provided that processes acting on behalf of users are themselves authenticated or verified before access.
- …plus 4 more objectives (see JSONL)

### NEW (full document, production code)

**Maturity: L2** (confidence 0.77)

> The document provides clear, formal, organization-wide requirements for password standards, MFA/2FA, centralized authentication via Okta for third-party applications handling confidential data, SAML where technically feasible, and use of individual user accounts rather than group/shared authentication. This demonstrates that Identification & Authentication practices are defined, governed, and requirements-driven rather than ad hoc. Evidence supporting this includes: (1) 'all third party applications that house GitLab confidential data are required to authenticate via Okta inline with GitLab's approach to centralized authentication and authorization'; (2) MFA is required whenever possible and required for production access; (3) authentication should support individual users, not groups; and (4) failed login attempts should be monitored and logged. These are meaningful IAC capabilities aligned to centralized authentication and audit expectations.

However, the evidence does not fully support Level 3. The benchmark for Level 3 expects a centrally managed IAM function implementing least-privilege RBAC for user, group, system, and privileged accounts, plus HR-driven provisioning/deprovisioning, and broader centralized identity/permission management with exceptions only where necessary. This document does not provide evidence of RBAC governance, privileged access governance, joiner/mover/leaver integration with HR, centralized authorization management across the enterprise, or explicit management of processes acting on behalf of users. It also focuses primarily on policy/standards and authentication requirements rather than demonstrating a fully standardized, centrally managed enterprise IAM operating model. Therefore, Level 2 is the best fit, with some emerging Level 3 characteristics.

Recommended: Document and enforce enterprise RBAC/least-privilege standards for user, group, service, and privileged accounts. | Establish and evidence centralized joiner-mover-leaver provisioning and deprovisioning workflows integrated with HR notifications. | Expand the standard to explicitly cover service accounts and processes acting on behalf of organizational users, including ownership, authentication, and review requirements.

- **FAIL** (0.76): The password standard discusses authentication controls, but it does not explicitly require that system, application, and service users be identified as unique users across systems and services.
- **PARTIAL** (0.9): The document requires password-based authentication and multi-factor authentication whenever possible, but the qualifier 'whenever possible' prevents full evidence that every user identity is authenticated as a prerequisite to access in all cases.
  - cited [chars 1530-1590]: "- Multi-factor authentication (MFA) = Yes, whenever possible"
- **FAIL** (0.8): This document does not address processes acting on behalf of users or how such processes are associated with uniquely identified and authenticated users.
- **FAIL** (0.8): The standard contains no requirement to authenticate or verify the identity of processes acting on behalf of users before system access.
- …plus 4 more objectives (see JSONL)

### NEW + second-opinion lane (harness prototype)

**Maturity: L2** (confidence 0.78)

> The document provides clear, formalized organizational requirements for user authentication, password management, MFA/2FA, logging of failed login attempts, and centralized authentication for third-party applications handling confidential data via Okta where technically feasible. This is strong evidence of a governed Identification & Authentication capability rather than ad hoc practices. Specifically, the standard requires: individual user authentication rather than group authentication, MFA whenever possible and required for production access, centralized authentication through Okta for relevant third-party applications, and logging/monitoring of failed authentication attempts. These align well with Level 2 expectations for requirements-driven and formally governed logical access control using a central IAM-related technology with exceptions for systems that cannot integrate.

However, the evidence does not fully demonstrate Level 3 maturity. While the standard references centralized authentication and authorization via Okta, it does not clearly establish that an IAM function centrally manages permissions organization-wide using least-privilege RBAC for all user, group, system, and privileged accounts. It also does not provide evidence of HR-triggered provisioning/deprovisioning workflows, formal IT asset categorization tied to identity controls, or a broader centrally managed AAA operating model beyond authentication standards. Audit evidence is also limited to failed-login logging requirements rather than a comprehensive centralized AAA/audit capability for all organizational users and processes.

Therefore, the best fit is Level 2: formally governed and requirements-driven, with meaningful centralization elements, but without enough evidence of fully standardized, centrally managed organizational AAA practices required for Level 3.

Recommended: Document and enforce organization-wide RBAC/least-privilege requirements for user, group, system, and privileged accounts within the IAM platform. | Establish and evidence centralized provisioning/deprovisioning workflows tied to HR personnel changes and role changes. | Expand standards or supporting procedures to define centralized authorization governance, not just centralized authentication, including exception handling and periodic access reviews.

- **PARTIAL** (0.65): The standard identifies covered human user populations and implies individual accounts, but it does not fully define mechanisms to identify all system, application, and service users uniquely.
  - cited [chars 325-483]: "Applies to all GitLab team members, contractors, advisors, and contracted parties interacting with GitLab computing resources and accessing confidential data."
  - cited [chars 2217-2269]: "- Individual account passwords are not to be shared."
- **PASS** (0.93): The document requires password-based authentication and mandates MFA/2FA whenever possible, including required 2FA for production access, evidencing authentication as a prerequisite to access.
  - cited [chars 1530-1590]: "- Multi-factor authentication (MFA) = Yes, whenever possible"
  - cited [chars 5181-5274]: "Usage of 2FA by GitLab team members is **required** for access to the production environment."
- **FAIL** (0.89): This password standard does not address processes acting on behalf of users being associated with uniquely identified and authenticated system users.
- **FAIL** (0.88): The document does not provide requirements for authenticating the identity of user-associated processes as a prerequisite to system access.
- …plus 4 more objectives (see JSONL)
- Second-opinion verdict: **?** —

---

## data-classification-standard × DCH-01

### OLD (first 2,000 chars only)

**Maturity: L1** (confidence 0.7)

> The evidence demonstrates a formal administrative control in the form of an organization-wide Data Classification Standard, including scope, roles/responsibilities, and a defined process for data owners to classify data and seek guidance from Security Compliance. This supports the existence of basic mechanisms to facilitate data protection controls. However, the provided evidence does not show enough support for Level 2 or higher, such as documented retention processes, data flow documentation, localized/requirements-driven implementation practices, technical enforcement mechanisms (e.g., DLP/MDM), or broader governance/oversight structures. Based on the evidence alone, the control is best aligned to Level 1.

Recommended: Document and evidence a formal data retention and disposal process tied to classification levels. | Show how data/process owners document data repositories, transfers, and processing locations. | Provide evidence of coordination with privacy/DPO functions for regulated data handling obligations.

- **FAIL** (0.93): The evidence is a data classification standard and does not mention physical controls for paper media containing sensitive or regulated data.
- **FAIL** (0.93): The document does not provide evidence of physical controls for digital media containing sensitive or regulated data.
- **FAIL** (0.92): No secure storage requirements or mechanisms for paper media are shown in the provided excerpt.
- **FAIL** (0.9): The evidence does not describe secure storage controls for digital media; it only establishes classification governance.
- …plus 4 more objectives (see JSONL)

### NEW (full document, production code)

**Maturity: L1** (confidence 0.82)

> The document provides clear evidence of a foundational, primarily administrative data protection capability, which aligns best with Level 1. Specifically, it establishes an organization-wide data classification standard with defined classification categories (Red, Orange, Yellow, Green), handling rules for access, reproduction, disclosure, storage, and disposal, and assigned responsibilities for team members, data owners, and security management. This satisfies key Level 1 indicators such as: administrative policies/standards to classify, protect, and dispose of data and media; a data classification process with specific protection requirements; and at least some manual retention/disposal expectations through repeated references to destruction in accordance with the Record Retention Policy.

However, the evidence does not substantiate Level 2. The document does not demonstrate localized or decentralized implementation structures, documented data repositories/data flows, DFDs/network diagrams, content filtering/DLP, MDM, geolocation controls, or other broader implementation mechanisms expected at Level 2. It also does not show formalized operational governance artifacts such as DPIAs, technical enforcement capabilities, or asset categorization mechanisms. While the standard is well defined, the evidence is still predominantly policy-based rather than showing broader implemented facilitation mechanisms across people, process, and technology.

Therefore, the most supportable maturity assessment from this document alone is Level 1.

Recommended: Establish and document a formal enterprise data retention process, including retention schedules and handling requirements by classification level. | Require data owners to document where sensitive/regulated data is stored, transmitted, and processed, including maintaining data flow diagrams for key systems. | Implement technical enforcement mechanisms such as DLP/content filtering to prevent unapproved file transfers of sensitive data.

- **FAIL** (0.82): This standard does not describe physical control requirements for paper media containing sensitive or regulated data.
- **FAIL** (0.75): The document defines data classification and handling controls but does not explicitly address physical control of digital media.
- **FAIL** (0.82): No requirements are provided for securely storing paper media containing sensitive or regulated data.
- **FAIL** (0.52): Although the standard discusses data handling and some storage-related controls, it does not clearly evidence secure storage requirements specifically for digital media in a way that maps directly to this objective.
- …plus 4 more objectives (see JSONL)

### NEW + second-opinion lane (harness prototype)

**Maturity: L1** (confidence 0.77)

> The document provides clear evidence of a defined administrative capability for data protection, which aligns well with Level 1. Specifically, it establishes an organization-wide data classification standard with defined categories (Red, Orange, Yellow, Green), handling requirements for access, reproduction, distribution, storage/disposal, roles and responsibilities, exception handling, and references to record retention. This satisfies core Level 1 expectations such as: administrative controls to classify, protect, and dispose of data and media; a data classification process; and owner responsibility for addressing sensitive/regulatory obligations.

Evidence supporting Level 1 includes: (1) formal classification categories and protection requirements, (2) explicit handling controls for storage, transmission, destruction, and disclosure, (3) data owner responsibility for classification and exceptions, (4) references to legal/privacy/security review for sensitive data transfers and vendors, and (5) a manual retention/destruction linkage via the Record Retention Policy.

However, the evidence does not sufficiently demonstrate Level 2 maturity. While the standard is formal and requirements-driven, the document does not show most of the additional Level 2 characteristics such as decentralized/localized implementation models, documented data repositories and flows, DFDs/network diagrams, content filtering to block ad hoc file transfers, MDM controls, physical protection measures for high value assets, or broader documented requirements for geolocation, data minimization, and comprehensive governance of testing/training use. Some isolated elements are present (e.g., limits on sharing, approved subprocessors, restrictions on test use for certain data), but not enough to conclude that most Level 2 criteria are met.

Therefore, the best-fit maturity assessment based on this evidence alone is Level 1.

Recommended: Establish and document enterprise procedures for identifying where sensitive/regulated data is stored, processed, and transmitted, including maintaining data flow diagrams and repository inventories. | Implement and document technical enforcement controls such as DLP/content filtering for unapproved file transfers and MDM for mobile data protection. | Define and publish explicit organizational requirements for data minimization, data geolocation/third-country transfers, and permitted use of sensitive data in testing, training, and research.

- **FAIL** (0.91): This standard defines data classifications and handling controls, but it does not specify physical control requirements for paper media containing sensitive or regulated data.
- **FAIL** (0.84): The document provides logical handling and storage requirements for classified data, but it does not explicitly require physical control of digital media containing sensitive or regulated data.
- **FAIL** (0.92): Although disposal requirements are documented, the standard does not state secure storage requirements for paper media containing sensitive or regulated data.
- **FAIL** (0.78): The standard addresses secure storage of classified data on systems, but it does not explicitly tie those controls to digital media containing sensitive or regulated data as required by the objective.
- …plus 4 more objectives (see JSONL)
- Second-opinion verdict: **?** —

---

## access-reviews × IAC-05

### OLD (first 2,000 chars only)

**Maturity: L2** (confidence 0.54)

> The evidence shows a formal, controlled access review procedure covering in-scope systems and vendors, with defined roles and periodic review objectives such as validating appropriate access, identifying dormant accounts, and removing terminated-user access. This supports a requirements-driven and governed logical access control process. However, the evidence is indirect for IAC-05: it does not explicitly demonstrate technical mechanisms used to identify and authenticate third-party TAAS, centralized IAM enforcement, federation/SSO, service account controls, or standardized enterprise-wide authentication practices. Therefore, the best fit is Level 2 rather than Level 3.

Recommended: Document the specific mechanisms used to identify and authenticate third-party TAAS (e.g., SSO, SAML/OIDC, API key management, mutual TLS, service accounts). | Define and evidence a centralized IAM model for third-party applications/services where technically feasible. | Establish and document standardized authentication requirements for third-party TAAS, including RBAC, MFA, privileged access restrictions, and exception handling.

- **PARTIAL** (0.68): The procedure defines in-scope systems/vendors for access reviews using criticality and origin factors, which provides some identification of relevant third-party systems/applications. However, it does not clearly define which system services/applications must be uniquely identified and authenticate
- **FAIL** (0.89): The evidence is focused on periodic user access reviews and entitlement validation. It does not show that third-party services/applications are uniquely identified and authenticated before establishing communications with devices, users, or other services/applications.

### NEW (full document, production code)

**Maturity: L2** (confidence 0.7)

> The document provides clear evidence of a formal, documented access review process for in-scope systems, including third-party vendors/services in scope based on factors such as criticality, subprocessors, integrated systems, and 'Red Vendors.' It also shows use of centralized supporting systems and data sources such as Workday as the employment source of truth, Okta/Authomize for facilitating reviews, role- and department-based entitlement validation, privileged access reviews, terminated user reviews, least-privilege validation, and documented removal workflows. These are meaningful Identification & Authentication-related governance practices and align with a requirements-driven, controlled capability.

However, the evidence is stronger for access governance and review than for the underlying mechanisms used to identify and authenticate third-party TAAS themselves. The procedure does not clearly demonstrate that identities and permissions for third-party services are centrally managed across the organization by a single IAM function wherever technically feasible, nor does it explicitly state that only exceptions operate decentralized access control. Instead, it shows significant dependence on system owners, administrators, managers, and different compliance teams to validate entitlements and execute removals, which is more consistent with a decentralized or partially standardized model. It also does not explicitly evidence AD or equivalent central identity management for all third-party services.

Because of this, the document supports Level 2 maturity: formally governed, requirements-driven, and repeatable, but not fully evidenced as organization-wide centrally managed and standardized to the Level 3 benchmark for third-party TAAS identification and authentication.

Recommended: Document the enterprise IAM architecture for third-party TAAS, including whether Okta or another central IdP is the standard mechanism for authentication across third-party services. | Define and publish an explicit policy that third-party applications/services must use centralized SSO/federation and RBAC wherever technically feasible, with exceptions formally approved and tracked. | Maintain an inventory mapping each in-scope third-party TAAS to its authentication method, provisioning/deprovisioning workflow, privileged access model, and exception status.

- **FAIL** (0.94): This access review procedure defines review scope and user entitlement processes, but it does not define which third-party system services and applications must be uniquely identified and authenticated as required by the objective.
- **FAIL** (0.97): The document addresses periodic user access reviews and access removals, but it provides no evidence that third-party services or applications are uniquely identified and authenticated before establishing communications.

### NEW + second-opinion lane (harness prototype)

**Maturity: L2** (confidence 0.68)

> The document provides clear evidence of a structured and governed access control process for in-scope systems, including third-party vendors/services, but it does not fully demonstrate the centrally managed, organization-wide IAM capability expected at Level 3. Evidence supporting Level 2 includes: (1) formal governance through a controlled 'Access Review Procedure'; (2) defined roles and responsibilities for Security Compliance, IT Compliance, System Owners, System Administrators, Managers, and IT Operations; (3) requirements-driven review activities tied to audit/compliance obligations; (4) use of least-privilege concepts and role/department-based entitlement reviews; and (5) periodic review of access, including privileged access and terminated users. The procedure also references centralized enterprise sources/tools such as Workday as the source of truth for employment status, Okta access to Authomize, and Authomize as the user access review platform. However, the evidence is still more strongly aligned to access review governance than to end-to-end identification and authentication for third-party TAAS. The document does not explicitly establish that a central IAM function manages identities and permissions for third-party services across the organization, nor does it clearly show that decentralized access control is limited to authorized exceptions only. Because the process is formalized and organization-relevant but still relies significantly on system owners/administrators for validation and execution, Level 2 is the best-supported maturity rating.

Recommended: Document the central IAM architecture for third-party TAAS, including authoritative identity sources, federation/SSO methods, and authentication standards. | Require all feasible third-party applications/services to integrate with a centralized identity provider (e.g., Okta/SSO) and document approved exceptions. | Define and publish a formal enterprise IAM function responsible for provisioning, deprovisioning, RBAC governance, and privileged access control for third-party TAAS.

- **FAIL** (0.91): The procedure defines access review scope and processes, but it does not define which third-party services and applications must be uniquely identified and authenticated for communications.
- **FAIL** (0.95): This document addresses periodic user access reviews and removals rather than requiring system services or applications to be uniquely identified and authenticated before establishing communications.
- Second-opinion verdict: **?** —

---

## security-incident-response × IRO-01

### OLD (first 2,000 chars only)

**Maturity: L2** (confidence 0.73)

> The evidence shows a formal, controlled Incident Response document and an established Security Incident Response Team (SIRT) with 24/7/365 coverage, defined scope, incident identification criteria, reporting paths, and references to supporting operational guidance. This demonstrates incident response is documented and governed beyond an ad hoc process. However, the evidence does not sufficiently demonstrate the broader Level 3 elements such as executive/CISO-led enterprise IR governance, a formally established steering committee, GRC oversight, an integrated enterprise-wide incident response program, SOC-enabled operations, business-unit IR plans, or supporting ITAM integration. It also does not fully evidence some Level 2 expectations such as recurring responder training, testing/exercises, temporary emergency account support, and formal lessons-learned updates, though the documented capability clearly exceeds Level 1.

Recommended: Document and evidence a tested enterprise Incident Response Plan covering preparation, detection/analysis, containment, eradication, and recovery. | Provide records of recurring incident response training and tabletop/rock-drill exercises for responders. | Establish and document formal lessons-learned reviews and IR plan updates after incidents and exercises.

- **PARTIAL** (0.75): The guide defines a central SIRT function, 24/7 on-call support, and states investigations are handled with the same urgency and priority, indicating some organizational consistency in rigor. However, detailed handling steps and organization-wide enforcement are not fully shown in the excerpt.
- **PARTIAL** (0.71): Evidence states incidents are handled with the same level of urgency and priority regardless of affected user/project scope, supporting predictable intensity. But specific severity criteria or escalation thresholds are not provided here.
- **PARTIAL** (0.68): The guide applies to incidents on GitLab.com or as part of the company, suggesting broad scope. Still, the complete scope of incident handling activities across all business areas is not fully demonstrated in the excerpt.
- **PARTIAL** (0.57): A documented guide and centralized SIRT imply more consistent outcomes, but the evidence does not describe expected outputs, closure criteria, or measurement of comparable results across the organization.
- …plus 14 more objectives (see JSONL)

### NEW (full document, production code)

**Maturity: L2** (confidence 0.77)

> The document provides strong evidence of a documented and operational incident response capability: it defines an organization-wide Security Incident Response Team (SIRT), establishes a formal incident lifecycle covering detection, analysis, containment, eradication, recovery, and post-incident activities, and documents roles, escalation paths, incident tracking, confidentiality requirements, severity classification, communications, and law-enforcement engagement. This clearly exceeds Level 1's ad hoc/informal practices.

However, the evidence does not fully support Level 3. While the process appears centralized and broadly standardized through SIRT, the document does not demonstrate several key Level 3 governance elements such as CISO-led strategic IR guidance, a formal GRC oversight function for IR controls, an executive steering committee, a documented program-level integrated incident response program/CONOPS, business-unit-specific IR plans aligned to enterprise IR, or ITAM integration supporting response operations.

The document aligns best with Level 2 because it shows a formal, documented response process and defined operational governance, but there are still important evidence gaps for both upper Level 2 and Level 3 criteria. In particular, this document does not show that the incident response plan is tested, that responders receive recurring role-based training/exercises, or that IT personnel provision/deprovision temporary emergency accounts for responders. It does show lessons learned and reviews are performed ('Incident Review will be completed for all incidents' and retrospectives for severity 1 incidents), which supports maturity beyond ad hoc response.

Recommended: Document and reference a formally tested enterprise Incident Response Plan, including exercise cadence and evidence of periodic validation. | Establish and document recurring role-based training and tabletop/rock-drill exercises for SIRT and supporting stakeholders. | Define formal governance oversight for incident response, including GRC responsibilities and executive/steering committee review of IR metrics, risks, and improvements.

- **PASS** (0.87): The guide states that investigations are handled with the same urgency and priority and defines a common incident response process, evidencing comparable and predictable rigor of handling activities.
  - cited [chars 838-977]: "These investigations are handled with the same level of urgency and priority regardless of whether it's a single user or multiple projects."
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
- **PASS** (0.85): The document explicitly requires the same urgency and priority for investigations, supporting comparable and predictable intensity of incident handling.
  - cited [chars 838-977]: "These investigations are handled with the same level of urgency and priority regardless of whether it's a single user or multiple projects."
- **PASS** (0.84): A single response workflow is defined for all identified security incidents, indicating comparable and predictable scope of handling activities.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
- **PARTIAL** (0.64): The document standardizes process activities, which supports more predictable outcomes, but it does not clearly define outcome criteria showing results are comparable across the organization.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
- …plus 14 more objectives (see JSONL)

### NEW + second-opinion lane (harness prototype)

**Maturity: L3** (confidence 0.74)

> The document provides strong evidence of a documented, organization-wide, centrally managed incident response capability, which aligns best with Level 3. Evidence includes: a formal Security Incident Response Team (SIRT) that is on-call 24/7/365; an end-to-end documented incident response process covering detection, analysis, containment, eradication, recovery, and post-incident activities; defined roles and responsibilities; standardized incident tracking through a central SIRT group and Slack-based intake/escalation workflow; severity classification; internal/external communication procedures; confidentiality requirements; escalation paths for high-severity incidents; and required incident reviews/retrospectives. The guide also shows integration with other business and technical functions such as Legal, Communications, Development, Infrastructure, and business continuity activities, supporting the existence of an on-demand integrated response model rather than a purely decentralized/local approach.

This exceeds Level 2 because the process is not merely local or regional and appears standardized across the organization through a central SIRT-led model. It also references governance mechanisms such as controlled document status, code owner approval, and an exception process.

However, evidence is incomplete for several explicit Level 3 benchmark elements. The document does not clearly show CISO-led strategic direction, a formal GRC oversight function, a steering committee for executive oversight, a named SOC, a documented enterprise CONOPS, business-unit-specific IRPs maintained by business owners, or ITAM integration feeding incident operations. It also does not explicitly demonstrate recurring responder training or exercise/testing, which is a notable gap from Level 2/3 supporting practices. Therefore, Level 3 is the best fit, but with moderate confidence rather than high confidence.

Recommended: Document formal executive and governance oversight for incident response, including CISO accountability, GRC review, and steering committee involvement. | Publish or reference an enterprise-level Incident Response Program/CONOPS that explicitly ties management, operational, and technical measures together across the organization. | Establish and evidence recurring incident response exercises and role-based training for SIRT, technical responders, privacy, legal, and business stakeholders.

- **FAIL** (0.7): The guide defines incident-response activities, but this artifact alone does not demonstrate that incident-handling rigor is actually comparable and predictable across the organization in practice.
- **FAIL** (0.7): Although severity and escalation concepts are documented, the document does not provide sufficient evidence that incident-handling intensity is consistently comparable and predictable organization-wide.
- **FAIL** (0.71): The procedure outlines scope considerations for incidents, but this document alone does not evidence that incident-handling scope is comparable and predictable across the organization.
- **FAIL** (0.72): The guide prescribes process steps and reviews, but it does not demonstrate that the results of incident handling are comparable and predictable across the organization.
- …plus 14 more objectives (see JSONL)
- Second-opinion verdict: **?** —

---

## records-retention-deletion × DCH-06

### OLD (first 2,000 chars only)

**Maturity: L1** (confidence 0.7)

> The evidence shows a controlled, organization-defined records retention and disposal standard with assigned roles and documented disposal requirements, including use of secure deletion procedures for certain digital records. This supports the existence of administrative controls for retention and disposal. However, the evidence does not demonstrate key DCH-06 requirements around physically controlling and securely storing digital and non-digital media within controlled areas, nor does it show operational procedures or technical/physical safeguards for protecting media until destruction or sanitization. Coverage appears limited to records retention/disposal policy rather than end-to-end media storage control.

Recommended: Document and implement procedures for physically controlling and securely storing both digital and non-digital media in controlled areas. | Define organization-specific security measures for media storage, including access restrictions, environmental protections, and custody requirements. | Establish and document approved media sanitization/destruction methods, equipment, and handling procedures for all media types.

- **PARTIAL** (0.84): The standard identifies certain records in tier 1 and tier 2 critical systems, implying some digital media scope, but it does not explicitly define media types to be securely stored.
- **FAIL** (0.96): No non-digital media types are identified or defined.
- **FAIL** (0.95): The document does not define controlled areas for secure storage of digital media.
- **FAIL** (0.97): The document does not define controlled areas for secure storage of non-digital media.
- …plus 7 more objectives (see JSONL)

### NEW (full document, production code)

**Maturity: L1** (confidence 0.79)

> The document provides clear evidence of an administrative, policy-based records retention and disposal capability, but it does not demonstrate the full breadth of DCH-06 media storage requirements, especially physical control and secure storage of digital and non-digital media within controlled areas. Evidence supporting Level 1 includes: (1) a controlled document defining retention and disposal requirements for many record types; (2) assigned roles and responsibilities for following, maintaining, and implementing the standard; and (3) disposal requirements referencing secure deletion methods such as "[GCP/AWS Secure Deletion]" and system-default deletion schedules for temporary PII files. This shows a documented retention/disposal process exists and that media/data is expected to be protected until deletion/sanitization through approved procedures. However, the evidence is limited to administrative requirements and secure disposal references. The document does not describe physical media controls, controlled storage areas, protection of non-digital media, inventorying of media, transport protections, or broader standardized organizational mechanisms expected at Levels 2-3. Because the evidence aligns with a basic, manual, policy-driven retention and disposal process but lacks broader operational and physical safeguards, Level 1 is the best fit.

Recommended: Document and implement physical security requirements for digital and non-digital media storage in controlled areas. | Define approved handling, storage, transport, sanitization, and destruction procedures for all media types, including paper and removable media. | Maintain media inventories for sensitive/regulated media and assign ownership for lifecycle tracking through destruction.

- **PARTIAL** (0.73): The document defines categories of records stored in critical systems, including clearly digital records such as audit logs, but it does not explicitly define digital media types as media.
  - cited [chars 509-570]: "GitLab records enumerated in the table below stored in GitLab"
  - cited [chars 2619-2640]: "Production audit logs"
- **FAIL** (0.93): The document lists retention and disposal requirements for records but does not define any non-digital media types to be securely stored.
- **FAIL** (0.95): The document scopes records to critical systems but does not define any controlled areas for securely storing digital media.
- **FAIL** (0.95): The document contains no definition of controlled areas for securely storing non-digital media.
- …plus 7 more objectives (see JSONL)

### NEW + second-opinion lane (harness prototype)

**Maturity: L1** (confidence 0.77)

> The document provides clear administrative requirements for records retention and disposal, including defined retention periods, disposal requirements using 'GCP/AWS Secure Deletion,' assigned roles and responsibilities, and an exception process. This is evidence of a documented, manual, policy-driven retention/disposal process, which aligns with Level 1 expectations for administrative data protection controls and a manual data retention process. However, the evidence does not demonstrate key elements required for higher maturity or for full alignment to the control objective, such as physical control of digital and non-digital media within controlled areas, secure storage measures for media prior to destruction, inventories of sensitive media, transport protections, standardized enterprise-wide media handling mechanisms, or technical/operational controls beyond policy statements. The scope is also focused on records in tier 1 and tier 2 critical systems rather than a broader media storage/control program. Therefore, the best fit is Level 1 rather than Level 2 or higher.

Recommended: Document and implement explicit procedures for physically controlling and securely storing digital and non-digital media in controlled areas. | Define approved media protection methods from creation through retention, transport, sanitization, and destruction, including chain-of-custody requirements. | Establish media inventory and tracking requirements for sensitive/regulated media, including periodic review and reconciliation.

- **FAIL** (0.92): This records retention and disposal standard enumerates record categories and disposal requirements, but it does not define types of digital media to be securely stored.
- **FAIL** (0.92): The document does not identify or define any types of non-digital media to be securely stored.
- **FAIL** (0.95): No controlled areas or storage locations for digital media are defined anywhere in the document.
- **FAIL** (0.95): The document does not define controlled areas within which non-digital media are to be securely stored.
- …plus 7 more objectives (see JSONL)
- Second-opinion verdict: **?** —

---
