# Roles and permissions

In KORbuild, nothing about access is hard-coded. The product defines the **catalog of permissions**; each company decides **which permissions each role has** (Settings › Roles) and **which role each user has** (Settings › Users). Every change goes to the audit log.

## The permission catalog

| Group | Permission | What it allows |
|---|---|---|
| Crew · time clock | **Clock in and out (self)** | My time clock: clock in, break and clock out on your own phone, with GPS. |
| Crew · time clock | **Clock in the crew** | Foreman: clocks the crew in and sees their hours. |
| Crew · office | **View time clock and timesheets** | Now, timesheets and the day map. |
| Crew · office | **Approve and edit timesheets** | Approve, return, edit and export to payroll. Includes *View*. |
| Crew · office | **See costs and dollar amounts** | Job costs, budgets, wages on timesheets. Includes *View*. |
| Daily | **Fill out daily reports** | Create and submit daily reports for your jobs. |
| Daily | **View all jobs** | Dashboard, jobs and submitted reports. |
| Daily | **Approve reports and send to the client** | Approve, request changes, PDF and client link. Includes *View all jobs*. |
| Daily | **Build the job schedule** | Tasks, baseline, publish to the client and export to Excel. Includes *View all jobs*. |
| Measure | **Measure plans** | Projects, plans, scale, measuring, assemblies, quote lists and proposals. |
| Measure | **Items and assemblies** | Catalog, formulas, prices and markups. Includes *Measure plans*. |
| Settings | **Employee records** | Employee records, certifications and hourly rates. |
| Settings | **Labor burden and work rules** | New versions, with effective dates. |
| Settings | **Users and access roles** | Who signs in and what each role can do; audit log. |
| Settings | **Company, account and plan** | Company profile, plan and modules. |
| Settings | **Contacts** | The directory of general contractors, clients, suppliers and subcontractors. |
| Settings | **Add and edit jobs** | Jobs and task templates. |

**See costs and dollar amounts** is separate on purpose: a superintendent can approve hours without seeing anyone's wage.

## Default roles

| Role | In short | When they sign in |
|---|---|---|
| **Worker** | Clock in and out (self). | Straight to **My time clock** — no modules screen, no menu. |
| **Foreman** | Own time clock, crew time clock, daily reports. | Modules screen (Daily and Crew). |
| **Project manager** | Follows and approves in Daily and Crew, sees costs, measures, creates jobs. | Modules screen (Daily, Crew, Measure and Settings with Jobs only). |
| **Admin** | Everything in the office, including Settings. **Locked.** | Modules screen. |

![The permission matrix](img/settings-roles.png)

!!! note "Good to know"
    - **The home screen follows the permissions.** Someone with a single module goes straight into it.
    - **Admin is locked**, so the company never loses the ability to manage access. There must always be at least one active user with *Users and access roles*, and nobody can remove their own access.
    - **Dependencies are automatic:** approving includes viewing; seeing costs includes viewing.
    - **A role in use cannot be deleted:** change the users' role first.
    - **Without permission, the screen does not open**, even by typing its address.
    - A **user** is someone who signs in; an **employee** is someone who works on the jobs. A worker who clocks in on their own phone needs both, linked. Someone the foreman clocks in needs no login.

## Examples

- **A worker who also fills out the daily report:** check *Fill out daily reports* on the Worker role, or create a new role from it. They will see Daily and Crew.
- **A foreman who approves timesheets:** create a role from Foreman and check *Approve and edit timesheets*.

## In the prototype

| Demo user | Company | Role |
|---|---|---|
| Ana Ribeiro | Example Builders (general contractor) | Admin |
| Sandra Lopes | Ridgeline Concrete & Masonry | Admin |
| Márcia Souza | Ridgeline Concrete & Masonry | Project manager (not on the sign-in list) |
| Tom Reilly | Northfield Framing & Siding | Admin |
| Rita Gomes | Northfield Framing & Siding | Project manager |
