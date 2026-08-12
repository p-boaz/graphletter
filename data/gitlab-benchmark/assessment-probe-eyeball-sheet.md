# Probe eyeball sheet — the AI's actual feedback, old vs new

Rendered from assessment-probe-2026-07-08T17-44-14-071Z.jsonl. Read each document and ask: which column sounds like a competent assessor?

## password-standard × IAC-02

### OLD (first 2,000 chars only)

**Maturity: L1** (confidence 0.57)

> The evidence demonstrates an organization-wide administrative standard for authentication hygiene (password construction, reuse prohibition, MFA expectation, scope, and governance roles). This supports the existence of basic Identification & Authentication controls at a policy/standards level. However, the evidence does not demonstrate centralized IAM/AAA capability, unique identity management, RBAC, provisioning/deprovisioning, authorization workflows, audit logging, or management of processes acting on behalf of users. Because the control evidence is limited to password standards, the maturity aligns best to Level 1 rather than Level 2 or Level 3.

Recommended: Implement and document a centralized IAM/AAA solution used across organizational systems, where technically feasible. | Establish and evidence unique user identity provisioning, deprovisioning, and role-change processes tied to HR events. | Define and enforce RBAC and least-privilege access management for user, group, system, and privileged accounts.

- **PARTIAL** (0.62): The standard applies to organizational users and implies user accounts/passwords exist, but it does not explicitly describe mechanisms to uniquely identify system, application, or service users.
- **PARTIAL** (0.79): The document defines password requirements and requires MFA whenever possible, supporting user authentication. However, it does not explicitly state authentication is required as a prerequisite to system access for all covered systems.
- **FAIL** (0.93): No evidence addresses processes acting on behalf of users or their association to uniquely identified and authenticated user accounts.
- **FAIL** (0.94): The evidence does not describe authentication or verification of process identities before system access.
- …plus 4 more objectives (see JSONL)

### NEW (full document)

**Maturity: L2** (confidence 0.74)

> The evidence shows a formally documented, organization-wide authentication standard with defined password requirements, MFA expectations, logging of failed logins, temporary lockout requirements, and a requirement that third-party applications housing confidential data authenticate via Okta in line with a centralized authentication and authorization approach. It also requires individual user authentication and SAML/SSO where technically feasible, which supports unique identification and central authentication. However, the document does not provide sufficient evidence that permissions and authorization are centrally managed through an enterprise IAM function using standardized RBAC across all systems, nor does it address provisioning/deprovisioning workflows, HR-triggered role changes, privileged account governance, or identities for processes/service accounts acting on behalf of users. Because there is clear formal governance and some centralized IAM capability, but not enough evidence of comprehensive, standardized, enterprise-wide centralized AAA, Level 2 is the best-supported assessment.

Recommended: Document and enforce enterprise-wide RBAC for user, group, privileged, and service/process accounts. | Expand centralized IAM requirements beyond third-party applications housing confidential data to all in-scope systems, with exceptions tightly governed. | Define and evidence centralized authorization management, not just centralized authentication, including least-privilege role design and approval workflows.

- **PASS** (0.83): Pass because the standard requires centralized authentication for applicable applications and explicitly states authentication should support individual users rather than groups, evidencing identifiable system/application users.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
- **PASS** (0.93): The standard requires user authentication for application access through centralized Okta authentication and mandates 2FA for production access, demonstrating identity verification before system access.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 5004-5621]: "All GitLab team members are required to use [Two Factor Authentication](https://www.cisa.gov/resources-tools/resources/multifactor-authentication-mfa#) (2FA) whenever possible. Usa"
- **PARTIAL** (0.78): The standard requires centralized, MFA-backed authentication and individual user accounts for applications, but it does not explicitly state that processes acting on behalf of users are tied to uniquely identified and authenticated system users.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 5004-5621]: "All GitLab team members are required to use [Two Factor Authentication](https://www.cisa.gov/resources-tools/resources/multifactor-authentication-mfa#) (2FA) whenever possible. Usa"
- **PARTIAL** (0.79): The standard requires centralized application authentication via Okta and SAML/MFA where feasible, but it does not explicitly state that each process acting on behalf of a user is uniquely authenticated or verified before system access.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 5004-5621]: "All GitLab team members are required to use [Two Factor Authentication](https://www.cisa.gov/resources-tools/resources/multifactor-authentication-mfa#) (2FA) whenever possible. Usa"
- …plus 4 more objectives (see JSONL)

### NEW + second-opinion lane

