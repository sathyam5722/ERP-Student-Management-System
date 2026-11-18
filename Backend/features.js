/**
 * Campus features used by all dashboards:
 *   events, announcements (notices), exams, library resources, research,
 *   admissions, leave requests, fees & payments, assignments & submissions,
 *   notifications, per-role dashboard overviews and CSV reports.
 */
const {
  Student, Faculty, Staff, Hod, Department, Subject, Allocation, Attendance, Mark,
  Event, Announcement, Exam, Fee, Payment, Assignment, Submission, Leave, Resource, Admission, Research, PasswordRequest,
} = require("./models");
const { ACCOUNT_KINDS, findAccount } = require("./auth");
const { authenticate, allow } = require("./auth");

module.exports = function registerFeatures(app, h) {
  const { ah, pick, ciExact, escapeRegex, sameDept, pct, parseDay, logger, MANAGE, LEADERS, EVERYONE } = h;
  const auth = (...roles) => [authenticate, allow(...roles)];
  const DAY = 24 * 60 * 60 * 1000;
  const actorName = (req) => req.user.name || req.user.username || req.user.email;
  const today = () => parseDay(new Date().toISOString().slice(0, 10));
  const daysAgo = (n) => new Date(Date.now() - n * DAY);
  const daysAhead = (n) => new Date(Date.now() + n * DAY);
  const isActiveStudent = { status: { $ne: "inactive" } };
  const anyDeptOr = (dept) => (dept ? { $or: [{ department: { $in: [null, ""] } }, { department: ciExact(dept) }] } : {});

  /** Attendance % and marks % for a list of students. */
  async function studentStats(ids) {
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
    const out = {};
    ids.forEach((id) => (out[String(id)] = { attendancePct: null, marksPct: null }));
    att.forEach((a) => (out[String(a._id)].attendancePct = pct(a.present, a.total)));
    marks.forEach((m) => (out[String(m._id)].marksPct = pct(m.got, m.max)));
    return out;
  }

  const gradeOf = (p) => (p >= 85 ? "A" : p >= 70 ? "B" : p >= 55 ? "C" : p >= 40 ? "D" : "F");

  /** Generic list/create/update/delete routes for simple content collections. */
  function content({ base, Model, label, fields, readRoles, writeRoles, filter, sort, beforeSave, canModify, deptScoped }) {
    app.get(
      base,
      auth(...readRoles),
      ah(async (req, res) => {
        const query = filter ? await filter(req) : {};
        const limit = Math.min(Number(req.query.limit) || 500, 500);
        res.json(await Model.find(query).sort(sort || { createdAt: -1 }).limit(limit));
      }),
    );

    app.post(
      base,
      auth(...writeRoles),
      ah(async (req, res) => {
        const data = pick(req.body, fields);
        if (deptScoped && req.role === "hod") data.department = req.user.department;
        if (beforeSave) {
          const problem = await beforeSave(req, data, null);
          if (problem) return res.status(400).json({ message: problem });
        }
        res.status(201).json(await Model.create(data));
      }),
    );

    const update = ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: `${label} not found` });
      if (canModify && !canModify(req, doc)) return res.status(403).json({ message: `You cannot change this ${label.toLowerCase()}` });
      const data = pick(req.body, fields);
      if (deptScoped && req.role === "hod") delete data.department;
      if (beforeSave) {
        const problem = await beforeSave(req, data, doc);
        if (problem) return res.status(400).json({ message: problem });
      }
      Object.assign(doc, data);
      await doc.save();
      res.json(doc);
    });
    app.put(`${base}/:id`, auth(...writeRoles), update);
    app.patch(`${base}/:id`, auth(...writeRoles), update);

    app.delete(
      `${base}/:id`,
      auth(...writeRoles),
      ah(async (req, res) => {
        const doc = await Model.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: `${label} not found` });
        if (canModify && !canModify(req, doc)) return res.status(403).json({ message: `You cannot delete this ${label.toLowerCase()}` });
        await doc.deleteOne();
        res.json({ message: `${label} deleted` });
      }),
    );
  }

  // HODs may only change their own department's items; everyone else with write access may change anything.
  const hodOwnDept = (req, doc) => req.role !== "hod" || !doc.department || sameDept(doc.department, req.user.department);

  /** Who sees which events / announcements. */
  function visibility(req) {
    if (["admin", "staff", "principal"].includes(req.role)) return {};
    const query = anyDeptOr(req.user.department);
    if (req.role === "student") query.audience = { $in: ["all", "students"] };
    return query;
  }

  const stampAuthor = (req, data, doc) => {
    if (!doc) {
      data.createdByName = actorName(req);
      data.createdByRole = req.role;
    }
  };

  // -------------------- EVENTS --------------------
  content({
    base: "/api/events",
    Model: Event,
    label: "Event",
    fields: ["title", "description", "date", "endDate", "time", "location", "type", "audience", "department"],
    readRoles: EVERYONE,
    writeRoles: [...MANAGE, ...LEADERS],
    deptScoped: true,
    canModify: hodOwnDept,
    sort: { date: 1 },
    filter: (req) => {
      const q = visibility(req);
      if (req.query.upcoming) q.date = { $gte: today() };
      return q;
    },
    beforeSave: (req, data, doc) => {
      if (!doc && (!data.title || !data.date)) return "Title and date are required";
      stampAuthor(req, data, doc);
    },
  });

  // -------------------- ANNOUNCEMENTS / NOTICES --------------------
  content({
    base: "/api/announcements",
    Model: Announcement,
    label: "Announcement",
    fields: ["title", "message", "category", "priority", "audience", "department"],
    readRoles: EVERYONE,
    writeRoles: [...MANAGE, ...LEADERS],
    deptScoped: true,
    canModify: hodOwnDept,
    filter: (req) => visibility(req),
    beforeSave: (req, data, doc) => {
      if (!doc && !data.title) return "Title is required";
      stampAuthor(req, data, doc);
    },
  });

  // -------------------- EXAMS --------------------
  content({
    base: "/api/exams",
    Model: Exam,
    label: "Exam",
    fields: ["subjectCode", "subjectName", "semester", "department", "examType", "date", "startTime", "endTime", "venue"],
    readRoles: EVERYONE,
    writeRoles: [...MANAGE, "hod"],
    deptScoped: true,
    canModify: hodOwnDept,
    sort: { date: 1 },
    filter: (req) => {
      if (req.role === "student") return { semester: req.user.semester || -1, ...anyDeptOr(req.user.department) };
      const q = {};
      if (req.query.semester) q.semester = Number(req.query.semester);
      if (req.role === "hod") Object.assign(q, anyDeptOr(req.user.department));
      return q;
    },
    beforeSave: async (req, data, doc) => {
      if (!doc && (!data.subjectCode || !data.semester || !data.date)) return "Subject, semester and date are required";
      if (data.subjectCode && !data.subjectName) {
        const s = await Subject.findOne({ code: String(data.subjectCode).toUpperCase() });
        if (s) data.subjectName = s.name;
      }
    },
  });

  // -------------------- LIBRARY RESOURCES --------------------
  content({
    base: "/api/resources",
    Model: Resource,
    label: "Resource",
    fields: ["title", "author", "category", "subjectCode", "semester", "url", "description"],
    readRoles: EVERYONE,
    writeRoles: [...MANAGE, "hod", "faculty"],
    canModify: (req, doc) => req.role !== "faculty" || String(doc.addedBy) === String(req.user._id),
    filter: (req) => {
      const q = {};
      if (req.query.category) q.category = req.query.category;
      if (req.query.subjectCode) q.subjectCode = String(req.query.subjectCode).toUpperCase();
      if (req.query.semester) q.semester = Number(req.query.semester);
      return q;
    },
    beforeSave: (req, data, doc) => {
      if (data.url !== undefined && !/^https?:\/\/\S+$/i.test(data.url)) return "Link must start with http:// or https://";
      if (!doc) {
        if (!data.title || !data.url) return "Title and link are required";
        data.addedBy = req.user._id;
        data.addedByName = actorName(req);
      }
    },
  });

  // -------------------- RESEARCH --------------------
  content({
    base: "/api/research",
    Model: Research,
    label: "Research project",
    fields: ["title", "lead", "department", "funding", "status", "progress", "startDate", "endDate", "description"],
    readRoles: [...MANAGE, ...LEADERS],
    writeRoles: ["admin", "principal"],
    beforeSave: (_req, data, doc) => {
      if (!doc && !data.title) return "Title is required";
    },
  });

  // -------------------- ADMISSIONS --------------------
  const ADMISSION_STAFF = ["admin", "staff", "principal"];
  const admissionFields = ["name", "email", "phone", "department", "program", "score", "notes"];

  app.get(
    "/api/admissions",
    auth(...ADMISSION_STAFF),
    ah(async (req, res) => {
      const q = {};
      if (req.query.status) q.status = req.query.status;
      res.json(await Admission.find(q).sort({ createdAt: -1 }));
    }),
  );

  const createAdmission = ah(async (req, res) => {
    const data = pick(req.body, admissionFields);
    if (!data.name || !data.email) return res.status(400).json({ message: "Name and email are required" });
    if (!/^\S+@\S+\.\S+$/.test(data.email)) return res.status(400).json({ message: "Please enter a valid email" });
    if (await Admission.exists({ email: ciExact(data.email), status: "pending" })) {
      return res.status(409).json({ message: "An application with this email is already pending" });
    }
    res.status(201).json(await Admission.create(data));
  });
  app.post("/api/admissions", auth(...ADMISSION_STAFF), createAdmission);

  // Public lists for the admission form (names only).
  app.get(
    "/api/public/options",
    ah(async (_req, res) => {
      const [departments, courses] = await Promise.all([
        Department.find({ status: { $ne: "inactive" } }, "name").sort({ name: 1 }),
        require("./models").Course.find({ status: { $ne: "inactive" } }, "name").sort({ name: 1 }),
      ]);
      res.json({ departments: departments.map((d) => d.name), programs: courses.map((c) => c.name) });
    }),
  );
  app.post("/api/admissions/apply", createAdmission); // public application form

  // Approve (and enroll as a student) or reject an application.
  app.patch(
    "/api/admissions/:id/review",
    auth("admin", "principal"),
    ah(async (req, res) => {
      const { status, notes } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Status must be approved or rejected" });
      const adm = await Admission.findById(req.params.id);
      if (!adm) return res.status(404).json({ message: "Application not found" });
      if (adm.status !== "pending") return res.status(400).json({ message: "This application was already reviewed" });

      let student = null;
      if (status === "approved") {
        student = await Student.findOne({ email: ciExact(adm.email) });
        const password = String(req.body.password || "").trim();
        if (!student && password.length < 6) {
          return res.status(400).json({ message: "Set a password (at least 6 characters) for the new student account" });
        }
        if (!student) {
          const year = new Date().getFullYear();
          const count = await Student.countDocuments({ studentId: new RegExp(`^ADM${year}`) });
          student = await Student.create({
            name: adm.name,
            email: adm.email,
            phone: adm.phone,
            department: adm.department,
            courseName: adm.program,
            studentId: `ADM${year}${String(count + 1).padStart(3, "0")}`,
            semester: Number(req.body.semester) || 1,
            section: req.body.section || "A",
            enrollmentDate: new Date(),
            password,
          });
        }
        adm.enrolledStudent = student._id;
      }
      adm.status = status;
      adm.notes = notes || adm.notes;
      adm.reviewedByName = actorName(req);
      await adm.save();
      res.json({
        message: status === "approved" ? `Approved and enrolled as ${student.studentId}. They can log in with their email and the password you set.` : "Application rejected",
        admission: adm,
        student,
      });
    }),
  );

  app.delete(
    "/api/admissions/:id",
    auth("admin", "principal"),
    ah(async (req, res) => {
      const doc = await Admission.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: "Application not found" });
      res.json({ message: "Application deleted" });
    }),
  );

  // -------------------- LEAVE REQUESTS --------------------
  const LEAVE_APPLICANTS = ["faculty", "hod", "staff", "student"];

  app.post(
    "/api/leaves",
    auth(...LEAVE_APPLICANTS),
    ah(async (req, res) => {
      const from = parseDay(req.body.from);
      const to = parseDay(req.body.to);
      if (!from || !to) return res.status(400).json({ message: "From and To dates are required" });
      if (to < from) return res.status(400).json({ message: "'To' date cannot be before 'From' date" });
      if (!String(req.body.reason || "").trim()) return res.status(400).json({ message: "Please give a reason" });
      const leave = await Leave.create({
        applicantKind: req.role,
        applicant: req.user._id,
        applicantName: actorName(req),
        applicantTitle:
          req.role === "student"
            ? `Student · ${req.user.studentId || ""}${req.user.semester ? ` · Sem ${req.user.semester}${req.user.section || ""}` : ""}`
            : req.user.designation || (req.role === "hod" ? "Head of Department" : req.role),
        department: req.user.department,
        type: req.body.type || "casual",
        from,
        to,
        days: Math.round((to - from) / DAY) + 1,
        reason: String(req.body.reason).trim(),
      });
      res.status(201).json(leave);
    }),
  );

  app.get(
    "/api/leaves/mine",
    auth(...LEAVE_APPLICANTS),
    ah(async (req, res) => res.json(await Leave.find({ applicant: req.user._id }).sort({ createdAt: -1 }))),
  );

  app.delete(
    "/api/leaves/:id",
    auth(...LEAVE_APPLICANTS),
    ah(async (req, res) => {
      const leave = await Leave.findById(req.params.id);
      if (!leave || String(leave.applicant) !== String(req.user._id)) return res.status(404).json({ message: "Leave request not found" });
      if (leave.status !== "pending") return res.status(400).json({ message: "Only pending requests can be cancelled" });
      await leave.deleteOne();
      res.json({ message: "Leave request cancelled" });
    }),
  );

  /** Which leave requests a reviewer is responsible for. */
  function reviewScope(req) {
    if (req.role === "hod") return { applicantKind: { $in: ["faculty", "student"] }, department: ciExact(req.user.department || "-") };
    if (req.role === "principal") return { applicantKind: { $in: ["hod", "staff"] } };
    return {}; // admin & staff see all
  }
  const canReview = (req, leave) => {
    if (req.role === "admin") return true;
    if (req.role === "hod") return ["faculty", "student"].includes(leave.applicantKind) && sameDept(leave.department, req.user.department);
    if (req.role === "principal") return ["hod", "staff"].includes(leave.applicantKind);
    return false;
  };

  app.get(
    "/api/leaves",
    auth("admin", "staff", "hod", "principal"),
    ah(async (req, res) => {
      const q = reviewScope(req);
      if (req.query.status) q.status = req.query.status;
      res.json(await Leave.find(q).sort({ createdAt: -1 }).limit(300));
    }),
  );

  app.patch(
    "/api/leaves/:id/review",
    auth("admin", "hod", "principal"),
    ah(async (req, res) => {
      const { status, note } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Status must be approved or rejected" });
      const leave = await Leave.findById(req.params.id);
      if (!leave) return res.status(404).json({ message: "Leave request not found" });
      if (!canReview(req, leave)) return res.status(403).json({ message: "You are not the reviewer for this request" });
      leave.status = status;
      leave.reviewNote = note || "";
      leave.reviewerName = actorName(req);
      leave.reviewedAt = new Date();
      await leave.save();
      res.json({ message: `Leave ${status}`, leave });
    }),
  );

  // -------------------- FORGOT PASSWORD (admin-assisted reset) --------------------

  // Public: a user asks for a reset. Always answers the same way so it cannot be used to discover accounts.
  app.post(
    "/api/auth/forgot-password",
    ah(async (req, res) => {
      const kind = String(req.body.role || "");
      const generic = { message: "If that account exists, your request has been sent to the administrator. They will set a new password and share it with you." };
      if (!ACCOUNT_KINDS[kind] || !req.body.identifier) return res.status(400).json({ message: "Choose your role and enter your email or ID" });
      const user = await findAccount(kind, req.body.identifier);
      if (user && !(await PasswordRequest.exists({ account: user._id, status: "pending" }))) {
        await PasswordRequest.create({ kind, account: user._id, name: user.name || user.username, email: user.email, department: user.department });
      }
      res.json(generic);
    }),
  );

  app.get(
    "/api/password-requests",
    auth("admin"),
    ah(async (req, res) => {
      const q = req.query.status ? { status: req.query.status } : {};
      res.json(await PasswordRequest.find(q).sort({ createdAt: -1 }).limit(200));
    }),
  );

  app.post(
    "/api/password-requests/:id/resolve",
    auth("admin"),
    ah(async (req, res) => {
      const reqDoc = await PasswordRequest.findById(req.params.id);
      if (!reqDoc || reqDoc.status !== "pending") return res.status(404).json({ message: "Request not found or already handled" });
      if (req.body.dismiss) {
        Object.assign(reqDoc, { status: "dismissed", resolvedByName: actorName(req), resolvedAt: new Date() });
        await reqDoc.save();
        return res.json({ message: "Request dismissed" });
      }
      const password = String(req.body.password || "").trim();
      if (password.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });
      const account = await ACCOUNT_KINDS[reqDoc.kind].model.findById(reqDoc.account);
      if (!account) return res.status(404).json({ message: "The account no longer exists" });
      account.password = password;
      await account.save({ validateBeforeSave: false });
      Object.assign(reqDoc, { status: "done", resolvedByName: actorName(req), resolvedAt: new Date() });
      await reqDoc.save();
      res.json({ message: `New password set for ${reqDoc.name}. Share it with them securely.` });
    }),
  );

  // -------------------- FEES & PAYMENTS --------------------

  app.post(
    "/api/fees/assign",
    auth(...MANAGE),
    ah(async (req, res) => {
      const { title, category, amount, dueDate, semester, department, section, studentIds } = req.body;
      if (!title || !(Number(amount) > 0)) return res.status(400).json({ message: "Title and a positive amount are required" });

      const filter = { ...isActiveStudent };
      if (Array.isArray(studentIds) && studentIds.length) filter._id = { $in: studentIds };
      if (semester) filter.semester = Number(semester);
      if (department) filter.department = ciExact(department);
      if (section) filter.section = section;
      const students = await Student.find(filter, "_id semester");
      if (!students.length) return res.status(400).json({ message: "No active students match these filters" });

      const already = new Set((await Fee.find({ title, student: { $in: students.map((s) => s._id) } }, "student")).map((f) => String(f.student)));
      const docs = students
        .filter((s) => !already.has(String(s._id)))
        .map((s) => ({ student: s._id, title, category: category || "other", amount: Number(amount), dueDate: dueDate || undefined, semester: s.semester }));
      if (docs.length) await Fee.insertMany(docs);
      res.status(201).json({ message: `Fee assigned to ${docs.length} students${already.size ? ` (${already.size} already had it)` : ""}`, created: docs.length });
    }),
  );

  app.get(
    "/api/fees",
    auth(...MANAGE, "principal"),
    ah(async (req, res) => {
      const q = {};
      if (req.query.status) q.status = req.query.status;
      let fees = await Fee.find(q).populate("student", "name studentId department semester section email").sort({ createdAt: -1 }).limit(1000);
      if (req.query.department) fees = fees.filter((f) => f.student && sameDept(f.student.department, req.query.department));
      res.json(fees);
    }),
  );

  app.delete(
    "/api/fees/:id",
    auth(...MANAGE),
    ah(async (req, res) => {
      const fee = await Fee.findById(req.params.id);
      if (!fee) return res.status(404).json({ message: "Fee not found" });
      if (fee.status === "paid") return res.status(400).json({ message: "A paid fee cannot be deleted" });
      await fee.deleteOne();
      res.json({ message: "Fee removed" });
    }),
  );

  async function feeSummary(studentFilter) {
    let ids = null;
    if (studentFilter) ids = (await Student.find(studentFilter, "_id")).map((s) => s._id);
    const match = ids ? { student: { $in: ids } } : {};
    const [totals, dueStudents, payments] = await Promise.all([
      Fee.aggregate([{ $match: match }, { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      Fee.distinct("student", { ...match, status: "pending" }),
      Payment.find({ ...match, paidAt: { $gte: daysAgo(186) } }, "amount paidAt"),
    ]);
    const by = Object.fromEntries(totals.map((t) => [t._id, t]));
    const collected = by.paid ? by.paid.amount : 0;
    const outstanding = by.pending ? by.pending.amount : 0;
    const overdue = await Fee.countDocuments({ ...match, status: "pending", dueDate: { $lt: today() } });

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
      months.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), collected: 0 });
    }
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    payments.forEach((p) => {
      const m = byKey[`${p.paidAt.getUTCFullYear()}-${p.paidAt.getUTCMonth()}`];
      if (m) m.collected += p.amount;
    });
    return {
      assigned: collected + outstanding,
      collected,
      outstanding,
      percentCollected: pct(collected, collected + outstanding),
      studentsWithDues: dueStudents.length,
      overdueFees: overdue,
      monthly: months.map(({ label, collected: c }) => ({ label, collected: c })),
    };
  }

  app.get(
    "/api/fees/summary",
    auth(...MANAGE, ...LEADERS),
    ah(async (req, res) => {
      const filter = req.role === "hod" ? { department: ciExact(req.user.department || "-") } : null;
      res.json(await feeSummary(filter));
    }),
  );

  app.post(
    "/api/fees/remind",
    auth(...MANAGE),
    ah(async (req, res) => {
      const due = await Fee.distinct("student", { status: "pending" });
      if (!due.length) return res.json({ message: "No students have pending fees", students: 0 });
      await Announcement.create({
        title: "Fee payment reminder",
        message: "You have pending fees. Please pay them from the Fee Payment section before the due date to avoid a late fine.",
        category: "fees",
        priority: "high",
        audience: "students",
        createdByName: actorName(req),
        createdByRole: req.role,
      });
      res.json({ message: `Reminder posted for ${due.length} students with pending fees`, students: due.length });
    }),
  );

  app.get(
    "/api/payments",
    auth(...MANAGE, "principal"),
    ah(async (_req, res) => {
      res.json(await Payment.find().populate("student", "name studentId department").sort({ paidAt: -1 }).limit(300));
    }),
  );

  app.get(
    "/api/payments/:id/receipt",
    auth(...MANAGE, "principal", "student"),
    ah(async (req, res) => {
      const payment = await Payment.findById(req.params.id)
        .populate("student", "name studentId department courseName semester section email")
        .populate("fees", "title category amount semester");
      if (!payment) return res.status(404).json({ message: "Receipt not found" });
      if (req.role === "student" && String(payment.student._id) !== String(req.user._id)) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(payment);
    }),
  );

  // Student fee portal
  app.get(
    "/api/student-portal/fees",
    auth("student"),
    ah(async (req, res) => {
      const fees = await Fee.find({ student: req.user._id }).sort({ status: -1, dueDate: 1 });
      const total = fees.reduce((s, f) => s + f.amount, 0);
      const paid = fees.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
      res.json({ fees, summary: { total, paid, pending: total - paid, percentPaid: pct(paid, total) } });
    }),
  );

  // Simulated payment gateway: marks the selected fees as paid and issues a receipt.
  app.post(
    "/api/student-portal/pay",
    auth("student"),
    ah(async (req, res) => {
      const { feeIds, method } = req.body;
      if (!Array.isArray(feeIds) || !feeIds.length) return res.status(400).json({ message: "Select at least one fee to pay" });
      if (!["card", "netbanking", "upi"].includes(method)) return res.status(400).json({ message: "Choose a payment method" });
      const fees = await Fee.find({ _id: { $in: feeIds }, student: req.user._id, status: "pending" });
      if (fees.length !== feeIds.length) return res.status(400).json({ message: "Some selected fees are already paid or do not belong to you" });

      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const receiptNo = `RCP-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const amount = fees.reduce((s, f) => s + f.amount, 0);
      const payment = await Payment.create({
        student: req.user._id,
        fees: fees.map((f) => f._id),
        amount,
        method,
        receiptNo,
        description: fees.map((f) => f.title).join(", "),
      });
      await Fee.updateMany({ _id: { $in: fees.map((f) => f._id) } }, { $set: { status: "paid", paidAt: new Date(), payment: payment._id } });
      logger.info({ msg: "Payment recorded", receiptNo, amount });
      res.status(201).json({ message: `Payment of ₹${amount.toLocaleString("en-IN")} successful`, payment });
    }),
  );

  app.get(
    "/api/student-portal/payments",
    auth("student"),
    ah(async (req, res) => res.json(await Payment.find({ student: req.user._id }).sort({ paidAt: -1 }))),
  );

  // -------------------- ASSIGNMENTS --------------------

  /** Students an assignment is meant for. */
  const assignmentRosterFilter = (a) => {
    const q = { ...isActiveStudent, semester: a.semester };
    if (a.section) q.section = a.section;
    if (a.department) q.department = ciExact(a.department);
    return q;
  };

  app.get(
    "/api/faculty-portal/assignments",
    auth("faculty"),
    ah(async (req, res) => {
      const list = await Assignment.find({ faculty: req.user._id }).sort({ dueDate: -1 });
      const counts = await Submission.aggregate([
        { $match: { assignment: { $in: list.map((a) => a._id) } } },
        { $group: { _id: "$assignment", submitted: { $sum: 1 }, graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } } } },
      ]);
      const by = Object.fromEntries(counts.map((c) => [String(c._id), c]));
      const out = await Promise.all(
        list.map(async (a) => ({
          ...a.toJSON(),
          students: await Student.countDocuments(assignmentRosterFilter(a)),
          submitted: by[String(a._id)]?.submitted || 0,
          graded: by[String(a._id)]?.graded || 0,
        })),
      );
      res.json(out);
    }),
  );

  const assignmentFields = ["title", "subjectCode", "semester", "section", "dueDate", "instructions", "maxMarks"];

  app.post(
    "/api/assignments",
    auth("faculty"),
    ah(async (req, res) => {
      const data = pick(req.body, assignmentFields);
      if (!data.title || !data.subjectCode || !data.dueDate) return res.status(400).json({ message: "Title, subject and due date are required" });
      const subject = await Subject.findOne({ code: String(data.subjectCode).toUpperCase() });
      if (!subject) return res.status(400).json({ message: "Unknown subject" });
      const a = await Assignment.create({
        ...data,
        semester: Number(data.semester) || subject.semester,
        subjectName: subject.name,
        department: req.user.department,
        faculty: req.user._id,
        facultyName: req.user.name,
      });
      res.status(201).json(a);
    }),
  );

  const ownAssignment = async (req, res) => {
    const a = await Assignment.findById(req.params.id);
    if (!a || String(a.faculty) !== String(req.user._id)) {
      res.status(404).json({ message: "Assignment not found" });
      return null;
    }
    return a;
  };

  app.put(
    "/api/assignments/:id",
    auth("faculty"),
    ah(async (req, res) => {
      const a = await ownAssignment(req, res);
      if (!a) return;
      Object.assign(a, pick(req.body, ["title", "section", "dueDate", "instructions", "maxMarks"]));
      await a.save();
      res.json(a);
    }),
  );

  app.delete(
    "/api/assignments/:id",
    auth("faculty"),
    ah(async (req, res) => {
      const a = await ownAssignment(req, res);
      if (!a) return;
      await Submission.deleteMany({ assignment: a._id });
      await a.deleteOne();
      res.json({ message: "Assignment deleted" });
    }),
  );

  app.get(
    "/api/assignments/:id/submissions",
    auth("faculty"),
    ah(async (req, res) => {
      const a = await ownAssignment(req, res);
      if (!a) return;
      const [students, subs] = await Promise.all([
        Student.find(assignmentRosterFilter(a), "name studentId email section").sort({ studentId: 1 }),
        Submission.find({ assignment: a._id }),
      ]);
      const bySt = Object.fromEntries(subs.map((s) => [String(s.student), s]));
      res.json({ assignment: a, roster: students.map((s) => ({ student: s, submission: bySt[String(s._id)] || null })) });
    }),
  );

  app.patch(
    "/api/submissions/:id/grade",
    auth("faculty"),
    ah(async (req, res) => {
      const sub = await Submission.findById(req.params.id).populate("assignment");
      if (!sub || String(sub.assignment.faculty) !== String(req.user._id)) return res.status(404).json({ message: "Submission not found" });
      const marks = Number(req.body.marks);
      if (!(marks >= 0 && marks <= sub.assignment.maxMarks)) return res.status(400).json({ message: `Marks must be between 0 and ${sub.assignment.maxMarks}` });
      sub.marks = marks;
      sub.feedback = String(req.body.feedback || "").trim();
      sub.status = "graded";
      await sub.save();
      res.json({ message: "Submission graded", submission: sub });
    }),
  );

  // Student side
  const studentAssignmentFilter = (st) => ({
    semester: st.semester || -1,
    $and: [
      { $or: [{ section: { $in: [null, ""] } }, { section: st.section || "-" }] },
      anyDeptOr(st.department),
    ],
  });

  app.get(
    "/api/student-portal/assignments",
    auth("student"),
    ah(async (req, res) => {
      const list = await Assignment.find(studentAssignmentFilter(req.user)).sort({ dueDate: 1 });
      const subs = await Submission.find({ student: req.user._id, assignment: { $in: list.map((a) => a._id) } });
      const by = Object.fromEntries(subs.map((s) => [String(s.assignment), s]));
      const now = new Date();
      res.json(
        list.map((a) => {
          const sub = by[String(a._id)] || null;
          const status = sub ? sub.status : a.dueDate < now ? "overdue" : "pending";
          return { ...a.toJSON(), submission: sub, status };
        }),
      );
    }),
  );

  app.post(
    "/api/student-portal/assignments/:id/submit",
    auth("student"),
    ah(async (req, res) => {
      const content = String(req.body.content || "").trim();
      if (!content) return res.status(400).json({ message: "Write your answer or paste a link to your work" });
      const a = await Assignment.findOne({ _id: req.params.id, ...studentAssignmentFilter(req.user) });
      if (!a) return res.status(404).json({ message: "Assignment not found" });
      if (a.dueDate < new Date(Date.now() - DAY)) return res.status(400).json({ message: "The deadline for this assignment has passed" });
      const existing = await Submission.findOne({ assignment: a._id, student: req.user._id });
      if (existing && existing.status === "graded") return res.status(400).json({ message: "This submission is already graded" });
      const sub = await Submission.findOneAndUpdate(
        { assignment: a._id, student: req.user._id },
        { $set: { content, submittedAt: new Date(), status: "submitted" } },
        { upsert: true, new: true },
      );
      res.json({ message: existing ? "Submission updated" : "Assignment submitted", submission: sub });
    }),
  );

  // -------------------- STUDENT CURRICULUM & OVERVIEW --------------------

  app.get(
    "/api/student-portal/curriculum",
    auth("student"),
    ah(async (req, res) => {
      const semester = req.user.semester;
      if (!semester) return res.json({ semester: null, subjects: [] });
      const subjects = await Subject.find({ semester, ...anyDeptOr(req.user.department) }).sort({ code: 1 });
      const codes = subjects.map((s) => s.code);
      const [allocations, resources] = await Promise.all([
        Allocation.find({ subjectCode: { $in: codes }, semester, section: req.user.section || "-" }).populate("faculty", "name"),
        Resource.find({ subjectCode: { $in: codes } }).sort({ category: 1 }),
      ]);
      const teacher = Object.fromEntries(allocations.map((a) => [a.subjectCode, a.faculty ? a.faculty.name : null]));
      res.json({
        semester,
        subjects: subjects.map((s) => ({
          code: s.code,
          name: s.name,
          credits: s.credits,
          faculty: teacher[s.code] || null,
          resources: resources.filter((r) => r.subjectCode === s.code),
        })),
      });
    }),
  );

  app.get(
    "/api/student-portal/overview",
    auth("student"),
    ah(async (req, res) => {
      const me = req.user;
      const [stats, fees, assignments, subs, exams] = await Promise.all([
        studentStats([me._id]),
        Fee.find({ student: me._id }),
        Assignment.find(studentAssignmentFilter(me)),
        Submission.find({ student: me._id }),
        Exam.find({ semester: me.semester || -1, ...anyDeptOr(me.department), date: { $gte: today() } }).sort({ date: 1 }).limit(5),
      ]);
      const submittedIds = new Set(subs.map((s) => String(s.assignment)));
      const pendingFees = fees.filter((f) => f.status === "pending");
      const total = fees.reduce((s, f) => s + f.amount, 0);
      const paid = total - pendingFees.reduce((s, f) => s + f.amount, 0);

      const deadlines = [
        ...assignments
          .filter((a) => !submittedIds.has(String(a._id)) && a.dueDate >= daysAgo(1))
          .map((a) => ({ kind: "assignment", id: a._id, title: a.title, subtitle: a.subjectName, date: a.dueDate, section: "assignments" })),
        ...pendingFees.map((f) => ({ kind: "fee", id: f._id, title: f.title, subtitle: `₹${f.amount.toLocaleString("en-IN")}`, date: f.dueDate, section: "fee-payment" })),
        ...exams.map((e) => ({ kind: "exam", id: e._id, title: `${e.subjectName || e.subjectCode} exam`, subtitle: e.venue || "", date: e.date, section: "exam-schedule" })),
      ]
        .filter((d) => d.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 6);

      res.json({
        attendancePct: stats[String(me._id)].attendancePct,
        marksPct: stats[String(me._id)].marksPct,
        assignments: { total: assignments.length, submitted: assignments.filter((a) => submittedIds.has(String(a._id))).length },
        fees: { total, paid, pending: total - paid, percentPaid: pct(paid, total) },
        deadlines,
      });
    }),
  );

  // -------------------- FACULTY ACTIVITY --------------------

  app.get(
    "/api/faculty-portal/activity",
    auth("faculty"),
    ah(async (req, res) => {
      const since = daysAgo(30);
      const [att, marks, assignments, subs, leaves] = await Promise.all([
        Attendance.aggregate([
          { $match: { markedBy: req.user._id, updatedAt: { $gte: since } } },
          { $group: { _id: { subject: "$subjectName", date: "$date" }, at: { $max: "$updatedAt" }, count: { $sum: 1 } } },
          { $sort: { at: -1 } },
          { $limit: 5 },
        ]),
        Mark.aggregate([
          { $match: { enteredBy: req.user._id, updatedAt: { $gte: since } } },
          { $group: { _id: { subject: "$subjectName", assessment: "$assessment" }, at: { $max: "$updatedAt" }, count: { $sum: 1 } } },
          { $sort: { at: -1 } },
          { $limit: 5 },
        ]),
        Assignment.find({ faculty: req.user._id }, "title subjectName createdAt dueDate").sort({ createdAt: -1 }).limit(5),
        Submission.find({ assignment: { $in: (await Assignment.find({ faculty: req.user._id }, "_id")).map((a) => a._id) }, submittedAt: { $gte: since } })
          .populate("student", "name")
          .populate("assignment", "title")
          .sort({ submittedAt: -1 })
          .limit(5),
        Leave.find({ applicant: req.user._id, reviewedAt: { $gte: since } }).sort({ reviewedAt: -1 }).limit(3),
      ]);
      const assessmentName = { test1: "Internal Test 1", test2: "Internal Test 2", assignment: "Assignments", lab: "Lab" };
      const items = [
        ...att.map((a) => ({ type: "attendance", title: "Marked attendance", detail: `${a._id.subject} · ${new Date(a._id.date).toLocaleDateString("en-IN")} · ${a.count} students`, at: a.at, section: "attendance" })),
        ...marks.map((m) => ({ type: "marks", title: "Entered marks", detail: `${m._id.subject} · ${assessmentName[m._id.assessment]} · ${m.count} students`, at: m.at, section: "internal-marks" })),
        ...assignments.map((a) => ({ type: "assignment", title: "Created assignment", detail: `${a.title} · ${a.subjectName}`, at: a.createdAt, section: "assignments" })),
        ...subs.map((s) => ({ type: "submission", title: "New submission", detail: `${s.student ? s.student.name : "A student"} · ${s.assignment ? s.assignment.title : ""}`, at: s.submittedAt, section: "assignments" })),
        ...leaves.map((l) => ({ type: "leave", title: `Leave ${l.status}`, detail: `${l.type} leave · ${l.days} day(s)`, at: l.reviewedAt, section: "leave" })),
      ]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 8);

      const upcoming = await Assignment.find({ faculty: req.user._id, dueDate: { $gte: today() } }).sort({ dueDate: 1 }).limit(4);
      const pendingToGrade = await Submission.countDocuments({ assignment: { $in: (await Assignment.find({ faculty: req.user._id }, "_id")).map((a) => a._id) }, status: "submitted" });
      res.json({ items, upcoming, pendingToGrade });
    }),
  );

  // -------------------- NOTIFICATIONS --------------------

  app.get(
    "/api/notifications",
    auth(...EVERYONE),
    ah(async (req, res) => {
      const out = [];
      const push = (type, message, at, section) => out.push({ type, message, at, section });
      const week = daysAgo(7);

      const notices = await Announcement.find({ ...visibility(req), createdAt: { $gte: week } }).sort({ createdAt: -1 }).limit(5);
      notices.forEach((n) => push("notice", `Notice: ${n.title}`, n.createdAt, "notices"));

      if (req.role === "student") {
        const me = req.user;
        const fees = await Fee.find({ student: me._id, status: "pending", dueDate: { $lte: daysAhead(14) } });
        fees.forEach((f) => push("fee", `${f.title} (₹${f.amount.toLocaleString("en-IN")}) ${f.dueDate < today() ? "is overdue" : "is due soon"}`, f.dueDate, "fee-payment"));
        const assignments = await Assignment.find({ ...studentAssignmentFilter(me), dueDate: { $gte: today(), $lte: daysAhead(7) } });
        const submitted = new Set((await Submission.find({ student: me._id }, "assignment")).map((s) => String(s.assignment)));
        assignments.filter((a) => !submitted.has(String(a._id))).forEach((a) => push("assignment", `Assignment due: ${a.title}`, a.dueDate, "assignments"));
        const graded = await Submission.find({ student: me._id, status: "graded", updatedAt: { $gte: week } }).populate("assignment", "title maxMarks");
        graded.forEach((s) => push("grade", `Graded: ${s.assignment ? s.assignment.title : "assignment"} — ${s.marks}/${s.assignment ? s.assignment.maxMarks : ""}`, s.updatedAt, "assignments"));
        const exams = await Exam.find({ semester: me.semester || -1, ...anyDeptOr(me.department), date: { $gte: today(), $lte: daysAhead(14) } });
        exams.forEach((e) => push("exam", `Upcoming exam: ${e.subjectName || e.subjectCode}`, e.date, "exam-schedule"));
        const myLeaves = await Leave.find({ applicant: me._id, reviewedAt: { $gte: week } });
        myLeaves.forEach((l) => push("leave", `Your ${l.type} leave was ${l.status}`, l.reviewedAt, "leave"));
        const marks = await Mark.find({ student: me._id, updatedAt: { $gte: week } }, "subjectName assessment updatedAt");
        if (marks.length) push("marks", `New internal marks posted (${marks.length})`, marks[0].updatedAt, "internal-marks");
      }

      if (req.role === "faculty") {
        const mine = (await Assignment.find({ faculty: req.user._id }, "_id")).map((a) => a._id);
        const toGrade = await Submission.countDocuments({ assignment: { $in: mine }, status: "submitted" });
        if (toGrade) push("assignment", `${toGrade} submission(s) waiting to be graded`, new Date(), "assignments");
        const leaves = await Leave.find({ applicant: req.user._id, reviewedAt: { $gte: week } });
        leaves.forEach((l) => push("leave", `Your ${l.type} leave was ${l.status}`, l.reviewedAt, "leave"));
      }

      if (["hod", "principal", "admin", "staff"].includes(req.role)) {
        const pending = await Leave.countDocuments({ ...reviewScope(req), status: "pending" });
        if (pending) push("leave", `${pending} leave request(s) waiting for review`, new Date(), "leaves");
      }
      if (["principal", "admin", "staff"].includes(req.role)) {
        const apps = await Admission.countDocuments({ status: "pending" });
        if (apps) push("admission", `${apps} admission application(s) pending`, new Date(), "admissions");
      }
      if (req.role === "admin") {
        const resets = await PasswordRequest.countDocuments({ status: "pending" });
        if (resets) push("password", `${resets} password reset request(s) waiting`, new Date(), "settings");
      }
      if (["admin", "staff"].includes(req.role)) {
        const overdue = await Fee.countDocuments({ status: "pending", dueDate: { $lt: today() } });
        if (overdue) push("fee", `${overdue} fee payment(s) are overdue`, new Date(), "payment");
        const pays = await Payment.find({ paidAt: { $gte: week } }).populate("student", "name").sort({ paidAt: -1 }).limit(3);
        pays.forEach((p) => push("payment", `${p.student ? p.student.name : "A student"} paid ₹${p.amount.toLocaleString("en-IN")}`, p.paidAt, "payment"));
      }
      if (req.role === "hod" || req.role === "principal") {
        const filter = { ...isActiveStudent, ...(req.role === "hod" ? { department: ciExact(req.user.department || "-") } : {}) };
        const ids = (await Student.find(filter, "_id")).map((s) => s._id);
        const stats = await studentStats(ids);
        const risk = Object.values(stats).filter((s) => s.attendancePct !== null && s.attendancePct < 75).length;
        if (risk) push("alert", `${risk} student(s) below 75% attendance`, new Date(), "students");
      }

      out.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
      res.json(out.slice(0, 15));
    }),
  );

  // -------------------- DASHBOARD OVERVIEWS --------------------

  async function todayAttendance(studentFilter) {
    const date = today();
    const match = { date };
    if (studentFilter) match.student = { $in: (await Student.find(studentFilter, "_id")).map((s) => s._id) };
    const rows = await Attendance.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
    const by = Object.fromEntries(rows.map((r) => [r._id, r.n]));
    const present = by.present || 0;
    const absent = by.absent || 0;
    return { present, absent, total: present + absent, percentage: pct(present, present + absent) };
  }

  async function topStudents(filter, n = 3) {
    const students = await Student.find({ ...isActiveStudent, ...filter }, "name studentId department semester section");
    const stats = await studentStats(students.map((s) => s._id));
    return students
      .map((s) => ({ ...s.toJSON(), ...stats[String(s._id)] }))
      .filter((s) => s.marksPct !== null)
      .sort((a, b) => b.marksPct - a.marksPct)
      .slice(0, n);
  }

  app.get(
    "/api/admin-portal/overview",
    auth(...MANAGE, "principal"),
    ah(async (_req, res) => {
      const [students, studentsInactive, faculty, facultyInactive, staff, staffInactive, subjects, departments] = await Promise.all([
        Student.countDocuments(isActiveStudent),
        Student.countDocuments({ status: "inactive" }),
        Faculty.countDocuments({ status: { $ne: "inactive" } }),
        Faculty.countDocuments({ status: "inactive" }),
        Staff.countDocuments({ isActive: { $ne: false } }),
        Staff.countDocuments({ isActive: false }),
        Subject.countDocuments(),
        Department.countDocuments(),
      ]);
      const [attendance, top, fees, leaves, events, notices] = await Promise.all([
        todayAttendance(null),
        topStudents({}),
        feeSummary(null),
        Leave.find({ status: "pending" }).sort({ createdAt: -1 }).limit(5),
        Event.find({ date: { $gte: today() } }).sort({ date: 1 }).limit(5),
        Announcement.find().sort({ createdAt: -1 }).limit(5),
      ]);
      res.json({
        counts: { students, studentsInactive, faculty, facultyInactive, staff, staffInactive, subjects, departments },
        attendance,
        topStudents: top,
        fees,
        pendingLeaves: leaves,
        upcomingEvents: events,
        notices,
      });
    }),
  );

  app.get(
    "/api/hod-portal/overview",
    auth("hod"),
    ah(async (req, res) => {
      const dept = req.user.department || "";
      const deptQ = { department: ciExact(dept || "-") };
      const [faculty, students, allocations, leaves, events, notices] = await Promise.all([
        Faculty.find(deptQ).sort({ name: 1 }),
        Student.find(deptQ).sort({ studentId: 1 }),
        Allocation.find().populate("faculty", "name department"),
        Leave.find({ applicantKind: { $in: ["faculty", "student"] }, ...deptQ }).sort({ createdAt: -1 }),
        Event.find({ date: { $gte: today() }, ...anyDeptOr(dept) }).sort({ date: 1 }).limit(5),
        Announcement.find(anyDeptOr(dept)).sort({ createdAt: -1 }).limit(5),
      ]);
      const deptAllocs = allocations.filter((a) => a.faculty && sameDept(a.faculty.department, dept));
      const studentIds = students.map((s) => s._id);
      const stats = await studentStats(studentIds);

      const now = today();
      const onLeave = new Set(leaves.filter((l) => l.status === "approved" && l.from <= now && l.to >= now).map((l) => String(l.applicant)));

      // Attendance for each of the last 7 days that had classes
      const weekRows = await Attendance.aggregate([
        { $match: { student: { $in: studentIds }, date: { $gte: daysAgo(14) } } },
        { $group: { _id: "$date", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } },
        { $sort: { _id: -1 } },
        { $limit: 7 },
      ]);
      const weekly = weekRows
        .reverse()
        .map((r) => ({ label: new Date(r._id).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" }), value: pct(r.present, r.total) }));

      // Grade distribution and subject performance from internal marks
      const perSubject = await Mark.aggregate([
        { $match: { student: { $in: studentIds } } },
        { $group: { _id: { student: "$student", subject: "$subjectCode" }, name: { $first: "$subjectName" }, got: { $sum: "$marks" }, max: { $sum: "$maxMarks" } } },
      ]);
      const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      const subjects = {};
      perSubject.forEach((r) => {
        const p = pct(r.got, r.max);
        grades[gradeOf(p)] += 1;
        const s = (subjects[r._id.subject] ||= { code: r._id.subject, name: r.name, total: 0, n: 0, pass: 0 });
        s.total += p;
        s.n += 1;
        if (p >= 40) s.pass += 1;
      });

      const studentRows = students.map((s) => {
        const st = stats[String(s._id)];
        return { ...s.toJSON(), ...st, atRisk: (st.attendancePct !== null && st.attendancePct < 75) || (st.marksPct !== null && st.marksPct < 40) };
      });
      const withAtt = studentRows.filter((s) => s.attendancePct !== null);
      const graded = perSubject.length;

      res.json({
        department: dept,
        faculty: faculty.map((f) => ({ ...f.toJSON(), subjects: deptAllocs.filter((a) => String(a.faculty._id) === String(f._id)).length, onLeave: onLeave.has(String(f._id)) })),
        students: studentRows,
        allocations: deptAllocs,
        avgAttendance: withAtt.length ? Math.round(withAtt.reduce((s, x) => s + x.attendancePct, 0) / withAtt.length) : null,
        passRate: graded ? pct(Object.entries(grades).filter(([g]) => g !== "F").reduce((s, [, n]) => s + n, 0), graded) : null,
        weekly,
        grades: Object.entries(grades).map(([grade, count]) => ({ grade, count })),
        subjectPerformance: Object.values(subjects).map((s) => ({ code: s.code, name: s.name, average: Math.round(s.total / s.n), passRate: pct(s.pass, s.n) })),
        leaves,
        events,
        notices,
      });
    }),
  );

  app.get(
    "/api/principal-portal/overview",
    auth("principal", "admin"),
    ah(async (_req, res) => {
      const [departments, hods, faculty, students, admissions, research, hodLeaves, events, fees] = await Promise.all([
        Department.find().sort({ name: 1 }),
        Hod.find({ status: { $ne: "inactive" } }),
        Faculty.find({ status: { $ne: "inactive" } }, "department"),
        Student.find(isActiveStudent, "_id department"),
        Admission.find().sort({ createdAt: -1 }),
        Research.find(),
        Leave.find({ applicantKind: { $in: ["hod", "staff"] }, status: "pending" }).sort({ createdAt: -1 }),
        Event.find({ date: { $gte: today() } }).sort({ date: 1 }).limit(5),
        feeSummary(null),
      ]);
      const stats = await studentStats(students.map((s) => s._id));
      const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

      const deptRows = departments.map((d) => {
        const ds = students.filter((s) => sameDept(s.department, d.name));
        const st = ds.map((s) => stats[String(s._id)]);
        return {
          _id: d._id,
          name: d.name,
          departmentId: d.departmentId,
          collegeType: d.collegeType,
          status: d.status,
          hod: (hods.find((h) => sameDept(h.department, d.name)) || {}).name || null,
          students: ds.length,
          faculty: faculty.filter((f) => sameDept(f.department, d.name)).length,
          avgAttendance: avg(st.map((x) => x.attendancePct).filter((x) => x !== null)),
          avgMarks: avg(st.map((x) => x.marksPct).filter((x) => x !== null)),
        };
      });

      const byYear = {};
      admissions.forEach((a) => {
        const y = new Date(a.createdAt).getFullYear();
        const r = (byYear[y] ||= { year: y, applications: 0, approved: 0 });
        r.applications += 1;
        if (a.status === "approved") r.approved += 1;
      });

      res.json({
        totals: {
          students: students.length,
          faculty: faculty.length,
          departments: departments.length,
          hods: hods.length,
          research: research.filter((r) => r.status === "active").length,
          researchFunding: research.reduce((s, r) => s + (r.funding || 0), 0),
        },
        departments: deptRows,
        admissions: {
          pending: admissions.filter((a) => a.status === "pending").length,
          approved: admissions.filter((a) => a.status === "approved").length,
          rejected: admissions.filter((a) => a.status === "rejected").length,
          byYear: Object.values(byYear).sort((a, b) => a.year - b.year),
          recentPending: admissions.filter((a) => a.status === "pending").slice(0, 5),
        },
        pendingLeaves: hodLeaves,
        upcomingEvents: events,
        fees,
      });
    }),
  );

  // -------------------- REPORTS (CSV downloads) --------------------

  const csvCell = (v) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCsv = (headers, rows) => [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");

  const REPORTS = {
    async students(scope) {
      const students = await Student.find(scope).sort({ department: 1, studentId: 1 });
      const stats = await studentStats(students.map((s) => s._id));
      return toCsv(
        ["Student ID", "Name", "Email", "Department", "Course", "Semester", "Section", "Status", "Attendance %", "Marks %"],
        students.map((s) => [s.studentId, s.name, s.email, s.department, s.courseName, s.semester, s.section, s.status, stats[String(s._id)].attendancePct, stats[String(s._id)].marksPct]),
      );
    },
    async faculty(scope) {
      const list = await Faculty.find(scope).sort({ department: 1, name: 1 });
      return toCsv(["Faculty ID", "Name", "Email", "Department", "Designation", "Phone", "Status"], list.map((f) => [f.facultyId, f.name, f.email, f.department, f.designation, f.phone, f.status]));
    },
    async attendance(scope) {
      const ids = (await Student.find(scope, "_id")).map((s) => s._id);
      const rows = await Attendance.aggregate([
        { $match: { student: { $in: ids } } },
        { $group: { _id: { student: "$student", subject: "$subjectCode" }, name: { $first: "$subjectName" }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } },
      ]);
      const students = Object.fromEntries((await Student.find({ _id: { $in: ids } }, "name studentId department")).map((s) => [String(s._id), s]));
      return toCsv(
        ["Student ID", "Name", "Department", "Subject Code", "Subject", "Classes", "Present", "Attendance %"],
        rows.map((r) => {
          const s = students[String(r._id.student)] || {};
          return [s.studentId, s.name, s.department, r._id.subject, r.name, r.total, r.present, pct(r.present, r.total)];
        }),
      );
    },
    async marks(scope) {
      const ids = (await Student.find(scope, "_id")).map((s) => s._id);
      const marks = await Mark.find({ student: { $in: ids } }).populate("student", "name studentId department");
      return toCsv(
        ["Student ID", "Name", "Department", "Subject Code", "Subject", "Assessment", "Marks", "Max Marks"],
        marks.map((m) => [m.student?.studentId, m.student?.name, m.student?.department, m.subjectCode, m.subjectName, m.assessment, m.marks, m.maxMarks]),
      );
    },
    async fees(scope) {
      const ids = (await Student.find(scope, "_id")).map((s) => s._id);
      const fees = await Fee.find({ student: { $in: ids } }).populate("student", "name studentId department");
      return toCsv(
        ["Student ID", "Name", "Department", "Fee", "Category", "Amount", "Due Date", "Status", "Paid On"],
        fees.map((f) => [f.student?.studentId, f.student?.name, f.student?.department, f.title, f.category, f.amount, f.dueDate, f.status, f.paidAt]),
      );
    },
    async payments(scope) {
      const ids = (await Student.find(scope, "_id")).map((s) => s._id);
      const list = await Payment.find({ student: { $in: ids } }).populate("student", "name studentId department").sort({ paidAt: -1 });
      return toCsv(["Receipt No", "Date", "Student ID", "Name", "Department", "Description", "Method", "Amount"], list.map((p) => [p.receiptNo, p.paidAt, p.student?.studentId, p.student?.name, p.student?.department, p.description, p.method, p.amount]));
    },
    async admissions() {
      const list = await Admission.find().sort({ createdAt: -1 });
      return toCsv(["Applied On", "Name", "Email", "Phone", "Department", "Program", "Score", "Status"], list.map((a) => [a.createdAt, a.name, a.email, a.phone, a.department, a.program, a.score, a.status]));
    },
    async leaves(scope) {
      const q = scope.department ? { department: scope.department } : {};
      const list = await Leave.find(q).sort({ createdAt: -1 });
      return toCsv(["Applied On", "Name", "Role", "Department", "Type", "From", "To", "Days", "Status", "Reviewed By"], list.map((l) => [l.createdAt, l.applicantName, l.applicantKind, l.department, l.type, l.from, l.to, l.days, l.status, l.reviewerName]));
    },
  };

  app.get(
    "/api/reports/:type",
    auth(...MANAGE, ...LEADERS),
    ah(async (req, res) => {
      const build = REPORTS[req.params.type];
      if (!build) return res.status(404).json({ message: "Unknown report" });
      if (req.role === "hod" && req.params.type === "admissions") return res.status(403).json({ message: "Not available for HODs" });
      const dept = req.role === "hod" ? req.user.department || "-" : req.query.department;
      const scope = dept ? { department: ciExact(dept) } : {};
      const csv = await build(scope);
      const name = `${req.params.type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      res.send("﻿" + csv); // BOM so Excel opens UTF-8 (₹) correctly
    }),
  );
};
