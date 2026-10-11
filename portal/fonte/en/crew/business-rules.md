# Business rules

Each rule has an ID (`CRW-nnn`) so it can be quoted in meetings, tests and change requests. The **Status** column says whether the rule works in the prototype today.

!!! note "Source"
    These rules come from the prototype's code and from the Crew specification recorded in the project documentation. Open points are marked **To be confirmed** at the end.

## Punches

| ID | Rule | Status |
|---|---|---|
| CRW-001 | A punch is **never edited or deleted**. A correction is a **new punch**, marked as an edit, with who made it, when and the reason. The original stays visible. | Working |
| CRW-002 | **Every hour belongs to a job and a cost code.** That is what makes cost by job possible. | Working |
| CRW-003 | **No rounding.** Every minute is paid; the "7-minute rule" is not used. | Working |
| CRW-004 | The foreman can punch **several people at once**. Each punch records who registered it. | Working |
| CRW-005 | Each punch records the time, the job, the cost code, the GPS position and its accuracy, whether it was inside the geofence, who registered it and whether it had a photo. | Working |
| CRW-006 | **Note on the punch (optional):** at clock in, switch job, arrival and clock out, up to 280 characters. It is shown to the office and does not change the hours. Breaks take one tap, with no note. | Working |
| CRW-007 | Only jobs **in progress** appear in the time clock. | Working |

## Geofence

| ID | Rule | Status |
|---|---|---|
| CRW-010 | Each job has a **geofence**: its location and a radius (150 m by default, 50 to 2,000 m, set in the job setup). | Working |
| CRW-011 | **The geofence flags, it does not block.** A punch outside it is accepted, marked **off site**, and goes to the office to review. GPS is often inaccurate inside concrete structures. | Working |
| CRW-012 | Without GPS on the phone, the job's location is used. | Working |

## The workday

| ID | Rule | Status |
|---|---|---|
| CRW-020 | **Travel between jobs during the workday is paid time** (29 CFR 785.38). The commute from home to the job is not. | Working |
| CRW-021 | **On a switch job**, the punch is made where the person is (the job being left) and travel starts; **Arrived** is checked against the geofence of the new job. | Working |
| CRW-022 | **Breaks are not paid.** The minimum and after how many hours come from the work rule (New Hampshire default: 30 min after 5 hours, RSA 275:30-a). A missed break raises an alert. | Working |
| CRW-023 | **Missing clock-out:** a past day left open counts no hours until someone edits it. It raises an alert and a notification to the foreman. | Working |

## Overtime and timesheets

| ID | Rule | Status |
|---|---|---|
| CRW-030 | **Overtime follows the work rule in effect** (Settings). Company default: New Hampshire / federal FLSA — over **40 hours in the week** (Monday to Sunday) pays **1.5×**. | Working |
| CRW-031 | If the work rule has **daily overtime** (for example, over 8 h → 1.5×; over 12 h → 2×), hours already paid as daily overtime do not count again toward weekly overtime. | Working |
| CRW-032 | A work rule applies to whole weeks, starting on a Monday. | Working |
| CRW-033 | **Weighted regular rate:** if the hourly rate changed during the week, the overtime premium (0.5×) is calculated on the week's weighted average. | Working |
| CRW-034 | **Contractors (1099) and exempt employees** do not get overtime. Contractors also carry no labor burden. | Working |
| CRW-035 | **Weekly approval:** the office approves or returns the week (with a reason). Only approved weeks go to the payroll CSV. | Working |
| CRW-036 | A week cannot be approved while someone has a **missing clock-out**. | Working |

## Cost

| ID | Rule | Status |
|---|---|---|
| CRW-040 | **Hourly rate with effective date:** a change creates a new rate "from" a date, with a reason. The past is never rewritten: each day uses the rate in effect that day. | Working |
| CRW-041 | A new hourly rate cannot start **inside a week that is already approved** (it went to payroll). | Working |
| CRW-042 | **Job cost** = hours × rate in effect that day + the overtime premium **split across jobs** by that week's hours + **labor burden** on payroll. | Working |
| CRW-043 | **Labor burden** has effective dates (Settings › Labor burden). Default: 32.05% (FICA 7.65%, FUTA 0.60%, SUTA 2.80%, workers' comp 14.00%, benefits 7.00%). | Working |
| CRW-044 | **Forecast:** with a percent complete, estimate at completion = actual ÷ percent complete. Without it, actual + average of the last 4 complete weeks × weeks left to the end date. | Working |
| CRW-045 | **Job status:** **On track** (forecast ≤ budget), **Watch** (up to 5% over), **Projected overrun** (more than 5% over). | Working |

## Location

| ID | Rule | Status |
|---|---|---|
| CRW-050 | **Location only while clocked in.** Recorded at each punch, when the app is opened during the workday and every 15 minutes on site (every 5 while traveling). Never during breaks, while clocked out or off hours. The worker is told so. | Simulated (see Prototype status) |
| CRW-051 | The day map is seen by those who follow the time clock (office). | Working |

## Access

| ID | Rule | Status |
|---|---|---|
| CRW-060 | **Dollar amounts** (costs, wages on timesheets) require **See costs and dollar amounts**. Workers and foremen see hours, never money. | Working |
| CRW-061 | **Approve, return, edit and export** require **Approve and edit timesheets**. Without it, timesheets are read-only. | Working |

!!! confirm "To be confirmed"
    - Whether workers' comp should vary by trade (labor burden per role).
    - Prevailing wage (Davis-Bacon) on public jobs: a rate per job and trade.
    - Overtime split: by hours (today) or to the job that caused it; configurable per company?
    - Cost alerts in the notifications when a job turns **Watch** or **Projected overrun**.
    - Whether the foreman sees the job's hour budget (without dollar amounts).
