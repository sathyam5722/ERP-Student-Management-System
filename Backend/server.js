require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const winston = require("winston");

const {
  Student,
  Faculty,
  Staff,
  Admin,
  Hod,
  Principal,
  Department,
  Course,
  Subject,
  Allocation,
  Attendance,
  Mark,
  ASSESSMENTS,
} = require("./models");
const { ACCOUNT_KINDS, signToken, findAccount, authenticate, optionalAuth, allow } = require("./auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Serve the frontend too, so the app works at http://localhost:3000/login.html
app.use(express.static(path.join(__dirname, "..", "Frontend")));

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// -------------------- HELPERS --------------------

/** Wrap async route handlers so thrown errors reach the error handler. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const pick = (source, fields) => {
  const out = {};
  fields.forEach((f) => {
    if (source[f] !== undefined) out[f] = typeof source[f] === "string" ? source[f].trim() : source[f];
  });
  return out;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ciExact = (email) => new RegExp(`^${escapeRegex(String(email).trim())}$`, "i");
const sameDept = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** "YYYY-MM-DD" -> Date at UTC midnight, or null when invalid. */
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Role groups
const MANAGE = ["admin", "staff"];
const LEADERS = ["hod", "principal"];
const EVERYONE = ["admin", "staff", "hod", "principal", "faculty", "student"];

// -------------------- AUTH --------------------

const LOGIN_PATHS = {
  student: "/api/students/login",
  faculty: "/api/faculty/login",
  staff: "/api/staff/login",
  admin: "/api/admin/login",
  hod: "/api/hod/login",
  principal: "/api/principal/login",
};

Object.entries(LOGIN_PATHS).forEach(([kind, route]) => {
  app.post(
    route,
    ah(async (req, res) => {
      const identifier = req.body.email || req.body.loginId || req.body.username;
      const { password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ message: "Email/ID and password are required" });
      }

      const user = await findAccount(kind, identifier);
      const valid = user && ACCOUNT_KINDS[kind].isActive(user) && (await user.verifyPassword(password));
      if (!valid) {
        logger.warn({ msg: "Login failed", kind, identifier });
        return res.status(401).json({ message: "Invalid email/ID or password" });
      }

      const token = signToken(kind, user);
      const role = kind === "admin" && user.accountType === "Staff" ? "staff" : kind;
      logger.info({ msg: "Login success", kind, id: String(user._id) });
      res.json({ message: "Login successful", token, role, kind, user: user.toJSON() });
    }),
  );
});

// Fields each kind of user may change on their own profile.
const SELF_EDITABLE = {
  student: ["name", "email", "phone", "address", "fatherPhone", "motherPhone"],
  faculty: ["name", "email", "phone", "designation", "bio"],
  staff: ["name", "email", "phone"],
  admin: ["name", "username", "email"],
  hod: ["name", "email", "phone"],
  principal: ["name", "email", "phone"],
};

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ role: req.role, kind: req.kind, user: req.user.toJSON() });
});

app.patch(
  "/api/auth/me",
  authenticate,
  ah(async (req, res) => {
    const updates = pick(req.body, SELF_EDITABLE[req.kind]);
    if (updates.email) {
      const Model = ACCOUNT_KINDS[req.kind].model;
      const clash = await Model.findOne({ email: ciExact(updates.email), _id: { $ne: req.user._id } });
      if (clash) return res.status(409).json({ message: "Another account already uses this email" });
    }
    Object.assign(req.user, updates);
    await req.user.save();
    res.json({ message: "Profile updated", user: req.user.toJSON() });
  }),
);

