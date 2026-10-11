# Presenter's guide

This guide is for the person who will present KORbuild to a customer. You do not need to know the system beforehand: follow the order below, sign in with the users indicated, and use the "what to say" boxes as your script. A full presentation of Daily takes about **15 minutes**; with questions, plan for 30.

## The story in one minute

Construction companies in the US run their jobs on paper, text messages and spreadsheets. The superintendent writes the daily report at night (or not at all), the office chases people by phone, and when a client disputes a delay there is no reliable record of what happened on site.

KORbuild is **one platform, one set of jobs and people**, with modules the company turns on as it needs them:

| Module | In one sentence | Who uses it |
|---|---|---|
| **Daily** | The daily construction report, filled out on the phone in minutes, approved by the office and shared with the client as a sealed PDF. | Foreman / superintendent (phone), office (computer) |
| **Crew** | The crew time clock with GPS and geofence, timesheets and labor cost by job. | Foreman (phone), office |
| **Measure** | Plan takeoff in feet and inches, assemblies, quantities, quote lists and proposals. | Estimators (computer) |
| **Settings** | Company setup: employees, labor burden, work rules, jobs, contacts, users and roles. | Office administrator |

!!! say "What to say"
    "KORbuild replaces the paper daily report, the paper time card and the spreadsheet takeoff with one system. Everything the field does on the phone reaches the office the same day — and works even without signal on the job site."

KORbuild serves both sides of a job: the **general contractor** (GC) and the **trade contractor** (sub) that the GC hires. The prototype has one company of each, so you can show both points of view.

## Before you start

1. Open the prototype link: on the main sign-in page, click **Open the prototype**. You can also go straight to the prototype address (it ends in `?demo`).
2. Use **Chrome or Edge** on a computer. If you want to show the field side on a real phone, open the same link on the phone (Chrome on Android, Safari on iPhone).
3. Check the language button **EN | PT** at the top of the sign-in card. The prototype opens in English.
4. If someone already played with the prototype in that browser, reset it: user menu (your initials, top right) › **Reset demo**. Everything comes back to the original sample data.

![The main sign-in page: customer sign-in, the product guide and the prototype](img/entry-main.png)

!!! simulated "In the prototype"
    The prototype keeps all its data **in the browser** (no server yet). Two consequences: what you do on the phone does not appear on the computer, and two people never see each other's changes. To show the field → office flow, switch users **in the same browser**: user menu › **Sign out**, then sign in with the other user. Customer accounts with a real database are being built; the main sign-in page already shows where they will sign in.

## Demo users

There is no password in the prototype: on the sign-in screen, click the email of the user you want and then **Sign in**.

![The prototype sign-in screen with the demo users](img/entry-prototype.png)

| User | Company | Role | Use it to show |
|---|---|---|---|
| **Carlos Mendes** · carlos@examplebuilders.com | Example Builders (GC) | Foreman | The phone: daily report, crew time clock |
| **Ana Ribeiro** · ana@examplebuilders.com | Example Builders (GC) | Admin | The office: dashboard, approvals, client link, settings |
| **Diego Santos** · diego@examplebuilders.com | Example Builders (GC) | Worker | A worker who only clocks in and out |
| **Tom Reilly** · tom@northfieldframing.com | Northfield Framing & Siding (sub) | Admin | The trade contractor: Measure, job schedule, pricing |
| **Rita Gomes** · rita@northfieldframing.com | Northfield Framing & Siding (sub) | Project manager | An estimator |
| **José Pereira** · jose@northfieldframing.com | Northfield Framing & Siding (sub) | Foreman | The sub's field side |
| **Luis Ortega** · luis@northfieldframing.com | Northfield Framing & Siding (sub) | Worker | A worker of the sub |

!!! tip "Tip"
    Before the meeting, open the prototype once on the device you will use. After the first visit it also works offline, which is a strong point to show (see act 3).

## The presentation, act by act

### Act 1 — One platform, many modules (2 min)

1. Sign in as **Ana Ribeiro** (Admin).
2. Show the **modules screen**: Daily, Crew, Measure and Settings, each with a short description.

![The modules screen after signing in](img/modules-home.png)

!!! say "What to say"
    "Each company turns on the modules it needs. The jobs, people and contacts are entered once and used by every module."

### Act 2 — The field: a daily report in minutes (5 min)

Show this on a phone if you can; otherwise, narrow the browser window.

