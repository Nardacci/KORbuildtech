# Roles and permissions

In KORbuild, what each person can do comes from their **access role**. A role is a set of permissions; the company can adjust the default roles or create new ones in **Settings › Access roles**. Nothing is hard-coded.

## Daily permissions

| Permission | What it allows |
|---|---|
| **Fill out daily reports** | Create and submit the reports of your jobs (the field area: **Today** and **History**). |
| **View all jobs** | The office area: **Dashboard**, **Jobs** and the reports received. |
| **Approve reports and send to the client** | Approve, request changes, download the PDF and share the client link. Includes **View all jobs**. |
| **Build the job schedule** | Tasks, baseline, publish to the client and export to Excel. Includes **View all jobs**. |

## Default roles

| Role | Fill out | View all jobs | Approve | Build the schedule | Where Daily opens |
|---|:---:|:---:|:---:|:---:|---|
| **Admin** | — | ✓ | ✓ | ✓ | Dashboard |
| **Project manager** | — | ✓ | ✓ | ✓ | Dashboard |
| **Foreman** | ✓ | — | — | — | Today |
| **Worker** | — | — | — | — | (no Daily: goes straight to **My time clock**) |

!!! note "Good to know"
    - The **Admin** role is locked, so the company always has someone who can manage access. An admin who also fills out reports needs a new role created from it, with **Fill out daily reports** added.
    - Someone without **View all jobs** never opens the office screens; someone without **Fill out daily reports** never opens the field screens. Typing the address of a screen does not get around it.
    - The **client** is not a user: they receive the link of the approved report and need no account.
    - **Who approves depends on the job, not only on the role.** On a subcontractor's job linked to a general contractor, the general contractor's people with **Approve reports** approve it; the subcontractor sees *With the general contractor* and cannot approve. On a job the subcontractor has directly with the owner, its own people approve.
    - A **general contractor** does not fill out reports: its Daily is the Dashboard, Approvals and Jobs, covering every subcontractor on its jobs.

## In the prototype

| Demo user | Role | Company |
|---|---|---|
| Ana Ribeiro | Admin | Example Builders (general contractor) |
| Sandra Lopes | Admin | Ridgeline Concrete & Masonry (sub) |
| Carlos Mendes | Foreman | Ridgeline Concrete & Masonry (sub) |
| Diego Santos | Worker | Ridgeline Concrete & Masonry (sub) |
| Tom Reilly | Admin | Northfield Framing & Siding (sub) |
| Rita Gomes | Project manager | Northfield Framing & Siding (sub) |
| José Pereira | Foreman | Northfield Framing & Siding (sub) |
| Luis Ortega | Worker | Northfield Framing & Siding (sub) |

Laura Pierce (project manager at Example Builders), Márcia Souza (project manager at Ridgeline) and Roberto Lima (a second foreman at Ridgeline) exist in the sample data but are not on the sign-in list.