app.post(
  "/api/auth/change-password",
  authenticate,
  ah(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    if (!(await req.user.verifyPassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    req.user.password = newPassword;
    await req.user.save();
    res.json({ message: "Password changed successfully" });
  }),
);

// -------------------- PEOPLE (students, faculty, staff, admins, HODs, principals) --------------------

/**
 * Registers the standard routes for one type of person:
 *   GET  base/active | base/inactive | base/:id   (and GET base when listAll)
 *   POST base
 *   PATCH|PUT base/:id
 *   PATCH base/inactive/:id | base/reactivate/:id
 *   DELETE base/:id (when allowDelete)
 */
function registerPeople({ base, Model, label, flag, fields, readRoles, writeRoles, createGuard, listAll, allowDelete, deptScopedRoles = [] }) {
  // Roles in deptScopedRoles (e.g. HOD) may only manage records of their own department.
  const isScoped = (req) => deptScopedRoles.includes(req.role);
  const outOfScope = (req, doc) => isScoped(req) && !sameDept(doc.department, req.user.department);
  const scopeError = (res) => res.status(403).json({ message: `You can only manage ${label.toLowerCase()} records of your own department` });
  const activeFilter = flag ? { isActive: { $ne: false } } : { status: { $ne: "inactive" } };
  const inactiveFilter = flag ? { isActive: false } : { status: "inactive" };
  const read = [authenticate, allow(...readRoles)];
  const write = [authenticate, allow(...writeRoles)];

  const ensureUniqueEmail = async (email, exceptId) => {
    if (!email) return true;
    const query = { email: ciExact(email) };
    if (exceptId) query._id = { $ne: exceptId };
    return !(await Model.exists(query));
  };

  const setActive = (active) =>
    ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      if (outOfScope(req, doc)) return scopeError(res);
      if (!active && req.user && String(req.user._id) === String(doc._id)) {
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }
      if (flag) doc.isActive = active;
      else doc.status = active ? "active" : "inactive";
      await doc.save({ validateBeforeSave: false });
      res.json({ message: `${label} ${active ? "reactivated" : "deactivated"} successfully`, id: doc._id });
    });

  app.get(`${base}/active`, read, ah(async (_req, res) => res.json(await Model.find(activeFilter).sort({ createdAt: -1 }))));
  app.get(`${base}/inactive`, read, ah(async (_req, res) => res.json(await Model.find(inactiveFilter).sort({ createdAt: -1 }))));
  if (listAll) app.get(base, read, ah(async (_req, res) => res.json(await Model.find().sort({ createdAt: -1 }))));

  app.get(
    `${base}/:id`,
    read,
    ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      res.json(doc);
    }),
  );

  app.post(
    base,
    createGuard || write,
    ah(async (req, res) => {
      const data = pick(req.body, fields);
      if (!data.email) return res.status(400).json({ message: "Email is required" });
      if (!(await ensureUniqueEmail(data.email))) {
        return res.status(409).json({ message: `A ${label.toLowerCase()} with this email already exists` });
      }
      if (req.body.password) data.password = String(req.body.password);
      if (!flag && ["active", "inactive"].includes(req.body.status)) data.status = req.body.status;
      if (Model === Admin && req.user) data.createdBy = req.user._id;
      if (isScoped(req)) data.department = req.user.department;

      const doc = await Model.create(data);
      logger.info({ msg: `${label} created`, id: String(doc._id) });
      res.status(201).json(doc);
    }),
  );

  const update = ah(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: `${label} not found` });
    if (outOfScope(req, doc)) return scopeError(res);

    const data = pick(req.body, fields);
    if (isScoped(req)) delete data.department;
    if (data.email && !(await ensureUniqueEmail(data.email, doc._id))) {
      return res.status(409).json({ message: `A ${label.toLowerCase()} with this email already exists` });
    }
    Object.assign(doc, data);
    if (req.body.password) doc.password = String(req.body.password); // empty = keep current password
    if (!flag && ["active", "inactive"].includes(req.body.status)) doc.status = req.body.status;

    await doc.save();
    res.json(doc);
  });
  app.patch(`${base}/inactive/:id`, write, setActive(false));
  app.patch(`${base}/reactivate/:id`, write, setActive(true));
  app.patch(`${base}/:id`, write, update);
  app.put(`${base}/:id`, write, update);

  if (allowDelete) {
    app.delete(
      `${base}/:id`,
      write,
      ah(async (req, res) => {
        const found = await Model.findById(req.params.id);
        if (!found) return res.status(404).json({ message: `${label} not found` });
        if (outOfScope(req, found)) return scopeError(res);
        const doc = await Model.findByIdAndDelete(req.params.id);
        await Promise.all([Attendance.deleteMany({ student: doc._id }), Mark.deleteMany({ student: doc._id })]);
        res.json({ message: `${label} deleted successfully` });
      }),
    );
  }
}

