// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();
// const morgan = require("morgan");
// const winston = require("winston");

// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));

// // Configure Winston Logger
// const logger = winston.createLogger({
//   level: "info",
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json(),
//   ),
//   transports: [
//     new winston.transports.File({ filename: "error.log", level: "error" }),
//     new winston.transports.File({ filename: "combined.log" }),
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.simple(),
//       ),
//     }),
//   ],
// });

// app.use(
//   morgan(":method :url :status :response-time ms - :res[content-length]"),
// );

// // Custom API Logger Middleware
// const apiLogger = (req, res, next) => {
//   const start = Date.now();
//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     logger.info({
//       method: req.method,
//       path: req.path,
//       status: res.statusCode,
//       duration: `${duration}ms`,
//       params: req.params,
//       query: req.query,
//       body: req.method !== "GET" ? req.body : undefined,
//     });
//   });
//   next();
// };

// app.use(apiLogger);

// // MongoDB Connection
// mongoose
//   .connect(
//     process.env.MONGODB_URI ||
//       "mongodb://localhost:27017/student-management-app",
//   )
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("MongoDB connection error:", err));

// // -------------------- SCHEMAS & MODELS --------------------

// const studentSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     course: {
//       type: String,
//       required: true,
//     },
//     enrollmentDate: {
//       type: Date,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["active", "inactive"],
//       default: "active",
//     },
//     password: {
//       type: String,
//       default: "student123",
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// const Student =
//   mongoose.models.Student || mongoose.model("Student", studentSchema);

// const facultySchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     department: {
//       type: String,
//       required: true,
//     },
//     designation: {
//       type: String,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["active", "inactive"],
//       default: "active",
//     },
//     password: {
//       type: String,
//       default: "faculty123",
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// const Faculty =
//   mongoose.models.Faculty || mongoose.model("Faculty", facultySchema);

// // UPDATED: staff schema now matches your frontend staff form
// const staffSchema = new mongoose.Schema(
//   {
//     username: {
//       type: String,
//       required: true,
//       unique: true,
//       trim: true,
//       minlength: 3,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
//     },
//     password: {
//       type: String,
//       required: true,
//       minlength: 6,
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// const Staff = mongoose.models.Staff || mongoose.model("Staff", staffSchema);

// const courseSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     description: {
//       type: String,
//       required: true,
//     },
//     duration: {
//       type: Number,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["active", "inactive"],
//       default: "active",
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);

// const AdminSchema = new mongoose.Schema(
//   {
//     accountType: {
//       type: String,
//       enum: ["SuperAdmin", "Admin"],
//       required: true,
//     },

//     username: {
//       type: String,
//       required: true,
//       unique: true,
//       trim: true,
//       minlength: 3,
//     },

//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
//     },

//     password: {
//       type: String,
//       required: true,
//       minlength: 6,
//       select: false,
//     },

//     isActive: {
//       type: Boolean,
//       default: true,
//     },

//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Admin",
//       required: false,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

// // -------------------- FACULTY ROUTES --------------------

// app.get("/api/faculty/active", async (req, res) => {
//   try {
//     const faculty = await Faculty.find({ status: "active" });

//     if (!faculty || faculty.length === 0) {
//       return res.status(404).json({ msg: "Faculty not found" });
//     }

//     logger.info(`Retrieved ${faculty.length} faculties successfully`);
//     res.status(200).json(faculty);
//   } catch (error) {
//     logger.error("Error fetching faculties:", error);
//     res.status(500).json({ msg: error.message });
//   }
// });

// app.get("/api/faculty/inactive", async (req, res) => {
//   try {
//     const faculty = await Faculty.find({ status: "inactive" });

//     if (!faculty || faculty.length === 0) {
//       return res.status(404).json({ msg: "Faculty not found" });
//     }

//     logger.info(`Retrieved ${faculty.length} faculties successfully`);
//     res.status(200).json(faculty);
//   } catch (error) {
//     logger.error("Error fetching faculties:", error);
//     res.status(500).json({ msg: error.message });
//   }
// });

// app.get("/api/faculty/:id", async (req, res) => {
//   try {
//     const facultyId = req.params.id;
//     const faculty = await Faculty.findById(facultyId);

//     if (!faculty) return res.status(404).json({ msg: "Faculty not found" });

//     res.status(200).json({ msg: "Success", faculty });
//   } catch (error) {
//     logger.error("Error Fetching faculty:", error);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

