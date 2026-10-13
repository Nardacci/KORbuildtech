# Prototype status

The prototype (the demo with sample data) shows the product working. Beside it, the **real account** already runs Measure on the cloud database and is in homologation. This page says what is real today and what is still simulated in the demo.

## Already running on the database (real account)

| Item | How it works today |
|---|---|
| Projects, plans and takeoff | Projects, PDF plans (in the company's cloud storage), scale, conditions with their measurements and typicals are saved as you work, on the computer with internet; reopening on another computer shows the same takeoff. Two people on the same condition: the second is warned and sees the database version. |
| Catalog, prices and markups | The company's own items and assemblies; prices and markups are versions with effective dates that never change or disappear, with the author recorded. Money is visible only to those with the catalog permission or cost visibility. |
| Proposal | Issued proposals are numbered by the database (P-YYYY-NNN, per company and year) and frozen; they stay on record even if the project is deleted. |

## Simulated today (in the demo)

| Item | In the prototype | In the product |
|---|---|---|
| Where the data and the PDFs live | In the browser (the PDFs in the browser's storage). | The company's cloud storage, shared by its estimators — **already running** in the real account. |
| Sending email (quote requests, proposals) | Your email program opens with the message ready; you attach the PDF. | Sent by KORbuild, with the PDF attached and a record of what was sent. |
| PDF of the quote request and the proposal | Printed from the browser (**Save as PDF**). | Generated on the server, ready to download. |
| Catalog, prices and markups | Sample items, prices and markups for the demo — **not market references**. | Each company's own catalog and supplier prices — **already running**. |
| Click precision | Each click falls on a whole screen pixel; at normal zoom that is about 3/4" per point. The scale check shows the error, and a larger zoom reduces it. | Snapping to the lines of vector PDFs. |

## Coming next

| Item | Notes |
|---|---|
| Labor budget for Crew | Estimated hours per cost code become the job's labor budget. |
| Progress for Daily | Measured quantities as the reference for physical progress. |
| Measure on the phone | Read-only: projects, quantities, materials, quote lists and issued proposals, with PDF and email. Drawing stays on the computer. |
| More assemblies and trades | Roofing, drywall, concrete and others, with formulas from each trade. |
