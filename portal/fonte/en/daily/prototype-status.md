# Prototype status

The prototype (the demo with sample data) shows the product working. Beside it, the **real account** already runs on the cloud database and is in homologation. This page says what is real today and what is still simulated in the demo, so nobody promises more than exists.

## Already running on the database (real account)

| Item | How it works today |
|---|---|
| Accounts | Sign up with email and password; the company, its users, roles and invitations live on the database, separated by company. |
| Daily reports | Filled out in the field with photos, online or offline: the phone keeps the report and sends it when the signal is back. The same report never gets duplicated by a bad connection. |
| Approvals | The office approves or asks for changes; a subcontractor's report on a linked job is approved by the general contractor, never by the sub. |
| Seal | The database computes the seal (SHA-256) and the verification code at approval; nothing can change afterwards. |
| Client link | Opens anywhere, no sign-in, with the photos by temporary links; the database checks the seal on every open. |
| Job schedule | Stages with start and end, baseline, percent complete from the approved report (or by hand, with history) and publication to the general contractor by version. A stage that already received progress from an approved report cannot be deleted, and only the person who approved can change it. |
| Two devices, one report | If the same report was changed on another device while offline, the second one is warned and chooses which version stays. |

## Simulated today (in the demo)

| Item | In the prototype | In the product |
|---|---|---|
| Where the data lives | Only in the browser of each device. | The cloud database, separated by company — **already running** in the real account. |
| Reminders at 4 PM and 6 PM | Only while the app is open. | Sent by the server, even with the app closed. |
| **Improve text** | Simple rules on the phone. | AI, keeping the original text alongside. |
| PDF | Printed from the browser (**Save as PDF**). | Generated on the server, ready to download. |
| Client link | Opens only in the same browser. | Opens anywhere — **already running**. |
| Losing signal | Simulated by tapping **Online**. | Real — **already running** (the phone keeps the report and sends it later). |
| Sign-in | Demo users, no password. | Company email and password — **already running**. |
| Weather | Real (Open-Meteo), when there is internet. | Same. |

## Coming next

| Item | Notes |
|---|---|
| Crew from the time clock in the report | Already running: the report's crew comes from who clocked in at the job. |
| Store apps (App Store, Google Play) | Planned; the prototype already installs on the home screen. |
| Settings for deadline and reminder times | To be confirmed. |
| SMS and email reminders | Evaluated later (US rules for business SMS). |
| GC invites the trade contractor (bid) and a channel between them | Specified; next stage of the database (today the jobs are linked by the KORbuild team). |