// app.post("/api/faculty", async (req, res) => {
//   try {
//     const { name, email, department, designation, status, password } = req.body;

//     if (!name || !email || !department || !designation) {
//       return res.status(400).json({ msg: "All fields are required" });
//     }

//     const existingFaculty = await Faculty.findOne({ email });
//     if (existingFaculty) {
//       return res.status(409).json({ msg: "Email already exists" });
//     }

//     const result = await Faculty.create({
//       name,
//       email,
//       department,
//       designation,
//       status,
//       password,
//     });

//     return res.status(201).json({ msg: "success", id: result._id });
//   } catch (error) {
//     logger.error("Error creating faculty:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// app.patch("/api/faculty/reactivate/:id", async (req, res) => {
//   try {
//     const result = await Faculty.findByIdAndUpdate(
//       req.params.id,
//       { status: "active" },
//       { new: true },
//     );

//     if (!result) {
//       return res.status(404).json({ msg: "Faculty not found" });
//     }

//     res.status(200).json({ msg: "success" });
//   } catch (error) {
//     res.status(500).json({ msg: error.message });
//   }
// });

// app.patch("/api/faculty/:id", async (req, res) => {
//   try {
//     const facultyId = req.params.id;
//     const { name, email, department, designation, status, password } = req.body;

//     const faculty = await Faculty.findById(facultyId);
//     if (!faculty) {
//       return res.status(404).json({ msg: "Faculty not found" });
//     }

//     if (name !== undefined) faculty.name = name;
//     if (email !== undefined) faculty.email = email;
//     if (department !== undefined) faculty.department = department;
//     if (designation !== undefined) faculty.designation = designation;
//     if (status !== undefined) faculty.status = status;
//     if (password !== undefined) faculty.password = password;

//     await faculty.save();

//     return res.status(200).json({
//       msg: "Faculty updated successfully",
//       id: faculty._id,
//     });
//   } catch (error) {
//     logger.error("Error updating faculty:", error);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

// app.patch("/api/faculty/inactive/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const faculty = await Faculty.findById(id);
//     if (!faculty) {
//       return res.status(404).json({ msg: "Faculty not found" });
//     }

//     if (faculty.status === "inactive") {
//       return res.status(400).json({ msg: "Faculty already deleted" });
//     }

//     faculty.status = "inactive";
//     await faculty.save();

//     return res.status(200).json({
//       msg: "Faculty deleted successfully",
//       id: faculty._id,
//     });
//   } catch (error) {
//     logger.error("Error deleting faculty:", error);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

// // -------------------- STAFF MANAGEMENT ROUTES --------------------

// // Get all active staff
// app.get("/api/staff/active", async (req, res) => {
//   try {
//     const staff = await Staff.find({ isActive: true });

//     if (!staff || staff.length === 0) {
//       return res.status(404).json({ msg: "No active staff found" });
//     }

//     logger.info(`Retrieved ${staff.length} active staff successfully`);
//     res.status(200).json(staff);
//   } catch (error) {
//     logger.error("Error fetching active staff:", error);
//     res.status(500).json({ msg: error.message });
//   }
// });

// // Get all inactive staff
// app.get("/api/staff/inactive", async (req, res) => {
//   try {
//     const staff = await Staff.find({ isActive: false });

//     if (!staff || staff.length === 0) {
//       return res.status(404).json({ msg: "No inactive staff found" });
//     }

//     logger.info(`Retrieved ${staff.length} inactive staff successfully`);
//     res.status(200).json(staff);
//   } catch (error) {
//     logger.error("Error fetching inactive staff:", error);
//     res.status(500).json({ msg: error.message });
//   }
// });

// // Get single staff by ID
// app.get("/api/staff/:id", async (req, res) => {
//   try {
//     const staff = await Staff.findById(req.params.id);

//     if (!staff) return res.status(404).json({ msg: "Staff not found" });

//     res.status(200).json({ msg: "Success", staff });
//   } catch (error) {
//     logger.error("Error Fetching staff:", error);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

// // Create new staff
// app.post("/api/staff", async (req, res) => {
//   try {
//     const { username, email, password } = req.body;

//     if (!username || !email || !password) {
//       return res
//         .status(400)
//         .json({ msg: "Username, email, and password are required" });
//     }