// Student search must be registered before /api/students/:id
app.get(
  "/api/students/search",
  authenticate,
  allow(...MANAGE, ...LEADERS, "faculty"),
  ah(async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    const rx = new RegExp(escapeRegex(q), "i");
    res.json(
      await Student.find({ $or: [{ name: rx }, { email: rx }, { studentId: rx }, { courseName: rx }, { department: rx }] }),
    );
  }),
);

registerPeople({
  base: "/api/students",
  Model: Student,
  label: "Student",
  flag: false,
  listAll: true,
  allowDelete: true,
  readRoles: [...MANAGE, ...LEADERS, "faculty"],
  writeRoles: [...MANAGE, "hod"],
  deptScopedRoles: ["hod"],
  fields: [
    "name", "email", "studentId", "department", "course", "courseName", "collegeType", "enrollmentDate",
    "semester", "section", "phone", "address", "dob", "bloodGroup", "fatherName", "fatherPhone", "motherName", "motherPhone",
  ],
});

registerPeople({
  base: "/api/faculty",
  Model: Faculty,
  label: "Faculty",
  flag: false,
  readRoles: [...MANAGE, ...LEADERS, "faculty"],
  writeRoles: [...MANAGE, "hod"],
  deptScopedRoles: ["hod"],
  fields: ["name", "email", "facultyId", "department", "designation", "collegeType", "enrollmentDate", "phone", "bio"],
});

registerPeople({
  base: "/api/staff",
  Model: Staff,
  label: "Staff",
  flag: true,
  readRoles: MANAGE,
  writeRoles: MANAGE,
  fields: ["name", "username", "email", "staffId", "department", "collegeType", "enrollmentDate", "phone"],
});

registerPeople({
  base: "/api/hod",
  Model: Hod,
  label: "HOD",
  flag: false,
  readRoles: [...MANAGE, "principal"],
  writeRoles: [...MANAGE, "principal"],
  fields: ["name", "email", "hodId", "department", "collegeType", "appointedDate", "phone"],
});

registerPeople({
  base: "/api/principal",
  Model: Principal,
  label: "Principal",
  flag: false,
  readRoles: MANAGE,
  writeRoles: MANAGE,
  fields: ["name", "email", "principalId", "collegeType", "appointedDate", "phone"],
});

// Creating an admin: open only while no admin exists yet (first-time setup), otherwise admins only.
const adminCreateGuard = [
  optionalAuth,
  ah(async (req, res, next) => {
    if (req.role === "admin") return next();
    if (!(await Admin.exists({}))) return next();
    return res.status(403).json({
      message: "Only a logged-in admin can create admin accounts. Use the Admins section of the dashboard.",
    });
  }),
];

registerPeople({
  base: "/api/admin",
  Model: Admin,
  label: "Admin",
  flag: true,
  readRoles: ["admin"],
  writeRoles: ["admin"],
  createGuard: adminCreateGuard,
  fields: ["accountType", "username", "name", "email"],
});

// -------------------- DEPARTMENTS & COURSES --------------------

function registerSimpleCrud({ base, Model, label, fields, writeRoles, beforeDelete }) {
  const read = [authenticate, allow(...EVERYONE)];
  const write = [authenticate, allow(...writeRoles)];

  app.get(base, read, ah(async (_req, res) => res.json(await Model.find().sort({ name: 1 }))));
  app.get(
    `${base}/:id`,
    read,
    ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      res.json(doc);
    }),
  );
  app.post(base, write, ah(async (req, res) => res.status(201).json(await Model.create(pick(req.body, fields)))));

  const update = ah(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: `${label} not found` });
    Object.assign(doc, pick(req.body, fields));
    await doc.save();
    res.json(doc);
  });
  app.put(`${base}/:id`, write, update);
  app.patch(`${base}/:id`, write, update);

  app.delete(
    `${base}/:id`,
    write,
    ah(async (req, res) => {
      if (beforeDelete) {
        const problem = await beforeDelete(req.params.id);
        if (problem) return res.status(400).json({ message: problem });
      }
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      res.json({ message: `${label} deleted successfully` });
    }),
  );
}

