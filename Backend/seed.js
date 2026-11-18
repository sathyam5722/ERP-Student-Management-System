/**
 * One-off setup script.
 *
 *   npm run seed                    -> adds the subject catalogue and a first SuperAdmin (only if no admin exists)
 *   npm run seed -- --demo           -> adds a complete demo college (accounts for every role, password Demo@123)
 *   npm run seed -- --hash-passwords -> also converts every remaining plain-text password to bcrypt
 *
 * Safe to run more than once: subjects are upserted, existing admins are never touched.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const models = require("./models");

const { Admin, Subject, isBcryptHash } = models;

const SUBJECTS = [
  // Semester 1
  { code: "MATH101", name: "Engineering Mathematics I", semester: 1, credits: 4 },
  { code: "PHY101", name: "Engineering Physics", semester: 1, credits: 4 },
  { code: "CHE101", name: "Engineering Chemistry", semester: 1, credits: 3 },
  { code: "CSE101", name: "Programming in C", semester: 1, credits: 3 },
  { code: "MEC101", name: "Engineering Mechanics", semester: 1, credits: 3 },
  // Semester 2
  { code: "MATH102", name: "Engineering Mathematics II", semester: 2, credits: 4 },
  { code: "EEE102", name: "Basic Electrical Engineering", semester: 2, credits: 4 },
  { code: "CSE102", name: "Data Structures", semester: 2, credits: 3 },
  { code: "CSE103", name: "Digital Electronics", semester: 2, credits: 3 },
  { code: "MEC102", name: "Engineering Drawing", semester: 2, credits: 3 },
  // Semester 3
  { code: "MATH201", name: "Discrete Mathematics", semester: 3, credits: 4 },
  { code: "CSE201", name: "Object Oriented Programming", semester: 3, credits: 4 },
  { code: "CSE202", name: "Computer Organization", semester: 3, credits: 3 },
  { code: "CSE203", name: "Database Management Systems", semester: 3, credits: 3 },
  { code: "CSE204", name: "Operating Systems", semester: 3, credits: 3 },
  // Semester 4
  { code: "CSE205", name: "Design and Analysis of Algorithms", semester: 4, credits: 4 },
  { code: "CSE206", name: "Software Engineering", semester: 4, credits: 4 },
  { code: "CSE207", name: "Computer Networks", semester: 4, credits: 3 },
  { code: "CSE208", name: "Microprocessors", semester: 4, credits: 3 },
  { code: "CSE209", name: "Theory of Computation", semester: 4, credits: 3 },
];

async function seedSubjects() {
  const ops = SUBJECTS.map((s) => ({ updateOne: { filter: { code: s.code }, update: { $setOnInsert: s }, upsert: true } }));
  const result = await Subject.bulkWrite(ops);
  console.log(`Subjects: ${result.upsertedCount} added, ${SUBJECTS.length - result.upsertedCount} already present`);
}

async function seedFirstAdmin() {
  if (await Admin.exists({})) {
    console.log("Admins: at least one admin exists, nothing created");
    return;
  }
  const email = process.env.SEED_ADMIN_EMAIL || "admin@amc.edu";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  await Admin.create({ accountType: "SuperAdmin", username: "superadmin", name: "Super Admin", email, password });
  console.log(`Admins: created SuperAdmin ${email} / ${password}  <- change this password after logging in`);
}

async function hashAllPasswords() {
  const userModels = ["Student", "Faculty", "Staff", "Admin", "Hod", "Principal"];
  for (const name of userModels) {
    const Model = models[name];
    const docs = await Model.find({ password: { $exists: true, $ne: null } }, "password");
    let converted = 0;
    for (const doc of docs) {
      if (isBcryptHash(doc.password)) continue;
      doc.markModified("password"); // pre-save hook hashes it
      await doc.save({ validateBeforeSave: false });
      converted += 1;
    }
    console.log(`Passwords: ${name} - ${converted} converted to bcrypt`);
  }
}

// ---------------------------------------------------------------------------
// DEMO DATA (npm run seed -- --demo): a small, realistic college for testers.
// Every demo account uses the password DEMO_PASSWORD.
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = "Demo@123";
const DEMO_DOMAIN = "demo.amc.edu";

async function seedDemo() {
  const M = models;
  if (await M.Principal.exists({ email: `principal@${DEMO_DOMAIN}` })) {
    console.log("Demo: demo data already exists, nothing added");
    return;
  }
  const DAY = 864e5;
  const day = (offset) => {
    const d = new Date(Date.now() + offset * DAY);
    return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
  };
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280); // deterministic
  const mail = (local) => `${local}@${DEMO_DOMAIN}`;
  const pw = { password: DEMO_PASSWORD };

  // Departments & courses
  await M.Department.insertMany([
    { departmentId: "CSE", name: "Computer Science", collegeType: "AMCEC", status: "active" },
    { departmentId: "ECE", name: "Electronics", collegeType: "AMCEC", status: "active" },
  ]);
  const [cse] = await M.Course.insertMany([
    { courseId: "BE-CSE", name: "B.E. Computer Science", department: "Computer Science", collegeType: "AMCEC", description: "4-year undergraduate program", duration: 48, status: "active" },
    { courseId: "BE-ECE", name: "B.E. Electronics", department: "Electronics", collegeType: "AMCEC", description: "4-year undergraduate program", duration: 48, status: "active" },
  ]);

  // People (created one by one so passwords get hashed)
  await M.Admin.create({ accountType: "SuperAdmin", username: "demoadmin", name: "Demo Admin", email: mail("admin"), ...pw });
  await M.Staff.create({ name: "Ravi Kumar", username: "ravi", email: mail("staff"), staffId: "ST001", department: "Computer Science", collegeType: "AMCEC", ...pw });
  await M.Principal.create({ name: "Dr. Kavitha Rao", email: mail("principal"), principalId: "P001", collegeType: "AMCEC", appointedDate: day(-900), phone: "+91 98450 00001", ...pw });
  await M.Hod.create({ name: "Dr. Suresh Menon", email: mail("hod.cse"), hodId: "H-CSE", department: "Computer Science", collegeType: "AMCEC", appointedDate: day(-600), ...pw });
  await M.Hod.create({ name: "Dr. Lakshmi Narayan", email: mail("hod.ece"), hodId: "H-ECE", department: "Electronics", collegeType: "AMCEC", appointedDate: day(-500), ...pw });

  const facultySpecs = [
    ["faculty1", "Prof. Anita Desai", "F101", "Computer Science", "Assistant Professor"],
    ["faculty2", "Prof. Rahul Verma", "F102", "Computer Science", "Associate Professor"],
    ["faculty3", "Dr. Meena Iyer", "F103", "Computer Science", "Professor"],
    ["faculty4", "Prof. Arjun Shetty", "F201", "Electronics", "Assistant Professor"],
  ];
  const fac = {};
  for (const [local, name, id, dept, designation] of facultySpecs) {
    fac[local] = await M.Faculty.create({ name, email: mail(local), facultyId: id, department: dept, designation, collegeType: "AMCEC", enrollmentDate: day(-400), phone: "+91 98450 1" + id.slice(1), ...pw });
  }

  const firstNames = ["Aarav", "Diya", "Rohan", "Sneha", "Kiran", "Priya", "Vikram", "Ananya", "Nikhil", "Pooja", "Arjun", "Isha", "Manoj", "Divya", "Rahul"];
  const studentSpecs = [];
  for (let i = 0; i < 6; i++) studentSpecs.push(["Computer Science", 3, "A"]);
  for (let i = 0; i < 3; i++) studentSpecs.push(["Computer Science", 3, "B"]);
  for (let i = 0; i < 3; i++) studentSpecs.push(["Computer Science", 1, "A"]);
  for (let i = 0; i < 3; i++) studentSpecs.push(["Electronics", 3, "A"]);
  const students = [];
  for (let i = 0; i < studentSpecs.length; i++) {
    const [dept, semester, section] = studentSpecs[i];
    const code = dept === "Computer Science" ? "CS" : "EC";
    students.push(
      await M.Student.create({
        name: `${firstNames[i]} ${["Sharma", "Patel", "Reddy", "Nair", "Gowda"][i % 5]}`,
        email: mail(`student${i + 1}`),
        studentId: `1AM${semester === 1 ? 25 : 24}${code}${String(i + 1).padStart(3, "0")}`,
        department: dept,
        course: dept === "Computer Science" ? String(cse._id) : undefined,
        courseName: dept === "Computer Science" ? "B.E. Computer Science" : "B.E. Electronics",
        collegeType: "AMCEC",
        enrollmentDate: day(semester === 1 ? -90 : -450),
        semester,
        section,
        phone: `+91 99000 ${String(10000 + i).slice(1)}`,
        address: "Bannerghatta Road, Bengaluru",
        dob: new Date(`200${semester === 1 ? 7 : 5}-0${(i % 9) + 1}-1${i % 9}`),
        bloodGroup: ["O+", "A+", "B+", "AB+"][i % 4],
        fatherName: `Mr. ${["Sharma", "Patel", "Reddy", "Nair", "Gowda"][i % 5]}`,
        motherName: `Mrs. ${["Sharma", "Patel", "Reddy", "Nair", "Gowda"][i % 5]}`,
        ...pw,
      }),
    );
  }
  const sem3A = students.filter((s) => s.department === "Computer Science" && s.semester === 3 && s.section === "A");
  const sem3All = students.filter((s) => s.semester === 3);

  // Subject allocation
  const allocs = [
    ["faculty1", "CSE201", 3, "A"], ["faculty1", "CSE203", 3, "A"], ["faculty2", "MATH201", 3, "A"],
    ["faculty3", "CSE202", 3, "A"], ["faculty2", "CSE204", 3, "A"], ["faculty2", "CSE203", 3, "B"],
    ["faculty3", "CSE101", 1, "A"], ["faculty2", "MATH101", 1, "A"],
  ];
  await M.Allocation.insertMany(allocs.map(([f, code, semester, section]) => ({ faculty: fac[f]._id, subjectCode: code, semester, section })));

  // Attendance: last 15 weekdays for semester 3 section A
  const subjects = Object.fromEntries((await M.Subject.find()).map((s) => [s.code, s]));
  const attendance = [];
  let added = 0;
  for (let back = 21; back >= 1 && added < 15; back--) {
    const d = day(-back);
    if ([0, 6].includes(d.getUTCDay())) continue;
    added += 1;
    for (const [f, code, semester, section] of allocs.filter((a) => a[2] === 3 && a[3] === "A")) {
      for (const s of sem3A) {
        const weak = s === sem3A[5]; // one student with low attendance
        attendance.push({ student: s._id, subjectCode: code, subjectName: subjects[code].name, date: d, status: rand() < (weak ? 0.6 : 0.9) ? "present" : "absent", markedBy: fac[f]._id });
      }
    }
  }
  await M.Attendance.insertMany(attendance);

  // Internal marks
  const marks = [];
  for (const [f, code] of allocs.filter((a) => a[2] === 3 && a[3] === "A")) {
    for (const s of sem3A) {
      const base = s === sem3A[5] ? 0.4 : 0.6 + rand() * 0.35;
      for (const [assessment, max] of [["test1", 25], ["test2", 25], ["assignment", 20]]) {
        marks.push({ student: s._id, subjectCode: code, subjectName: subjects[code].name, assessment, marks: Math.min(max, Math.round(max * (base + (rand() - 0.5) * 0.1))), maxMarks: max, enteredBy: fac[f]._id });
      }
    }
  }
  await M.Mark.insertMany(marks);

  // Fees & payments
  const feeDocs = [];
  for (const s of sem3All) {
    feeDocs.push({ student: s._id, title: "Tuition Fee - Semester 3", category: "tuition", amount: 45000, dueDate: day(20), semester: 3 });
    feeDocs.push({ student: s._id, title: "Examination Fee - Semester 3", category: "exam", amount: 2500, dueDate: day(10), semester: 3 });
    feeDocs.push({ student: s._id, title: "Library Fee 2026", category: "library", amount: 1500, dueDate: day(-5), semester: 3 });
  }
  const fees = await M.Fee.insertMany(feeDocs);
  for (const s of sem3All.slice(0, 4)) {
    const lib = fees.find((f) => String(f.student) === String(s._id) && f.category === "library");
    const pay = await M.Payment.create({ student: s._id, fees: [lib._id], amount: lib.amount, method: "upi", receiptNo: `RCP-DEMO-${s.studentId}`, description: lib.title, paidAt: day(-12) });
    await M.Fee.updateOne({ _id: lib._id }, { status: "paid", paidAt: pay.paidAt, payment: pay._id });
  }

  // Exams
  const examCodes = ["CSE201", "CSE202", "CSE203", "CSE204", "MATH201"];
  await M.Exam.insertMany([
    ...examCodes.map((code, i) => ({ subjectCode: code, subjectName: subjects[code].name, semester: 3, examType: "semester", date: day(25 + i * 2), startTime: "09:30", endTime: "12:30", venue: `Block A - Hall ${101 + i}` })),
    { subjectCode: "CSE101", subjectName: subjects.CSE101.name, semester: 1, department: "Computer Science", examType: "internal", date: day(6), startTime: "10:00", endTime: "11:30", venue: "Lab 2" },
    { subjectCode: "MATH101", subjectName: subjects.MATH101.name, semester: 1, department: "Computer Science", examType: "internal", date: day(8), startTime: "10:00", endTime: "11:30", venue: "Room 204" },
  ]);

  // Events & notices
  await M.Event.insertMany([
    { title: "Technovation - Annual Tech Fest", description: "Hackathon, project expo and coding contests.", date: day(12), endDate: day(14), time: "09:00 AM", location: "Main Campus", type: "tech", audience: "all", createdByName: "Dr. Kavitha Rao", createdByRole: "principal" },
    { title: "Parent-Teacher Meeting", description: "Semester 3 progress review with parents.", date: day(5), time: "10:00 AM", location: "Seminar Hall", type: "meeting", audience: "all", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod" },
    { title: "Inter-College Sports Meet", date: day(18), endDate: day(19), time: "08:00 AM", location: "Sports Ground", type: "sports", audience: "all", createdByName: "Demo Admin", createdByRole: "admin" },
    { title: "Cloud Computing Workshop", description: "Hands-on AWS workshop for CSE students.", date: day(9), time: "02:00 PM", location: "Lab 3", type: "workshop", audience: "students", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod" },
    { title: "Kannada Rajyotsava Holiday", date: day(30), type: "holiday", audience: "all", createdByName: "Demo Admin", createdByRole: "admin" },
  ]);
  await M.Announcement.insertMany([
    { title: "Semester 3 exam timetable published", message: "Check the Exam Schedule section for dates, timings and halls.", category: "exam", priority: "high", audience: "students", createdByName: "Demo Admin", createdByRole: "admin" },
    { title: "Tuition fee due in 20 days", message: "Pay online from the Fee Payment section to avoid late fine.", category: "fees", priority: "medium", audience: "students", createdByName: "Demo Admin", createdByRole: "admin" },
    { title: "Department meeting on Friday", message: "All CSE faculty: curriculum review at 3 PM in the HOD cabin.", category: "academic", priority: "medium", audience: "faculty", department: "Computer Science", createdByName: "Dr. Suresh Menon", createdByRole: "hod" },
    { title: "New lab equipment installed in Lab 204", category: "infrastructure", priority: "low", audience: "all", createdByName: "Dr. Kavitha Rao", createdByRole: "principal" },
  ]);

  // Library
  const nptel = "https://nptel.ac.in/courses";
  await M.Resource.insertMany([
    ...examCodes.map((code) => ({ title: `${subjects[code].name} - Syllabus`, category: "syllabus", subjectCode: code, semester: 3, url: `${nptel}`, addedByName: "Demo Admin" })),
    { title: "OOP Lecture Notes (Units 1-3)", category: "notes", subjectCode: "CSE201", semester: 3, url: "https://docs.oracle.com/javase/tutorial/java/concepts/", addedBy: fac.faculty1._id, addedByName: "Prof. Anita Desai" },
    { title: "DBMS Lab Manual", category: "lab-manual", subjectCode: "CSE203", semester: 3, url: "https://www.w3schools.com/sql/", addedBy: fac.faculty1._id, addedByName: "Prof. Anita Desai" },
    { title: "Operating System Concepts", author: "Silberschatz, Galvin, Gagne", category: "textbook", subjectCode: "CSE204", semester: 3, url: "https://www.os-book.com/", addedByName: "Demo Admin" },
    { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", category: "textbook", subjectCode: "CSE203", semester: 3, url: "https://www.db-book.com/", addedByName: "Demo Admin" },
    { title: "Attention Is All You Need", author: "Vaswani et al.", category: "research-paper", url: "https://arxiv.org/abs/1706.03762", addedByName: "Demo Admin" },
    { title: "DBMS question paper - 2025", category: "question-paper", subjectCode: "CSE203", semester: 3, url: "https://vtu.ac.in/", addedByName: "Demo Admin" },
  ]);

  // Assignments & submissions
  const a1 = await M.Assignment.create({ title: "ER diagram for a library system", subjectCode: "CSE203", subjectName: subjects.CSE203.name, semester: 3, section: "A", department: "Computer Science", dueDate: day(-3), instructions: "Draw the ER diagram and convert it to tables.", maxMarks: 10, faculty: fac.faculty1._id, facultyName: fac.faculty1.name });
  const a2 = await M.Assignment.create({ title: "SQL joins practice", subjectCode: "CSE203", subjectName: subjects.CSE203.name, semester: 3, section: "A", department: "Computer Science", dueDate: day(4), instructions: "Solve the 10 join queries shared in class. Paste a link to your solution.", maxMarks: 10, faculty: fac.faculty1._id, facultyName: fac.faculty1.name });
  await M.Assignment.create({ title: "Inheritance & polymorphism program", subjectCode: "CSE201", subjectName: subjects.CSE201.name, semester: 3, section: "A", department: "Computer Science", dueDate: day(9), instructions: "Write a Java program demonstrating method overriding.", maxMarks: 10, faculty: fac.faculty1._id, facultyName: fac.faculty1.name });
  for (const s of sem3A.slice(0, 5)) {
    await M.Submission.create({ assignment: a1._id, student: s._id, content: "https://drive.google.com/demo-er-diagram", submittedAt: day(-4), marks: 6 + Math.round(rand() * 4), feedback: "Good work", status: "graded" });
  }
  for (const s of sem3A.slice(1, 3)) {
    await M.Submission.create({ assignment: a2._id, student: s._id, content: "https://github.com/demo/sql-joins", submittedAt: day(-1) });
  }

  // Leave requests
  const leave = (who, kind, title, type, from, to, reason, status) => ({
    applicantKind: kind, applicant: who._id, applicantName: who.name, applicantTitle: title, department: who.department,
    type, from: day(from), to: day(to), days: to - from + 1, reason, status,
    ...(status !== "pending" ? { reviewerName: kind === "faculty" ? "Dr. Suresh Menon" : "Dr. Kavitha Rao", reviewedAt: day(-1) } : {}),
  });
  const hodCse = await M.Hod.findOne({ email: mail("hod.cse") });
  await M.Leave.insertMany([
    leave(fac.faculty2, "faculty", fac.faculty2.designation, "casual", 3, 4, "Family function", "pending"),
    leave(fac.faculty3, "faculty", fac.faculty3.designation, "conference", 15, 17, "Presenting a paper at IEEE conference", "pending"),
    leave(fac.faculty1, "faculty", fac.faculty1.designation, "sick", -8, -7, "Fever", "approved"),
    leave(hodCse, "hod", "Head of Department", "academic", 20, 21, "External examiner duty at VTU", "pending"),
  ]);

  // Admissions & research
  await M.Admission.insertMany([
    { name: "Harsha Vardhan", email: "harsha.applicant@example.com", phone: "+91 90000 11111", department: "Computer Science", program: "B.E. Computer Science", score: 91 },
    { name: "Meghana Rao", email: "meghana.applicant@example.com", phone: "+91 90000 22222", department: "Computer Science", program: "B.E. Computer Science", score: 86 },
    { name: "Sanjay Kulkarni", email: "sanjay.applicant@example.com", phone: "+91 90000 33333", department: "Electronics", program: "B.E. Electronics", score: 78 },
    { name: "Fathima Begum", email: "fathima.applicant@example.com", department: "Electronics", program: "B.E. Electronics", score: 64, status: "rejected", reviewedByName: "Dr. Kavitha Rao" },
  ]);
  await M.Research.insertMany([
    { title: "AI-based crop disease detection", lead: "Dr. Meena Iyer", department: "Computer Science", funding: 12.5, status: "active", progress: 45, startDate: day(-200), endDate: day(300) },
    { title: "Low-power IoT sensor network", lead: "Prof. Arjun Shetty", department: "Electronics", funding: 8, status: "active", progress: 70, startDate: day(-320), endDate: day(60) },
    { title: "Blockchain for academic records", lead: "Prof. Rahul Verma", department: "Computer Science", funding: 5, status: "proposed", progress: 0 },
  ]);

  console.log(`Demo: data created. All demo accounts use the password ${DEMO_PASSWORD}`);
  console.log(`  Admin      admin@${DEMO_DOMAIN}`);
  console.log(`  Staff      staff@${DEMO_DOMAIN}`);
  console.log(`  Principal  principal@${DEMO_DOMAIN}`);
  console.log(`  HOD        hod.cse@${DEMO_DOMAIN}   (also hod.ece@)`);
  console.log(`  Faculty    faculty1@${DEMO_DOMAIN}  (faculty1-4)`);
  console.log(`  Student    student1@${DEMO_DOMAIN}  (student1-15; student1-6 = CSE sem 3 section A)`);
}

/** Used by server.js when SEED_ON_START=demo (hosting without shell access). Safe to call on every start. */
async function seedOnStart() {
  await seedSubjects();
  await seedDemo();
}

module.exports = { seedOnStart };

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
