const jwt = require("jsonwebtoken");
const { Student, Faculty, Staff, Admin, Hod, Principal } = require("./models");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to Backend/.env before starting the server.");
}

const isActiveStatus = (u) => u.status !== "inactive";
const isActiveFlag = (u) => u.isActive !== false;

/**
 * Every kind of account that can log in.
 * idField = the alternative login ID accepted besides email.
 */
const ACCOUNT_KINDS = {
  student: { model: Student, idField: "studentId", isActive: isActiveStatus },
  faculty: { model: Faculty, idField: "facultyId", isActive: isActiveStatus },
  staff: { model: Staff, idField: "staffId", isActive: isActiveFlag },
  admin: { model: Admin, idField: "username", isActive: isActiveFlag },
  hod: { model: Hod, idField: "hodId", isActive: isActiveStatus },
  principal: { model: Principal, idField: "principalId", isActive: isActiveStatus },
};

/** The permission role of a user. Admin-collection accounts typed "Staff" act as staff. */
function roleFor(kind, user) {
  if (kind === "admin") return user.accountType === "Staff" ? "staff" : "admin";
  return kind;
}

function signToken(kind, user) {
  return jwt.sign({ sub: String(user._id), kind, role: roleFor(kind, user) }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find an account by email (case-insensitive) or by its login ID. */
async function findAccount(kind, identifier) {
  const { model, idField } = ACCOUNT_KINDS[kind];
  const value = String(identifier || "").trim();
  if (!value) return null;
  return model.findOne({
    $or: [{ email: new RegExp(`^${escapeRegex(value)}$`, "i") }, { [idField]: value }],
  });
}

async function loadUserFromToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  const config = ACCOUNT_KINDS[payload.kind];
  if (!config) return null;
  const user = await config.model.findById(payload.sub);
  if (!user || !config.isActive(user)) return null;
  return { user, kind: payload.kind, role: roleFor(payload.kind, user) };
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

/** Requires a valid token. Sets req.user, req.kind and req.role. */
async function authenticate(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ message: "Please log in to continue" });
  try {
    const session = await loadUserFromToken(token);
    if (!session) return res.status(401).json({ message: "Account not found or deactivated" });
    Object.assign(req, session);
    next();
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    return res.status(401).json({ message: expired ? "Session expired, please log in again" : "Invalid session" });
  }
}

/** Like authenticate, but lets the request through without a user. */
async function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      const session = await loadUserFromToken(token);
      if (session) Object.assign(req, session);
    } catch (_) {
      /* ignore bad tokens here */
    }
  }
  next();
}

/** Restrict a route to certain roles. Use after authenticate. */
const allow =
  (...roles) =>
  (req, res, next) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ message: "You do not have permission to do this" });
    }
    next();
  };

module.exports = { ACCOUNT_KINDS, roleFor, signToken, findAccount, authenticate, optionalAuth, allow };