**Maturity: L2** (confidence 0.76)

> The document provides clear evidence of a formally governed Identification & Authentication standard with organization-wide requirements for password strength, MFA/2FA, failed-login logging, account lockout, and centralized authentication expectations for third-party applications handling confidential data. In particular, it states that such applications are required to authenticate via Okta in line with GitLab's centralized authentication and authorization approach, that SAML assertions are required where technically feasible, and that authentication should support individual users rather than groups. These are meaningful indicators of a requirements-driven IAM capability with some centralized characteristics.

However, the evidence does not fully demonstrate Level 3 maturity for IAC-02. The control objective includes uniquely identifying and centrally Authenticate, Authorize, and Audit organizational users and processes acting on behalf of users. While the document addresses unique user authentication and partial audit logging (failed login attempts), it does not provide sufficient evidence of centrally managed authorization using RBAC/least privilege across the enterprise, centralized lifecycle management for provisioning/deprovisioning, HR-triggered role-change processes, or comprehensive AAA auditing for users and user-acting processes. The Okta requirement also appears scoped to third-party applications housing confidential data rather than all systems universally, and exceptions are explicitly anticipated where Okta is not supported.

Accordingly, the evidence best aligns with Level 2: formal, governed, and requirements-driven IAM practices with centralized technology used in important cases, but without enough evidence to conclude the capability is consistently and centrally managed across the organization for authentication, authorization, and audit.

Recommended: Document and enforce enterprise-wide centralized IAM coverage for all organizational systems and applications, not only third-party applications housing confidential data. | Establish and evidence RBAC/least-privilege authorization standards managed centrally through the IAM platform, including privileged and service/process accounts. | Implement and document joiner-mover-leaver workflows integrated with HR notifications to support timely provisioning, deprovisioning, and access changes.

- **PARTIAL** (0.87): The standard requires centralized authentication and individual user accounts for applications, supporting identification of organizational application users, but it does not clearly address identification of service users.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
- **PASS** (0.95): The standard requires users to authenticate through centralized mechanisms and MFA before accessing applicable systems, including mandatory 2FA for production access.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 5004-5621]: "All GitLab team members are required to use [Two Factor Authentication](https://www.cisa.gov/resources-tools/resources/multifactor-authentication-mfa#) (2FA) whenever possible. Usa"
- **PARTIAL** (0.87): The document establishes centralized and multi-factor authentication with individual user accounts, but it does not explicitly address processes acting on behalf of users being associated with those uniquely identified users.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 5004-5621]: "All GitLab team members are required to use [Two Factor Authentication](https://www.cisa.gov/resources-tools/resources/multifactor-authentication-mfa#) (2FA) whenever possible. Usa"
- **PARTIAL** (0.61): The document requires centralized application authentication via Okta with MFA and SAML where feasible, which supports authenticated access prerequisites, but it does not explicitly state that each process acting on behalf of a user is separately authenticated or verified.
  - cited [chars 8223-8975]: "- Effective FY23 Q3, all third party applications that house GitLab confidential data are required to [authenticate via Okta inline with GitLab's approach to centralized authentica"
  - cited [chars 5004-5621]: "All GitLab team members are required to use [Two Factor Authentication](https://www.cisa.gov/resources-tools/resources/multifactor-authentication-mfa#) (2FA) whenever possible. Usa"
