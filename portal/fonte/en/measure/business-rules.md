# Business rules

Each rule has an ID (`MSR-nnn`) so it can be quoted in meetings, tests and change requests. The **Status** column says whether the rule works in the prototype today.

!!! note "Source"
    These rules come from the prototype's code and from the Measure specification in the project documentation. Open points are marked **To be confirmed** at the end.

## Units and measuring

| ID | Rule | Status |
|---|---|---|
| MSR-001 | **No fractions or text in the math.** Lengths are stored in inches, areas in square inches, volumes in cubic inches. Feet and inches appear only on screen. | Working |
| MSR-002 | **Points are stored in the PDF page's coordinates**, never in screen pixels. Zoom and screen resolution never change a measurement. | Working |
| MSR-003 | **The scale belongs to the sheet.** It comes from the list (architectural and engineering scales) or from calibrating on a known dimension. Each sheet has its own scale. | Working |
| MSR-004 | **Scale check:** after setting the scale, measure another known dimension. A difference above 1% is flagged. | Working |
| MSR-005 | **A measurement is always calculated from the drawing**, never typed in, so every quantity can be traced back to the plan. | Working |
| MSR-006 | **Rounding only on screen:** feet and inches to 1/16", square feet to whole numbers. The stored value does not change. | Working |
| MSR-007 | Accepted entries: `12'-6 1/2"`, `12' 6.5"`, `12'6"`, `12'`, `6"`, `150"`, `12.54'`, `12-6`, `12-6-1/2`. A number without a unit is read as feet. `12'-14"` is refused (inches must be under 12 when feet are given). | Working |
| MSR-008 | Roof pitch is entered as `6/12`, `6:12` or `6`; the factor is √(1 + (6/12)²) = 1.118. | Working |

## Conditions

| ID | Rule | Status |
|---|---|---|
| MSR-010 | A **condition** is what you measure (exterior walls, LVP floor, siding, windows W1). It has a name, a type, a color and properties, and measurements on one or more sheets. | Working |
| MSR-011 | **Three types:** linear (with height → surface; with pitch → pitched length), area (with pitch → roof area; with thickness → volume) and count. | Working |
| MSR-012 | **Openings:** a count (window, door) can have a width and a height. A wall or an area can **deduct the openings** of chosen counts, from any sheet of the project. Counting one more window updates the sheathing, the drywall and the siding. | Working |
| MSR-013 | **Deduct (eraser):** on an area, a drawn polygon is subtracted from the total (stairs, chimney, cut-out). | Working |
| MSR-014 | **Drawn opening:** the Opening tool draws the window or door rectangle, adds 1 to the chosen count and cuts the same area out of the areas behind it. An opening already cut out is not deducted again (no double deduction). Deleting one deletes the other. | Working |
| MSR-015 | **Conditions per sheet:** each sheet shows only the conditions added to it. A condition can be reused on another sheet; its measurements add up to the same total. | Working |
| MSR-016 | The drawing starts **empty**: conditions are created by adding an assembly from the catalog (or "Just measure, no assembly"). | Working |
| MSR-017 | **Show on the drawing:** hiding a condition is only visual; quantities and materials do not change. | Working |

## Items, assemblies and formulas

| ID | Rule | Status |
|---|---|---|
| MSR-020 | An **item** is what you buy or pay for, in its **purchase unit** (sheet, box, roll, piece, cu yd, hour), with a category (material, labor, equipment, subcontractor) and a cost code (CSI MasterFormat). | Working |
| MSR-021 | An **assembly** is a set of lines for one type of condition. One measurement feeds many items. | Working |
| MSR-022 | A **formula** only calculates the **raw** quantity. **Waste %** and **rounding** (none, or up to 1, 0.5 or 0.25) are separate columns, never numbers hidden in the formula. | Working |
| MSR-023 | **Variables in trade units**, with the names US estimators use: `MeasuredLinear`, `MeasuredArea`, `MeasuredCount`, `WallHeight`, `SurfaceArea`, `NetSurfaceArea`, `NetArea`, `OpeningArea`, `OpeningPerimeter`, `VolumeCY`, `PitchedArea`… | Working |
| MSR-024 | **Safe formulas:** only numbers, + − × ÷ ^, parentheses, the variables of the type and `ceil floor round min max sqrt abs`. Anything else is refused when typing and when saving; formulas are never executed as code. | Working |
| MSR-025 | A formula is tested with sample values when saved; division by zero and negative results are refused, and the error names the line. | Working |
| MSR-026 | **A missing property does not break the takeoff:** if an assembly needs `SurfaceArea` and the condition has no height, the line becomes a **to-do** ("missing on the condition: height"). | Working |
| MSR-027 | Rounding is applied **per line** (the way each trade buys); the item total adds up the lines. | Working |
| MSR-028 | **Full trace:** each material shows condition · assembly → formula = raw → + waste → rounded, with the values of the variables. The CSV export carries the same trace. | Working |