//     const existingEmail = await Staff.findOne({ email });
//     if (existingEmail) {
//       return res.status(409).json({ msg: "Email already exists" });
//     }

//     const existingUsername = await Staff.findOne({ username });
//     if (existingUsername) {
//       return res.status(409).json({ msg: "Username already exists" });
//     }

//     const result = await Staff.create({
//       username,
//       email,
//       password,
//       isActive: true,
//     });

//     logger.info(`Staff created: ${result.username}`);
//     return res.status(201).json({ msg: "success", id: result._id });
//   } catch (error) {
//     logger.error("Error creating staff:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// // Reactivate staff
// app.patch("/api/staff/reactivate/:id", async (req, res) => {
//   try {
//     const result = await Staff.findByIdAndUpdate(
//       req.params.id,
//       { isActive: true },
//       { new: true },
//     );

//     if (!result) return res.status(404).json({ msg: "Staff not found" });

//     res.status(200).json({ msg: "success" });
//   } catch (error) {
//     res.status(500).json({ msg: error.message });
//   }
// });

// // Update staff details
// app.patch("/api/staff/:id", async (req, res) => {
//   try {
//     const { username, email, password } = req.body;

//     const staff = await Staff.findById(req.params.id);

//     if (!staff) {
//       return res.status(404).json({ msg: "Staff not found" });
//     }

//     if (email && email !== staff.email) {
//       const existingEmail = await Staff.findOne({ email });
//       if (existingEmail) {
//         return res.status(409).json({ msg: "Email already exists" });
//       }
//     }

//     if (username && username !== staff.username) {
//       const existingUsername = await Staff.findOne({ username });
//       if (existingUsername) {
//         return res.status(409).json({ msg: "Username already exists" });
//       }
//     }

//     if (username !== undefined) staff.username = username;
//     if (email !== undefined) staff.email = email;
//     if (password !== undefined && password !== "") staff.password = password;

//     await staff.save();

//     return res.status(200).json({
//       msg: "Staff updated successfully",
//       id: staff._id,
//     });
//   } catch (error) {
//     logger.error("Error updating staff:", error);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

// // Deactivate staff
// app.patch("/api/staff/inactive/:id", async (req, res) => {
//   try {
//     const staff = await Staff.findById(req.params.id);

//     if (!staff) {
//       return res.status(404).json({ msg: "Staff not found" });
//     }

//     if (!staff.isActive) {
//       return res.status(400).json({ msg: "Staff already deactivated" });
//     }

//     staff.isActive = false;
//     await staff.save();

//     return res.status(200).json({
//       msg: "Staff deactivated successfully",
//       id: staff._id,
//     });
//   } catch (error) {
//     logger.error("Error deactivating staff:", error);
//     res.status(500).json({ msg: "Internal Server Error" });
//   }
// });

// // -------------------- COURSE ROUTES --------------------

// app.get("/api/courses", async (req, res) => {
//   try {
//     const courses = await Course.find().sort({ name: 1 });
//     logger.info(`Retrieved ${courses.length} courses successfully`);
//     res.json(courses);
//   } catch (error) {
//     logger.error("Error fetching courses:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.post("/api/courses", async (req, res) => {
//   try {
//     const course = new Course(req.body);
//     const savedCourse = await course.save();

//     logger.info("New course created:", {
//       courseId: savedCourse._id,
//       name: savedCourse.name,
//     });

//     res.status(201).json(savedCourse);
//   } catch (error) {
//     logger.error("Error creating course:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// app.put("/api/courses/:id", async (req, res) => {
//   try {
//     const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });

//     if (!course) {
//       logger.warn("Course not found for update:", { courseId: req.params.id });
//       return res.status(404).json({ message: "Course not found" });
//     }

//     logger.info("Course updated successfully:", {
//       courseId: course._id,
//       name: course.name,
//     });

//     res.json(course);
//   } catch (error) {
//     logger.error("Error updating course:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// app.delete("/api/courses/:id", async (req, res) => {
//   try {
//     const enrolledStudents = await Student.countDocuments({
//       course: req.params.id,
//     });

//     if (enrolledStudents > 0) {
//       logger.warn("Attempted to delete course with enrolled students:", {
//         courseId: req.params.id,
//         enrolledStudents,
//       });

//       return res
//         .status(400)
//         .json({ message: "Cannot delete course with enrolled students" });
//     }

//     const course = await Course.findByIdAndDelete(req.params.id);

