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

## In the prototype

| Demo user | Role | Company |
|---|---|---|
| Carlos Mendes | Foreman | Example Builders |
| Ana Ribeiro | Admin | Example Builders |
| Márcia Souza | Project manager | Example Builders |
| Diego Santos | Worker | Example Builders |
| Tom Reilly | Admin | Northfield Framing & Siding |
| Rita Gomes | Project manager | Northfield Framing & Siding |
| José Pereira | Foreman | Northfield Framing & Siding |
| Luis Ortega | Worker | Northfield Framing & Siding |

Márcia Souza and Roberto Lima (a second foreman) exist in the sample data but are not on the sign-in list.