registerSimpleCrud({
  base: "/api/departments",
  Model: Department,
  label: "Department",
  writeRoles: [...MANAGE, "principal"],
  fields: ["departmentId", "name", "collegeType", "status"],
});

registerSimpleCrud({
  base: "/api/courses",
  Model: Course,
  label: "Course",
  writeRoles: MANAGE,
  fields: ["courseId", "name", "department", "collegeType", "description", "duration", "durationMonths", "status"],
  beforeDelete: async (id) =>
    (await Student.exists({ course: id })) ? "Cannot delete a course that still has students enrolled" : null,
});

registerSimpleCrud({
  base: "/api/subjects",
  Model: Subject,
  label: "Subject",
  writeRoles: [...MANAGE, "hod"],
  fields: ["code", "name", "semester", "credits", "department"],
  beforeDelete: async (id) => {
    const subject = await Subject.findById(id);
    if (!subject) return null;
    const used = await Promise.all([
      Attendance.exists({ subjectCode: subject.code }),
      Mark.exists({ subjectCode: subject.code }),
    ]);
    return used.some(Boolean) ? "This subject already has attendance or marks recorded" : null;
  },
});

// -------------------- SUBJECT ALLOCATION --------------------

const ALLOCATORS = [...MANAGE, "hod", "faculty"];

app.get(
  "/api/allocations",
  authenticate,
  allow(...ALLOCATORS, "principal"),
  ah(async (_req, res) => {
    const allocations = await Allocation.find().populate("faculty", "name email department").sort({ semester: 1, section: 1 });
    const subjects = await Subject.find({ code: { $in: allocations.map((a) => a.subjectCode) } });
    const byCode = Object.fromEntries(subjects.map((s) => [s.code, s]));
    res.json(
      allocations.map((a) => ({
        _id: a._id,
        faculty: a.faculty,
        subjectCode: a.subjectCode,
        subjectName: byCode[a.subjectCode]?.name || a.subjectCode,
        semester: a.semester,
        section: a.section,
        createdAt: a.createdAt,
      })),
    );
  }),
);

// Assign a subject to a faculty member, or un-assign it if they already have it.
app.post(
  "/api/allocations/toggle",
  authenticate,
  allow(...ALLOCATORS),
  ah(async (req, res) => {
    const { faculty, subjectCode, semester, section } = req.body;
    if (!faculty || !subjectCode || !semester || !section) {
      return res.status(400).json({ message: "faculty, subjectCode, semester and section are required" });
    }
    const code = String(subjectCode).toUpperCase();
    if (!(await Subject.exists({ code }))) return res.status(400).json({ message: "Unknown subject" });
    if (!(await Faculty.exists({ _id: faculty }))) return res.status(400).json({ message: "Unknown faculty" });

    const existing = await Allocation.findOne({ subjectCode: code, semester, section });
    if (existing && String(existing.faculty) !== String(faculty)) {
      return res.status(409).json({ message: "This subject is already assigned to another faculty for this section" });
    }
    if (existing) {
      await existing.deleteOne();
      return res.json({ message: "Allocation removed", allocated: false });
    }
    const created = await Allocation.create({ faculty, subjectCode: code, semester, section });
    res.status(201).json({ message: "Subject allocated", allocated: true, allocation: created });
  }),
);

app.delete(
  "/api/allocations/:id",
  authenticate,
  allow(...ALLOCATORS),
  ah(async (req, res) => {
    const doc = await Allocation.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Allocation not found" });
    res.json({ message: "Allocation removed" });
  }),
);

// -------------------- FACULTY PORTAL --------------------

const facultyOnly = [authenticate, allow("faculty")];

/** Active students in the faculty member's department (all departments if theirs is not set). */
function facultyStudentFilter(faculty, { semester, section } = {}) {
  const filter = { status: { $ne: "inactive" } };
  if (faculty.department) filter.department = ciExact(faculty.department); 
  if (semester) filter.semester = Number(semester);
  if (section) filter.section = String(section);
  return filter;
}

