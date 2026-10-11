# Business rules

Each rule has an ID (`DLY-nnn`) so it can be quoted in meetings, tests and change requests. The **Status** column says whether the rule works in the prototype today.

!!! note "Source"
    These rules come from the prototype's code and from the product decisions recorded in the project documentation (daily report alerts, jobs, schedule). Where something was not decided yet, it is marked **To be confirmed**.

## Who reports and when

| ID | Rule | Status |
|---|---|---|
| DLY-001 | Every job has **one person responsible** for its daily report. Reminders and alerts go to that person. | Working |
| DLY-002 | A report is required for each **workday of the job's calendar** (default: Monday to Saturday). Days that are not workdays generate no alert; if there is work, a report can still be filled out. | Working |
| DLY-003 | Only jobs **in progress** require reports. Jobs **on hold** or **completed** do not appear in the field and generate no alert. A job also requires nothing before its start date. | Working |
| DLY-004 | The daily **deadline is 6 PM** of the day itself. | Working |
| DLY-005 | A day is **done** when its report was submitted (even if it is still saved on the phone, without signal) or when it was logged as **No work**. | Working |
| DLY-006 | **No work** requires a reason (rain, holiday or day off, job on hold, material shortage, strike, other) and may have a note. It counts as the report of the day and stops that day's alerts. | Working |

## Alerts

| ID | Rule | Status |
|---|---|---|
| DLY-010 | At **4 PM**, the person responsible gets a reminder: today's report is missing. | Working (app open) |
| DLY-011 | At **6 PM**, the report of the day is **late**: the person responsible gets an alert. | Working (app open) |
| DLY-012 | At **8 AM of the next day**, the office sees on the Dashboard and in notifications every job with no report on its last workday, with the person responsible. | Working |
| DLY-013 | Alerts go to the in-app notifications (bell) and to the phone's notifications. **No SMS or email** for now. | Working |
| DLY-014 | The field's pending count (late days + jobs without today's report + requests for changes) shows on the **Today** tab and, where the phone allows it, on the app icon. | Working |

## Late reports

| ID | Rule | Status |
|---|---|---|
| DLY-020 | The **last 3 workdays** without a report are shown as late and can be filled out. | Working |
| DLY-021 | A report submitted after the deadline is accepted but marked **Submitted late** in the report and in the PDF, with the date and time of submission and the deadline it missed. | Working |
| DLY-022 | Lateness is measured on the **first submission**: resubmitting after a request for changes does not count as late. | Working |

## Filling out the report

| ID | Rule | Status |
|---|---|---|
| DLY-030 | A report can only be submitted with: the weather of the morning and of the afternoon, at least one person present in the crew and at least one activity described. | Working |
| DLY-031 | A report without photos can be submitted, after a confirmation. | Working |
| DLY-032 | The weather is pulled automatically from the job's location for the morning (7 AM–12 PM) and the afternoon (1 PM–5 PM). More than 2 mm of rain in a period marks it **Not workable**. Everything can be corrected by hand; the report shows whether the weather was automatic, adjusted or manual. | Working |
| DLY-033 | **Copy from a previous report** brings the crew (absences reset to zero), the equipment and the activities still in progress. Weather, photos and issues are never copied. | Working |
| DLY-034 | The crew can be filled from the people who clocked in on the job that day in Crew. | Working |
| DLY-035 | Everything typed is saved on the phone as it is entered, with or without signal. | Working |
| DLY-036 | A report submitted without signal waits in a queue on the phone and uploads by itself, photo by photo, when the connection comes back. | Working |
| DLY-037 | An activity may point to a task of the job's schedule with its % complete. The schedule receives it only when the report is **approved**. | Working |

## Photos as evidence

| ID | Rule | Status |
|---|---|---|
| DLY-040 | Each photo gets a stamp **inside the image** with the job, date, time and GPS coordinates. | Working |
| DLY-041 | Without GPS, the job's location is used, and the stamp says so. | Working |
| DLY-042 | Photos are reduced on the phone (about 1,600 px and 300 KB) before uploading. | Working |
| DLY-043 | A digital fingerprint (SHA-256) of the **original** file is kept with each photo. | Working |

## Approval and seal

| ID | Rule | Status |
|---|---|---|
| DLY-050 | Only users with **Approve reports and send to the client** can approve or request changes. | Working |
| DLY-051 | A request for changes requires a reason, which appears on the field's phone. The report goes back to **Changes requested**. | Working |
| DLY-052 | At approval, the whole content of the report (including each photo's fingerprint) receives a SHA-256 fingerprint. Its first 12 characters become the **verification code**. | Working |
| DLY-053 | An approved report **cannot be changed by anyone**. | Working |
| DLY-054 | Each report keeps a history: who started it, submitted it, when it reached the office, who requested changes and who approved it. | Working |
| DLY-055 | **The general contractor approves.** On a subcontractor's job linked to a general contractor's job, the report goes to the general contractor's approval queue. The report stays in the subcontractor's account, with who approved it and the company (*Ana Ribeiro (Example Builders)*). The subcontractor cannot approve it. | Working |
| DLY-056 | **On its own jobs, the subcontractor approves.** On a job directly with the owner (no general contractor linked), the subcontractor's own people approve. | Working |
| DLY-057 | When the general contractor approves, the % complete informed in the report goes to the **subcontractor's** job schedule. | Working |
| DLY-058 | A general contractor does not fill out daily reports: its jobs are reported by the subcontractors working on them. | Working |

## Sharing with the client

| ID | Rule | Status |
|---|---|---|
| DLY-060 | Only **approved** reports can be shared. | Working |
| DLY-061 | The client opens the report by a link, read-only, **without an account**. | Working (same browser only, see Prototype status) |
| DLY-062 | Every time the link opens, the seal is checked: if the content changed after approval, the page says the document does not match what was approved. | Working |
| DLY-063 | The PDF has the company logo, the job, the weather, the tables, the photos with caption, date and GPS, the seal and signatures. | Working (printed from the browser) |

## Office follow-up

| ID | Rule | Status |
|---|---|---|
| DLY-070 | **Job status:** green when today's report was received, yellow with 1 day behind, red with 2 days or more. | Working |
| DLY-071 | The Dashboard shows the reports of the day, those awaiting approval, the jobs with late reports and the photos received today. | Working |
| DLY-072 | For a general contractor, the job status, the next-morning alert and the notifications are **per subcontractor on each job**. | Working |
| DLY-073 | On each job, the general contractor sees every subcontractor's people on site: name, trade, time in, who is there now and hours. **Never wages, labor burden or cost.** | Working |

!!! confirm "To be confirmed"
    - Whether the 6 PM deadline and the 4 PM reminder become a setting per company or per job.
    - Whether a report approved by mistake can be reopened (today: never).
    - SMS and email reminders (left out for now: SMS in the US requires A2P 10DLC registration and consent).
