# Roles and permissions

What each person can do in Crew comes from their **access role** (Settings › Access roles). The company can adjust the default roles or create new ones.

## Crew permissions

| Permission | What it allows |
|---|---|
| **Clock in and out (self)** | **My time clock**: clock in, break and clock out on your own phone, with GPS. |
| **Clock in the crew** | **Crew time clock** and **Hours**: punch the crew and see their hours. |
| **View time clock and timesheets** | **Now**, **Timesheets** and the **Day map** (read-only). |
| **Approve and edit timesheets** | Approve, return, edit and export to payroll. Includes **View time clock and timesheets**. |
| **See costs and dollar amounts** | **Costs**, budgets and wages on timesheets. Includes **View time clock and timesheets**. |

## Default roles

| Role | Self | Crew | View | Approve | Costs | Where Crew opens |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Admin** | — | — | ✓ | ✓ | ✓ | Now |
| **Project manager** | — | — | ✓ | ✓ | ✓ | Now |
| **Foreman** | ✓ | ✓ | — | — | — | Crew time clock |
| **Worker** | ✓ | — | — | — | — | My time clock (straight, no modules screen) |

!!! note "Good to know"
    - A **worker** only clocks in and out: KORbuild opens straight on **My time clock** and does not open any other screen, even by typing its address.
    - A **user** is someone who signs in; an **employee** is someone who works on the jobs (Settings › Employees). A worker who clocks in on their own phone needs both, linked. Someone the foreman clocks in does not need a login.
    - Workers and foremen see hours, never dollar amounts.

## In the prototype

| Demo user | Role | Use it to show |
|---|---|---|
| Diego Santos | Worker | **My time clock** |
| Carlos Mendes | Foreman | **Crew time clock** and **Hours** (Carlos's crew) |
| Ana Ribeiro | Admin | **Now**, **Timesheets**, **Costs** |
| Márcia Souza | Project manager | The office without Settings (not on the sign-in list) |
