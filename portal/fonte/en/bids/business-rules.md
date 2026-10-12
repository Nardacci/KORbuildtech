# Business rules

Each rule has an ID (`CO-nnn`) so it can be quoted in meetings, tests and change requests. The **Status** column says whether the rule works in the prototype today.

!!! note "Source"
    These rules come from the prototype's code and the bids specification in the project documentation. Open points are marked **To be confirmed** at the end.

## Who contracts whom

| ID | Rule | Status |
|---|---|---|
| CO-01 | **Both paths live together.** A subcontractor whose client is not on KORbuild keeps sending its proposal by email (PDF); with a client on KORbuild, everything goes through the platform. | Working |
| CO-02 | Bids come **with the plan**, not as a separate module. | Working |
| CO-19 | **Any company can be the contracting company**: a general contractor or a subcontractor. Screens, statuses and rules are the same. | Working |
| CO-20 | **Who hires approves.** The daily report and the schedule of a subcontracted company go to the company that hired it, not to the general contractor. | Working |
| CO-22 | **Amounts never cross a link.** Each company sees only the bids it received and the ones it sent. | Working |

## The package and the invitations

| ID | Rule | Status |
|---|---|---|
| CO-03 | **Showing the budget is a choice** for each bid: don't show (default) or show the total. | Working (by cost code: engine only) |
| CO-08 | Sending requires a job (or the project, when getting sub bids), a scope of work, at least one cost code, the included scope, a due date in the future and at least one invitee. | Working |
| CO-09 | Once sent, a bid changes only by **extending the due date**, **inviting more** or a **notice to all** (addendum). Everything goes to the history. | Working |
| CO-16 | A company is invited only once per bid. A job can have several bids (one per scope). | Working |
| CO-07 | A subcontractor **without an account** bids through a **private link**: it sees the invitation, answers, asks and submits the PDF with the total. The link opens only that invitation. | Working |

## Who sees what

| ID | Rule | Status |
|---|---|---|
| CO-04 | Each invitee sees **only its own invitation, its own bids** and the messages sent to it or to all. Never who else was invited or their amounts. | Working |
| CO-11 | The contracting company sees the amounts **as soon as they arrive** (common in private work). | Working |
| CO-17 | Bid amounts are seen by whoever has *Run bids and award*. The management view of the job (crew on site) shows no amounts. | Working |

## Bids, due date and leveling

| ID | Rule | Status |
|---|---|---|
| CO-05 | A submitted bid is never edited: a new one is a **revision** (rev. 1, rev. 2…). The leveling uses the latest revision of each company. | Working |
| CO-10 | Bids are accepted **until the due date**. After it, the bid is *Ready to award* and only an extension reopens it. | Working |
| — | A bid from Measure goes **by cost code**: lines whose code matches a cost code of the bid go to that cost code; the other lines and the other items go as **other items**. The total must equal the sum. | Working |
| CO-12 | **Leveling**: one row per cost code, one column per bid. A cost code without a price is **not bid**, never zero. The lowest amount of each row is highlighted; an exclusion that matches the included scope is flagged. | Working |

## Award and cancel

| ID | Rule | Status |
|---|---|---|
| CO-06 | The award is recorded (who, when, amount, accepted revision) and the bid never changes again. | Working |
| CO-13 | Awarding requires a submitted bid. The winner is *Awarded*; the others with bids are *Not selected* and are told, without the winning amount. | Working |
| CO-14 | **Job link:** the winner's Measure project becomes *Won*; the job created from it is **already linked** to the contracting company's job. | Working |
| CO-15 | Canceling requires a reason and notifies the invitees. A draft is simply deleted. | Working |
| CO-18 | Every action goes to the **audit log** of the company that did it. | Working |

## The channel

| ID | Rule | Status |
|---|---|---|
| — | One conversation per invitee. An answer goes **to all invitees** (the question goes along, without who asked) or **only to who asked**. A **notice to all** reaches every invitee. | Working |
| — | After the award, the winner's conversation is the **job channel**, on both companies' job pages. With the others, the conversation stops. Nothing is edited or deleted. | Working |
| — | The bell shows: bids received, declines, messages and due dates (contracting company); invitations, extensions, answers and the result (invitee). | Working |

## Subcontracting

| ID | Rule | Status |
|---|---|---|
| CO-21 | **Presence goes up the whole chain**: the general contractor sees who is on site from every company below it, marked with who hired them, without amounts. Daily reports and schedules come only from its direct subcontractor. | Working |
| CO-23 | Each bid says whether the awarded company may subcontract: **allowed** (default), **with my approval** (the upstream company approves the chosen company — it sees only the name) or **not allowed** (the sub bid is not sent). | Working |
| CO-24 | A bid started from a **project being estimated** can receive bids and have its prices used in the estimate, but is awarded only after the project is **won** and its job created. A **lost** project cancels its bids. | Working |
| CO-25 | When getting sub bids from a project, the due date must be **before** the project's own bid due date. | Working |

!!! confirm "To be confirmed"
    - **Sealed bids**: amounts visible only after the due date.
    - Whether the **foreman** sees the job channel.
    - Whether the site walk is just information or the contracting company records who attended.
    - Inviting a company that is **not in Contacts**, by email only.
    - **Splitting the award** between two subcontractors, by cost code.
    - The default for subcontracting: *allowed* or *with my approval*.