//     if (!course) {
//       logger.warn("Course not found for deletion:", {
//         courseId: req.params.id,
//       });
//       return res.status(404).json({ message: "Course not found" });
//     }

//     logger.info("Course deleted successfully:", {
//       courseId: course._id,
//       name: course.name,
//     });

//     res.json({ message: "Course deleted successfully" });
//   } catch (error) {
//     logger.error("Error deleting course:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.get("/api/courses/:id", async (req, res) => {
//   try {
//     const course = await Course.findById(req.params.id);

//     if (!course) {
//       return res.status(404).json({ message: "Course not found" });
//     }

//     res.json(course);
//   } catch (error) {
//     logger.error("Error fetching course:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // -------------------- STUDENT ROUTES --------------------

// app.get("/api/students", async (req, res) => {
//   try {
//     const students = await Student.find().sort({ createdAt: -1 });
//     logger.info(`Retrieved ${students.length} students successfully`);
//     res.json(students);
//   } catch (error) {
//     logger.error("Error fetching students:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.post("/api/students", async (req, res) => {
//   try {
//     const student = new Student(req.body);
//     const savedStudent = await student.save();

//     logger.info("New student created:", {
//       studentId: savedStudent._id,
//       name: savedStudent.name,
//       course: savedStudent.course,
//     });

//     res.status(201).json(savedStudent);
//   } catch (error) {
//     logger.error("Error creating student:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// app.put("/api/students/:id", async (req, res) => {
//   try {
//     const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });

//     if (!student) {
//       logger.warn("Student not found for update:", {
//         studentId: req.params.id,
//       });
//       return res.status(404).json({ message: "Student not found" });
//     }

//     logger.info("Student updated successfully:", {
//       studentId: student._id,
//       name: student.name,
//       course: student.course,
//     });

//     res.json(student);
//   } catch (error) {
//     logger.error("Error updating student:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// app.delete("/api/students/:id", async (req, res) => {
//   try {
//     const student = await Student.findByIdAndDelete(req.params.id);

//     if (!student) {
//       logger.warn("Student not found for deletion:", {
//         studentId: req.params.id,
//       });
//       return res.status(404).json({ message: "Student not found" });
//     }

//     logger.info("Student deleted successfully:", {
//       studentId: student._id,
//       name: student.name,
//       course: student.course,
//     });

//     res.json({ message: "Student deleted successfully" });
//   } catch (error) {
//     logger.error("Error deleting student:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.get("/api/students/search", async (req, res) => {
//   try {
//     const searchTerm = req.query.q;
//     logger.info("Student search initiated:", { searchTerm });

//     const students = await Student.find({
//       $or: [
//         { name: { $regex: searchTerm, $options: "i" } },
//         { course: { $regex: searchTerm, $options: "i" } },
//         { email: { $regex: searchTerm, $options: "i" } },
//       ],
//     });

//     logger.info("Student search completed:", {
//       searchTerm,
//       resultsCount: students.length,
//     });

//     res.json(students);
//   } catch (error) {
//     logger.error("Error searching students:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.get("/api/students/:id", async (req, res) => {
//   try {
//     const student = await Student.findById(req.params.id);

//     if (!student) {
//       return res.status(404).json({ message: "Student not found" });
//     }

//     res.json(student);
//   } catch (error) {
//     logger.error("Error fetching student:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // -------------------- LOGIN ROUTES --------------------

// app.post("/api/students/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Email and password are required" });
//     }