app.get(
  "/api/faculty-portal/subjects",
  facultyOnly,
  ah(async (req, res) => {
    const [allocations, subjects] = await Promise.all([
      Allocation.find({ faculty: req.user._id }).sort({ semester: 1, section: 1 }),
      Subject.find().sort({ semester: 1, code: 1 }),
    ]);
    const byCode = Object.fromEntries(subjects.map((s) => [s.code, s]));
    res.json({
      allocated: allocations.map((a) => ({
        subjectCode: a.subjectCode,
        subjectName: byCode[a.subjectCode]?.name || a.subjectCode,
        semester: a.semester,
        section: a.section,
      })),
      subjects,
    });
  }),
);

app.get(
  "/api/faculty-portal/students",
  facultyOnly,
  ah(async (req, res) => {
    const students = await Student.find(facultyStudentFilter(req.user, req.query)).sort({ studentId: 1, name: 1 });
    const ids = students.map((s) => s._id);
    const [att, marks] = await Promise.all([
      Attendance.aggregate([
        { $match: { student: { $in: ids } } },
        { $group: { _id: "$student", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } },
      ]),
      Mark.aggregate([
        { $match: { student: { $in: ids } } },
        { $group: { _id: "$student", got: { $sum: "$marks" }, max: { $sum: "$maxMarks" } } },
      ]),
    ]);
    const attBy = Object.fromEntries(att.map((a) => [String(a._id), a]));
    const marksBy = Object.fromEntries(marks.map((m) => [String(m._id), m]));

    res.json(
      students.map((s) => {
        const a = attBy[String(s._id)];
        const m = marksBy[String(s._id)];
        return {
          ...s.toJSON(),
          stats: {
            attendancePct: a ? pct(a.present, a.total) : null,
            marksPct: m ? pct(m.got, m.max) : null,
            classesRecorded: a ? a.total : 0,
          },
        };
      }),
    );
  }),
);

app.get(
  "/api/faculty-portal/overview",
  facultyOnly,
  ah(async (req, res) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5, 1);
    sixMonthsAgo.setUTCHours(0, 0, 0, 0);

    const [totalStudents, subjects, records] = await Promise.all([
      Student.countDocuments(facultyStudentFilter(req.user)),
      Allocation.countDocuments({ faculty: req.user._id }),
      Attendance.find({ markedBy: req.user._id, date: { $gte: sixMonthsAgo } }, "date status"),
    ]);

    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setUTCMonth(d.getUTCMonth() + i);
      months.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), present: 0, total: 0 });
    }
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    let present = 0;
    records.forEach((r) => {
      const m = byKey[`${r.date.getUTCFullYear()}-${r.date.getUTCMonth()}`];
      if (!m) return;
      m.total += 1;
      if (r.status === "present") {
        m.present += 1;
        present += 1;
      }
    });

    res.json({
      totalStudents,
      subjects,
      avgAttendance: records.length ? pct(present, records.length) : null,
      monthly: months.map((m) => ({ label: m.label, percentage: m.total ? pct(m.present, m.total) : 0, total: m.total })),
    });
  }),
);

// ---- Attendance ----

app.get(
  "/api/attendance",
  facultyOnly,
  ah(async (req, res) => {
    const date = parseDay(req.query.date);
    if (!req.query.subjectCode || !date) return res.status(400).json({ message: "subjectCode and date (YYYY-MM-DD) are required" });
    res.json(await Attendance.find({ subjectCode: String(req.query.subjectCode).toUpperCase(), date }));
  }),
);

app.post(
  "/api/attendance",
  facultyOnly,
  ah(async (req, res) => {
    const { subjectCode, records } = req.body;
    const date = parseDay(req.body.date);
    if (!subjectCode || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "subjectCode, date (YYYY-MM-DD) and at least one record are required" });
    }
    if (date > new Date()) return res.status(400).json({ message: "Attendance cannot be marked for a future date" });

    const subject = await Subject.findOne({ code: String(subjectCode).toUpperCase() });
    if (!subject) return res.status(400).json({ message: "Unknown subject" });

    const valid = records.filter((r) => r.student && ["present", "absent"].includes(r.status));
    if (valid.length !== records.length) return res.status(400).json({ message: "Each record needs a student and a status of present/absent" });

    await Attendance.bulkWrite(
      valid.map((r) => ({
        updateOne: {
          filter: { student: r.student, subjectCode: subject.code, date },
          update: {
            $set: { status: r.status, remarks: String(r.remarks || "").trim(), subjectName: subject.name, markedBy: req.user._id },
          },
          upsert: true,
        },
      })),
    );
    res.json({ message: `Attendance saved for ${valid.length} students`, saved: valid.length });
  }),
);

