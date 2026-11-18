const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 10;
const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

/**
 * Adds password hashing + verification to a user schema.
 * - Passwords are hashed with bcrypt whenever they are set/changed.
 * - Older accounts that still hold a plain-text password can log in once;
 *   their password is then re-saved as a bcrypt hash (transparent migration).
 * - The password is never included when a document is sent as JSON.
 */
function withPassword(schema) {
  schema.pre("save", async function () {
    if (this.isModified("password") && this.password && !isBcryptHash(this.password)) {
      this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
    }
  });

  schema.methods.verifyPassword = async function (plain) {
    if (!this.password || !plain) return false;
    if (isBcryptHash(this.password)) return bcrypt.compare(plain, this.password);

    // Legacy plain-text password: accept once, then upgrade to a hash.
    if (this.password !== plain) return false;
    this.password = plain;
    this.markModified("password");
    await this.save({ validateBeforeSave: false }); // older records may miss newer required fields
    return true;
  };

  schema.set("toJSON", {
    transform(_doc, ret) {
      delete ret.password;
      return ret;
    },
  });
  return schema;
}

const opts = { timestamps: true };
const statusField = { type: String, enum: ["active", "inactive"], default: "active" };

// -------------------- PEOPLE --------------------

const Student = mongoose.model(
  "Student",
  withPassword(
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        studentId: { type: String, trim: true },
        department: String,
        course: String, // Course _id
        courseName: String,
        collegeType: String,
        enrollmentDate: Date,
        semester: Number,
        section: String,
        phone: String,
        address: String,
        dob: Date,
        bloodGroup: String,
        fatherName: String,
        fatherPhone: String,
        motherName: String,
        motherPhone: String,
        status: statusField,
        photo: String, // small data: URL set from the profile page
        password: { type: String, default: "student123" },
      },
      opts,
    ),
  ),
);

const Faculty = mongoose.model(
  "Faculty",
  withPassword(
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        facultyId: { type: String, trim: true },
        department: String,
        designation: String,
        collegeType: String,
        enrollmentDate: Date,
        phone: String,
        bio: String,
        status: statusField,
        photo: String, // small data: URL set from the profile page
        password: { type: String, default: "faculty123" },
      },
      opts,
    ),
  ),
);

const Staff = mongoose.model(
  "Staff",
  withPassword(
    new mongoose.Schema(
      {
        name: { type: String, trim: true },
        username: { type: String, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        staffId: { type: String, trim: true },
        department: String,
        collegeType: String,
        enrollmentDate: Date,
        phone: String,
        isActive: { type: Boolean, default: true },
        photo: String, // small data: URL set from the profile page
        password: { type: String, default: "staff123" },
      },
      opts,
    ),
  ),
);

const Admin = mongoose.model(
  "Admin",
  withPassword(
    new mongoose.Schema(
      {
        accountType: { type: String, enum: ["SuperAdmin", "Admin", "Staff"], default: "Admin" },
        username: { type: String, required: true, trim: true },
        name: { type: String, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        password: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        photo: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      },
      opts,
    ),
  ),
);

const Hod = mongoose.model(
  "Hod",
  withPassword(
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        hodId: { type: String, trim: true },
        department: String,
        collegeType: String,
        appointedDate: Date,
        phone: String,
        status: statusField,
        photo: String, // small data: URL set from the profile page
        password: { type: String, default: "hod123" },
      },
      opts,
    ),
  ),
);

const Principal = mongoose.model(
  "Principal",
  withPassword(
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        principalId: { type: String, trim: true },
        collegeType: String,
        appointedDate: Date,
        phone: String,
        status: statusField,
        photo: String, // small data: URL set from the profile page
        password: { type: String, default: "principal123" },
      },
      opts,
    ),
  ),
);

// -------------------- ACADEMICS --------------------

const Department = mongoose.model(
  "Department",
  new mongoose.Schema(
    {
      departmentId: String,
      name: { type: String, required: true, trim: true },
      collegeType: String,
      status: statusField,
    },
    opts,
  ),
);

