/**
 * One-time data migrations, run on server start.
 * Each migration is recorded in the "migrations" collection and never runs twice,
 * so later changes (e.g. a user changing their password) are not overwritten.
 */
const mongoose = require("mongoose");
const { Student, Faculty, Staff, Admin, Hod, Principal } = require("./models");

/** The standard password for each kind of account. */
const ROLE_PASSWORDS = {
  admin: "admin123",
  staff: "staff123",
  principal: "principal123",
  hod: "hod123",
  faculty: "faculty123",
  student: "student123",
};

async function setPasswords(Model, passwordFor) {
  const docs = await Model.find({}, "password accountType");
  for (const doc of docs) {
    doc.password = passwordFor(doc);
    doc.markModified("password"); // force hashing even if the plain-text value was already the same
    await doc.save({ validateBeforeSave: false });
  }
  return docs.length;
}

const MIGRATIONS = [
  {
    id: "2026-11-18-role-based-passwords",
    async run(log) {
      const counts = {
        students: await setPasswords(Student, () => ROLE_PASSWORDS.student),
        faculty: await setPasswords(Faculty, () => ROLE_PASSWORDS.faculty),
        staff: await setPasswords(Staff, () => ROLE_PASSWORDS.staff),
        hods: await setPasswords(Hod, () => ROLE_PASSWORDS.hod),
        principals: await setPasswords(Principal, () => ROLE_PASSWORDS.principal),
        admins: await setPasswords(Admin, (a) => (a.accountType === "Staff" ? ROLE_PASSWORDS.staff : ROLE_PASSWORDS.admin)),
      };
      log(`Passwords reset to role-based defaults: ${JSON.stringify(counts)}`);
    },
  },
];

async function runMigrations(log = console.log) {
  const done = mongoose.connection.db.collection("migrations");
  for (const m of MIGRATIONS) {
    if (await done.findOne({ _id: m.id })) continue;
    await m.run(log);
    await done.insertOne({ _id: m.id, appliedAt: new Date() });
    log(`Migration applied: ${m.id}`);
  }
}

module.exports = { runMigrations, ROLE_PASSWORDS };

// Allow running directly: node migrations.js
if (require.main === module) {
  require("dotenv").config();
  mongoose
    .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/student-management-app")
    .then(() => runMigrations())
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