app.get(
  "/api/attendance/summary",
  facultyOnly,
  ah(async (req, res) => {
    const rows = await Attendance.aggregate([
      { $match: { markedBy: req.user._id } },
      {
        $group: {
          _id: "$subjectCode",
          subjectName: { $first: "$subjectName" },
          dates: { $addToSet: "$date" },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const subjects = rows.map((r) => ({
      subjectCode: r._id,
      subjectName: r.subjectName || r._id,
      classes: r.dates.length,
      total: r.total,
      present: r.present,
      percentage: pct(r.present, r.total),
    }));
    const total = subjects.reduce((s, r) => s + r.total, 0);
    const present = subjects.reduce((s, r) => s + r.present, 0);
    res.json({ subjects, total, present, absent: total - present, percentage: pct(present, total) });
  }),
);

// ---- Internal marks ----

app.get(
  "/api/marks",
  facultyOnly,
  ah(async (req, res) => {
    const { subjectCode, assessment } = req.query;
    if (!subjectCode || !ASSESSMENTS[assessment]) return res.status(400).json({ message: "subjectCode and a valid assessment are required" });
    res.json(await Mark.find({ subjectCode: String(subjectCode).toUpperCase(), assessment }));
  }),
);

app.post(
  "/api/marks",
  facultyOnly,
  ah(async (req, res) => {
    const { subjectCode, assessment, records } = req.body;
    const maxMarks = ASSESSMENTS[assessment];
    if (!subjectCode || !maxMarks || !Array.isArray(records)) {
      return res.status(400).json({ message: "subjectCode, a valid assessment and records are required" });
    }
    const subject = await Subject.findOne({ code: String(subjectCode).toUpperCase() });
    if (!subject) return res.status(400).json({ message: "Unknown subject" });

    const entries = records.filter((r) => r.student && r.marks !== "" && r.marks !== null && r.marks !== undefined);
    const bad = entries.find((r) => !(Number(r.marks) >= 0 && Number(r.marks) <= maxMarks));
    if (bad) return res.status(400).json({ message: `Marks must be between 0 and ${maxMarks}` });
    if (entries.length === 0) return res.status(400).json({ message: "Enter marks for at least one student" });

    await Mark.bulkWrite(
      entries.map((r) => ({
        updateOne: {
          filter: { student: r.student, subjectCode: subject.code, assessment },
          update: {
            $set: {
              marks: Number(r.marks),
              maxMarks,
              remarks: String(r.remarks || "").trim(),
              subjectName: subject.name,
              enteredBy: req.user._id,
            },
          },
          upsert: true,
        },
      })),
    );
    res.json({ message: `Marks saved for ${entries.length} students`, saved: entries.length });
  }),
);

// -------------------- STUDENT PORTAL --------------------

const studentOnly = [authenticate, allow("student")];

app.get(
  "/api/student-portal/attendance",
  studentOnly,
  ah(async (req, res) => {
    const records = await Attendance.find({ student: req.user._id }, "subjectCode subjectName date status").sort({ date: 1 });

    const bySubject = {};
    records.forEach((r) => {
      const s = (bySubject[r.subjectCode] ||= { subjectCode: r.subjectCode, subjectName: r.subjectName || r.subjectCode, total: 0, present: 0 });
      s.total += 1;
      if (r.status === "present") s.present += 1;
    });
    const subjects = Object.values(bySubject).map((s) => ({ ...s, absent: s.total - s.present, percentage: pct(s.present, s.total) }));

    // Last 6 weeks, oldest first
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date();
    const weeks = Array.from({ length: 6 }, (_, i) => {
      const start = new Date(today.getTime() - (6 - i) * 7 * DAY);
      return { label: start.toLocaleDateString("en-US", { day: "numeric", month: "short" }), start, end: new Date(start.getTime() + 7 * DAY), total: 0, present: 0 };
    });
    records.forEach((r) => {
      const w = weeks.find((wk) => r.date >= wk.start && r.date < wk.end);
      if (!w) return;
      w.total += 1;
      if (r.status === "present") w.present += 1;
    });

    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    res.json({
      subjects,
      overall: { total, present, absent: total - present, percentage: pct(present, total) },
      weekly: weeks.map((w) => ({ label: `Week of ${w.label}`, percentage: w.total ? pct(w.present, w.total) : null })),
    });
  }),
);

app.get(
  "/api/student-portal/marks",
  studentOnly,
  ah(async (req, res) => {
    const marks = await Mark.find({ student: req.user._id });
    const bySubject = {};
    marks.forEach((m) => {
      const s = (bySubject[m.subjectCode] ||= { subjectCode: m.subjectCode, subjectName: m.subjectName || m.subjectCode, total: 0, maxTotal: 0 });
      s[m.assessment] = m.marks;
      s.total += m.marks;
      s.maxTotal += m.maxMarks;
    });
    const subjects = Object.values(bySubject).map((s) => ({ ...s, percentage: pct(s.total, s.maxTotal) }));
    const got = subjects.reduce((a, s) => a + s.total, 0);
    const max = subjects.reduce((a, s) => a + s.maxTotal, 0);
    res.json({ subjects, averagePercentage: max ? pct(got, max) : null, maxMarks: ASSESSMENTS });
  }),
);

// -------------------- DASHBOARD --------------------

app.get(
  "/api/dashboard/stats",
  authenticate,
  allow(...MANAGE, ...LEADERS),
  ah(async (_req, res) => {
    const [totalStudents, activeStudents, totalCourses, activeCourses, totalFaculty, totalDepartments, courseCounts] =
      await Promise.all([
        Student.countDocuments(),
        Student.countDocuments({ status: { $ne: "inactive" } }),
        Course.countDocuments(),
        Course.countDocuments({ status: { $ne: "inactive" } }),
        Faculty.countDocuments({ status: { $ne: "inactive" } }),
        Department.countDocuments(),
        Student.aggregate([{ $group: { _id: "$courseName", count: { $sum: 1 } } }]),
      ]);
    const graduates = totalStudents - activeStudents;
    res.json({
      totalStudents,
      activeStudents,
      totalCourses,
      activeCourses,
      totalFaculty,
      totalDepartments,
      graduates,
      courseCounts,
      successRate: totalStudents > 0 ? Math.round((graduates / totalStudents) * 100) : 0,
    });
  }),
);

app.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    uptime: Math.round(process.uptime()),
    timestamp: new Date(),
  });
});

