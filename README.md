# AMC Engineering College ERP

A college management system with six dashboards: Admin/Staff, Principal, HOD, Faculty and Student, plus a public admission form.

- **Backend:** Node.js + Express + MongoDB (`Backend/`). Login uses bcrypt-hashed passwords and JWT tokens. Every API route checks the user's role.
- **Frontend:** plain HTML/CSS/JS (`Frontend/`). It is served by the backend, so one server runs everything.

## Run locally

```bash
cd Backend
cp .env.example .env        # then set JWT_SECRET (and MONGODB_URI if not local)
npm install
npm run seed -- --demo      # optional: demo college with sample data
npm start                   # http://localhost:3000
```

Open **http://localhost:3000** (the landing page) or **http://localhost:3000/login.html**.

## Demo accounts

These accounts exist after `npm run seed -- --demo`, or on a hosted copy with `SEED_ON_START=demo`. Each role has its own password: the role name followed by `123`.

| Role (choose on the login page) | Login | Password |
|---|---|---|
| Admin | `admin@demo.amc.edu` | `admin123` |
| Staff | `staff@demo.amc.edu` | `staff123` |
| Principal | `principal@demo.amc.edu` | `principal123` |
| HOD | `hod.cse@`, `hod.ece@`, `hod.me@`, `hod.civil@demo.amc.edu` | `hod123` |
| Faculty | `faculty1@demo.amc.edu` … `faculty24@demo.amc.edu` (1–6 CSE, 7–12 ECE, 13–18 ME, 19–24 Civil) | `faculty123` |
| Student | `student1@demo.amc.edu` … `student192@demo.amc.edu` (student1–8 = CSE semester 3 section A) | `student123` |

New accounts created from the dashboards get the same defaults. A one-time migration (`Backend/migrations.js`) set every existing account to these role passwords. It does not run again, so passwords users change later are kept.

Students and faculty can also log in with their ID, for example `1AM24CS001`.

## What each dashboard does

| Dashboard | Features |
|---|---|
| **Admin / Staff** | Live overview; students, faculty, staff, admins, HODs, principals; departments, courses, subjects; exams; events; notices; library; fees (assign fees, track dues, payments, receipts, reminders); admissions; leave requests; CSV reports; settings |
| **Principal** | College overview; department performance; HOD accounts; faculty and students; admissions (approving one enrolls the student); leave approvals for HODs and staff; research projects; events and notices; finance and reports |
| **HOD** | Department overview; faculty and students in the department (at-risk flags); subject allocation; faculty leave approval and the HOD's own leave; exams; analytics; events; announcements |
| **Faculty** | Attendance; internal marks with grades; assignments (create, view submissions, grade); study materials; student details; subject allocation; leave; notices; profile |
| **Student** | Dashboard (attendance, marks, assignments, fees, deadlines); profile; curriculum with study material; internal marks; attendance; assignments (submit online); exam timetable with countdown; fee payment (simulated) and receipts; library; events calendar; notices |

## Deploy (free): MongoDB Atlas + Render

1. **Database.** Create a free cluster at <https://www.mongodb.com/cloud/atlas>. Add a database user. Under Network Access, allow `0.0.0.0/0`. Copy the connection string (`mongodb+srv://...`) and add a database name, e.g. `.../amc-erp?retryWrites=true&w=majority`.
2. **Code.** Push this repository to GitHub.
3. **Server.** On <https://render.com>, choose **New → Blueprint**, pick the repository, and paste the Atlas string as `MONGODB_URI` when asked. `render.yaml` sets everything else, including a random `JWT_SECRET` and demo data on first start.
4. Open the `https://<your-app>.onrender.com` URL and share it with testers along with the demo accounts above.

> On Render's free plan the app sleeps after 15 minutes without visitors. The first visit after that takes about a minute to wake it up.
> Payments are simulated. No real payment gateway is connected.
