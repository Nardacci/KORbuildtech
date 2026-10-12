# Overview

**Bids** is how one company invites others to bid on a scope of work, compares the bids and awards one — all inside KORbuild. The company that hires is the **contracting company**: a general contractor hiring subcontractors, or a subcontractor passing part of its work to another one (**subcontracting**). The invited companies are **subcontractors**: with a KORbuild account they bid from Measure; without one, they bid through a private link.

The award is what **links the two companies on the job**. From then on, everything that already works between companies works on its own: the general contractor approves the subcontractor's daily reports, follows its crew on site (without dollar amounts) and receives its published schedule (see [How KORbuild is organized](@/organization.html)).

Bids come with the plan, like Settings. They are not a separate module.

## Why it matters

- **One place for the whole bid.** Package, invitations, answers, questions, bids, leveling and award — no spreadsheets and email threads to reconcile.
- **Each company sees only its own.** An invited subcontractor never sees who else was invited, the others' amounts or the winning amount.
- **Leveling that tells the truth.** A cost code without a price shows as *not bid*, never as zero; an exclusion that is in your included scope is flagged before you award.
- **The award creates the job link.** The winner creates its job from the won project and it is already linked to yours.
- **A channel that stays.** Questions during the bid become the job conversation after the award. Nothing is edited or deleted.

## Who takes part

| Who | Where | What they do |
|---|---|---|
| **Contracting company** (admin, project manager) | Daily › Bids | Builds the package, invites, answers questions, levels the bids, awards. |
| **Subcontractor with KORbuild** (admin, estimator) | Measure › Invitations | Opens the invitation, bids or declines, measures in a project created from it and submits through the platform. |
| **Subcontractor without KORbuild** | A private link | Sees the invitation, answers, asks and submits the bid PDF with the total. No account needed. |
| **Upstream contracting company** | Its own bid | When it asked for it, approves the company its subcontractor wants to hire. |

## The main screens

| Screen | What it shows |
|---|---|
| **Bids** (Daily) | Every bid the company sent: open, ready to award, drafts, awarded, with the due date and how many bids arrived. |
| **New bid** | The package: job, scope of work, cost codes, included and excluded scope, drawings, due date, budget, requirements and invitees. |
| **The bid** | Tabs **Invitees**, **Questions**, **Level bids** and **Details**; actions **Extend**, **Invite more**, **Cancel**. |
| **Invitations** (Measure) | The invitations the company received, with the contracting company and the due date. |
| **The invitation** | The package, **I'll bid** / **Decline**, the questions and your bids. |
| **The link page** | The same invitation, without signing in, with the bid form. |

![The bid list](img/bids-list.png)

![Leveling the bids](img/bids-leveling.png)

## How a bid goes

| Step | What happens |
|---|---|
| 1. **Package** | The contracting company describes the scope, picks the cost codes and the due date, and chooses the invitees from its Contacts. |
| 2. **Invitations** | Each invitee gets it in KORbuild (with an account) or by a private link (without one). |
| 3. **Answer** | *I'll bid* creates a project in Measure; *Decline* can carry a reason. |
| 4. **Questions** | Through the channel; each answer goes to all invitees (without saying who asked) or only to who asked. |
| 5. **Bids** | Submitted through the platform, by cost code. Each new one is a revision; nothing is edited. |
| 6. **Leveling** | Side by side, by cost code, with duration, exclusions and requirements. |
| 7. **Award** | The bid closes; the others are told they were not selected, without the amount. |
| 8. **Job link** | The winner's project becomes *Won*, its job is created linked to yours, and the channel continues. |

## Subcontracting

A subcontractor can also be the contracting company. It can get sub bids **while estimating** (from its Measure project, using their prices in its own estimate) or **after winning** (from its job). Each link in the chain sees only its neighbors; dollar amounts never cross a link. The general contractor sees who is on site from the whole chain, without amounts. See the [user manual](@/bids/user-manual.html#subcontracting).
