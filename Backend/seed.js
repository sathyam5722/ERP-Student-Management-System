/**
 * Setup and demo data.
 *
 *   npm run seed                     -> subject catalogue + a first SuperAdmin (only if no admin exists)
 *   npm run seed -- --demo           -> adds a complete demo college (role-based passwords, e.g. student123)
 *   npm run seed -- --hash-passwords -> converts any remaining plain-text password to bcrypt
 *
 * Safe to run more than once: subjects are upserted, the demo college is only created once.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const models = require("./models");
const { ROLE_PASSWORDS } = require("./migrations");

const { Admin, Subject, isBcryptHash } = models;

// ---------------------------------------------------------------------------
// SUBJECT CATALOGUE
// Semesters 1-2 are common to all branches; later semesters belong to a department.
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science", course: "B.E. Computer Science", hod: "Dr. Suresh Menon", hodEmail: "hod.cse" },
  { code: "ECE", name: "Electronics", course: "B.E. Electronics & Communication", hod: "Dr. Lakshmi Narayan", hodEmail: "hod.ece" },
  { code: "ME", name: "Mechanical", course: "B.E. Mechanical", hod: "Dr. Prakash Hegde", hodEmail: "hod.me" },
  { code: "CV", name: "Civil", course: "B.E. Civil", hod: "Dr. Shalini Rao", hodEmail: "hod.civil" },
];

const S = (code, name, semester, credits, department) => ({ code, name, semester, credits, ...(department ? { department } : {}) });
const SUBJECTS = [
  // Common first year
  S("MATH101", "Engineering Mathematics I", 1, 4), S("PHY101", "Engineering Physics", 1, 4), S("CHE101", "Engineering Chemistry", 1, 3),
  S("CSE101", "Programming in C", 1, 3), S("MEC101", "Engineering Mechanics", 1, 3),
  S("MATH102", "Engineering Mathematics II", 2, 4), S("EEE102", "Basic Electrical Engineering", 2, 4), S("CSE102", "Data Structures", 2, 3),
  S("CSE103", "Digital Electronics", 2, 3), S("MEC102", "Engineering Drawing", 2, 3),
  // Computer Science
  S("MATH201", "Discrete Mathematics", 3, 4, "Computer Science"), S("CSE201", "Object Oriented Programming", 3, 4, "Computer Science"),
  S("CSE202", "Computer Organization", 3, 3, "Computer Science"), S("CSE203", "Database Management Systems", 3, 3, "Computer Science"),
  S("CSE204", "Operating Systems", 3, 3, "Computer Science"),
  S("CSE205", "Design and Analysis of Algorithms", 4, 4, "Computer Science"), S("CSE206", "Software Engineering", 4, 4, "Computer Science"),
  S("CSE207", "Computer Networks", 4, 3, "Computer Science"), S("CSE208", "Microprocessors", 4, 3, "Computer Science"),
  S("CSE209", "Theory of Computation", 4, 3, "Computer Science"),
  S("CSE301", "Web Technologies", 5, 4, "Computer Science"), S("CSE302", "Compiler Design", 5, 4, "Computer Science"),
  S("CSE303", "Artificial Intelligence", 5, 3, "Computer Science"), S("CSE304", "Software Testing", 5, 3, "Computer Science"),
  S("CSE305", "Cloud Computing", 5, 3, "Computer Science"),
  S("CSE401", "Machine Learning", 7, 4, "Computer Science"), S("CSE402", "Cryptography and Network Security", 7, 4, "Computer Science"),
  S("CSE403", "Big Data Analytics", 7, 3, "Computer Science"), S("CSE404", "Internet of Things", 7, 3, "Computer Science"),
  S("CSE405", "Project Management", 7, 3, "Computer Science"),
  // Electronics
  S("ECE201", "Network Analysis", 3, 4, "Electronics"), S("ECE202", "Electronic Devices", 3, 4, "Electronics"),
  S("ECE203", "Digital System Design", 3, 3, "Electronics"), S("ECE204", "Signals and Systems", 3, 3, "Electronics"),
  S("MATH203", "Transform Calculus", 3, 3, "Electronics"),
  S("ECE301", "Digital Signal Processing", 5, 4, "Electronics"), S("ECE302", "Analog Communication", 5, 4, "Electronics"),
  S("ECE303", "Microcontrollers", 5, 3, "Electronics"), S("ECE304", "Control Systems", 5, 3, "Electronics"), S("ECE305", "VLSI Design", 5, 3, "Electronics"),
  S("ECE401", "Wireless Communication", 7, 4, "Electronics"), S("ECE402", "Embedded Systems", 7, 4, "Electronics"),
  S("ECE403", "Optical Networks", 7, 3, "Electronics"), S("ECE404", "Antenna Theory", 7, 3, "Electronics"), S("ECE405", "Satellite Communication", 7, 3, "Electronics"),
  // Mechanical
  S("ME201", "Thermodynamics", 3, 4, "Mechanical"), S("ME202", "Fluid Mechanics", 3, 4, "Mechanical"), S("ME203", "Material Science", 3, 3, "Mechanical"),
  S("ME204", "Manufacturing Processes", 3, 3, "Mechanical"), S("ME205", "Mechanics of Materials", 3, 3, "Mechanical"),
  S("ME301", "Design of Machine Elements", 5, 4, "Mechanical"), S("ME302", "Heat Transfer", 5, 4, "Mechanical"), S("ME303", "Dynamics of Machinery", 5, 3, "Mechanical"),
  S("ME304", "Turbomachines", 5, 3, "Mechanical"), S("ME305", "Metrology and Measurements", 5, 3, "Mechanical"),
  S("ME401", "CAD/CAM", 7, 4, "Mechanical"), S("ME402", "Automobile Engineering", 7, 4, "Mechanical"), S("ME403", "Operations Research", 7, 3, "Mechanical"),
  S("ME404", "Mechatronics", 7, 3, "Mechanical"), S("ME405", "Renewable Energy Systems", 7, 3, "Mechanical"),
  // Civil
  S("CV201", "Strength of Materials", 3, 4, "Civil"), S("CV202", "Surveying", 3, 4, "Civil"), S("CV203", "Hydraulics", 3, 3, "Civil"),
  S("CV204", "Building Materials and Construction", 3, 3, "Civil"), S("CV205", "Engineering Geology", 3, 3, "Civil"),
  S("CV301", "Structural Analysis", 5, 4, "Civil"), S("CV302", "Geotechnical Engineering", 5, 4, "Civil"), S("CV303", "Transportation Engineering", 5, 3, "Civil"),
  S("CV304", "Water Resources Engineering", 5, 3, "Civil"), S("CV305", "Concrete Technology", 5, 3, "Civil"),
  S("CV401", "Design of Steel Structures", 7, 4, "Civil"), S("CV402", "Environmental Engineering", 7, 4, "Civil"), S("CV403", "Estimation and Costing", 7, 3, "Civil"),
  S("CV404", "Earthquake Engineering", 7, 3, "Civil"), S("CV405", "Urban Planning", 7, 3, "Civil"),
];

async function seedSubjects() {
  const ops = SUBJECTS.map(({ department, ...rest }) => ({
    updateOne: {
      filter: { code: rest.code },
      update: { $setOnInsert: rest, ...(department ? { $set: { department } } : {}) },
      upsert: true,
    },
  }));
  const result = await Subject.bulkWrite(ops);
  console.log(`Subjects: ${result.upsertedCount} added, ${SUBJECTS.length - result.upsertedCount} already present`);
}

async function seedFirstAdmin() {
  if (await Admin.exists({})) {
    console.log("Admins: at least one admin exists, nothing created");
    return;
  }
  const email = process.env.SEED_ADMIN_EMAIL || "admin@amc.edu";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
  await Admin.create({ accountType: "SuperAdmin", username: "superadmin", name: "Super Admin", email, password });
  console.log(`Admins: created SuperAdmin ${email} / ${password}  <- change this password after logging in`);
}

async function hashAllPasswords() {
  for (const name of ["Student", "Faculty", "Staff", "Admin", "Hod", "Principal"]) {
    const docs = await models[name].find({ password: { $exists: true, $ne: null } }, "password");
    let converted = 0;
    for (const doc of docs) {
      if (isBcryptHash(doc.password)) continue;
      doc.markModified("password");
      await doc.save({ validateBeforeSave: false });
      converted += 1;
    }
    console.log(`Passwords: ${name} - ${converted} converted to bcrypt`);
  }
}

// ---------------------------------------------------------------------------
// DEMO COLLEGE
// ---------------------------------------------------------------------------
const DEMO_DOMAIN = "demo.amc.edu";
const DAY = 864e5;

const FIRST = ["Aarav", "Diya", "Rohan", "Sneha", "Kiran", "Priya", "Vikram", "Ananya", "Nikhil", "Pooja", "Arjun", "Isha", "Manoj", "Divya", "Rahul",
  "Kavya", "Siddharth", "Meera", "Aditya", "Shreya", "Varun", "Nandini", "Harsha", "Tanvi", "Karthik", "Bhavana", "Suhas", "Ritika", "Yash", "Lavanya",
  "Abhishek", "Keerthi", "Pranav", "Swathi", "Gautham", "Anjali", "Rakesh", "Deepika", "Tejas", "Sahana", "Naveen", "Pallavi", "Chetan", "Akshata",
  "Darshan", "Spoorthi", "Manish", "Ramya"];
const LAST = ["Sharma", "Patel", "Reddy", "Nair", "Gowda", "Iyer", "Rao", "Kulkarni", "Shetty", "Menon", "Joshi", "Bhat", "Hegde", "Naik", "Pillai", "Das"];
const FACULTY_NAMES = [
  ["Prof. Anita Desai", "Assistant Professor"], ["Prof. Rahul Verma", "Associate Professor"], ["Dr. Meena Iyer", "Professor"],
  ["Prof. Kiran Bhat", "Assistant Professor"], ["Dr. Sanjay Kulkarni", "Associate Professor"], ["Prof. Neha Joshi", "Assistant Professor"],
  ["Prof. Arjun Shetty", "Assistant Professor"], ["Dr. Revathi Pillai", "Professor"], ["Prof. Mohan Das", "Associate Professor"],
  ["Prof. Sunita Rao", "Assistant Professor"], ["Dr. Vinay Hegde", "Associate Professor"], ["Prof. Asha Naik", "Assistant Professor"],
  ["Dr. Ramesh Gowda", "Professor"], ["Prof. Deepak Menon", "Associate Professor"], ["Prof. Kavitha Reddy", "Assistant Professor"],
  ["Prof. Suresh Patil", "Assistant Professor"], ["Dr. Usha Nair", "Associate Professor"], ["Prof. Ganesh Iyer", "Assistant Professor"],
  ["Dr. Padma Sharma", "Professor"], ["Prof. Ajay Kumar", "Associate Professor"], ["Prof. Rekha Shetty", "Assistant Professor"],
  ["Prof. Vivek Bhat", "Assistant Professor"], ["Dr. Lata Kulkarni", "Associate Professor"], ["Prof. Nitin Joshi", "Assistant Professor"],
];

/** Builds the whole demo college. Returns a summary. Uses bulk inserts with pre-hashed passwords for speed. */
async function seedDemo() {
  const M = models;
  if (await M.Principal.exists({ email: `principal@${DEMO_DOMAIN}` })) {
    console.log("Demo: demo data already exists, nothing added");
    return null;
  }
  await seedSubjects();

  let seed = 20261118;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const mail = (local) => `${local}@${DEMO_DOMAIN}`;
  const day = (offset) => new Date(`${new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const hash = {};
  for (const [role, pw] of Object.entries(ROLE_PASSWORDS)) hash[role] = await bcrypt.hash(pw, 10);
  const subjects = Object.fromEntries((await M.Subject.find()).map((s) => [s.code, s]));
  const subjectsFor = (dept, sem) => Object.values(subjects).filter((s) => s.semester === sem && (sem <= 2 ? !s.department : s.department === dept)).slice(0, 5);

  // --- departments, courses, leadership, staff
  await M.Department.insertMany(DEPARTMENTS.map((d) => ({ departmentId: d.code, name: d.name, collegeType: "AMCEC", status: "active" })));
  const courses = await M.Course.insertMany(DEPARTMENTS.map((d) => ({ courseId: `BE-${d.code}`, name: d.course, department: d.name, collegeType: "AMCEC", description: "4-year undergraduate program (VTU)", duration: 48, status: "active" })));
  const courseFor = Object.fromEntries(DEPARTMENTS.map((d, i) => [d.name, courses[i]]));

  await M.Admin.insertMany([
    { accountType: "SuperAdmin", username: "demoadmin", name: "Demo Admin", email: mail("admin"), password: hash.admin },
    { accountType: "Admin", username: "office", name: "Office Admin", email: mail("office"), password: hash.admin },
  ]);
  await M.Staff.insertMany([
    { name: "Ravi Kumar", username: "ravi", email: mail("staff"), staffId: "ST001", department: "Computer Science", collegeType: "AMCEC", phone: "+91 98450 30001", password: hash.staff, enrollmentDate: day(-800) },
    { name: "Geetha Bai", username: "geetha", email: mail("accounts"), staffId: "ST002", department: "Accounts", collegeType: "AMCEC", phone: "+91 98450 30002", password: hash.staff, enrollmentDate: day(-1200) },
    { name: "Mahesh N", username: "mahesh", email: mail("library"), staffId: "ST003", department: "Library", collegeType: "AMCEC", phone: "+91 98450 30003", password: hash.staff, enrollmentDate: day(-600) },
  ]);
  const [principal] = await M.Principal.insertMany([
    { name: "Dr. Kavitha Rao", email: mail("principal"), principalId: "P001", collegeType: "AMCEC", appointedDate: day(-1100), phone: "+91 98450 00001", password: hash.principal },
  ]);
  const hods = await M.Hod.insertMany(DEPARTMENTS.map((d, i) => ({
    name: d.hod, email: mail(d.hodEmail), hodId: `H-${d.code}`, department: d.name, collegeType: "AMCEC", appointedDate: day(-400 - i * 120), phone: `+91 98450 0001${i}`, password: hash.hod,
  })));

  // --- faculty: 6 per department (faculty1-6 = CSE, 7-12 = ECE, 13-18 = ME, 19-24 = Civil)
  const facultyDocs = FACULTY_NAMES.map(([name, designation], i) => {
    const d = DEPARTMENTS[Math.floor(i / 6)];
    return {
      name, designation, email: mail(`faculty${i + 1}`), facultyId: `F${d.code}${String((i % 6) + 1).padStart(2, "0")}`, department: d.name, collegeType: "AMCEC",
      enrollmentDate: day(-300 - Math.floor(rand() * 2500)), phone: `+91 98451 ${String(10000 + i).slice(1)}0`, password: hash.faculty,
      bio: `${designation} in ${d.name}, ${5 + Math.floor(rand() * 18)} years of teaching experience.`,
    };
  });
  const faculty = await M.Faculty.insertMany(facultyDocs);
  const facultyOf = (dept) => faculty.filter((f) => f.department === dept);

  // --- classes & students: semesters 1 and 3 (sections A, B), 5 and 7 (section A); 8 students each
  const CLASSES = [];
  for (const d of DEPARTMENTS) for (const [sem, sections] of [[3, ["A", "B"]], [1, ["A", "B"]], [5, ["A"]], [7, ["A"]]]) for (const sec of sections) CLASSES.push({ dept: d, sem, sec });
  // CSE semester 3A first so student1 is the richest demo account
  CLASSES.sort((a, b) => (a.dept.code === "CSE" && a.sem === 3 && a.sec === "A" ? -1 : b.dept.code === "CSE" && b.sem === 3 && b.sec === "A" ? 1 : 0));

  const studentDocs = [];
  let n = 0;
  const usedNames = new Set();
  for (const c of CLASSES) {
    const year = { 1: 25, 3: 24, 5: 23, 7: 22 }[c.sem];
    for (let k = 0; k < 8; k++) {
      n += 1;
      let name;
      do name = `${pick(FIRST)} ${pick(LAST)}`; while (usedNames.has(name));
      usedNames.add(name);
      const last = name.split(" ")[1];
      studentDocs.push({
        name, email: mail(`student${n}`), studentId: `1AM${year}${c.dept.code}${String(n).padStart(3, "0")}`,
        department: c.dept.name, course: String(courseFor[c.dept.name]._id), courseName: c.dept.course, collegeType: "AMCEC",
        enrollmentDate: new Date(`20${year}-08-${String(1 + (n % 20)).padStart(2, "0")}`), semester: c.sem, section: c.sec,
        phone: `+91 9${String(800000000 + n * 7919).slice(0, 9)}`, address: `${10 + n}, ${pick(["Bannerghatta Road", "JP Nagar", "Jayanagar", "BTM Layout", "Electronic City", "Koramangala", "HSR Layout"])}, Bengaluru`,
        dob: new Date(`${2007 - Math.floor((c.sem - 1) / 2)}-${String(1 + (n % 12)).padStart(2, "0")}-${String(1 + (n % 27)).padStart(2, "0")}`),
        bloodGroup: pick(["O+", "A+", "B+", "AB+", "O-", "B-"]), fatherName: `Mr. ${pick(FIRST)} ${last}`, fatherPhone: `+91 9${String(700000000 + n * 104729).slice(0, 9)}`,
        motherName: `Mrs. ${pick(FIRST)} ${last}`, motherPhone: `+91 9${String(600000000 + n * 130363).slice(0, 9)}`, password: hash.student,
        _class: c,
      });
    }
  }
  const students = await M.Student.insertMany(studentDocs.map(({ _class, ...s }) => s));
  students.forEach((s, i) => { s._class = studentDocs[i]._class; });
  const inClass = (c) => students.filter((s) => s._class === c);

  // --- allocations: each class's 5 subjects spread over the department's faculty
  const allocations = [];
  const teacher = {}; // `${code}-${sem}-${sec}` -> faculty
  for (const c of CLASSES) {
    const fac = facultyOf(c.dept.name);
    subjectsFor(c.dept.name, c.sem).forEach((s, i) => {
      // first-year common subjects can share codes across departments: keep one teacher per (code, sem, section) pair
      const key = `${s.code}-${c.sem}-${c.sec}`;
      if (teacher[key]) return;
      const f = fac[(i + c.sem + (c.sec === "B" ? 2 : 0)) % fac.length];
      teacher[key] = f;
      allocations.push({ faculty: f._id, subjectCode: s.code, semester: c.sem, section: c.sec });
    });
  }
  // Make sure faculty1 (the demo faculty login) teaches CSE 3A DBMS and OOP
  for (const code of ["CSE201", "CSE203"]) {
    const a = allocations.find((x) => x.subjectCode === code && x.semester === 3 && x.section === "A");
    a.faculty = faculty[0]._id;
    teacher[`${code}-3-A`] = faculty[0];
  }
  await M.Allocation.insertMany(allocations);
  // first-year subjects are shared, so classes of every department use the same teacher list
  const teacherFor = (code, c) => teacher[`${code}-${c.sem}-${c.sec}`];

  // --- attendance: last 7 weeks, each subject meets 3 days a week
  const attendance = [];
  const ability = new Map(students.map((s) => [String(s._id), 0.55 + rand() * 0.42])); // attendance & marks tendency
  const weekdays = [];
  for (let back = 49; back >= 1; back--) { const d = day(-back); if (![0, 6].includes(d.getUTCDay())) weekdays.push(d); }
  for (const c of CLASSES) {
    const subs = subjectsFor(c.dept.name, c.sem);
    subs.forEach((s, si) => {
      const t = teacherFor(s.code, c);
      weekdays.forEach((d, di) => {
        if ((di + si) % 5 >= 3) return; // 3 sessions per week per subject
        for (const st of inClass(c)) {
          const p = Math.min(0.99, ability.get(String(st._id)) + 0.25);
          attendance.push({ student: st._id, subjectCode: s.code, subjectName: s.name, date: d, status: rand() < p ? "present" : "absent", markedBy: t._id, ...(rand() < 0.02 ? { remarks: "Medical" } : {}) });
        }
      });
    });
  }
  await M.Attendance.insertMany(attendance, { ordered: false });

  // --- internal marks
  const marks = [];
  for (const c of CLASSES) {
    for (const s of subjectsFor(c.dept.name, c.sem)) {
      const t = teacherFor(s.code, c);
      const parts = [["test1", 25], ["assignment", 20]];
      if (c.sem > 1) parts.push(["test2", 25]);
      if (/CSE20[13]|ECE20[23]|ME20[14]|CV20[12]|30[13]|40[24]/.test(s.code)) parts.push(["lab", 30]);
      for (const st of inClass(c)) {
        const base = ability.get(String(st._id));
        for (const [assessment, max] of parts) {
          const v = Math.max(0, Math.min(max, Math.round(max * (base + (rand() - 0.5) * 0.25))));
          marks.push({ student: st._id, subjectCode: s.code, subjectName: s.name, assessment, marks: v, maxMarks: max, enteredBy: t._id });
        }
      }
    }
  }
  await M.Mark.insertMany(marks, { ordered: false });

  // --- fees & payments
  const feeDocs = [];
  const tuition = { "Computer Science": 92000, Electronics: 88000, Mechanical: 85000, Civil: 82000 };
  for (const st of students) {
    const sem = st.semester;
    feeDocs.push({ student: st._id, title: `Tuition Fee - Semester ${sem}`, category: "tuition", amount: tuition[st.department] / 2, dueDate: day(-20 + (st.semester % 3) * 15), semester: sem });
    feeDocs.push({ student: st._id, title: `Examination Fee - Semester ${sem}`, category: "exam", amount: 2850, dueDate: day(12), semester: sem });
    feeDocs.push({ student: st._id, title: "Library & Lab Fee 2026-27", category: "library", amount: 3500, dueDate: day(-35), semester: sem });
    if (rand() < 0.3) feeDocs.push({ student: st._id, title: `Hostel Fee - Semester ${sem}`, category: "hostel", amount: 48000, dueDate: day(-10), semester: sem });
    if (rand() < 0.25) feeDocs.push({ student: st._id, title: "Transport Fee 2026-27", category: "transport", amount: 18000, dueDate: day(5), semester: sem });
  }
  const fees = await M.Fee.insertMany(feeDocs);
  const payments = [];
  const paidFeeIds = [];
  const byStudent = {};
  fees.forEach((f) => (byStudent[String(f.student)] ||= []).push(f));
  let receipt = 1000;
  for (const st of students) {
    const mine = byStudent[String(st._id)];
    const good = ability.get(String(st._id)) > 0.7;
    // Batch 1: library (+ tuition for most), paid 1-5 months ago
    const batch1 = mine.filter((f) => f.category === "library" || (f.category === "tuition" && (good || rand() < 0.55)) || (f.category === "hostel" && rand() < 0.7));
    const batch2 = mine.filter((f) => f.category === "transport" && rand() < 0.5);
    for (const batch of [batch1, batch2]) {
      if (!batch.length) continue;
      const paidAt = day(-5 - Math.floor(rand() * 140));
      receipt += 1;
      const pay = { _id: new mongoose.Types.ObjectId(), student: st._id, fees: batch.map((f) => f._id), amount: batch.reduce((s, f) => s + f.amount, 0), method: pick(["upi", "upi", "card", "netbanking"]), receiptNo: `RCP-${paidAt.toISOString().slice(0, 10).replace(/-/g, "")}-${receipt}`, description: batch.map((f) => f.title).join(", "), paidAt, status: "success" };
      payments.push(pay);
      batch.forEach((f) => paidFeeIds.push({ id: f._id, pay: pay._id, paidAt }));
    }
  }
  await M.Payment.insertMany(payments);
  await M.Fee.bulkWrite(paidFeeIds.map((p) => ({ updateOne: { filter: { _id: p.id }, update: { $set: { status: "paid", paidAt: p.paidAt, payment: p.pay } } } })));

  // --- exams: semester-end exams for odd semesters, internal test 3 for first years
  const exams = [];
  for (const d of DEPARTMENTS) {
    for (const sem of [3, 5, 7]) {
      subjectsFor(d.name, sem).forEach((s, i) => exams.push({ subjectCode: s.code, subjectName: s.name, semester: sem, department: d.name, examType: "semester", date: day(24 + i * 2 + (sem === 7 ? 1 : 0)), startTime: sem === 5 ? "14:00" : "09:30", endTime: sem === 5 ? "17:00" : "12:30", venue: `${d.code} Block - Hall ${100 + sem * 10 + i}` }));
      exams.push({ subjectCode: subjectsFor(d.name, sem)[0].code, subjectName: subjectsFor(d.name, sem)[0].name, semester: sem, department: d.name, examType: "practical", date: day(18 + sem), startTime: "10:00", endTime: "13:00", venue: `${d.code} Lab 2` });
    }
  }
  subjectsFor(null, 1).forEach((s, i) => exams.push({ subjectCode: s.code, subjectName: s.name, semester: 1, examType: "internal", date: day(6 + i), startTime: "10:00", endTime: "11:30", venue: `First Year Block - Room ${201 + i}` }));
  subjectsFor(null, 1).forEach((s, i) => exams.push({ subjectCode: s.code, subjectName: s.name, semester: 1, examType: "internal", date: day(-28 + i), startTime: "10:00", endTime: "11:30", venue: `First Year Block - Room ${201 + i}` }));
  await M.Exam.insertMany(exams);

  // --- events (past and upcoming)
  const E = (title, offset, extra) => ({ title, date: day(offset), createdByName: "Dr. Kavitha Rao", createdByRole: "principal", audience: "all", type: "academic", ...extra });
  await M.Event.insertMany([
    E("Freshers' Day 2026", -60, { type: "cultural", time: "10:00 AM", location: "Main Auditorium", description: "Welcome celebration for first-year students." }),
    E("Industry Talk: Careers in AI", -35, { type: "tech", time: "02:00 PM", location: "Seminar Hall 1", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod" }),
    E("Internal Assessment Week 1", -28, { endDate: day(-24), type: "exam", description: "Internal test 1 for all semesters." }),
    E("Blood Donation Camp", -14, { type: "other", time: "09:00 AM", location: "Health Centre", description: "Organised by NSS with Red Cross." }),
    E("Kannada Rajyotsava Celebrations", -17, { type: "cultural", time: "09:30 AM", location: "Open Air Theatre" }),
    E("Parent-Teacher Meeting (CSE)", 5, { type: "meeting", time: "10:00 AM", location: "CSE Seminar Hall", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod", description: "Semester progress review with parents." }),
    E("Cloud Computing Workshop", 9, { type: "workshop", time: "02:00 PM", location: "Lab 3", audience: "students", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod", description: "Hands-on AWS workshop." }),
    E("Technovation - Annual Tech Fest", 12, { endDate: day(14), type: "tech", time: "09:00 AM", location: "Main Campus", description: "Hackathon, project expo, robotics and coding contests." }),
    E("PCB Design Workshop", 10, { type: "workshop", time: "10:00 AM", location: "ECE Lab 4", audience: "students", department: "Electronics", createdByName: "Dr. Lakshmi Narayan", createdByRole: "hod" }),
    E("Site Visit: Metro Construction", 15, { type: "academic", time: "08:30 AM", location: "Bengaluru Metro Phase 3 site", audience: "students", department: "Civil", createdByName: "Dr. Shalini Rao", createdByRole: "hod" }),
    E("Industrial Visit: Toyota Kirloskar", 16, { type: "academic", time: "07:30 AM", location: "Bidadi", audience: "students", department: "Mechanical", createdByName: "Dr. Prakash Hegde", createdByRole: "hod" }),
    E("Inter-College Sports Meet", 18, { endDate: day(19), type: "sports", time: "08:00 AM", location: "Sports Ground", createdByName: "Demo Admin", createdByRole: "admin" }),
    E("Faculty Development Program: Outcome-Based Education", 21, { endDate: day(23), type: "workshop", audience: "faculty", location: "Board Room", description: "NBA accreditation preparation." }),
    E("Semester End Examinations Begin", 24, { type: "exam", description: "Check the exam timetable for your branch." }),
    E("Winter Vacation", 40, { endDate: day(54), type: "holiday", createdByName: "Demo Admin", createdByRole: "admin" }),
  ]);

  // --- notices
  const A = (title, message, extra) => ({ title, message, priority: "medium", category: "general", audience: "all", createdByName: "Demo Admin", createdByRole: "admin", ...extra });
  const notices = await M.Announcement.insertMany([
    A("Semester end exam timetable published", "Check the Exam Schedule section for dates, timings and halls. Hall tickets will be issued one week before.", { category: "exam", priority: "high", audience: "students" }),
    A("Examination fee due in 12 days", "Pay the semester examination fee online from the Fee Payment section to avoid a late fine of ₹500.", { category: "fees", priority: "high", audience: "students" }),
    A("Library timings extended during exams", "The central library will stay open until 9 PM from next Monday.", { category: "academic", audience: "students", createdByName: "Mahesh N", createdByRole: "staff" }),
    A("Department meeting on Friday", "All CSE faculty: curriculum review at 3 PM in the HOD cabin.", { category: "academic", audience: "faculty", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod" }),
    A("Submit internal marks by Friday", "Faculty must enter Internal Test 2 marks in the ERP before Friday 5 PM.", { category: "exam", priority: "high", audience: "faculty", createdByName: "Dr. Kavitha Rao", createdByRole: "principal" }),
    A("New lab equipment installed in ECE Lab 4", "Spectrum analysers and oscilloscopes are now available for project work.", { category: "infrastructure", priority: "low", department: "Electronics", createdByName: "Dr. Lakshmi Narayan", createdByRole: "hod" }),
    A("Workshop registrations open", "Register for the CAD/CAM and Ansys workshops with your class coordinator.", { category: "event", audience: "students", department: "Mechanical", createdByName: "Dr. Prakash Hegde", createdByRole: "hod" }),
    A("Survey camp schedule", "5th semester Civil students: survey camp at Nandi Hills next month. Carry your instruments kit.", { category: "academic", audience: "students", department: "Civil", createdByName: "Dr. Shalini Rao", createdByRole: "hod" }),
    A("Placement drive: Infosys and Wipro", "Final-year students with no active backlogs can register in the placement cell by Wednesday.", { category: "event", priority: "high", audience: "students", createdByName: "Dr. Kavitha Rao", createdByRole: "principal" }),
    A("Anti-ragging committee contacts", "Report any incident to the anti-ragging helpline 1800-180-5522 or the committee members listed on the notice board.", { category: "general", priority: "medium" }),
    A("Research grant proposals invited", "Faculty can submit proposals for the internal seed grant (up to ₹5 lakh) before the end of the month.", { category: "research", audience: "faculty", createdByName: "Dr. Kavitha Rao", createdByRole: "principal" }),
    A("Campus Wi-Fi maintenance on Sunday", "Internet will be unavailable from 6 AM to 12 PM.", { category: "infrastructure", priority: "low" }),
  ]);
  // spread notice dates over the last few weeks
  await M.Announcement.collection.bulkWrite(notices.map((x, i) => ({ updateOne: { filter: { _id: x._id }, update: { $set: { createdAt: day(-i * 3), updatedAt: day(-i * 3) } } } })));

  // --- library
  const res = [];
  for (const s of Object.values(subjects).filter((x) => [1, 3, 5, 7].includes(x.semester))) {
    res.push({ title: `${s.name} - Syllabus`, category: "syllabus", subjectCode: s.code, semester: s.semester, url: "https://vtu.ac.in/en/b-e-scheme-syllabus/", addedByName: "Demo Admin" });
    if (rand() < 0.5) res.push({ title: `${s.name} - Notes (Modules 1-3)`, category: "notes", subjectCode: s.code, semester: s.semester, url: `https://nptel.ac.in/courses`, addedByName: "Faculty" });
    if (rand() < 0.3) res.push({ title: `${s.name} - Question Paper 2025`, category: "question-paper", subjectCode: s.code, semester: s.semester, url: "https://vtu.ac.in/en/model-question-paper-b-e-b-tech-b-arch/", addedByName: "Mahesh N" });
  }
  res.push(
    { title: "OOP Lecture Notes (Units 1-3)", category: "notes", subjectCode: "CSE201", semester: 3, url: "https://docs.oracle.com/javase/tutorial/java/concepts/", addedBy: faculty[0]._id, addedByName: faculty[0].name },
    { title: "DBMS Lab Manual", category: "lab-manual", subjectCode: "CSE203", semester: 3, url: "https://www.w3schools.com/sql/", addedBy: faculty[0]._id, addedByName: faculty[0].name },
    { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", category: "textbook", subjectCode: "CSE203", semester: 3, url: "https://www.db-book.com/", addedByName: "Mahesh N" },
    { title: "Operating System Concepts", author: "Silberschatz, Galvin, Gagne", category: "textbook", subjectCode: "CSE204", semester: 3, url: "https://www.os-book.com/", addedByName: "Mahesh N" },
    { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", category: "textbook", semester: 4, url: "https://mitpress.mit.edu/9780262046305/", addedByName: "Mahesh N" },
    { title: "Signals and Systems", author: "Oppenheim, Willsky", category: "textbook", subjectCode: "ECE204", semester: 3, url: "https://ocw.mit.edu/courses/6-003-signals-and-systems-fall-2011/", addedByName: "Mahesh N" },
    { title: "Engineering Thermodynamics", author: "P. K. Nag", category: "textbook", subjectCode: "ME201", semester: 3, url: "https://nptel.ac.in/courses/112105123", addedByName: "Mahesh N" },
    { title: "Strength of Materials", author: "R. K. Bansal", category: "textbook", subjectCode: "CV201", semester: 3, url: "https://nptel.ac.in/courses/105105108", addedByName: "Mahesh N" },
    { title: "Hands-On Machine Learning", author: "Aurélien Géron", category: "textbook", subjectCode: "CSE401", semester: 7, url: "https://github.com/ageron/handson-ml3", addedByName: "Mahesh N" },
    { title: "Attention Is All You Need", author: "Vaswani et al.", category: "research-paper", url: "https://arxiv.org/abs/1706.03762", addedByName: "Mahesh N" },
    { title: "Deep Residual Learning for Image Recognition", author: "He et al.", category: "research-paper", url: "https://arxiv.org/abs/1512.03385", addedByName: "Mahesh N" },
    { title: "5G Wireless Networks: A Survey", author: "IEEE Communications Surveys", category: "research-paper", url: "https://ieeexplore.ieee.org/", addedByName: "Mahesh N" },
    { title: "Self-compacting Concrete: A Review", author: "Okamura & Ouchi", category: "research-paper", url: "https://www.sciencedirect.com/", addedByName: "Mahesh N" },
  );
  await M.Resource.insertMany(res);

  // --- assignments & submissions: two per class (one closed and graded, one open)
  const titles = ["Problem set", "Case study report", "Mini project proposal", "Lab record", "Tutorial sheet", "Seminar write-up"];
  const assignmentDocs = [];
  for (const c of CLASSES) {
    const subs = subjectsFor(c.dept.name, c.sem);
    [[subs[0], -6], [subs[1], 5]].forEach(([s, due], k) => {
      const t = teacherFor(s.code, c);
      assignmentDocs.push({ title: `${pick(titles)}: ${s.name}`, subjectCode: s.code, subjectName: s.name, semester: c.sem, section: c.sec, department: c.dept.name, dueDate: day(due + k), instructions: "Submit a PDF link (Google Drive / OneDrive) with your answers. Show all steps.", maxMarks: 10, faculty: t._id, facultyName: t.name, _class: c, _closed: due < 0 });
    });
  }
  // Extra assignments by faculty1 for CSE 3A (the main demo class)
  const cse3a = CLASSES[0];
  assignmentDocs.push(
    { title: "ER diagram for a library system", subjectCode: "CSE203", subjectName: subjects.CSE203.name, semester: 3, section: "A", department: "Computer Science", dueDate: day(-3), instructions: "Draw the ER diagram and convert it to tables.", maxMarks: 10, faculty: faculty[0]._id, facultyName: faculty[0].name, _class: cse3a, _closed: true },
    { title: "SQL joins practice", subjectCode: "CSE203", subjectName: subjects.CSE203.name, semester: 3, section: "A", department: "Computer Science", dueDate: day(4), instructions: "Solve the 10 join queries shared in class.", maxMarks: 10, faculty: faculty[0]._id, facultyName: faculty[0].name, _class: cse3a, _closed: false },
    { title: "Inheritance & polymorphism program", subjectCode: "CSE201", subjectName: subjects.CSE201.name, semester: 3, section: "A", department: "Computer Science", dueDate: day(9), instructions: "Write a Java program demonstrating method overriding.", maxMarks: 10, faculty: faculty[0]._id, facultyName: faculty[0].name, _class: cse3a, _closed: false },
  );
  const assignments = await M.Assignment.insertMany(assignmentDocs.map(({ _class, _closed, ...a }) => a));
  const submissions = [];
  assignments.forEach((a, i) => {
    const meta = assignmentDocs[i];
    for (const st of inClass(meta._class)) {
      if (st === students[0] && !meta._closed) continue; // leave open work for the demo student to submit
      const diligent = ability.get(String(st._id));
      if (rand() > (meta._closed ? diligent + 0.2 : diligent - 0.25)) continue;
      const submittedAt = new Date(a.dueDate.getTime() - Math.floor(rand() * 4) * DAY);
      const graded = meta._closed && rand() < 0.8;
      submissions.push({
        assignment: a._id, student: st._id, content: `https://drive.google.com/file/d/${st.studentId.toLowerCase()}-${i}/view`, submittedAt: submittedAt > new Date() ? new Date() : submittedAt,
        ...(graded ? { status: "graded", marks: Math.max(3, Math.min(10, Math.round(10 * diligent + (rand() - 0.5) * 3))), feedback: pick(["Good work", "Well structured", "Explain step 3 in more detail", "Neat and complete", "Add references next time"]) } : { status: "submitted" }),
      });
    }
  });
  await M.Submission.insertMany(submissions, { ordered: false });

  // --- leave requests (faculty, students, HODs, staff)
  const L = (who, kind, title, type, from, to, reason, status, reviewer) => ({
    applicantKind: kind, applicant: who._id, applicantName: who.name, applicantTitle: title, department: who.department,
    type, from: day(from), to: day(to), days: to - from + 1, reason, status, ...(status !== "pending" ? { reviewerName: reviewer, reviewedAt: day(Math.min(from, 0) - 1), reviewNote: status === "rejected" ? "Clashes with internal assessment duty" : "" } : {}),
  });
  const leaves = [];
  faculty.forEach((f, i) => {
    const hodName = hods.find((h) => h.department === f.department).name;
    if (i % 3 === 0) leaves.push(L(f, "faculty", f.designation, pick(["casual", "sick", "earned"]), -20 + i, -19 + i, pick(["Family function", "Fever", "Personal work", "Medical check-up"]), "approved", hodName));
    if (i % 4 === 1) leaves.push(L(f, "faculty", f.designation, pick(["casual", "conference", "academic"]), 3 + i, 4 + i, pick(["Attending IEEE conference", "Wedding in family", "External examiner duty", "Workshop at IISc"]), "pending"));
    if (i % 7 === 2) leaves.push(L(f, "faculty", f.designation, "casual", -9, -8, "Personal work", "rejected", hodName));
  });
  students.filter((_, i) => i % 23 === 0).forEach((st, i) => {
    const hodName = hods.find((h) => h.department === st.department).name;
    leaves.push(L(st, "student", `Student · ${st.studentId} · Sem ${st.semester}${st.section}`, pick(["sick", "academic", "emergency"]), 2 + i, 3 + i, pick(["Representing college in hackathon", "Fever and cold", "Sister's wedding", "NSS camp"]), i % 3 === 0 ? "approved" : "pending", hodName));
  });
  hods.forEach((h, i) => { if (i < 2) leaves.push(L(h, "hod", "Head of Department", i ? "conference" : "academic", 20 + i, 21 + i, i ? "Presenting paper at IIT Madras" : "External examiner duty at VTU", "pending")); });
  await M.Leave.insertMany(leaves);

  // --- admissions (pending, approved = enrolled first-years, rejected)
  const admissions = [];
  students.filter((s) => s.semester === 1).slice(0, 10).forEach((s) => admissions.push({ name: s.name, email: s.email, phone: s.phone, department: s.department, program: s.courseName, score: 70 + Math.floor(rand() * 28), status: "approved", enrolledStudent: s._id, reviewedByName: principal.name }));
  for (let i = 0; i < 18; i++) {
    const d = DEPARTMENTS[i % 4];
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    admissions.push({ name, email: `${name.toLowerCase().replace(/\s+/g, ".")}${i}@example.com`, phone: `+91 90000 ${String(10000 + i * 37).slice(0, 5)}`, department: d.name, program: d.course, score: 55 + Math.floor(rand() * 43), ...(i % 6 === 5 ? { status: "rejected", reviewedByName: principal.name } : {}) });
  }
  const adms = await M.Admission.insertMany(admissions);
  await M.Admission.collection.bulkWrite(adms.map((a, i) => ({ updateOne: { filter: { _id: a._id }, update: { $set: { createdAt: day(-2 - i * 3), updatedAt: day(-2 - i * 3) } } } })));

  // --- research
  await M.Research.insertMany([
    { title: "AI-based crop disease detection", lead: "Dr. Meena Iyer", department: "Computer Science", funding: 12.5, status: "active", progress: 45, startDate: day(-200), endDate: day(300), description: "Mobile app that detects leaf diseases from photos. Funded by KSCST." },
    { title: "Blockchain for academic records", lead: "Prof. Rahul Verma", department: "Computer Science", funding: 5, status: "proposed", progress: 0, description: "Tamper-proof certificate verification." },
    { title: "Federated learning for healthcare", lead: "Dr. Sanjay Kulkarni", department: "Computer Science", funding: 18, status: "active", progress: 62, startDate: day(-400), endDate: day(200), description: "AICTE RPS funded project with a hospital partner." },
    { title: "Low-power IoT sensor network", lead: "Prof. Arjun Shetty", department: "Electronics", funding: 8, status: "active", progress: 70, startDate: day(-320), endDate: day(60) },
    { title: "Phased-array antenna for 5G", lead: "Dr. Revathi Pillai", department: "Electronics", funding: 22, status: "active", progress: 35, startDate: day(-150), endDate: day(500), description: "DST-SERB funded." },
    { title: "Solar-powered cold storage", lead: "Dr. Ramesh Gowda", department: "Mechanical", funding: 9.5, status: "completed", progress: 100, startDate: day(-700), endDate: day(-30) },
    { title: "EV battery thermal management", lead: "Prof. Deepak Menon", department: "Mechanical", funding: 14, status: "active", progress: 25, startDate: day(-90), endDate: day(640) },
    { title: "Recycled aggregate concrete", lead: "Dr. Padma Sharma", department: "Civil", funding: 6, status: "active", progress: 55, startDate: day(-250), endDate: day(120) },
    { title: "Flood mapping of Bengaluru lakes", lead: "Dr. Lata Kulkarni", department: "Civil", funding: 4, status: "proposed", progress: 0 },
  ]);

  const summary = { students: students.length, faculty: faculty.length, classes: CLASSES.length, attendance: attendance.length, marks: marks.length, fees: fees.length, payments: payments.length, assignments: assignments.length, submissions: submissions.length, leaves: leaves.length, admissions: admissions.length };
  console.log(`Demo: data created ${JSON.stringify(summary)}`);
  console.log("Demo logins (role passwords): admin@, staff@, principal@, hod.cse@ / hod.ece@ / hod.me@ / hod.civil@, faculty1-24@, student1-192@demo.amc.edu");
  return summary;
}

/** Used by server.js when SEED_ON_START=demo (hosting without shell access). Safe to call on every start. */
async function seedOnStart() {
  await seedSubjects();
  await seedDemo();
}

module.exports = { seedOnStart, seedDemo, seedSubjects, DEMO_DOMAIN };

if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/student-management-app");
    await seedSubjects();
    if (process.argv.includes("--demo")) await seedDemo();
    else await seedFirstAdmin();
    if (process.argv.includes("--hash-passwords")) await hashAllPasswords();
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