const Course = mongoose.model(
  "Course",
  new mongoose.Schema(
    {
      courseId: String,
      name: { type: String, required: true, trim: true },
      department: String,
      collegeType: String,
      description: String,
      duration: Number,
      durationMonths: Number,
      status: statusField,
    },
    opts,
  ),
);

const Subject = mongoose.model(
  "Subject",
  new mongoose.Schema(
    {
      code: { type: String, required: true, unique: true, trim: true, uppercase: true },
      name: { type: String, required: true, trim: true },
      semester: { type: Number, required: true },
      credits: { type: Number, default: 3 },
      department: String,
    },
    opts,
  ),
);

// Which faculty teaches which subject to which semester/section.
const allocationSchema = new mongoose.Schema(
  {
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    subjectCode: { type: String, required: true, uppercase: true },
    semester: { type: Number, required: true },
    section: { type: String, required: true },
  },
  opts,
);
allocationSchema.index({ subjectCode: 1, semester: 1, section: 1 }, { unique: true });
const Allocation = mongoose.model("Allocation", allocationSchema);

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subjectCode: { type: String, required: true, uppercase: true },
    subjectName: String,
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent"], required: true },
    remarks: String,
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
  },
  opts,
);
attendanceSchema.index({ student: 1, subjectCode: 1, date: 1 }, { unique: true });
const Attendance = mongoose.model("Attendance", attendanceSchema);

// Internal assessment components and their maximum marks.
const ASSESSMENTS = { test1: 25, test2: 25, assignment: 20, lab: 30 };

const markSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subjectCode: { type: String, required: true, uppercase: true },
    subjectName: String,
    assessment: { type: String, enum: Object.keys(ASSESSMENTS), required: true },
    marks: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true },
    remarks: String,
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
  },
  opts,
);
markSchema.index({ student: 1, subjectCode: 1, assessment: 1 }, { unique: true });
const Mark = mongoose.model("Mark", markSchema);

// -------------------- CAMPUS LIFE --------------------

const ObjectId = mongoose.Schema.Types.ObjectId;
const AUDIENCES = ["all", "students", "faculty", "staff"];

const Event = mongoose.model(
  "Event",
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      description: String,
      date: { type: Date, required: true },
      endDate: Date,
      time: String,
      location: String,
      type: { type: String, enum: ["academic", "cultural", "sports", "tech", "meeting", "exam", "workshop", "holiday", "other"], default: "other" },
      audience: { type: String, enum: AUDIENCES, default: "all" },
      department: String, // empty = whole college
      createdByName: String,
      createdByRole: String,
    },
    opts,
  ),
);

const Announcement = mongoose.model(
  "Announcement",
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      message: String,
      category: { type: String, enum: ["academic", "exam", "fees", "event", "research", "infrastructure", "general"], default: "general" },
      priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
      audience: { type: String, enum: AUDIENCES, default: "all" },
      department: String,
      createdByName: String,
      createdByRole: String,
    },
    opts,
  ),
);

const Exam = mongoose.model(
  "Exam",
  new mongoose.Schema(
    {
      subjectCode: { type: String, required: true, uppercase: true, trim: true },
      subjectName: String,
      semester: { type: Number, required: true },
      department: String,
      examType: { type: String, enum: ["internal", "semester", "practical"], default: "semester" },
      date: { type: Date, required: true },
      startTime: String,
      endTime: String,
      venue: String,
    },
    opts,
  ),
);

const Fee = mongoose.model(
  "Fee",
  new mongoose.Schema(
    {
      student: { type: ObjectId, ref: "Student", required: true },
      title: { type: String, required: true, trim: true },
      category: { type: String, enum: ["tuition", "exam", "library", "hostel", "transport", "other"], default: "other" },
      amount: { type: Number, required: true, min: 0 },
      dueDate: Date,
      semester: Number,
      status: { type: String, enum: ["pending", "paid"], default: "pending" },
      paidAt: Date,
      payment: { type: ObjectId, ref: "Payment" },
    },
    opts,
  ),
);

