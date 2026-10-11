# Business rules

Each rule has an ID (`SET-nnn`) so it can be quoted in meetings, tests and change requests. The **Status** column says whether the rule works in the prototype today.

!!! note "Source"
    These rules come from the prototype's code and from the Settings, jobs and schedule specifications in the project documentation. Open points are marked **To be confirmed** at the end.

## Principles

| ID | Rule | Status |
|---|---|---|
| SET-001 | **Nothing a company may want to change is hard-coded.** Rules, percentages, roles and lists live in Settings. | Working (see Prototype status for what is still fixed) |
| SET-002 | **Effective dates, never rewriting the past.** Hourly rates, labor burden and work rules change from a date; earlier days keep the values of their time. | Working |
| SET-003 | **Every change goes to the audit log**: what changed, before and after, who, when and why. | Working |
| SET-004 | **Fixed by product decision:** a time punch is never edited (a correction is a new punch), the audit log is mandatory, companies are isolated, and the geofence flags but does not block. | Working |

## Employees

| ID | Rule | Status |
|---|---|---|
| SET-010 | **Each company registers and manages its own employees.** The record shows **Company (employer)**, always the account the employee belongs to. | Working |
| SET-011 | An employee record holds code (employee ID), phone, emergency contact, **classification** (W-2 employee or 1099 contractor), **FLSA** (non-exempt gets overtime; exempt does not), trade, crew, hire and termination dates, status and the date the location notice was accepted. | Working |
| SET-012 | **SSNs and immigration documents are not stored in KORbuild**: they stay in the payroll system; only the employee ID is kept for matching. | Working |
| SET-013 | **Hourly rate with history:** a change applies from a date, with a reason, and never deletes the previous rate. Each day's hours are paid and costed at the rate in effect that day. | Working |
| SET-014 | A new hourly rate cannot start inside a week that is already approved (it went to payroll). | Working |
| SET-015 | **Certifications** (OSHA 10/30, licenses…) with an expiration date: KORbuild warns 30 days before, on the menu and in the notifications. | Working |
| SET-016 | Terminated employees leave the active lists but keep their history. | Working |

## Labor burden and work rules

| ID | Rule | Status |
|---|---|---|
| SET-020 | **Labor burden** is a set of percentages on wages (FICA, FUTA, SUTA, workers' comp, benefits) applied to all W-2 employees; 1099 contractors carry none. Default: 32.05%. | Working |
| SET-021 | A new burden version applies **from a date, never in the past**: the past weeks' costs do not change. | Working |
| SET-022 | **Work rules**: weekly overtime (default: over 40 h, Monday to Sunday, 1.5×), optional daily overtime and double time, and the minimum break (New Hampshire default: 30 min after 5 hours). | Working |
| SET-023 | Work rules apply to **whole weeks**, starting on a Monday. **Templates** (federal FLSA, New Hampshire, California…) only fill in the form; the company adjusts them. | Working |
| SET-024 | **No rounding of time**: every minute is paid (product principle). | Working |

## Company and contacts

| ID | Rule | Status |
|---|---|---|
| SET-030 | **Company profile:** logo, legal name, EIN, how the company works (subcontractor, general contractor or both), address, phone, email, licenses, insurance and the default proposal terms. Proposals and daily reports use it. | Working |
| SET-031 | **One directory of contacts with tags:** general contractor, client (owner), supplier, subcontractor. A contact can have more than one tag (the same company may be your GC on one job and your client on another). | Working |
| SET-032 | A **supplier** lists the cost codes it supplies; the Measure quote list sends it only those items. | Working |
| SET-033 | Contacts receive documents by link or email and **are not users**: they need no account and do not count as users. | Working |
| SET-034 | A contact in use (on a project or a job) cannot be deleted. | Working |

## Jobs

| ID | Rule | Status |
|---|---|---|
| SET-040 | **The job belongs to the company, not to a module:** Daily (reports and schedule), Crew (time clock, geofence and cost) and Measure (won project) share the same record. | Working |
| SET-041 | Fields: name\*, client\* (and the owner, if different), address, city\*, state\*, ZIP, **location on the map\***, **geofence radius** (50 to 2,000 m), start\* and finish\*, **who fills out the daily report\***, **workdays\*** and status. | Working |
| SET-042 | The location comes from a click on the map, the device's current location (when setting up on site) or typed coordinates. It drives the geofence, the weather on daily reports and the day map. | Working |
| SET-043 | **Status:** in progress, on hold or completed. Only jobs **in progress** require daily reports and appear on field phones and the time clock. Jobs on hold or completed stay in the office with their history; nothing is deleted. | Working |
| SET-044 | **Task templates:** a list of tasks with each one's **share of the schedule** (%, adding up to 100). When creating a job, a template lays the tasks out in sequence between start and finish and saves the first baseline. | Working |
| SET-045 | **From Measure:** a won project with no job yet opens the job form pre-filled (name, address, client, owner); project and job stay linked. | Working |
| SET-046 | **A general contractor's job** has no daily report owner, workdays or schedule template: the daily report, time clock and schedule belong to each subcontractor's job linked to it. | Working |

## Job schedule

| ID | Rule | Status |
|---|---|---|
| SET-050 | The schedule **belongs to the job** and is built by the company that does the work. Each task has a name, start, finish, an optional person responsible and % complete. | Working |
| SET-051 | **Baseline:** a snapshot of the dates, saved with date, author and reason. The first is saved automatically; new ones only by decision (**Save new baseline**). Variance is measured against the latest baseline. Nothing is deleted. | Working |
| SET-052 | **% complete from Daily:** an activity on the daily report can point to a schedule task and its %. When the report is **approved**, the % goes to the task, with its history (date, % and source report). The office can also update the % by hand. | Working |
| SET-053 | **Task status:** completed (100%), behind (past its finish and not 100%), at risk (actual progress 15 points or more below planned for today), in progress, not started. | Working |
| SET-054 | **Job progress** = the average % of the tasks, weighted by duration. **Planned to date** uses the same math on the baseline dates. | Working |
| SET-055 | **3-week look-ahead:** tasks in progress or starting/finishing in the next 21 days, on the foreman's job screen. | Working |
| SET-056 | **Notifications:** one per task behind schedule, for those who follow the jobs. | Working |
| SET-057 | **Publish to the client:** the subcontractor decides when the general contractor sees it. Each publication is a snapshot (version); the general contractor sees the latest, read-only, with its date, and can export it to Excel. | Working |
| SET-058 | **Export to Excel:** company header, job and client, task table (dates, duration, %, status, variance) and the Gantt bars week by week. | Working |

## Users and access

| ID | Rule | Status |
|---|---|---|
| SET-060 | **The home screen follows the permissions:** with a single module, the person goes straight into it. | Working |
| SET-061 | **Admin is locked**; at least one active user must keep *Users and access roles*; nobody removes their own access. | Working |
| SET-062 | Dependencies are automatic: approving includes viewing; seeing costs includes viewing; the catalog includes measuring; the schedule includes viewing all jobs. | Working |
| SET-063 | **A user who clocks in on their own phone must be linked to an employee record.** | Working |
| SET-064 | A role in use cannot be deleted. | Working |
| SET-065 | Without permission, the screen does not open — typing its address leads back to the person's home screen. | Working |

!!! confirm "To be confirmed"
    - Permissions **per job** (a foreman sees only his jobs; a project manager only his region).
    - Work rules **per job** (prevailing wage, a job in another state) and workers' comp per trade.
    - Daily report deadlines, GPS intervals and cost alerts as company settings (today: fixed values, see Prototype status).
    - Real email invitations for new users.
