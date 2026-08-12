---
title: "Security Incident Response Guide"
description: " "
weight: 20
controlled_document: true
tags:
  - security_standard
  - security_standard_cpir
---

{{< label name="Visibility: Audit" color="#E24329" >}}

## Purpose

The [Security Incident Response Team (SIRT)](/handbook/security/security-operations/sirt/) is on-call [24/7/365](/handbook/engineering/infrastructure-platforms/incident-management/on-call/#security-team-on-call-rotation) to assist with any security incidents. If an urgent security incident has been identified or you suspect an incident may have occurred, please refer to [Engaging the Security Engineer On-Call](/handbook/security/security-operations/sirt/engaging-security-on-call/) and use the Slack `/security` command by writing a new message to either yourself, or a public/private channel (this command does not work inside Slack threads).

Information about SIRT responsibilities and incident ownership is available in the [SIRT On-Call Guide](/handbook/security/security-operations/secops-oncall/).

## Scope

### Incident Identification

Security incident investigations are initiated when any security event is detected on [GitLab.com](https://www.gitlab.com), on another GitLab service, or as part of the GitLab company. These investigations are triaged by qualified Security team members and dispositioned as false positives when the triage evidence is obvious and risk-free. If there is any question about the event being potentially harmful or negatively impactful to GitLab customers, services, products, team members, 3rd party services, or alike, the Security team investigates the incident.

Incident indicators can be [reported](/handbook/security/#reporting-an-incident) to SIRT either internally, by a GitLab team member, or externally. It is the Security team's responsibility to determine when to investigate dependent on the identification and verification of a security incident.

The GitLab Security team identifies security incidents as any violation, or threat of violation, of GitLab security, acceptable use or other relevant policies.

SIRT will follow processes in the [Material Breach Determination internal handbook page](https://internal.gitlab.com/handbook/security/security_operations/sirt/operations/incident_response/material_breach_guidance/material_breach_determination/) for any security incidents that individually, or in aggregate may be a material breach, including 3rd party breaches that may have a material impact to GitLab. Incidents that have the potential to be material will be treated as MNPI.

## Roles & Responsibilities

| Role | Responsibilities |
| ----- |------------|
| GitLab Team Members | Responsible for following the requirements in this procedure |
| SIRT | Responsible for implementing and executing this procedure |
| SIRT Management (Code Owners) | Responsible for approving significant changes and exceptions to this procedure |

## Procedure

### Incident Response Process: this guide covers the following activities for all security incidents

1. Detection
    - The SIRT, other internal, or external entity identifies a Security or Privacy event or risk that may be the result of a potential exploitation of a Security Vulnerability or Weakness, or that may be the result of a misconfiguration, or an innocent error
    - One of our Security detection controls identifies event(s) outside of the established security baseline
    - A security issue is escalated into an incident out of an abudance of caution and to validate any assumptions
1. Analysis
    - SIRT determines whether the reported security or privacy event is in actuality security or a privacy event
    - SIRT determines the incident severity and priority based on the following [incident classification](/handbook/security/security-operations/sirt/severity-matrix/) methodology
1. Containment
    - Prevent the spread of unauthorized or malicious use of the affected system or data
    - Mitigates and eventualy fully remediates the root cause of the incident to prevent further damage or exposure
    - SIRT may implement additional controls to minimize the damage as a result of the incident
    - Determine if it is safe to continue operations with the affected system
    - Permit or deny the operations of the affected system
1. Eradication
    - Components that have caused the security incident are eliminated
    - Removal of the attackers' access to the environment or the targeted system
    - Strengthen the controls surrounding the affected system
1. Recovery
    - Represents the effort to restore the affected system's operations after the problem that gave rise to the incident has been corrected
    - Implementation of additional monitoring controls
    - Update the incident record with any relevant details
1. Post-Incident analysis and activities
    - Retrospective and lessons learned activity

#### Leaked Secrets Incident Response Process

When secrets are confirmed to be leaked, it is important to minimize the exposure time by immediately revoking the secrets. This can be done by automation or manual revocation by the Security team. Security will immediately revoke the secrets to prevent further abuse even if the potential impact of that action isn't clearly understood at that time. In some cases this may cause disruption, when the secrets are being used for legitimate processes. Because of this potential for impact to services dependent on the revoked secrets, Security posts a notification to the `#security-revocation-self-service` Slack channel, where secrets owners can use the channel for manual or automated self-service. Since secret has already been exposed and revoked, and to make it easier for secrets' owners to find their secrets in the channel, the clear text version of the revoked secret is published as a part of the notification.

### Confidentiality

Security incidents may (and usually do) involve sensitive information related to GitLab, GitLab's customers or employees, or users who (in one way or another) have engaged with GitLab. GitLab, while codifying the [Transparency](/handbook/values/#transparency) value, also strongly believes in and strives to maintain the privacy and confidentiality of the data its employees, customers, and users have entrusted us with.

A **confidential** issue means any data within the issue and any discussions about the issue or investigation are to be kept to a need to know basis. This will involve specific **GitLab employees only** unless permission is explicitly granted by GitLab Legal, a GitLab Security Director, a VP of Security, or scoped incident labels GitLab Executive Team.

Which team members have access to a specific incident is defined on a case to case basis by SIRT according to our [limited access policy](/handbook/security/security-operations/sirt/#limited-access). Whenever a team member needs access to the incident, this should be requested in the corresponding incident channel or in `#security-operations`. Bypassing security controls to access the incident issue will result in Security Operations being notified.

### Incident Tracking

Security incident investigations are opened in the [SIRT](https://gitlab.com/gitlab-sirt/) group. The project will be created using [the Incident Response project template](https://gitlab.com/gitlab-sirt/project-templates/incident) and the [incident issue template](https://gitlab.com/gitlab-sirt/operations/-/blob/main/.gitlab/issue_templates/incident_baseline.md?ref_type=heads). To create the incident, the `/security` command in Slack has to be used over manual creation. Please refer to the [Engaging the Security Engineer On-Call page](/handbook/security/security-operations/sirt/engaging-security-on-call/#engage-the-security-engineer-on-call) for further detail.

All artifacts from an investigation must be handled per the [Artifact Handling and Sharing](https://internal.gitlab.com/handbook/security/security_operations/sirt/operations/artifacts_handling_sharing/) internal handbook page.

**NOTE:** The tracking issue, any collected data, and all other engagements involved in a Security Incident must be kept **strictly confidential**.

### Incident Severity

Assigning severity to an incident isn't an exact science and it takes some rational concepts mixed with past experiences and gut feelings to decide how bad a situation may be. When considering severity, look at:

- The type of data involved and how it's classified using the [Data Classification Policy](/handbook/security/policies_and_standards/data-classification-standard/)
  - Was this data leaked or disclosed to parties who should not have visibility to it?
  - Has the data been modified in our records? (either confirmed or believed to be)
- Was a user or service account taken over?
  - What level of access did this account have and to what services or hosts?
  - What actions were taken by the compromised account?
- If a vulnerability is present on a host or service, consider the impact it might have on GitLab and the likelihood of it being exploited by using the [Risk Factors and Risk Scoring](/handbook/security/security-assurance/security-risk/storm-program/#risk-factors-and-risk-scoring) documentation.
  - Was the vulnerability exploited? If so, how was it used and how frequently?
- What is the scope of the incident?
  - How many GitLab.com users were/may have been impacted?
  - How many hosts or services?
- Has this incident resulted in any hosts or services being unavailable?

To help place the correct severity rating on the incident you are about to submit, please refer to the [Incident Classification](/handbook/security/security-operations/sirt/severity-matrix/) page.

### Internal Engagement & Escalation for High-Severity Incidents

Coordinate with internal teams and prepare for the incident investigation:

- Open an incident-focused Slack channel to centralize non-verbal discussion, particularly if the incident is of a sensitive nature. This is done by using `/sirt-escalate` in slack.
- For artifact handling, a Google Drive folder and shared Google Doc should have been created automatically and linked to the issue.

In the event that an incident needs to be escalated within GitLab, the Security Engineer On Call (SEOC) will page the Security Incident Manager On Call (SIMOC). It is the responsibility of the SIMOC to direct response activities, gather technical resources from required teams, coordinate communication efforts with the Communications Manager On Call, and further escalate the incident as necessary.

Characteristics of an incident requiring escalation include but are not limited to the following:

- Incidents involving or likely to involve data with an Orange or Red classification
- Incidents that are likely to impact, or are actively impacting the availability or functionality of essential services
- Incidents affecting legal or financial resources
- Incidents that are likely to require a breach notification or public notification
- Incidents involving criminal activity or that may require the involvement of law enforcement
- Incidents involving key personnel such as executive leadership

Often a security incident may revolve around a particular GitLab feature where coordination with the respective engineering team is required to gather in-depth understanding of implementation or mitigation. The EM/PM for those teams should be looped in and depending on the severity of the issue (Severity 1 or Severity 2) consider setting up follow the sun coverage from the engineering counterparts. This will allow for quick remediation or engineering assistance as situation may evolve on security incident.

If applicable, coordinate the incident response with [business contingency activities](/handbook/business-technology/entapps-documentation/policies/gitlab-business-continuity-plan/).

### Containment

Once an incident has been identified and the severity has been set, the incident responder must attempt to limit the damage that has already occurred and prevent any further damage from occurring.

The first step in this process is to identify impacted resources and determine a course of action to contain the incident while potentially also preserving evidence. Containment strategies will vary based on the type of incident but can be as simple as marking an issue confidential to prevent information disclosure or to block access to a network segment.

It's important to remember the containment phase is typically a stop-gap measure to limit damage and not to produce a long term fix for the underlying problem. Additionally the impact of the mitigation on the service must be weighed against the severity of the incident.

When triaging `priority::1/severity::1` incidents there may be times that SIRT
or Infrastructure are unable to mitigate an issue, or identify the full impact
of a potential mitigation. In these cases, escalate to the
appropriate [Tier 2 On-Call team](/handbook/engineering/infrastructure-platforms/incident-management/on-call/tier-2/). It is important that escalations are only initiated for
`priority::1/severity::1` issues and follow
the [Tier 2 escalation criteria](/handbook/engineering/infrastructure-platforms/incident-management/on-call/tier-2/#when-does-tier-2-get-paged).

### Remediation and Recovery

During the remediation and recovery phase the incident responder will work to ensure impacted resources are secured and prepared to return the service to the production environment. This process may involve removing malicious or illicit content, updating access controls, deploying patches and hardening systems, redeploying systems completely, or a variety of other tasks depending on the type of incident.

An Incident Review will be completed for all incidents. To prevent future occurrences and better our security posture, incident retrospectives will be conducted for all `severity::1` incidents and others where there is indication for added value.

This phase should prioritize short term changes that improve the overall security of impacted systems while the full recovery process may take several months as longer term improvements are developed.

### Resolution

Upon completing the containment, remediation, communication and verification of impacted services, the incident will be considered resolved and the incident issues may be closed after a review.

The incident response process will move on to a retrospective and lessons learned phase through which the process improvements and overall security of the organization can be analyzed and strengthened.

### Internal & External Communication

Our [security incident communication plan](/handbook/security/security-operations/sirt/security-incident-communication-plan/) defines the who, what, when, and how of GitLab in notifying internal stakeholders and external customers of security incidents.

### Engaging Law Enforcement

If during the course of investigating a security event the incident itself, materials involved in the incident (stored data, traffic/connections, etc), or actions surrounding the incident are deemed illegal in the United States, it may be necessary (and advisable) to engage U.S. law enforcement.

1. The Security Engineer On-Call will immediately escalate to the Security Operations Manager On-Call and the VP of Security Operations to raise awareness of the legal concern.
1. Following review, the VP of Security Operations will engage the CISO of Security and VP of Legal for validation of next steps.
1. The VP of Security Operations will then contact the appropriate local law enforcement agencies, state agencies or US (federal) government agencies.

### When You Join an Incident Channel or Call

In the event of a perceived major security incident (which may prove to not be one at a later point), adhoc communication is sometimes required for coordination. This is outlined in the sections above. If you are identified as someone who could assist during the perceived security incident with either the identification, confirmation, or mitigation of the incident, you will be added to a dedicated Zoom call or Slack channel. Upon joining that call/channel, please take note of the following:

- This is crisis management communication channel, that means that it's **private by default**. It may contain business critical or PII information that cannot be shared with the larger company at this time, or ever. Should GitLab Security determine that the content of this particular communication channel can be made internally available or public at a later point, the required changes will be made.
- **Read the channel history before asking questions**. Get some context, read through past conversations and related documents. The relevant person will reach out to you with specific asks at the right time.
- **Do your best to stay professional**. However, be aware that security incidents are often stressful and we're all humans. People may raise their voice, or use wording that seems unnecessary, harsh or inappropriate. It's important to cut people some slack (no pun intended) during this stressful time, and raise/address any potentially erratic behavior with the relevant manager once the incident is over.
- **Humor is your ally**. No, it really is.

### Incident Labels

Use proper labels. The correct use of dedicated scoped incident labels is critical to the accuracy of the data in the incident tracker and the subsequent metrics calculated from it. A list of all labels can be found in the [GitLab SIRT group](https://internal.gitlab.com/handbook/security/security_operations/sirt/team/groups_projects/gitlab_sirt/#labels) internal handbook page.

## Exceptions

Exceptions to this procedure will be tracked as per the [Information Security Policy Exception Management Process](/handbook/security/controlled-document-procedure/#exceptions).

## References

- [Security Communications Runbooks](https://gitlab.com/gitlab-com/gl-security/runbooks/-/tree/master/communications) (internal)
- [Incident Communications Plan](/handbook/security/security-operations/sirt/security-incident-communication-plan/)
- [Marketing Emergency Response process](/handbook/marketing/emergency-response/)