## Projects

| ID | Rule | Status |
|---|---|---|
| MSR-030 | Name, client, city and state are required; state with 2 letters, ZIP with 5 digits (or 5+4). | Working |
| MSR-031 | **Status:** Estimating → Proposal sent → Won or Lost. The bid due date alerts (overdue, today, within 3 days) only while Estimating. | Working |
| MSR-032 | Deleting a project deletes its sheets and conditions, after confirmation. | Working |
| MSR-033 | A **won** project can create the job (Settings › Jobs), with the client and address filled in; project and job stay linked. | Working |

## Typicals (what repeats)

| ID | Rule | Status |
|---|---|---|
| MSR-040 | A **typical** has a name, a region of the sheet (or the whole sheet) and its **occurrences**: where it repeats and how many times, counting the one drawn (e.g., Building A 3 + Building B 3 = × 6). | Working |
| MSR-041 | A measurement belongs to the typical when its **center** falls inside the region; it counts × the total of occurrences. | Working |
| MSR-042 | The multiplication applies **everywhere**: condition totals, openings, formula variables, materials, quote lists and the proposal. | Working |
| MSR-043 | Typicals do not overlap, and a whole-sheet typical cannot coexist with regions on the same sheet (it would multiply twice). | Working |
| MSR-044 | Changing the occurrences recalculates immediately; deleting the typical makes the measurements count once again. | Working |

## Quotes and proposals

| ID | Rule | Status |
|---|---|---|
| MSR-050 | The **material list for quotes** has only materials (no labor), in purchase units, with waste and rounding, **split by supplier**: each supplier gets only the cost codes it supplies (Settings › Contacts). Items nobody supplies go to "No supplier". | Working |
| MSR-051 | Suppliers never see selling prices, labor or formulas. | Working |
| MSR-052 | Prices a supplier sends back can be entered on the list; they become the item's price from that date, with the source "Quote · supplier". | Working |
| MSR-053 | **Prices have effective dates:** a new price applies from a date; old prices stay in the history. The proposal uses the price in effect on the day. | Working |
| MSR-054 | **Markups have effective dates:** overhead % on cost; profit as **markup** (% on cost + overhead) or as **margin** (% of the selling price); sales tax on materials (a setting; 0 in the New Hampshire example). | Working |
| MSR-055 | **Calculated line price** = (materials × (1 + tax) + labor + other) × (1 + overhead), then + profit (markup: × (1 + profit); margin: ÷ (1 − profit)). | Working |
| MSR-056 | The proposal has **one line per cost code**, materials and labor together. Any line price can be typed instead of the calculated one; clearing it goes back to the calculated price. Lines can be left out, and other items (mobilization, dumpster…) added. | Working |
| MSR-057 | **Issuing** requires a client, at least one line and a price on every included line. The issued proposal gets a **number** (`P-YYYY-NNN`) and is **frozen**: later changes do not affect what was sent. Each issue is a new version. | Working |
| MSR-058 | Issuing moves the project from Estimating to **Proposal sent**. | Working |
| MSR-059 | The proposal document shows only the price of each line: **cost, overhead and profit never go to the client**; they stay in the issued version for internal reference. | Working |

!!! confirm "To be confirmed"
    - Whether the client sees material quantities on the proposal by default (today: an option per proposal).
    - Changing a project's status and entering supplier prices from the phone.
    - Snapping clicks to the lines of vector PDFs, for more precision.
