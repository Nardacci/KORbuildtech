# Prototype status

The prototype (the demo with sample data) shows the product working. Beside it, the **real account** already runs the time clock on the cloud database and is in homologation. This page says what is real today and what is still simulated in the demo.

## Already running on the database (real account)

| Item | How it works today |
|---|---|
| Time clock | The foreman clocks in the crew and the worker clocks in and out on their own phone, online or offline: the phone keeps the punch and sends it when the signal is back, **with the time it was punched**. A punch is never edited or deleted; the database refuses it. |
| Crew photo | At the foreman's clock-in the **Crew photo** field opens the phone camera; the photo is reduced, stamped with job, time and place, kept on the phone and sent with the punch (offline too). The office sees it as a thumbnail on the person's day; the general contractor does not see photos. |
| Geofence | Checked by the database at every punch; outside the geofence the punch is accepted, flagged and listed for the office to review. |
| Office | Review, adjust (a new punch with a reason), approve and return the week, labor budget. A week with a missing clock-out cannot be approved; an approved week is closed — no late punch, no adjustment, no new hourly rate inside it. |
| Location during the workday | After the worker accepts the **location notice** in the app, the phone records its position while the app is open and the person is clocked in: when the app is opened and every 15 minutes on site (5 while traveling). Never during breaks or clocked out — the database refuses those. The day map shows the real records and flags stretches with no record (app closed). |
| General contractor | Sees names, trades and hours of the subcontractors' people on its jobs — never wages, costs or location. |

## Simulated today (in the demo)

| Item | In the prototype | In the product |
|---|---|---|
| Where the data lives | Only in the browser of each device. | The cloud database, separated by company, with audit trail — **already running** in the real account. |
| GPS at the punch | The browser's GPS; without it, the job's location. | The store app's GPS, with accuracy and checks against fake GPS. |
| Location during the workday (trail) | **Simulated** from the punches (the map says *Simulated trail*). | **Already running** while the app is open, after the worker's consent. With the app closed or the screen locked the browser cannot record: that part needs the store app, which will use the same database. |
| Street maps, routes and addresses | Free public services (OpenStreetMap, OSRM, Nominatim), with usage limits; without internet, a simple drawing. | A paid provider (Google, Mapbox or HERE). |
| Past weeks | Generated as summarized history. | Real approved timesheets — **already running**. |
| Labor burden | One % for the whole company, with effective dates. | By state and by trade (workers' comp class). |
| Labor budget | Typed in; cost codes generated. | Imported from the job's estimate (Measure), with versions. |
| Payroll | A generic CSV file. | Integrations (QuickBooks, Gusto, ADP) and certified payroll (WH-347). |

## Coming next

| Item | Notes |
|---|---|
| Geofence reminder to clock in | Reminds the worker at the job; never clocks in by itself. |
| Percent complete from Daily and Measure | Instead of typing it in Costs. |
| Payroll integrations and certified payroll | Phase 2. |
| Full job cost (materials, subcontractors, equipment) and margin | Under study: Crew sees own labor only. |
