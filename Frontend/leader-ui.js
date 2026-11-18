/*
 * Shared UI kit for the HOD and Principal dashboards (Tailwind based).
 * Layout shell, cards, pills, simple charts, modal forms and toasts.
 */
(function () {
  const esc = ErpAuth.escapeHtml;
  const fmt = (d) => ErpAuth.formatDate(d);

  const GRADIENTS = [
    "from-violet-500 to-purple-600", "from-sky-500 to-blue-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600", "from-indigo-500 to-violet-600", "from-cyan-500 to-blue-600", "from-fuchsia-500 to-pink-600",
  ];
  const initials = (name) => String(name || "?").replace(/^(Dr|Prof|Mr|Mrs|Ms)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

  function avatar(name, size) {
    const ini = initials(name);
    const grad = GRADIENTS[ini.charCodeAt(0) % GRADIENTS.length];
    const sz = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-sm";
    return `<div class="${sz} bg-gradient-to-br ${grad} rounded-2xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0">${esc(ini)}</div>`;
  }

  function pill(status, label) {
    const map = {
      active: "bg-emerald-50 text-emerald-700|bg-emerald-500", approved: "bg-emerald-50 text-emerald-700|bg-emerald-500", completed: "bg-sky-50 text-sky-700|bg-sky-500",
      pending: "bg-amber-50 text-amber-700|bg-amber-500", proposed: "bg-amber-50 text-amber-700|bg-amber-500", on_leave: "bg-amber-50 text-amber-700|bg-amber-500",
      inactive: "bg-slate-100 text-slate-600|bg-slate-400", rejected: "bg-red-50 text-red-700|bg-red-500", at_risk: "bg-red-50 text-red-700|bg-red-500",
      high: "bg-red-50 text-red-700|bg-red-500", medium: "bg-amber-50 text-amber-700|bg-amber-500", low: "bg-slate-100 text-slate-600|bg-slate-400",
    };
    const [c, dot] = (map[status] || "bg-slate-100 text-slate-600|bg-slate-400").split("|");
    const text = label || String(status || "").replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c}"><span class="h-1.5 w-1.5 rounded-full ${dot}"></span>${esc(text)}</span>`;
  }

  function progress(val) {
    if (val === null || val === undefined) return '<span class="text-xs text-slate-400">No data</span>';
    const p = Math.round(val);
    const color = p >= 90 ? "from-emerald-500 to-green-500" : p >= 75 ? "from-sky-500 to-blue-500" : p >= 60 ? "from-amber-500 to-orange-500" : "from-red-500 to-rose-500";
    return `<div class="flex items-center gap-2"><div class="w-20 h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r ${color} rounded-full" style="width:${Math.min(100, p)}%"></div></div><span class="text-xs font-semibold text-slate-600 min-w-[2.5rem]">${p}%</span></div>`;
  }

  const ICONS = {
    users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    megaphone: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
    cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    building: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    userAdd: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
    bulb: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    money: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    plane: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
    exam: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
    plus: "M12 4v16m8-8H4",
    edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  };
  const icon = (name, cls) => `<svg class="${cls || "h-5 w-5"}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${ICONS[name] || name}"/></svg>`;

  function statCard({ label, value, sub, iconName, gradient, go }) {
    return `<div class="stat-card card-hover bg-white rounded-2xl p-5 border border-slate-100 shadow-sm ${go ? "cursor-pointer" : ""}" ${go ? `onclick="go('${go}')"` : ""}>
      <div class="flex items-start justify-between mb-4">
        <div class="stat-icon h-12 w-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg">${icon(iconName, "h-6 w-6")}</div>
        ${sub ? `<span class="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg">${esc(sub)}</span>` : ""}
      </div>
      <p class="text-2xl font-bold text-slate-900 tracking-tight">${esc(value)}</p>
      <p class="mt-1 text-sm text-slate-500 font-medium">${esc(label)}</p>
    </div>`;
  }

  const panel = (title, body, action) => `<div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100"><h3 class="text-base font-bold text-slate-800">${title}</h3>${action || ""}</div>
      <div>${body}</div></div>`;
  const link = (label, page) => `<button onclick="go('${page}')" class="text-xs font-bold text-violet-600 hover:text-violet-700">${label} →</button>`;
  const button = (label, onclick, kind) => {
    const k = { primary: "brand-grad text-white shadow-md hover:shadow-lg", ok: "bg-emerald-500 text-white hover:bg-emerald-600", no: "bg-red-500 text-white hover:bg-red-600", soft: "bg-slate-100 text-slate-700 hover:bg-slate-200" }[kind || "primary"];
    return `<button onclick="${onclick}" class="px-4 py-2 text-sm font-bold rounded-xl transition ${k}">${label}</button>`;
  };
  const iconButton = (name, onclick, title, color) => `<button onclick="${onclick}" title="${title || ""}" class="p-2 rounded-xl ${color || "text-sky-500 hover:bg-sky-50"}">${icon(name, "h-4 w-4")}</button>`;
  const empty = (text) => `<p class="px-6 py-8 text-center text-sm text-slate-400">${esc(text)}</p>`;

  /** Vertical bar chart. items: [{label, value}] */
  function bars(items, suffix, max) {
    if (!items.length) return empty("No data yet");
    const top = max || Math.max(1, ...items.map((i) => i.value || 0));
    return `<div class="flex items-end gap-3 h-56 px-6 pb-4 pt-6">${items.map((d) => `<div class="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
        <div class="text-xs font-bold text-slate-700">${d.value ?? 0}${suffix || ""}</div>
        <div class="w-full rounded-t-xl bg-gradient-to-t from-violet-500 to-purple-400 shadow-md" style="height:${Math.max(2, ((d.value || 0) / top) * 100)}%"></div>
        <span class="text-[11px] font-medium text-slate-500 text-center leading-tight">${esc(d.label)}</span></div>`).join("")}</div>`;
  }

  /** Horizontal bars. items: [{label, sub, value}] */
  function hbars(items, suffix) {
    if (!items.length) return empty("No data yet");
    const top = Math.max(1, ...items.map((i) => i.value || 0));
    return `<div class="p-6 space-y-3">${items.map((i) => `<div class="flex items-center gap-4">
        <div class="w-40 flex-shrink-0"><p class="text-sm font-bold text-slate-700 truncate">${esc(i.label)}</p>${i.sub ? `<p class="text-xs text-slate-400 truncate">${esc(i.sub)}</p>` : ""}</div>
        <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full" style="width:${((i.value || 0) / top) * 100}%"></div></div>
        <span class="text-sm font-bold text-slate-700 min-w-[3.5rem] text-right">${i.value ?? 0}${suffix || ""}</span></div>`).join("")}</div>`;
  }

  // ---------------- modal forms ----------------
  let saveHandler = null;

  function openModal(html) {
    closeModal();
    const div = document.createElement("div");
    div.className = "leader-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4";
    div.addEventListener("click", (e) => { if (e.target === div) closeModal(); });
    div.innerHTML = `<div class="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto pop">${html}</div>`;
    document.body.appendChild(div);
    const first = div.querySelector("input, select, textarea");
    if (first) first.focus();
  }
  function closeModal() { document.querySelectorAll(".leader-modal").forEach((m) => m.remove()); }

  const inputCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition";
  function field(f, value) {
    const v = value === undefined || value === null ? (f.default ?? "") : value;
    const id = `lf_${f.name}`;
    let input;
    if (f.type === "select") input = `<select id="${id}" class="${inputCls}">${f.options.map((o) => `<option value="${esc(o.value)}" ${String(v) === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
    else if (f.type === "textarea") input = `<textarea id="${id}" rows="${f.rows || 3}" class="${inputCls}">${esc(v)}</textarea>`;
    else input = `<input id="${id}" type="${f.type || "text"}" value="${esc(f.type === "date" ? String(v).slice(0, 10) : v)}" class="${inputCls}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}>`;
    return `<div class="space-y-1.5 ${f.half ? "" : "col-span-2"}"><label class="block text-xs font-semibold text-slate-700" for="${id}">${esc(f.label)}${f.required ? " *" : ""}</label>${input}${f.hint ? `<p class="text-[11px] text-slate-400">${esc(f.hint)}</p>` : ""}</div>`;
  }

  /** showForm({ title, fields, values, onSave(values) => Promise }) */
  function showForm({ title, fields, values, onSave, saveLabel }) {
    saveHandler = async () => {
      const out = {};
      for (const f of fields) {
        let v = document.getElementById(`lf_${f.name}`).value.trim();
        if (f.required && !v) { toast(`${f.label} is required`, "error"); return; }
        if (f.type === "number") v = v === "" ? null : Number(v);
        if (f.type === "date" && v === "") v = null;
        out[f.name] = v;
      }
      const btn = document.getElementById("leaderSave");
      btn.disabled = true;
      try {
        await onSave(out);
        closeModal();
      } catch (error) {
        toast(error.message, "error");
        btn.disabled = false;
      }
    };
    openModal(`
      <div class="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <div class="h-11 w-11 rounded-2xl brand-grad flex items-center justify-center text-white shadow-md">${icon("plus")}</div>
        <h2 class="text-lg font-bold text-slate-800">${esc(title)}</h2>
      </div>
      <div class="grid grid-cols-2 gap-4">${fields.map((f) => field(f, values ? values[f.name] : undefined)).join("")}</div>
      <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
        <button onclick="LeaderUI.closeModal()" class="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
        <button id="leaderSave" onclick="LeaderUI.save()" class="px-5 py-2.5 text-sm font-semibold text-white brand-grad rounded-xl shadow-md">${esc(saveLabel || "Save")}</button>
      </div>`);
  }

  function toast(msg, type) {
    const colors = { success: "bg-emerald-500", error: "bg-red-500", info: "bg-sky-500" };
    const t = document.createElement("div");
    t.className = `fixed bottom-6 right-6 z-[100] px-5 py-3 ${colors[type || "success"]} text-white text-sm font-medium rounded-xl shadow-2xl pop max-w-md`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /** Settings page used by both dashboards: profile + password. */
  function settingsPage(user, extraNote) {
    return `<div class="space-y-6 max-w-3xl fade">
      <div><h3 class="text-2xl font-extrabold text-slate-800">Settings</h3><p class="text-sm text-slate-500 mt-1">Manage your profile and password</p></div>
      <div class="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div class="flex items-center gap-4 mb-6">${avatar(user.name, "lg")}<div><p class="font-bold text-slate-800">${esc(user.name)}</p><p class="text-xs text-slate-500">${esc(extraNote || "")}</p></div></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label class="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label><input id="setName" value="${esc(user.name)}" class="${inputCls}"></div>
          <div><label class="block text-xs font-bold text-slate-700 mb-1.5">Email</label><input id="setEmail" type="email" value="${esc(user.email)}" class="${inputCls}"></div>
          <div><label class="block text-xs font-bold text-slate-700 mb-1.5">Phone</label><input id="setPhone" value="${esc(user.phone || "")}" class="${inputCls}"></div>
          <div><label class="block text-xs font-bold text-slate-700 mb-1.5">Department</label><input value="${esc(user.department || "College-wide")}" disabled class="${inputCls} bg-slate-50 text-slate-500"></div>
        </div>
        <div class="mt-5">${button("Save Profile", "LeaderUI.saveProfile()")}</div>
      </div>
      <div class="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <h3 class="text-base font-bold text-slate-800 mb-4">Change Password</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input id="pwCurrent" type="password" placeholder="Current password" class="${inputCls}" autocomplete="current-password">
          <input id="pwNew" type="password" placeholder="New password (6+ chars)" class="${inputCls}" autocomplete="new-password">
          <input id="pwConfirm" type="password" placeholder="Confirm new password" class="${inputCls}" autocomplete="new-password">
        </div>
        <div class="mt-5">${button("Change Password", "LeaderUI.changePassword()")}</div>
      </div>
    </div>`;
  }

  async function saveProfile() {
    try {
      const { user } = await ErpAuth.api("/api/auth/me", { method: "PATCH", body: { name: document.getElementById("setName").value.trim(), email: document.getElementById("setEmail").value.trim(), phone: document.getElementById("setPhone").value.trim() } });
      ErpAuth.updateSessionUser(user);
      toast("Profile saved");
      if (window.onProfileSaved) window.onProfileSaved(user);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function changePassword() {
    const n = document.getElementById("pwNew").value;
    if (n !== document.getElementById("pwConfirm").value) return toast("New passwords do not match", "error");
    try {
      await ErpAuth.api("/api/auth/change-password", { method: "POST", body: { currentPassword: document.getElementById("pwCurrent").value, newPassword: n } });
      ["pwCurrent", "pwNew", "pwConfirm"].forEach((id) => { document.getElementById(id).value = ""; });
      toast("Password changed");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  /**
   * Renders the sidebar + header layout. Pages render into #mainContent.
   * opts: { brand, subtitle, infoTitle, infoValue, infoMeta, nav:[{id,label,icon,badge}], page, user, roleLabel, notifications, sidebarOpen }
   */
  function shell(o) {
    const unread = o.notifications.length;
    document.getElementById("app").innerHTML = `
      ${o.sidebarOpen ? '<div class="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onclick="toggleSidebar()"></div>' : ""}
      <aside class="fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 flex flex-col slide ${o.sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}">
        <div class="px-6 py-6 border-b border-slate-100"><div class="flex items-center gap-3">
          <div class="h-11 w-11 rounded-2xl brand-grad flex items-center justify-center shadow-lg ring-glow text-white">${icon("book", "h-6 w-6")}</div>
          <div><h1 class="text-lg font-extrabold gradient-text tracking-tight leading-none">${esc(o.brand)}</h1><p class="text-[11px] text-slate-400 font-medium mt-0.5">${esc(o.subtitle)}</p></div>
        </div></div>
        <div class="mx-4 my-4 p-4 brand-grad-soft rounded-2xl border border-violet-100">
          <p class="text-[10px] font-bold uppercase tracking-wider text-violet-500">${esc(o.infoTitle)}</p>
          <p class="text-sm font-bold text-slate-800 mt-1">${esc(o.infoValue)}</p>
          <div class="flex items-center gap-2 mt-2"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot"></span><p class="text-[11px] text-slate-500">${esc(o.infoMeta)}</p></div>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          ${o.nav.map((p) => `<button onclick="go('${p.id}')" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${o.page === p.id ? "active bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}">
              ${icon(p.icon, "h-5 w-5 flex-shrink-0")}<span class="flex-1 text-left">${esc(p.label)}</span>
              ${p.badge ? `<span class="h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">${p.badge}</span>` : ""}</button>`).join("")}
          <div class="border-t border-slate-100 my-3"></div>
          <button onclick="logout()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition">${icon("logout")} Logout</button>
        </nav>
        <div class="p-3 border-t border-slate-100"><div class="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-slate-50 to-violet-50/40 border border-slate-100 cursor-pointer" onclick="go('settings')">
          ${avatar(o.user.name, "sm")}<div class="flex-1 min-w-0"><p class="text-sm font-bold text-slate-800 truncate">${esc(o.user.name)}</p><p class="text-[11px] text-slate-400 truncate">${esc(o.roleLabel)}</p></div>
          <div class="h-2 w-2 rounded-full bg-emerald-500"></div></div></div>
      </aside>
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header class="glass border-b border-slate-100 px-4 lg:px-7 py-3.5 flex items-center gap-4 flex-shrink-0 z-10">
          <button onclick="toggleSidebar()" class="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100">${icon("M4 6h16M4 12h16M4 18h16")}</button>
          <div class="hidden sm:block"><h2 class="text-base font-bold text-slate-800">${esc(o.title)}</h2><p class="text-xs text-slate-400">${esc(o.subtitleText || "")}</p></div>
          <div class="flex-1 max-w-md relative">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" placeholder="Search this page..." oninput="LeaderUI.search(this.value)" class="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition">
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <div class="relative">
              <button onclick="LeaderUI.toggleNotifications()" class="relative p-2.5 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition">${icon("bell")}
                ${unread ? `<span class="absolute top-1 right-1 h-4 min-w-4 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">${unread}</span>` : ""}</button>
              <div id="notifPanel" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-96 overflow-y-auto">
                <div class="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">Notifications</div>
                ${unread ? o.notifications.map((n) => `<button onclick="LeaderUI.toggleNotifications(); go('${o.notificationPage(n)}')" class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50">
                    <p class="text-sm text-slate-700">${esc(n.message)}</p><p class="text-[11px] text-slate-400 mt-1">${ErpAuth.timeAgo(n.at)}</p></button>`).join("") : '<p class="px-4 py-6 text-sm text-slate-400 text-center">You are all caught up</p>'}
              </div>
            </div>
            <div class="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-slate-200 cursor-pointer" onclick="go('settings')">
              ${avatar(o.user.name, "sm")}<div><p class="text-xs font-bold text-slate-800">${esc(o.user.name)}</p><p class="text-[10px] text-slate-400">${esc(o.roleLabel)}</p></div>
            </div>
          </div>
        </header>
        <main class="flex-1 overflow-y-auto p-4 lg:p-7 bg-slate-50/50" id="mainContent"></main>
      </div>`;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    document.querySelectorAll("#mainContent [data-row]").forEach((r) => { r.style.display = !q || r.textContent.toLowerCase().includes(q) ? "" : "none"; });
  }

  function toggleNotifications() {
    const p = document.getElementById("notifPanel");
    if (p) p.classList.toggle("hidden");
  }

  async function download(type, label) {
    try {
      await ErpAuth.download(`/api/reports/${type}`, `${type}.csv`);
      toast(`${label || type} report downloaded`);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  window.LeaderUI = {
    esc, fmt, avatar, pill, progress, icon, statCard, panel, link, button, iconButton, empty, bars, hbars,
    openModal, closeModal, showForm, toast, settingsPage, saveProfile, changePassword, shell, search, toggleNotifications, download,
    save: () => saveHandler && saveHandler(),
  };
})();
