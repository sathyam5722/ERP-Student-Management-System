/*
 * Shared login/session helper for every dashboard.
 *
 *  - Stores the logged-in user + JWT token (from login.html).
 *  - Automatically adds "Authorization: Bearer <token>" to every fetch() call to the API.
 *  - Sends the user back to login.html when the token is missing, expired or rejected (401).
 *  - ErpAuth.requireRole([...]) keeps each dashboard limited to the right roles.
 */
(function () {
  const SESSION_KEY = "collegeErpLoggedInUser";
  // Opened as a local file -> talk to the local backend. Served by the backend (localhost:3000 or the
  // hosted site) -> use the same address the page came from.
  const API_BASE_URL = location.protocol === "file:" ? "http://localhost:3000" : location.origin;

  const DASHBOARDS = {
    student: "Student dashboard.html",
    faculty: "faculty dashboard.html",
    staff: "dashboard.html",
    admin: "dashboard.html",
    hod: "HOD dashboard.html",
    principal: "principal Dashboard.html",
  };

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function saveSession(data, remember) {
    clearSession();
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(data));
  }

  /** Update the stored user (e.g. after a profile edit) without changing where it is stored. */
  function updateSessionUser(user) {
    const session = getSession();
    if (!session) return;
    const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify({ ...session, ...user, name: user.name || session.name }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function tokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return !payload.exp || payload.exp * 1000 <= Date.now();
    } catch (_) {
      return true;
    }
  }

  /** A session is usable only if it has a token that has not expired. */
  function getValidSession() {
    const session = getSession();
    if (!session || !session.token || tokenExpired(session.token)) return null;
    return session;
  }

  function goToLogin() {
    clearSession();
    if (!/login\.html$/i.test(decodeURIComponent(location.pathname))) location.href = "login.html";
  }

  function logout() {
    goToLogin();
  }

  /** Call at the top of a dashboard. Returns the session, or redirects. */
  function requireRole(roles) {
    const session = getValidSession();
    if (!session) {
      goToLogin();
      return null;
    }
    if (roles && !roles.includes(session.role)) {
      // Logged in, but on the wrong dashboard: send them to their own.
      location.href = DASHBOARDS[session.role] || "login.html";
      return null;
    }
    return session;
  }

  const isApiRequest = (url) => /\/api\//.test(url) && !/\/login$/.test(url.split("?")[0]);

  // Attach the token to every API call and handle expired sessions in one place.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    if (!isApiRequest(url)) return nativeFetch(input, init);

    const session = getSession();
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    if (session && session.token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }
    const response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401) goToLogin();
    return response;
  };

  /** fetch + JSON with a readable error message. */
  async function api(path, options = {}) {
    const init = { ...options };
    if (init.body && typeof init.body !== "string") {
      init.body = JSON.stringify(init.body);
      init.headers = { "Content-Type": "application/json", ...(init.headers || {}) };
    }
    const res = await fetch(`${API_BASE_URL}${path}`, init);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* empty body */
    }
    if (!res.ok) throw new Error((data && (data.message || data.msg)) || `Request failed (${res.status})`);
    return data;
  }

  /** Download a file (e.g. a CSV report) from an authenticated API route. */
  async function download(path, fallbackName) {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) {
      let msg = `Download failed (${res.status})`;
      try { msg = (await res.json()).message || msg; } catch (_) { /* not JSON */ }
      throw new Error(msg);
    }
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = match ? match[1] : fallbackName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const escapeHtml = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const formatDate = (d, opts) => (d ? new Date(d).toLocaleDateString("en-IN", opts || { day: "numeric", month: "short", year: "numeric" }) : "—");
  const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const timeAgo = (d) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const abs = Math.abs(diff);
    const units = [["day", 864e5], ["hour", 36e5], ["minute", 6e4]];
    for (const [name, ms] of units) {
      const n = Math.floor(abs / ms);
      if (n >= 1) return diff >= 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`;
    }
    return "just now";
  };

  /** Printable fee receipt in a new window. */
  async function openReceipt(paymentId) {
    const w = window.open("", "_blank");
    try {
      const p = await api(`/api/payments/${paymentId}/receipt`);
      const methods = { upi: "UPI", card: "Credit / Debit Card", netbanking: "Net Banking", cash: "Cash" };
      w.document.write(`<!doctype html><html><head><title>Receipt ${escapeHtml(p.receiptNo)}</title>
        <style>body{font-family:Arial,sans-serif;max-width:720px;margin:32px auto;color:#1f2937}h1{margin:0;color:#1d4ed8}
        table{width:100%;border-collapse:collapse;margin:18px 0}td,th{border:1px solid #d1d5db;padding:8px;text-align:left}
        .row{display:flex;justify-content:space-between}.muted{color:#6b7280}.total{font-size:18px;font-weight:bold}
        .paid{display:inline-block;padding:4px 12px;border:2px solid #16a34a;color:#16a34a;font-weight:bold;border-radius:6px}
        @media print{button{display:none}}</style></head><body>
        <div class="row"><div><h1>AMC Engineering College</h1><div class="muted">Fee Payment Receipt</div></div><div class="paid">PAID</div></div>
        <hr><div class="row"><div><strong>Receipt No:</strong> ${escapeHtml(p.receiptNo)}<br><strong>Date:</strong> ${formatDate(p.paidAt)}<br><strong>Method:</strong> ${methods[p.method] || escapeHtml(p.method)}</div>
        <div><strong>${escapeHtml(p.student.name)}</strong><br>${escapeHtml(p.student.studentId || "")}<br>${escapeHtml(p.student.department || "")}${p.student.semester ? ` · Sem ${p.student.semester}` : ""}</div></div>
        <table><tr><th>#</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>
        ${(p.fees || []).map((f, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.category)}</td><td style="text-align:right">${rupees(f.amount)}</td></tr>`).join("")}
        <tr><td colspan="3" class="total">Total paid</td><td class="total" style="text-align:right">${rupees(p.amount)}</td></tr></table>
        <p class="muted">This is a computer-generated receipt (test environment: no real money was charged).</p>
        <button onclick="window.print()">Print / Save as PDF</button></body></html>`);
      w.document.close();
    } catch (error) {
      w.close();
      alert(error.message);
    }
  }

  /**
   * Lets the user pick an image, crops it to a 256x256 square, saves it as their profile photo
   * and returns the updated user. Resolves to null if they cancel.
   */
  function changePhoto() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error("Please choose a PNG, JPEG or WebP image"));
        if (file.size > 15 * 1024 * 1024) return reject(new Error("That image is too large (max 15 MB)"));
        const img = new Image();
        img.onload = async () => {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const side = Math.min(img.width, img.height);
          canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          URL.revokeObjectURL(img.src);
          try {
            const { user } = await api("/api/auth/me", { method: "PATCH", body: { photo: canvas.toDataURL("image/jpeg", 0.85) } });
            updateSessionUser(user);
            resolve(user);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error("Could not read that image"));
        img.src = URL.createObjectURL(file);
      };
      input.click();
    });
  }

  async function removePhoto() {
    const { user } = await api("/api/auth/me", { method: "PATCH", body: { photo: "" } });
    updateSessionUser({ ...user, photo: "" });
    return user;
  }

  /** Avatar image URL: the user's photo, or a generated initials avatar. */
  const avatarUrl = (user, size, bg) =>
    (user && user.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent((user && (user.name || user.username)) || "User")}&background=${bg || "6a11cb"}&color=fff&size=${size || 128}`;

  window.ErpAuth = {
    changePhoto,
    removePhoto,
    avatarUrl,
    download,
    escapeHtml,
    formatDate,
    rupees,
    timeAgo,
    openReceipt,
    API_BASE_URL,
    DASHBOARDS,
    getSession,
    getValidSession,
    saveSession,
    updateSessionUser,
    clearSession,
    requireRole,
    logout,
    api,
  };
})();