const Payment = mongoose.model(
  "Payment",
  new mongoose.Schema(
    {
      student: { type: ObjectId, ref: "Student", required: true },
      fees: [{ type: ObjectId, ref: "Fee" }],
      amount: { type: Number, required: true },
      method: { type: String, enum: ["card", "netbanking", "upi", "cash"], default: "upi" },
      receiptNo: { type: String, unique: true },
      description: String,
      status: { type: String, default: "success" },
      paidAt: { type: Date, default: Date.now },
    },
    opts,
  ),
);

const Assignment = mongoose.model(
  "Assignment",
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      subjectCode: { type: String, required: true, uppercase: true },
      subjectName: String,
      semester: { type: Number, required: true },
      section: String, // empty = all sections
      department: String,
      dueDate: { type: Date, required: true },
      instructions: String,
      maxMarks: { type: Number, default: 10 },
      faculty: { type: ObjectId, ref: "Faculty", required: true },
      facultyName: String,
    },
    opts,
  ),
);

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: ObjectId, ref: "Assignment", required: true },
    student: { type: ObjectId, ref: "Student", required: true },
    content: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    marks: Number,
    feedback: String,
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
  },
  opts,
);
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
const Submission = mongoose.model("Submission", submissionSchema);

const Leave = mongoose.model(
  "Leave",
  new mongoose.Schema(
    {
      applicantKind: { type: String, enum: ["faculty", "hod", "staff", "student"], required: true },
      applicant: { type: ObjectId, required: true },
      applicantName: String,
      applicantTitle: String, // e.g. "Assistant Professor"
      department: String,
      type: { type: String, enum: ["casual", "sick", "earned", "academic", "conference", "emergency", "other"], default: "casual" },
      from: { type: Date, required: true },
      to: { type: Date, required: true },
      days: Number,
      reason: String,
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      reviewerName: String,
      reviewNote: String,
      reviewedAt: Date,
    },
    opts,
  ),
);

const Resource = mongoose.model(
  "Resource",
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      author: String,
      category: { type: String, enum: ["syllabus", "notes", "lab-manual", "textbook", "research-paper", "question-paper"], default: "notes" },
      subjectCode: { type: String, uppercase: true, trim: true },
      semester: Number,
      url: { type: String, required: true, trim: true },
      description: String,
      addedBy: ObjectId,
      addedByName: String,
    },
    opts,
  ),
);

const Admission = mongoose.model(
  "Admission",
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      phone: String,
      department: String,
      program: String,
      score: Number, // entrance / qualifying exam %
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      notes: String,
      enrolledStudent: { type: ObjectId, ref: "Student" },
      reviewedByName: String,
    },
    opts,
  ),
);

const Research = mongoose.model(
  "Research",
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true },
      lead: String,
      department: String,
      funding: { type: Number, default: 0 }, // in lakhs (₹)
      status: { type: String, enum: ["proposed", "active", "completed"], default: "proposed" },
      progress: { type: Number, default: 0, min: 0, max: 100 },
      startDate: Date,
      endDate: Date,
      description: String,
    },
    opts,
  ),
);

// A user who forgot their password asks the admin to set a new one.
const PasswordRequest = mongoose.model(
  "PasswordRequest",
  new mongoose.Schema(
    {
      kind: { type: String, enum: ["student", "faculty", "staff", "admin", "hod", "principal"], required: true },
      account: { type: ObjectId, required: true },
      name: String,
      email: String,
      department: String,
      status: { type: String, enum: ["pending", "done", "dismissed"], default: "pending" },
      resolvedByName: String,
      resolvedAt: Date,
    },
    opts,
  ),
);

module.exports = {
  PasswordRequest,
  Event,
  Announcement,
  Exam,
  Fee,
  Payment,
  Assignment,
  Submission,
  Leave,
  Resource,
  Admission,
  Research,
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
  isBcryptHash,
};
