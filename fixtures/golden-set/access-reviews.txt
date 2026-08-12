---
title: "Access Review Procedure"
controlled_document: true
tags:
  - security_standard
  - security_standard_acia
---

{{< label name="Visibility: Audit" color="#E24329" >}}

## Purpose

GitLab's user access review is an important control activity required for internal and external IT audits, helping to minimize threats, and provide assurance that the right people have the right access to critical systems and infrastructure. This procedure details process steps and provides control owner guidance for access reviews.

### Benefits to the organization

- Reduces security risk
- Identifies dormant and/or disabled accounts
- Ensures only required team members have access to a system
- Validates users who have changed roles have not retained access no longer relevant
- Ensures terminated team members no longer can access company systems
- Supports GitLab compliance and regulatory requirements which maintains customer trust

## Scope

### In-Scope Systems

Security Compliance performs Access Reviews for in-scope systems based on a subset of factors. Including:

1. Origin: External certification impact, Red Data System
2. Criticality: Mission Critical
3. Business Critical if Lumos connector available

- See the [tech stack](https://gitlab.com/gitlab-com/www-gitlab-com/-/blob/master/data/tech_stack.yml) for a current listing of all GitLab Systems and Vendors and their associated critical system tier.

### Out-of-scope Systems

Systems that fall outside of the threshold of the above in-scope system factors. As a general best practice, all system owners are highly encouraged to perform a minimum of an annual terminated access review for their owned systems using this process as a guide.

## Roles & Responsibilities

| Role | Responsibility |
| :---: | :---: |
| Security Compliance Team | *Execution of Full Entitlement Review, Privileged Access, Terminated User Reviews<br><br>* Creation of observations and oversight of remediation activities for any identified findings|
| IT Compliance Team | *Execution of Full Entitlement Review, Privileged Access, Terminated User Reviews for SOX in-scope systems<br><br>* Creation of observations and oversight of remediation activities for any identified findings|
| System Owners | *Validation of privileged entitlements<br><br>* Validation of user entitlements<br><br>*Timely evidence support <br><br>* Execution of remediation plans for identified observations<br><br>* Execution of access removal(s)|
| System Administrators | *Validation of privileged entitlements<br><br>* Validation of user entitlements<br><br>*Timely evidence support <br><br>* Execution of remediation plans for identified observations<br><br>* Execution of access removal(s)|
| Managers | *Support validation of privileged entitlements<br><br>* Support validation of user entitlements|
| IT Operations | * Execution of access removal(s)|
| Security Assurance Management (Code Owners) | Responsible for approving significant changes and exceptions to this procedure |

## What is Lumos and why do I have an Okta tile for it?

[Lumos](../../corporate/systems/lumos/access_reviews/_index.md) is GitLab's User Access Review tool. It is used to facilitate all user access reviews. By default, all team members will receive access to Lumos upon onboarding. To access Lumos, team members can select the Lumos tile in Okta. If you are assigned an access review, please follow the runbook linked below to complete the access review.

## Access Review Procedure

**Terminated Users**

- The current access listings of systems is correlated against a list of active team members derived from Workday (GitLab's source of truth for employment status) using GitLab's User Access Review tool [Lumos](/handbook/security/security-assurance/). If any users are found to have active system access that are not current GitLab team members, open access removal issues to start the access de-provisioning process.

**Entitlement/Privileged Access**

- Access for systems will be reviewed based on the job roles and departments in GitLab's User Access Review tool, Lumos. Depending on the user base size and scope of users with access, a system owner and/or manager will be involved in reviewing user entitlements. System owners should have detailed knowledge of which roles/deparments should have access to their system. For detailed instructions on how to complete a user access review via Lumos see the [Lumos review handbook page here](../../corporate/systems/lumos/access_reviews/_index.md).

### Access Review runbook

The [Lumos review handbook page here](../../corporate/systems/lumos/access_reviews/_index.md) provides the outline to complete these access reviews, including how to confirm [least privilege](https://internal.gitlab.com/handbook/security/access-management-standard/#least-privilege-reviews-for-access-requests).

In the event access is identified to no longer be required, open an [Access Removal](https://gitlab.com/gitlab-com/team-member-epics/access-requests/-/issues/new?issue%5Bassignee_id%5D=&issue%5Bmilestone_id%5D=) issue for each account that no longer requires access and relate it to the system access review issue.

If you have any questions or require assistance with completing an access review, please [contact the GitLab Security Compliance team](../security-compliance/).

### Access Review Cadence

| System Type | Review Frequency | Review Scope |
|-------------|------------------|--------------|
| **Red Data Systems** | Annual | All users with access to Red data systems |
| **[SOX In-Scope Applications](https://gitlab.com/groups/gitlab-com/internal-audit/-/wikis/IT-General-Controls)** | Quarterly | All users - entitlement reviews |
| **PCI In-Scope Applications** | Bi-Annual (6 months) | All entitlements/Account inactivity reviews |
| **[External Certification Systems](/handbook/security/security-assurance/security-compliance/certifications/)** | Quarterly | Entitlement Reviews |

### Access Removals

If appropriateness of access cannot be verified as part of the review or a system owner/reviewer flags a user for removal, a validation will take place with the team member's manager prior to access removal as per the [Observation Management Procedure](/handbook/security/security-assurance/observation-management-procedure/). This validation must take place within **7 calendar days** and if access is determined to not be required **OR** no agreement can be reached within that SLA between the Manager and system owner/reviewer, access will be removed. If the risk associated with unvalidated access is too high, access will be revoked immediately and impacted users will be directed towards the new access request process for re-provisioning. While we want to avoid disruption in access whenever possible, we need to balance the impact of that disruption with the risk of continued access to GitLab systems that has not been validated. The Security Compliance team is not responsible nor has the ability to remove access. Security Compliace's role and responsibility is limited to opening access removal issues and assigning those issues out to the appropriate System Owner(s) and/or the IT Operations team. System Owners and/or IT Operations is responsible for execution of access removal or adjustment. Communication of the access removal or adjustment for affected team members is at the discretion of the system owner/reviewer.

## Additional Guidance

### Timing of Access Reviews

- Access reviews are targeted to be completed within 1 month from when the system listing is exported to completion of all steps of the review. By completing the access review within a month's timeframe, we ensure the access data has not become stale. If any components of an access review are not completed within the quarter they are initiated, the review would likely be considered ineffective for compliance purposes making the month timeline all the more important to adhere to.

### Lookback Reviews

For any accounts that require any removal of access (full removal or individual roles/privileges), a lookback review may be required. A lookback review is a review of activity for the period of time which the access was inappropriate.

Example scenarios where a lookback may be required:

- A terminated team member is identified during the Access Review as still being an active user in a system, prior to the account being removed GitLab would perform a lookback to confirm that the terminated user did not use the access after their final day.
- A team member was identified as having administrative access to a system that was not appropriate for their role but the user did require some level of access to the system, a lookback would be performed to validate that the administrative access was not used in an inappropriate manner.
- A team member was identified as having a role in a system which conflicted with their job responsibilities and their access in other systems allowing them to circumvent established control points and processes, a lookback would be performed to validate the user didn't use their access to circumvent established processes and controls in place.

In cases where there is a disagreement between system owner and manager as to whether a lookback is required, it should be completed.
Engage the appropriate personnel (typically, the system owner) to perform a lookback assessment to validate the account(s) did not use the access inappropriately.

It may not be necessary to perform a lookback in all cases, for example:

- A person transferred between non-conflicting departments, continued to support their previous role during transition, and the access review is a chance to remove the access now that the transition is complete
- A role is being removed as the access granted by that role is duplicative to access granted as part of another role that will remain
- A user no longer uses the access that they have to a system but the access isn't a risk for the user to have and could be reinstated by opening  an Access Request if a need for the access ever arises again
- A team of 4 users have the same access to a system but usage is minimal. To free up licenses and maintain an environment of least privilege, access for 3 of the users is requested for removal.

The most simple method to perform a lookback for users is to review their last login date/time and validate it was not after the date access was no longer appropriate. If a last login shows the account did authenticate after the access was inappropriate, a full review should be performed to determine any activity from the account during that time to validate no risk. If a last login is not available, other validations should be performed to confirm the account was not used inappropriately after termination, including reviews of key transactions or similar reviews.

Evidence of the completed lookback review should be retained and documented within the access review workbook or other associated documentation.

### Validation of Modifications completed

For any accounts that are requested for modification or removal, validation they were modified as requested should be completed and evidence captured of their successful modification. This can be demonstrated by screenshot, updated user listing that reflects changes made, or similar evidence.

### Access Review Notification Reminders

Security Compliance managed access reviews required for audit evidence have a deadline of 10 business days from the launch of the review in Lumos.  Automated reminders will be used based on number of days out from the due date:

|  Days until Due Date | Notification | Who is Notified |
| :---: | :---: | :---: |
|  5 | Lumos "nudge" | Reviewer |
|  3 | Slack ping | Reviewer |
|  2 | Lumos "nudge" & <br/>Slack ping the Reviewer | Reviewer, Reviewer's Manager, and Security Compliance Manager |
|  0 | Escalated to CISO | CISO |

{-If an access review is not completed within 10 days, identified access will be removed.-}

### Access List For Review

#### Access List Generation

Based on how the system access is maintained will determine the method of account and related permissions export for access review.  This will most likely fall to the business or technical owner identified in the [Tech Stack Applications](https://gitlab.com/gitlab-com/www-gitlab-com/-/blob/master/data/tech_stack.yml).

- A system owned by Infrastructure will require an issue opened in the [Infrastructure Project](https://gitlab.com/gitlab-com/gl-infra/infrastructure) for access listing export request

##### Access List Data Fields

The following fields are the most comprehensive to assist in performing a thorough access review: (all are helpful, but all might not be available)

- Account Name
- User Name
- Email Address
- Access Permissions (level of access - user, admin,etc.)
- Account Creation Date Timestamp
- Last Access Date Timestamp

#### Access Listing Generation Validation

- Please attach a system-generated access list along with evidence of how listing was produced, which should include date data was pulled. Timestamp should include the day, month, and year the listing was pulled.
- Evidence of how the listing was pulled generally takes the form of screenshots from within the system interface; the screenshots document the steps taken within the system to generate the user listing.
- If a query was used to generate the list, please provide the query along with a screenshot of system used to pull data, e.g. PostgreSQL query window, making sure screenshot evidences date/time query was run and raw row count. This will be used to evidence completeness of the population.
- To evidence completeness and accuracy, where technically feasible, include a row count or a screen shot of the row count or the generated file hash.

#### How to provide a desktop timestamp screenshot

1. Please make sure that your workstation system clock (date and time) is visible in your screenshots.

## Exceptions

Exceptions to this procedure will be tracked as per the [Information Security Policy Exception Management Process](/handbook/security/controlled-document-procedure/#exceptions).

## <i class="fas fa-book" style="color:rgb(110,73,203)" aria-hidden="true"></i> References

- [Identification & Authentication Security Controls](/handbook/security/security-assurance/security-compliance/sec-controls/)
- [Access Requests handbook page](/handbook/security/corporate/end-user-services/access-requests/access-requests/)
- [Access Management Policy](/handbook/security/security-and-technology-policies/access-management-policy/)

<a href="/handbook/security/security-assurance/" class="btn bg-primary text-white btn-lg">Return to the Security Assurance Homepage</a>
