# Prototype status

What is simulated in the prototype today, and what comes next.

## Simulated today

| Item | In the prototype | In the product |
|---|---|---|
| Where the data lives | In the browser. | A cloud database, separated by company, with the audit log on the server. |
| New users | Created on the Users screen; no email is sent and there are no real passwords. | An email invitation; the person sets a password (or signs in with the company's identity provider). |
| Map on the job form | Free public maps (OpenStreetMap), with usage limits. | A paid map provider and address search. |
| Labor burden | One % for the whole company, with effective dates. | By state and by trade (workers' comp class). |
| Logo | Stored in the browser. | The company's cloud storage. |

## Still fixed in the code

These values are the same for every company today and will move to Settings:

| Value | Today | Will go to |
|---|---|---|
| Daily report deadline and reminders | 6 PM deadline, 4 PM reminder, office alert at 8 AM next day, 3 days back | Settings › Daily report (and per job) |
| Default geofence radius | 150 m | Settings › Time clock and GPS (and per job) |
| Location interval during the workday | 15 min (5 min while traveling) | Settings › Time clock and GPS |
| Cost alerts | Watch up to 5% over; forecast from the last 4 weeks | Settings › Costs and forecast |
| Lists on the daily report | Trades, equipment, issue types | Settings › Lists (the same ones as Crew) |

## Coming next

| Item | Notes |
|---|---|
| Permissions per job | A foreman sees only his jobs; a project manager only his region. |
| Work rules per job | Prevailing wage (Davis-Bacon), jobs in another state. |
| Invitations by email | For users, and for subcontractors invited by a general contractor. |
| Payroll integrations | QuickBooks, Gusto, ADP. |
| Notification preferences | Per user. |
