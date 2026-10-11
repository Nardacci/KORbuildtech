# Prototype status

What is simulated in the prototype today, and what comes next.

## Simulated today

| Item | In the prototype | In the product |
|---|---|---|
| Where the data lives | Only in the browser of each device. | A cloud database, separated by company, with audit trail. |
| GPS at the punch | The browser's GPS; without it, the job's location. | The store app's GPS, with accuracy and checks against fake GPS. |
| Location during the workday (trail) | **Simulated** from the punches (the map says *Simulated trail*). | The store app's GPS in the background, with notice and consent. A web app cannot record in the background. |
| Street maps, routes and addresses | Free public services (OpenStreetMap, OSRM, Nominatim), with usage limits; without internet, a simple drawing. | A paid provider (Google, Mapbox or HERE). |
| Past weeks | Generated as summarized history. | Real approved timesheets. |
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