- …plus 4 more objectives (see JSONL)
- Second-opinion verdict: {"object": {"verdict": "dissent", "rationale": "Dissent is warranted because the assessment overclaims at least one objective and omits material evidence. The clearest issue is objective 9be9d65d-d6fd-4608-8064-b40717d54c9c: a full pass is too strong because the cited MFA/application-authentication language is conditional or scoped, not universal. E1 says application MFA only \"should\" be present

---

## data-classification-standard × DCH-01

### OLD (first 2,000 chars only)

**Maturity: L1** (confidence 0.86)

> The evidence demonstrates a formal administrative control for data classification and handling: a controlled Data Classification Standard with scope, roles/responsibilities, and a defined expectation that data owners classify data and personnel handle data according to classification levels. This supports the existence of a basic capability to facilitate data protection controls. However, the evidence does not show broader Level 2 or Level 3 maturity elements such as a documented retention process, data flow/repository documentation, DFDs/network diagrams, DLP/content filtering, MDM, localized or centralized governance operating models, DPIAs, or consistent technical enforcement across the organization. Therefore, the strongest supported rating is Level 1.

Recommended: Document and evidence a formal data retention and disposal process tied to classification levels. | Establish and evidence data inventory/data flow documentation for sensitive and regulated data repositories. | Implement and document technical enforcement controls such as DLP/content filtering and MDM where applicable.

- **FAIL** (0.92): The evidence does not mention physical controls for paper media containing sensitive or regulated data.
- **FAIL** (0.9): The evidence does not describe physical control measures for digital media containing sensitive or regulated data.
- **FAIL** (0.92): No secure storage requirements or practices for paper media are provided in the evidence.
- **FAIL** (0.88): The excerpt references a control matrix but does not provide evidence that digital media is securely stored.
- …plus 4 more objectives (see JSONL)

### NEW (full document)

**Maturity: L1** (confidence 0.81)

> The evidence demonstrates a documented and controlled Data Classification Standard with defined data categories (Red/Orange/Yellow/Green), handling requirements, roles and responsibilities, exception handling, and disposal/retention references. This is strong evidence that data protection controls are facilitated through administrative mechanisms such as policies and standards, which aligns well with Level 1. The document also shows that data owners are responsible for classification decisions and that Security/Privacy teams can be consulted, further supporting the Level 1 expectation that owners work with specialized functions to address regulatory, contractual, and handling obligations. However, the evidence does not show enough of the broader operational and governance capabilities expected for Level 2 or Level 3, such as documented data flow inventories/DFDs, decentralized or regional operating models, DLP/content filtering, MDM, formal DPIA usage, IT asset categorization, centralized GRC oversight, or formal executive steering structures. While the standard appears organization-wide, the provided evidence is still primarily policy-based rather than demonstrating consistent technical and procedural implementation across the enterprise.

Recommended: Establish and document an enterprise process for identifying where sensitive/regulated data is stored, transmitted, and processed, including data repositories and data flows. | Require and maintain Data Flow Diagrams (DFDs) and network diagrams for systems handling Orange and Red data. | Formalize collaboration points between data owners, Security, Privacy, and legal/compliance functions for handling regulated data and exceptions.

- **FAIL** (0.95): This standard defines data classification, access, sharing, storage, and disposal controls, but it does not specify physical control requirements for paper media containing sensitive or regulated data.
- **PARTIAL** (0.77): The standard provides secure handling, approved-system storage, and secure disposal requirements for sensitive data media, but it does not explicitly define physical control requirements over digital media itself.
  - cited [chars 10395-11826]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required for approved business functions | All copies of Red data outside o"
  - cited [chars 11881-13192]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required | May be reproduced for Internal Use only. Team member data classi"
- **FAIL** (0.96): This standard defines data classification and storage/disposal controls, but it does not specify requirements for securely storing paper media containing sensitive or regulated data.
- **PASS** (0.95): The standard explicitly requires secure storage controls for sensitive and regulated data, including approved systems, encryption at rest, and secure media disposal for Red and Orange classifications.
  - cited [chars 10395-11826]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required for approved business functions | All copies of Red data outside o"
  - cited [chars 11881-13192]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required | May be reproduced for Internal Use only. Team member data classi"
- …plus 4 more objectives (see JSONL)

### NEW + second-opinion lane

**Maturity: L1** (confidence 0.82)

> The evidence demonstrates a defined administrative foundation for data protection, but not enough implementation evidence to support Level 2 or higher. The document establishes an organization-wide data classification standard with defined categories (Red/Orange/Yellow/Green), handling requirements for access, reproduction, distribution, storage/disposal, roles and responsibilities, exception handling, and references to record retention. It also assigns responsibilities to data owners and security management, and requires approval paths for sensitive data handling and vendor processing. This aligns well with Level 1 expectations for policy/standards-based classification, protection, and disposal mechanisms. However, the evidence does not show key Level 2 capabilities such as documented data repositories and flows, DFDs/network diagrams, decentralized operational governance, content filtering/DLP-style blocking of unapproved transfers, MDM controls, or broader operational mechanisms for implementing and enforcing the standard. The document is strong as a standard, but it is still primarily administrative and does not provide sufficient evidence of the more formalized and implemented practices expected at Level 2.

Recommended: Document and maintain where sensitive and regulated data is stored, processed, and transmitted, including data repositories and data flow mappings. | Establish and evidence operational retention procedures, not just policy references, including roles, workflows, and periodic review of retained data. | Implement and document technical enforcement mechanisms such as DLP/content filtering for unapproved file transfers.

- **FAIL** (0.97): This data classification standard defines handling, access, sharing, and disposal controls for data, but it does not specify physical control requirements for paper media containing sensitive or regulated data.
- **PARTIAL** (0.79): The standard defines handling and secure disposal requirements for sensitive electronic storage media and restricts storage to approved systems, but it does not explicitly require physical control of digital media.
  - cited [chars 10395-11826]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required for approved business functions | All copies of Red data outside o"
  - cited [chars 11881-13192]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required | May be reproduced for Internal Use only. Team member data classi"
- **FAIL** (0.95): The standard defines storage and disposal controls for classified data, but it does not specify secure storage requirements for paper media containing sensitive or regulated data.
- **PASS** (0.95): The standard defines explicit storage and disposal requirements for sensitive and regulated Red and Orange data, including approved-system restrictions, encryption at rest, and secure media erasure.
  - cited [chars 10395-11826]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required for approved business functions | All copies of Red data outside o"
  - cited [chars 11881-13192]: "| Access| Reproduction | Distribution/ Disclosure | Storage/Disposal | |-|-|-|-| | Business need-to-know required | May be reproduced for Internal Use only. Team member data classi"
- …plus 4 more objectives (see JSONL)
- Second-opinion verdict: {"object": {"verdict": "confirmed", "rationale": "The assessment is directionally consistent with the document. The standard clearly establishes a documented classification framework and prescribes handling, access, sharing, storage, transmission, and disposal controls, especially for Red and Orange data (for example, E1, E2, and E4). The partial/pass conclusions tied to documented controls, roles

---

## access-reviews × IAC-05

### OLD (first 2,000 chars only)

**Maturity: L0** (confidence 0.4)

> The provided evidence is an access review procedure focused on reviewing user access to in-scope systems. While it demonstrates some governance over logical access and periodic review activity, it does not provide evidence of mechanisms specifically used to identify and authenticate third-party technology assets, applications, or services (TAAS). There is no clear evidence of third-party service authentication methods, centralized IAM integration for third parties, service account controls, federation/SSO, certificate-based trust, API authentication, or standardized onboarding requirements for third-party TAAS. Therefore, against this control’s maturity benchmarks, the evidence does not substantiate a defined capability for third-party TAAS identification and authentication.

Recommended: Document the specific mechanisms used to identify and authenticate third-party TAAS (e.g., SSO/SAML, OAuth, API keys, mutual TLS, certificates, managed service accounts). | Establish and publish a formal standard for onboarding and authenticating third-party applications and services. | Maintain an inventory of third-party TAAS and map each to its authentication method, owner, risk tier, and access model.

- **PARTIAL** (0.6): The procedure defines a population of in-scope systems/vendors for access review, which provides some identification of relevant applications/services. However, it does not explicitly define which third-party TAAS must be uniquely identified and authenticated, nor the required identification/authent
- **FAIL** (0.89): The evidence is focused on user access reviews and entitlement validation. It does not show that system services or applications are uniquely identified and authenticated before establishing communications with devices, users, or other services/applications.

### NEW (full document)

**Maturity: L2** (confidence 0.76)

> The evidence shows a formal, documented, and repeatable access governance process for in-scope systems, including third-party vendors/integrated systems. The procedure defines roles and responsibilities, uses a centralized review tool (Authomize), references Okta access to that tool, correlates accounts against Workday as the employment source of truth, and requires periodic entitlement, privileged access, and terminated-user reviews. These are strong indicators of requirements-driven IAM governance and least-privilege oversight.

However, the document is primarily an access review procedure, not a direct technical standard for how third-party TAAS are identified and authenticated. It does not clearly demonstrate that third-party TAAS are centrally authenticated through a common enterprise IAM platform organization-wide, nor does it explicitly show standardized authentication methods for those services, exception handling for non-integrated services, or controls over non-organizational privileged access beyond review/removal processes. Because centralized, organization-wide identification/authentication for third-party TAAS is implied but not fully evidenced, Level 3 is not fully supported by this document alone.

Therefore, the best-supported assessment is Level 2: formal and governed IAM-related practices exist, but the evidence is more administrative and review-focused than fully standardized, centrally managed authentication for third-party TAAS across the enterprise.

Recommended: Document and evidence the standard authentication architecture for third-party TAAS, including required use of Okta/SSO, SAML/OIDC, SCIM, or other centralized IAM mechanisms. | Maintain and reference an authoritative inventory of third-party TAAS showing each service's authentication method, owner, integration status, and approved exceptions. | Define and evidence exception criteria and compensating controls for third-party services that cannot use centralized identity federation.

- **PARTIAL** (0.74): The procedure identifies a defined population of systems via Tech Stack Applications and system-specific access review processes, but it does not explicitly define which system services/applications must be uniquely identified and authenticated.
  - cited [chars 12598-12917]: "Based on how the system access is maintained will determine the method of account and related permissions export for access review. This will most likely fall to the business or te"
  - cited [chars 3912-4598]: "- Access for systems will be reviewed based on the job roles and departments via GitLab's User Access Review tool, Authomize. Depending on the user base size and scope of users wit"
- **FAIL** (0.96): This procedure addresses user access reviews, entitlement validation, and access removals, but does not describe mechanisms ensuring system services and applications are uniquely identified and authenticated before communications are established.

### NEW + second-opinion lane

**Maturity: L2** (confidence 0.76)

> The evidence demonstrates a formal, documented access governance process for in-scope systems that includes third-party vendors and integrated systems. Specifically, the procedure defines scope including external vendors/sub-processors, assigns responsibilities, uses a centralized review tool (Authomize), correlates access against HR employment status from Workday for terminated-user checks, and requires periodic entitlement and privileged access reviews with supporting evidence. These are strong indicators of a requirements-driven and governed Identification & Authentication capability.

However, the document is primarily an access review procedure rather than a direct description of mechanisms used to identify and authenticate third-party TAAS. It does not clearly establish that identities and permissions for third-party services are centrally managed across the organization through a standard IAM platform for provisioning/authentication, nor does it show that decentralized exceptions are tightly controlled by policy. Evidence of authentication standards for third-party TAAS, centralized enforcement of RBAC/SSO/MFA, and organization-wide IAM integration is indirect or absent.

Therefore, the control is best assessed at Level 2: formalized and governed, but not sufficiently evidenced as fully standardized and centrally managed across the organization for third-party TAAS authentication.

Recommended: Document the specific technical mechanisms used to identify and authenticate third-party TAAS (for example: SSO via Okta, federated identity, service accounts, API authentication, MFA requirements). | Establish and evidence an organization-wide IAM standard for third-party applications and services, including centralized provisioning, deprovisioning, and RBAC enforcement where technically feasible. | Define and document exception handling for third-party TAAS that cannot integrate with centralized IAM, including compensating controls and approval requirements.

- **PARTIAL** (0.79): The procedure identifies in-scope systems and references a maintained tech stack and system access reviews, but it does not explicitly define the full set of system services and applications that must be uniquely identified and authenticated.
  - cited [chars 12598-12917]: "Based on how the system access is maintained will determine the method of account and related permissions export for access review. This will most likely fall to the business or te"
  - cited [chars 3912-4598]: "- Access for systems will be reviewed based on the job roles and departments via GitLab's User Access Review tool, Authomize. Depending on the user base size and scope of users wit"
- **FAIL** (0.96): This procedure addresses user access reviews, entitlement validation, and access removals, but does not document mechanisms for uniquely identifying and authenticating system services or applications before communications are established.
- Second-opinion verdict: {"object": {"verdict": "confirmed", "rationale": "The assessment is appropriately cautious. This document is centered on user access reviews, entitlement validation, removals, cadence, and evidence collection\u2014not on defining or enforcing mechanisms to uniquely identify and authenticate system services/applications or to authenticate them before communications are established. The available ca

---

## security-incident-response × IRO-01

### OLD (first 2,000 chars only)

**Maturity: L2** (confidence 0.74)

> The evidence shows a formal, controlled incident response document and an established SIRT with 24/7/365 on-call coverage, defined incident intake/reporting paths, scope for incident identification, and references to supporting operational guidance. This supports that incident response operations are documented and governed beyond an ad hoc basis. However, the evidence does not demonstrate enough of the Level 3 criteria, such as enterprise-wide centralized governance by CISO/GRC, a formal steering committee, an integrated cross-functional incident response program, SOC-supported operations, business-unit IRPs, or supporting ITAM integration. It also does not fully evidence some Level 2 expectations like tested IR plans, recurring role-based training, emergency account provisioning, or lessons-learned updates, but overall it aligns best with a documented, formalized capability at Level 2.

Recommended: Document and evidence incident response plan testing/exercises and lessons-learned updates. | Provide evidence of recurring role-based training for incident responders. | Formalize and evidence enterprise governance oversight for incident response (e.g., CISO, GRC, steering committee).

- **PARTIAL** (0.63): Guide defines centralized SIRT-led investigations and states incidents are handled with the same urgency/priority, supporting some consistency of rigor, but detailed organization-wide handling steps are not shown.
- **PARTIAL** (0.6): Evidence says investigations are handled with the same level of urgency and priority regardless of affected users/projects, indicating some predictable intensity, but no tiering or severity-based response criteria are provided.
- **PARTIAL** (0.58): Scope covers security events on GitLab.com or across the company and internal/external reporting, but full boundaries of incident handling activities are not fully documented in the excerpt.
- **FAIL** (0.7): No evidence of defined expected outputs, closure criteria, or standardized results of incident handling across the organization.
- …plus 14 more objectives (see JSONL)

### NEW (full document)

**Maturity: L3** (confidence 0.72)

> The evidence supports a Level 3 assessment because the incident response capability appears to be documented, standardized, and centrally coordinated across the organization rather than ad hoc or localized. The document is a controlled procedure and defines an organization-wide Security Incident Response Team (SIRT) with 24/7/365 coverage, formal roles and responsibilities, documented workflows for detection, analysis, containment, eradication, recovery, and post-incident review, as well as structured escalation, communication, tracking, confidentiality, and exception handling. It also shows cross-functional coordination with incident managers, communications, legal, development, infrastructure, and business continuity activities, which aligns with an integrated response capability. However, confidence is moderated because several Level 3 benchmark elements are not explicitly evidenced in this document, including formal CISO-led strategic guidance, explicit GRC oversight, a steering committee, a defined SOC function, business-unit-specific IRPs, formal training/exercise cadence, and ITAM integration for response operations.

Recommended: Document explicit executive and governance oversight for incident response, including named CISO-equivalent accountability, GRC review responsibilities, and steering committee involvement. | Publish or reference a program-level Integrated Incident Response Program that clearly ties this guide to enterprise governance, privacy, legal, and business functions. | Add evidence of recurring incident response training and exercises for responders and supporting teams, including tabletop or annual drill requirements.

- **PASS** (0.94): The document establishes a standardized incident response lifecycle and mandated incident tracking workflow, indicating incident handling is intended to be consistent and repeatable across the organization.
  - cited [chars 2397-4083]: "1. Detection - The SIRT, other internal, or external entity identifies a Security or Privacy Event that may be the result of a potential exploitation of a Security Vulnerability or"
  - cited [chars 6321-6873]: "Security incident investigations are opened in the [SIRT](https://gitlab.com/gitlab-sirt/) group. The project will be created using the [Incident Response project template](https:/"
- **PASS** (0.89): The guide defines a uniform incident response workflow for all identified security incidents and uses severity-based classification to drive consistent handling intensity.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
  - cited [chars 2397-4083]: "1. Detection - The SIRT, other internal, or external entity identifies a Security or Privacy Event that may be the result of a potential exploitation of a Security Vulnerability or"
- **PASS** (0.94): The document establishes a uniform incident response lifecycle for all identified security incidents and standardizes how incidents are created and tracked, making handling activities comparable and predictable across the organization.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
  - cited [chars 2397-4083]: "1. Detection - The SIRT, other internal, or external entity identifies a Security or Privacy Event that may be the result of a potential exploitation of a Security Vulnerability or"
- **PASS** (0.93): The document establishes a standardized incident-handling lifecycle and mandates a common incident template and creation method, supporting comparable and predictable handling across the organization.
  - cited [chars 2397-4083]: "1. Detection - The SIRT, other internal, or external entity identifies a Security or Privacy Event that may be the result of a potential exploitation of a Security Vulnerability or"
  - cited [chars 6321-6873]: "Security incident investigations are opened in the [SIRT](https://gitlab.com/gitlab-sirt/) group. The project will be created using the [Incident Response project template](https:/"
- …plus 14 more objectives (see JSONL)

### NEW + second-opinion lane

**Maturity: L3** (confidence 0.75)

> The evidence supports Level 3 maturity because the organization has a centrally managed, documented, organization-wide incident response capability rather than an ad hoc or localized one. The guide is a controlled document, defines enterprise-wide scope, assigns formal roles and responsibilities, and documents a standardized lifecycle covering detection, analysis, containment, eradication, recovery, and post-incident review. It also shows centralized operational management through a 24/7 SIRT on-call function, centralized incident tracking in the SIRT group, severity classification, escalation paths, confidentiality handling, communications coordination, and integration with legal, communications, development, and business continuity activities. These are strong indicators of standardized and centrally managed incident response operations. However, the evidence does not clearly demonstrate several higher-confidence Level 3 governance elements, such as explicit CISO-led strategic guidance, a formal steering committee, named GRC oversight, business-unit-specific IRPs, or ITAM support to incident operations. Because the organization-wide and centralized characteristics are clearly present, Level 3 is the best fit, but confidence is moderated by those missing explicit governance artifacts.

Recommended: Document explicit executive oversight for incident response, including the accountable CISO-equivalent role and how strategic priorities are set. | Establish and evidence formal GRC oversight for incident response controls, including regulatory, contractual, and privacy compliance monitoring. | Create or reference a program-level integrated incident response program/CONOPS that ties management, operational, technical, legal, privacy, and business functions together.

- **PASS** (0.93): The guide defines a standardized incident response lifecycle for all identified security incidents and requires use of a common tracking/template process, supporting consistent and predictable handling across the organization.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
  - cited [chars 6321-6873]: "Security incident investigations are opened in the [SIRT](https://gitlab.com/gitlab-sirt/) group. The project will be created using the [Incident Response project template](https:/"
- **PASS** (0.9): The document defines a uniform incident response workflow for all identified security incidents and requires severity/priority classification using a stated methodology, supporting comparable and predictable handling intensity.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
  - cited [chars 2397-4083]: "1. Detection - The SIRT, other internal, or external entity identifies a Security or Privacy Event that may be the result of a potential exploitation of a Security Vulnerability or"
- **PASS** (0.94): The document defines a standard incident-response lifecycle for all identified security incidents and standardizes how incidents are created and tracked, supporting comparable and predictable handling scope across the organization.
  - cited [chars 2283-2395]: "### Incident Response Process - this guide covers the following activities for all identified security incidents"
  - cited [chars 6321-6873]: "Security incident investigations are opened in the [SIRT](https://gitlab.com/gitlab-sirt/) group. The project will be created using the [Incident Response project template](https:/"
- **PASS** (0.95): The guide defines a standardized incident lifecycle and requires use of a common incident tracking template and process, which supports consistent and predictable handling outcomes across incidents.
  - cited [chars 2397-4083]: "1. Detection - The SIRT, other internal, or external entity identifies a Security or Privacy Event that may be the result of a potential exploitation of a Security Vulnerability or"
  - cited [chars 6321-6873]: "Security incident investigations are opened in the [SIRT](https://gitlab.com/gitlab-sirt/) group. The project will be created using the [Incident Response project template](https:/"
- …plus 14 more objectives (see JSONL)
- Second-opinion verdict: {"object": {"verdict": "confirmed", "rationale": "The assessment is directionally sound and does not materially overclaim the document. Core incident-response operations are clearly supported by candidate spans: E12 and E1 define a common lifecycle for all identified security incidents; E1 also covers detection, analysis, containment, eradication, recovery, and post-incident activity; E5 adds conc

---

## records-retention-deletion × DCH-06

### OLD (first 2,000 chars only)

**Maturity: L1** (confidence 0.69)

> The evidence demonstrates a controlled, organization-defined records retention and disposal standard, including assigned responsibilities and approved secure deletion methods for certain records in tier 1 and tier 2 critical systems. This supports a Level 1 maturity finding because administrative controls for retention and disposal exist and are documented. However, the evidence does not show mechanisms for physically controlling and securely storing digital and non-digital media within controlled areas, nor does it demonstrate broader media protection practices prior to destruction/sanitization. Coverage appears limited to retention/disposal requirements for selected records rather than a comprehensive media storage control framework.

Recommended: Document physical security requirements for storage of digital and non-digital media within controlled areas. | Define and evidence procedures for protecting media from creation through destruction/sanitization, not only at disposal time. | Expand the standard to cover non-digital/physical media and removable media where applicable.

- **PARTIAL** (0.78): The document identifies records in tier 1 and tier 2 critical systems and references secure deletion, which implies some digital media scope, but it does not explicitly define media types to be securely stored.
- **FAIL** (0.94): No non-digital media types are identified or defined in the evidence.
- **FAIL** (0.93): The evidence does not define controlled areas for secure storage of digital media; it only references tier 1 and tier 2 critical systems.
- **FAIL** (0.95): No controlled areas for secure storage of non-digital media are defined.
- …plus 7 more objectives (see JSONL)

### NEW (full document)

**Maturity: L1** (confidence 0.72)

> The evidence supports a limited, primarily administrative capability for media retention and disposal, but it does not demonstrate the full scope of DCH-06. The document is a controlled standard with defined roles and responsibilities, a formal retention schedule, and explicit disposal requirements for many record types using "GCP/AWS Secure Deletion." This is evidence of a manual, policy-based retention/disposal process and approved sanitization procedures for digital records. However, the control also requires physically controlling and securely storing digital and non-digital media within controlled areas, and the document provides no explicit requirements for physical media storage, controlled areas, handling of non-digital media, protection of media prior to destruction, transport protections, or media inventory practices. Because there is some evidence of capability—especially for disposal/sanitization governance—but not enough to demonstrate standardized or broader operational control, Level 1 is the best fit.

Recommended: Establish and document explicit requirements for physically controlling and securely storing both digital and non-digital media within controlled areas. | Define organization-approved security measures for media storage, such as restricted access, locked storage, environmental protections, and access logging. | Document procedures to protect media from creation through retention until destruction or sanitization, not only at the point of disposal.

- **PARTIAL** (0.78): The document defines multiple categories of GitLab records stored in critical systems, which partially identifies digital media types, but it does not explicitly define digital media types for secure storage or describe storage security measures.
  - cited [chars 443-693]: "The below retention and secure disposal requirements apply to all GitLab records enumerated in the table below stored in GitLab [tier 1 and tier 2 critical systems](/handbook/secur"
  - cited [chars 1272-6889]: "| Record | Retention Requirement | Disposal Requirement | |----------------------------------------------------|---------------------------|---------------------------| | Business "
- **FAIL** (0.98): This records retention and disposal document defines retention and disposal requirements for records, but it does not define any types of non-digital media that must be securely stored.
- **FAIL** (0.96): This records retention and disposal standard addresses retention periods, disposal requirements, scope, and roles, but does not define controlled areas for securely storing digital media.
- **FAIL** (0.95): The document defines retention and disposal requirements for records in critical systems but does not define any controlled areas for securely storing non-digital media.
- …plus 7 more objectives (see JSONL)

### NEW + second-opinion lane

**Maturity: L1** (confidence 0.71)

> The document provides clear administrative evidence of a defined retention and disposal process for records in critical systems, including specific retention periods, assigned responsibilities, exception handling, and approved disposal methods such as 'GCP/AWS Secure Deletion.' This supports the existence of a basic, policy-driven capability for media retention and disposal. However, the evidence is limited to records retention/disposal and does not demonstrate the full scope of DCH-06. In particular, there is no explicit evidence of: physical control of digital and non-digital media within controlled areas; organization-defined security measures for secure storage; protection of media during its lifecycle prior to destruction; handling requirements for non-digital media; or approved sanitization equipment/techniques beyond cloud deletion references. Because the document shows foundational administrative controls for retention and disposal, but not the broader operational and physical media storage protections required for higher maturity, Level 1 is the best fit.

Recommended: Document and implement explicit requirements for physically controlling and securely storing both digital and non-digital media within controlled areas. | Define organization-approved security measures for media storage, such as locked storage, restricted access, environmental protections, and visitor/access logging where applicable. | Establish documented procedures to protect media from creation through destruction, including custody, transport, temporary storage, and access restrictions.

- **PARTIAL** (0.83): The document defines categories of records stored in critical systems, which indicates some digital media types, but it does not explicitly define digital media types for secure storage or describe secure storage requirements.
  - cited [chars 443-693]: "The below retention and secure disposal requirements apply to all GitLab records enumerated in the table below stored in GitLab [tier 1 and tier 2 critical systems](/handbook/secur"
  - cited [chars 1272-6889]: "| Record | Retention Requirement | Disposal Requirement | |----------------------------------------------------|---------------------------|---------------------------| | Business "
- **FAIL** (0.97): This records retention document defines retention and disposal requirements for records in critical systems, but it does not define any types of non-digital media to be securely stored.
- **FAIL** (0.97): This document defines records retention and disposal requirements for records in critical systems, but it does not define any controlled areas for securely storing digital media.
- **FAIL** (0.98): This records retention and disposal document addresses retention periods and secure deletion for records in critical systems, but it does not define controlled areas for securely storing non-digital media.
- …plus 7 more objectives (see JSONL)
- Second-opinion verdict: {"object": {"verdict": "confirmed", "rationale": "The assessment is supported by the document. The text is narrowly about records retention and secure disposal for records in tier 1 and tier 2 critical systems, not about media storage controls. E7 and E5 define the document\u2019s scope as retention/disposal requirements for critical-system records, and E1 is a retention/disposal table with dispos

---
