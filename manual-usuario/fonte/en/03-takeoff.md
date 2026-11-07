# Takeoff: from the plan to the proposal

Takeoff takes a project from start to finish: **items and assemblies** (the price catalog), **project**, **plans**, **scale**, **measuring**, **materials**, **schedule**, **proposal** and **release to the job**. The project's **Overview** card counts the steps ("5 of 6 steps") and tells you what is missing.

## The catalog: items and assemblies

An **item** is a material or an hour of labor, with a code, unit and price. An **assembly** is a recipe: it combines items with formulas. For example, "Drywall, walls" uses one sheet for every 32 sq ft of wall and one labor hour for every 50 sq ft.

To create an item, open **Items › New item**. Pick the category:

- **Material:** you type the price (the price history is kept, with the date of each one).
- **Labor:** pick the **job role**. The price comes from the role's hourly rate (see the previous chapter) and the price field disappears.

![New item](img:item-novo)

The item's **Pricing** tab shows today's price and the history.

![Item: pricing](img:item-precos)

**Assemblies** live under **Assemblies**.

![Assemblies](img:assemblies)

Open an assembly to see its lines. Each line has the item, the **formula** (for example `MeasuredArea / 32`, the measured area divided by 32) and the **waste** percentage.

![Assembly: lines and formulas](img:assembly-editor)

## Create the project

Under **Projects › New project**, enter the name, the client (chosen from Contacts), the city and the state. Tap **Continue to plans**.

![New project](img:projeto-novo)

## Upload the plans

On the **Plans** tab, upload the PDF. Each page becomes a **sheet** of the project.

![Plans: upload](img:plantas-vazio)

![Plans uploaded](img:plantas)

## Set and check the scale

Before measuring, each sheet needs a **scale**. Open the sheet, tap **Scale** and pick the scale printed on the plan itself (for example 1/4" = 1'-0").

![Set the sheet's scale](img:escala)

Then **check** it: mark the two ends of a dimension the plan already shows (for example 40'-0") and enter the real value. The system compares and shows the error. Measuring is only reliable with a checked scale.

![Check the scale on a dimension](img:escala-conferir)

## Measure

With the scale checked, use **Add assembly** to create a **condition** (for example "Garage floor") linked to an assembly, then measure on the drawing. For an area, click the corners and close on the first point (or double-click). The left panel shows the measurement and the assembly applied.

![Add an assembly to the drawing](img:takeoff-assembly)

![Takeoff: measuring on the drawing](img:takeoff)

Other tools on the bar: **Pan**, **Deduct**, **Opening** (such as doors and windows), **Typical** (sheets that repeat).

## Materials and labor

The **Materials** tab shows what the measurements call for: each material with its quantity and the calculation trail, and the **estimated labor** in hours. Quantities are rounded up.

![Materials and labor](img:materiais)

## Schedule

On the **Schedule** tab, add the tasks with a **start** and **duration in days**; the end date is calculated. Under **Who does it**, say whether it is your crew or a subcontractor.

![Schedule](img:cronograma)

The project's **Gantt** draws these tasks and, once Daily starts, shows the progress (see the next chapter).

## Project overview

The Overview lists the steps and what is missing. When everything is ready, the **Job** card enables the **Release for construction** button.

![Project overview](img:projeto-visao)

## Proposal

On the **Proposal** tab, the system builds one line per phase: cost (material + labor) with **overhead** and **profit** applied. Check it and tap **Issue**. The proposal gets a number (P-YYYY-NNN) and is kept.

![Proposal](img:proposta)

The proposal is optional for releasing the job.

## Release for construction

On the Overview, check the **Construction start** field (it comes with today's date) and tap **Release for construction**.

![Release for construction](img:liberar)

The project becomes a job in **Daily**. The card now shows **Released for construction**, who released it and the **Open in Daily** button. You can still change the start date later, and the job follows. If you need to revisit the estimate, use **Back to analysis**: the job leaves Daily until you release it again.

![Project released to the job](img:liberado)

> **Once the project already has a daily report,** the **Back to analysis** button disappears: a job is already under way.