1. Sign out and sign in as **Carlos Mendes** (Foreman). Daily opens on **Today**.
2. Point out the red box (**late report**), the yellow box (**today's report is missing**, with the time left until 6 PM) and the request for changes sent by the office.
3. Open **Maple Gardens Residences** and tap **or copy from a previous report** → choose yesterday → **Copy**. The crew, the equipment and the activities still in progress come from yesterday.
4. Scroll through the report: weather (pulled automatically from the job location), crew (+ and − buttons), equipment, **Work performed** with **Dictate** and **Improve text**, **Issues & delays**, photos.
5. Tap **Submit for approval**.

![Today screen of the foreman, with late and missing reports](img/daily-field-today-mobile.png)

!!! say "What to say"
    "The foreman fills out the report at the end of the day, on the phone, in three or four minutes — copying yesterday, adjusting the crew, dictating what was done. Photos get a stamp with the date, time and GPS inside the image. If he forgets, the app reminds him at 4 PM, flags it at 6 PM and tells the office the next morning."

Full details: [Daily user manual — Fill out the daily report](@/daily/user-manual.html#field-fill-out-the-daily-report).

### Act 3 — No signal on the job site (1 min)

1. In the top bar, tap **Online**: it switches to offline (this simulates losing signal).
2. Submit a report: it stays queued on the phone.
3. Tap again to go back online: the report uploads by itself, photo by photo.

!!! say "What to say"
    "Job sites often have no signal. Nothing is lost: everything is saved on the phone and uploads as soon as there is a connection."

### Act 4 — The office: review, approve and seal (4 min)

1. Sign out and sign in as **Ana Ribeiro**. Daily opens on the **Dashboard**: today's numbers, the job status (green, yellow, red) and the approval queue.
2. Open a report from **Awaiting approval** and click **Review**.
3. Show **Request changes from the field**: the reason goes back to the foreman's phone. (Cancel it for the demo.)
4. Click **Approve and seal** → confirm. The report gets a **verification code** and can no longer be changed by anyone.

![The office dashboard: numbers of the day, job status and approval queue](img/daily-dashboard.png)

!!! say "What to say"
    "The office sees at a glance which jobs reported today. Approval seals the report with a digital fingerprint: if anyone changes a single word or photo later, the client's link shows that the document was altered."

### Act 5 — The client receives the report (2 min)

1. On the approved report, click **View as the client** (or **Copy link for the client**).
2. Show the green box **Authentic document** and the full report with the photos.
3. Show **Download PDF**.

![What the client sees: authentic document, with the full report](img/daily-client-link.png)

!!! say "What to say"
    "The client doesn't need an account or an app: just a link. And the link proves the report is exactly what was approved. That's what protects the contractor in a delay claim."

### Act 6 — The other modules (optional, 5 min each)

Detailed scripts for Crew, Measure and Settings will be added to this guide. Meanwhile, the highlights:

- **Crew** — sign in as **Carlos**, open Crew › **Crew**: clock in the whole crew at once, with GPS and the job's geofence. Then as **Ana**: **Now** (who is working where), **Timesheets** and **Costs** by job, with the forecast to completion.
- **Measure** — sign in as **Tom**, open a project, then a sheet: set the scale, measure walls and floors on the PDF plan, and see the materials and labor calculated by the assemblies; then the **Material list for quotes** and the **Proposal**.
- **Job schedule** — as **Tom**, Daily › Jobs › Maple Gardens Residences › **Open schedule**: Gantt chart, baseline, progress from the daily reports, export to Excel and publish to the GC.

## Questions customers ask

| Question | Answer |
|---|---|
| Does it work without internet? | Yes. The app is saved on the phone after the first visit; reports and punches are stored on the phone and upload when there is signal. |
| Do I need to install an app? | Not in the prototype: it runs in the browser and can be added to the home screen. App Store and Google Play versions are planned. |
| Can the foreman change a report after approval? | No. Approval seals it. Changes are requested **before** approval ("Request changes from the field"). |
| What does the client need? | Nothing: they receive a link and can download the PDF. No account, no cost. |
| Can someone fake a photo or a date? | Each photo carries a stamp with date, time and GPS inside the image, plus a digital fingerprint of the original file. The approved report is sealed; any change shows up on the client's link. |
| Does it send SMS or email reminders? | Not yet: reminders go to the in-app notifications (bell) and to the phone's notifications. SMS and email are being evaluated. |
| Where is my data stored? | In the prototype, only in the browser. In the product, on a secure cloud database, separated by company. |
| What does it cost? | Pricing is not part of the prototype. |

!!! confirm "To be confirmed"
    Prices, plans, the release date of the store apps and integrations (payroll, accounting) are commercial decisions still open. Do not commit to them during the presentation.