//     const student = await Student.findOne({ email });
//     if (!student) {
//       logger.warn("Login attempt with invalid email:", { email });
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     if (student.password !== password) {
//       logger.warn("Login attempt with invalid password:", { email });
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     const { password: _, ...studentData } = student.toObject();

//     logger.info("Student logged in successfully:", {
//       studentId: student._id,
//       email,
//     });

//     res.json({ message: "Login successful", student: studentData });
//   } catch (error) {
//     logger.error("Error during student login:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.post("/api/faculty/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const faculty = await Faculty.findOne({ email, status: "active" });

//     if (!faculty || faculty.password !== password) {
//       logger.warn("Faculty login failed:", { email });
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     const { password: _, ...facultyData } = faculty.toObject();
//     logger.info("Faculty logged in successfully:", { facultyId: faculty._id });

//     res.json({
//       message: "Login successful",
//       user: facultyData,
//       role: "faculty",
//     });
//   } catch (error) {
//     logger.error("Error during faculty login:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // NEW: separate staff login
// app.post("/api/staff/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const staff = await Staff.findOne({ email, isActive: true });

//     if (!staff || staff.password !== password) {
//       logger.warn("Staff login failed:", { email });
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     const { password: _, ...staffData } = staff.toObject();
//     logger.info("Staff logged in successfully:", { staffId: staff._id });

//     res.json({
//       message: "Login successful",
//       user: staffData,
//       role: "staff",
//     });
//   } catch (error) {
//     logger.error("Error during staff login:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // UPDATED: admin login checks only Admin collection
// app.post("/api/admin/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const admin = await Admin.findOne({ email, isActive: true }).select(
//       "+password",
//     );

//     if (!admin || admin.password !== password) {
//       logger.warn("Admin login failed:", { email });
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     const { password: _, ...adminData } = admin.toObject();
//     logger.info("Admin logged in:", {
//       adminId: admin._id,
//       type: admin.accountType,
//     });

//     res.json({
//       message: "Login successful",
//       user: adminData,
//       role: admin.accountType,
//     });
//   } catch (error) {
//     logger.error("Error during admin login:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // -------------------- ADMIN ROUTES --------------------

// app.post("/api/admin", async (req, res) => {
//   try {
//     const { accountType, username, email, password, createdBy } = req.body;

//     if (!username || !email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Username, email and password are required" });
//     }

//     const existingEmail = await Admin.findOne({ email });
//     if (existingEmail) {
//       return res.status(409).json({ message: "Email already exists" });
//     }

//     const existingUsername = await Admin.findOne({ username });
//     if (existingUsername) {
//       return res.status(409).json({ message: "Username already exists" });
//     }

//     const admin = new Admin({
//       accountType: accountType || "Admin",
//       username,
//       email,
//       password,
//       createdBy,
//       isActive: true,
//     });

//     const savedAdmin = await admin.save();

//     logger.info("New admin created:", {
//       adminId: savedAdmin._id,
//       username: savedAdmin.username,
//     });

//     const adminData = savedAdmin.toObject();
//     delete adminData.password;

//     res.status(201).json(adminData);
//   } catch (error) {
//     logger.error("Error creating admin:", error);
//     res.status(400).json({ message: error.message });
//   }
// });

// app.get("/api/admin/active", async (req, res) => {
//   try {
//     const admins = await Admin.find({ isActive: true }).sort({ createdAt: -1 });
//     return res.status(200).json(admins || []);
//   } catch (error) {
//     logger.error("Error fetching active admins:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.get("/api/admin/inactive", async (req, res) => {
//   try {
//     const admins = await Admin.find({ isActive: false }).sort({ createdAt: -1 });
//     return res.status(200).json(admins || []);
//   } catch (error) {
//     logger.error("Error fetching inactive admins:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.get("/api/admin/list/all", async (req, res) => {
//   try {
//     const admins = await Admin.find().sort({ createdAt: -1 });
//     res.status(200).json(admins);
//   } catch (error) {
//     logger.error("Error listing admins:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.get("/api/admin/:id", async (req, res) => {
//   try {
//     const admin = await Admin.findById(req.params.id);

//     if (!admin) {
//       return res.status(404).json({ message: "Admin not found" });
//     }

//     res.status(200).json({ message: "Success", admin });
//   } catch (error) {
//     logger.error("Error fetching admin:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.patch("/api/admin/:id", async (req, res) => {
//   try {
//     const { accountType, username, email, password } = req.body;

//     const admin = await Admin.findById(req.params.id).select("+password");

//     if (!admin) {
//       return res.status(404).json({ message: "Admin not found" });
//     }

//     if (email && email !== admin.email) {
//       const existingEmail = await Admin.findOne({ email });
//       if (existingEmail) {
//         return res.status(409).json({ message: "Email already exists" });
//       }
//     }

//     if (username && username !== admin.username) {
//       const existingUsername = await Admin.findOne({ username });
//       if (existingUsername) {
//         return res.status(409).json({ message: "Username already exists" });
//       }
//     }

//     if (accountType !== undefined) admin.accountType = accountType;
//     if (username !== undefined) admin.username = username;
//     if (email !== undefined) admin.email = email;
//     if (password !== undefined && password !== "") admin.password = password;

//     await admin.save();

//     res.status(200).json({
//       message: "Admin updated successfully",
//       id: admin._id,
//     });
//   } catch (error) {
//     logger.error("Error updating admin:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.patch("/api/admin/inactive/:id", async (req, res) => {
//   try {
//     const admin = await Admin.findById(req.params.id);

//     if (!admin) {
//       return res.status(404).json({ message: "Admin not found" });
//     }

//     if (!admin.isActive) {
//       return res.status(400).json({ message: "Admin already inactive" });
//     }

//     admin.isActive = false;
//     await admin.save();

//     res.status(200).json({
//       message: "Admin deactivated successfully",
//       id: admin._id,
//     });
//   } catch (error) {
//     logger.error("Error deactivating admin:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// app.patch("/api/admin/reactivate/:id", async (req, res) => {
//   try {
//     const admin = await Admin.findByIdAndUpdate(
//       req.params.id,
//       { isActive: true },
//       { new: true },
//     );

//     if (!admin) {
//       return res.status(404).json({ message: "Admin not found" });
//     }

//     res.status(200).json({
//       message: "Admin reactivated successfully",
//       id: admin._id,
//     });
//   } catch (error) {
//     logger.error("Error reactivating admin:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // -------------------- DASHBOARD --------------------

// app.get("/api/dashboard/stats", async (req, res) => {
//   try {
//     const stats = await getDashboardStats();
//     logger.info("Dashboard statistics retrieved successfully:", stats);
//     res.json(stats);
//   } catch (error) {
//     logger.error("Error fetching dashboard stats:", error);
//     res.status(500).json({ message: error.message });
//   }
// });

// async function getDashboardStats() {
//   const totalStudents = await Student.countDocuments();
//   const activeStudents = await Student.countDocuments({ status: "active" });
//   const totalCourses = await Course.countDocuments();
//   const activeCourses = await Course.countDocuments({ status: "active" });
//   const graduates = await Student.countDocuments({ status: "inactive" });
//   const courseCounts = await Student.aggregate([
//     { $group: { _id: "$course", count: { $sum: 1 } } },
//   ]);

//   return {
//     totalStudents,
//     activeStudents,
//     totalCourses,
//     activeCourses,
//     graduates,
//     courseCounts,
//     successRate:
//       totalStudents > 0 ? Math.round((graduates / totalStudents) * 100) : 0,
//   };
// }

// // -------------------- HEALTH CHECK --------------------

// app.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "UP",
//     timestamp: new Date(),
//     uptime: process.uptime(),
//     environment: process.env.NODE_ENV || "development",
//   });
// });

// app.get("/health/detailed", async (req, res) => {
//   try {
//     const dbStatus =
//       mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";

//     const systemInfo = {
//       memory: {
//         total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
//         used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
//         unit: "MB",
//       },
//       uptime: {
//         seconds: Math.round(process.uptime()),
//         formatted: formatUptime(process.uptime()),
//       },
//       nodeVersion: process.version,
//       platform: process.platform,
//     };

//     const healthCheck = {
//       status: "UP",
//       timestamp: new Date(),
//       database: {
//         status: dbStatus,
//         name: "MongoDB",
//         host: mongoose.connection.host,
//       },
//       system: systemInfo,
//       environment: process.env.NODE_ENV || "development",
//     };

//     res.status(200).json(healthCheck);
//   } catch (error) {
//     res.status(500).json({
//       status: "DOWN",
//       timestamp: new Date(),
//       error: error.message,
//     });
//   }
// });

// // -------------------- HELPERS --------------------

// function formatUptime(seconds) {
//   const days = Math.floor(seconds / (3600 * 24));
//   const hours = Math.floor((seconds % (3600 * 24)) / 3600);
//   const minutes = Math.floor((seconds % 3600) / 60);
//   const remainingSeconds = Math.floor(seconds % 60);

//   const parts = [];
//   if (days > 0) parts.push(`${days}d`);
//   if (hours > 0) parts.push(`${hours}h`);
//   if (minutes > 0) parts.push(`${minutes}m`);
//   if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

//   return parts.join(" ");
// }

// // -------------------- ERROR HANDLER --------------------
// // Keep this AFTER all routes
// app.use((err, req, res, next) => {
//   logger.error({
//     message: err.message,
//     stack: err.stack,
//     method: req.method,
//     path: req.path,
//     params: req.params,
//     query: req.query,
//     body: req.method !== "GET" ? req.body : undefined,
//   });

//   res.status(500).json({ message: "Internal server error" });
// });

// // -------------------- SERVER --------------------

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const winston = require("winston");
require("dotenv").config();

const app = express();

// -------------------- CONFIG --------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------- LOGGER --------------------
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

app.use(morgan("dev"));

// -------------------- DB --------------------
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/student-management-app")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

// -------------------- SCHEMAS --------------------

const studentSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  studentId: { type: String, unique: true },
  department: String,
  course: String,
  courseName: String,
  collegeType: String,
  enrollmentDate: Date,
  status: { type: String, default: "active" },
  password: { type: String, default: "student123" },
});

const facultySchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  facultyId: { type: String, unique: true },
  department: String,
  collegeType: String,
  enrollmentDate: Date,
  status: { type: String, default: "active" },
  password: { type: String, default: "faculty123" },
});

const staffSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  staffId: { type: String, unique: true },
  department: String,
  collegeType: String,
  enrollmentDate: Date,
  isActive: { type: Boolean, default: true },
  password: String,
});

const adminSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  isActive: { type: Boolean, default: true },
});

const departmentSchema = new mongoose.Schema({
  departmentId: String,
  name: String,
  collegeType: String,
  status: { type: String, default: "active" },
});

const courseSchema = new mongoose.Schema({
  courseId: String,
  name: String,
  department: String,
  collegeType: String,
  description: String,
  duration: Number,
  status: { type: String, default: "active" },
});

// -------------------- MODELS --------------------

const Student = mongoose.model("Student", studentSchema);
const Faculty = mongoose.model("Faculty", facultySchema);
const Staff = mongoose.model("Staff", staffSchema);
const Admin = mongoose.model("Admin", adminSchema);
const Department = mongoose.model("Department", departmentSchema);
const Course = mongoose.model("Course", courseSchema);

// -------------------- STUDENT --------------------

app.post("/api/students", async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.json(student);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

app.get("/api/students", async (req, res) => {
  const data = await Student.find();
  res.json(data);
});

// -------------------- FACULTY --------------------

app.post("/api/faculty", async (req, res) => {
  const data = await Faculty.create(req.body);
  res.json(data);
});

app.get("/api/faculty/active", async (req, res) => {
  res.json(await Faculty.find({ status: "active" }));
});

// -------------------- STAFF --------------------

app.post("/api/staff", async (req, res) => {
  const data = await Staff.create(req.body);
  res.json(data);
});

app.get("/api/staff/active", async (req, res) => {
  res.json(await Staff.find({ isActive: true }));
});

// -------------------- ADMIN --------------------

app.post("/api/admin", async (req, res) => {
  const data = await Admin.create(req.body);
  res.json(data);
});

app.get("/api/admin/active", async (req, res) => {
  res.json(await Admin.find({ isActive: true }));
});

// -------------------- DEPARTMENT --------------------

app.post("/api/departments", async (req, res) => {
  const data = await Department.create(req.body);
  res.json(data);
});

app.get("/api/departments", async (req, res) => {
  res.json(await Department.find());
});

// -------------------- COURSE --------------------

app.post("/api/courses", async (req, res) => {
  const data = await Course.create(req.body);
  res.json(data);
});

app.get("/api/courses", async (req, res) => {
  res.json(await Course.find());
});

// -------------------- LOGIN (PLAIN TEXT) --------------------

app.post("/api/students/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await Student.findOne({ email, password });

  if (!user) return res.status(401).json({ message: "Invalid" });

  res.json({ message: "Login success", user });
});

app.post("/api/faculty/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await Faculty.findOne({ email, password });

  if (!user) return res.status(401).json({ message: "Invalid" });

  res.json({ message: "Login success", user });
});

app.post("/api/staff/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await Staff.findOne({ email, password });

  if (!user) return res.status(401).json({ message: "Invalid" });

  res.json({ message: "Login success", user });
});

app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await Admin.findOne({ email, password });

  if (!user) return res.status(401).json({ message: "Invalid" });

  res.json({ message: "Login success", user });
});

// -------------------- DASHBOARD --------------------

app.get("/api/dashboard/stats", async (req, res) => {
  const totalStudents = await Student.countDocuments();
  const totalCourses = await Course.countDocuments();

  res.json({
    totalStudents,
    totalCourses,
  });
});

// -------------------- SERVER --------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});