// -------------------- EVENTS, NOTICES, EXAMS, FEES, ASSIGNMENTS, LEAVE, LIBRARY, ADMISSIONS, RESEARCH, REPORTS --------------------

require("./features")(app, { ah, pick, ciExact, escapeRegex, sameDept, pct, parseDay, logger, MANAGE, LEADERS, EVERYONE });

// -------------------- ERRORS --------------------

app.use("/api", (_req, res) => res.status(404).json({ message: "API route not found" }));

app.use((err, req, res, _next) => {
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid ID" });
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: "A record with these details already exists" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body" });

  logger.error({ message: err.message, stack: err.stack, method: req.method, path: req.path });
  res.status(500).json({ message: "Internal server error" });
});

// -------------------- START --------------------

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/student-management-app";

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    logger.info("Connected to MongoDB");
    if (process.env.SEED_ON_START === "demo") {
      try {
        await require("./seed").seedOnStart();
      } catch (err) {
        logger.error({ message: "Demo seed failed", error: err.message });
      }
    }
    try {
      await require("./migrations").runMigrations((msg) => logger.info(msg));
    } catch (err) {
      logger.error({ message: "Migration failed", error: err.message });
    }
    app.listen(PORT, () => logger.info(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    logger.error({ message: "MongoDB connection error", error: err.message });
    process.exit(1);
  });
