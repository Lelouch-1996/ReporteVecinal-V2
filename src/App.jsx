import "./App.css";
import { useEffect, useMemo, useState } from "react";

const REPORTS_KEY = "rv_reports_v3";
const USER_KEY = "rv_user_v3";
const CATALOGS_KEY = "rv_catalogs_v3";
const NOTIFICATIONS_KEY = "rv_notifications_v3";
const AUDIT_KEY = "rv_audit_v3";

const DEFAULT_CATALOGS = {
  types: ["Bache", "Luminaria", "Basura", "Fuga de agua", "Banqueta"],
  zones: ["Centro", "Norte", "Sur", "Oriente", "Poniente"],
};

const STATUS_OPTIONS = ["Pendiente", "En proceso", "Resuelto"];

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadReports() {
  return safeRead(REPORTS_KEY, []);
}

function saveReports(reports) {
  saveJson(REPORTS_KEY, reports);
}

function loadUser() {
  return safeRead(USER_KEY, null);
}

function saveUser(user) {
  saveJson(USER_KEY, user);
}

function clearUser() {
  localStorage.removeItem(USER_KEY);
}

function loadCatalogs() {
  const stored = safeRead(CATALOGS_KEY, null);
  if (!stored) return DEFAULT_CATALOGS;
  return {
    types: Array.isArray(stored.types) && stored.types.length ? stored.types : DEFAULT_CATALOGS.types,
    zones: Array.isArray(stored.zones) && stored.zones.length ? stored.zones : DEFAULT_CATALOGS.zones,
  };
}

function saveCatalogs(catalogs) {
  saveJson(CATALOGS_KEY, catalogs);
}

function loadNotifications() {
  return safeRead(NOTIFICATIONS_KEY, []);
}

function saveNotifications(list) {
  saveJson(NOTIFICATIONS_KEY, list);
}

function loadAuditTrail() {
  return safeRead(AUDIT_KEY, []);
}

function saveAuditTrail(list) {
  saveJson(AUDIT_KEY, list);
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function createModerationRecord(by, hidden, reason) {
  return {
    id: crypto.randomUUID(),
    by,
    hidden,
    reason: reason || (hidden ? "Contenido ocultado por moderación." : "Contenido restaurado."),
    date: new Date().toISOString(),
  };
}

function ensureReportShape(report) {
  return {
    ...report,
    hidden: report.hidden ?? false,
    hiddenReason: report.hiddenReason || "",
    moderationHistory: report.moderationHistory || [],
    statusHistory: report.statusHistory || [],
    comments: (report.comments || []).map((comment) => ({
      ...comment,
      hidden: comment.hidden ?? false,
      moderationHistory: comment.moderationHistory || [],
    })),
  };
}

function loadNormalizedReports() {
  return loadReports().map(ensureReportShape);
}

function makeSeedReports() {
  const now = Date.now();
  return [
    {
      id: crypto.randomUUID(),
      type: "Bache",
      description: "Bache grande frente a la tienda de la esquina.",
      location: "Av. Juárez 120",
      zone: "Centro",
      status: "Pendiente",
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      createdBy: "vecino1@demo.com",
      hidden: false,
      hiddenReason: "",
      moderationHistory: [],
      statusHistory: [
        {
          id: crypto.randomUUID(),
          status: "Pendiente",
          date: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
          by: "vecino1@demo.com",
          note: "Reporte creado",
        },
      ],
      comments: [
        {
          id: crypto.randomUUID(),
          text: "El bache ya tiene varios días.",
          by: "vecino1@demo.com",
          date: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
          hidden: false,
          moderationHistory: [],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "Luminaria",
      description: "La lámpara no enciende por las noches.",
      location: "Calle Morelos 88",
      zone: "Norte",
      status: "En proceso",
      createdAt: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
      createdBy: "vecino2@demo.com",
      hidden: false,
      hiddenReason: "",
      moderationHistory: [],
      statusHistory: [
        {
          id: crypto.randomUUID(),
          status: "Pendiente",
          date: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
          by: "vecino2@demo.com",
          note: "Reporte creado",
        },
        {
          id: crypto.randomUUID(),
          status: "En proceso",
          date: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
          by: "admin@admin.com",
          note: "Asignado a mantenimiento",
        },
      ],
      comments: [],
    },
  ];
}

function seedIfEmpty() {
  if (!localStorage.getItem(CATALOGS_KEY)) {
    saveCatalogs(DEFAULT_CATALOGS);
  }

  if (!localStorage.getItem(REPORTS_KEY)) {
    saveReports(makeSeedReports());
  }

  if (!localStorage.getItem(NOTIFICATIONS_KEY)) {
    saveNotifications([
      {
        id: crypto.randomUUID(),
        userEmail: "vecino2@demo.com",
        title: "Cambio de estado",
        message: "Tu reporte de luminaria está en proceso.",
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  if (!localStorage.getItem(AUDIT_KEY)) {
    saveAuditTrail([
      {
        id: crypto.randomUUID(),
        action: "seed.init",
        actor: "sistema",
        details: "Se inicializaron datos demo del portal.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

function buildNotification(userEmail, title, message) {
  return {
    id: crypto.randomUUID(),
    userEmail,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

function buildAuditEntry(action, actor, details) {
  return {
    id: crypto.randomUUID(),
    action,
    actor,
    details,
    createdAt: new Date().toISOString(),
  };
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export function findDuplicates(reports, candidate) {
  const type = normalizeText(candidate.type);
  const location = normalizeText(candidate.location);
  const zone = normalizeText(candidate.zone);
  const description = normalizeText(candidate.description);

  return reports.filter((report) => {
    const sameType = normalizeText(report.type) === type;
    const sameZone = normalizeText(report.zone) === zone;
    const sameLocation = normalizeText(report.location) === location;
    const similarDescription =
      description.length >= 8 &&
      (normalizeText(report.description).includes(description.slice(0, 12)) ||
        description.includes(normalizeText(report.description).slice(0, 12)));

    return sameType && ((sameZone && sameLocation) || (sameZone && similarDescription));
  });
}

function escapeCsvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export function buildCsvRows(reports) {
  const headers = [
    "ID",
    "Tipo",
    "Zona",
    "Ubicación",
    "Estatus",
    "Oculto",
    "Motivo de moderación",
    "Creado por",
    "Fecha",
    "Comentarios visibles",
  ];

  const rows = reports.map((report) => [
    report.id,
    report.type,
    report.zone,
    report.location,
    report.status,
    report.hidden ? "Sí" : "No",
    report.hiddenReason || "",
    report.createdBy,
    formatDate(report.createdAt),
    (report.comments || []).filter((comment) => !comment.hidden).length,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function filterCollection(reports, filters, includeHidden = false) {
  return reports.filter((report) => {
    const statusOk = filters.status === "Todos" || report.status === filters.status;
    const zoneOk = filters.zone === "Todas" || report.zone === filters.zone;
    const typeOk = filters.type === "Todos" || report.type === filters.type;
    const searchOk =
      !filters.search ||
      [report.type, report.description, report.location, report.zone, report.createdBy]
        .join(" ")
        .toLowerCase()
        .includes(filters.search.toLowerCase());
    const hiddenOk = includeHidden || !report.hidden;
    return statusOk && zoneOk && typeOk && searchOk && hiddenOk;
  });
}

export default function App() {
  const [user, setUser] = useState(() => loadUser());
  const [page, setPage] = useState("list");
  const [reports, setReports] = useState(() => loadNormalizedReports());
  const [catalogs, setCatalogs] = useState(() => loadCatalogs());
  const [notifications, setNotifications] = useState(() => loadNotifications());
  const [auditTrail, setAuditTrail] = useState(() => loadAuditTrail());
  const [statusMessage, setStatusMessage] = useState("Portal cargado correctamente.");
  const [filters, setFilters] = useState({
    status: "Todos",
    zone: "Todas",
    type: "Todos",
    search: "",
    showHidden: false,
  });
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    seedIfEmpty();
    setReports(loadNormalizedReports());
    setCatalogs(loadCatalogs());
    setNotifications(loadNotifications());
    setAuditTrail(loadAuditTrail());
  }, []);

  const isAdmin = user?.role === "admin";
  const publicReports = useMemo(() => reports.filter((report) => !report.hidden), [reports]);

  const visibleReports = useMemo(() => {
    return filterCollection(reports, filters, isAdmin && filters.showHidden);
  }, [reports, filters, isAdmin]);

  const stats = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = publicReports.filter((report) => report.status === status).length;
      return acc;
    }, {});
  }, [publicReports]);

  const zoneStats = useMemo(() => {
    return catalogs.zones.map((zone) => ({
      zone,
      total: publicReports.filter((report) => report.zone === zone).length,
      pending: publicReports.filter((report) => report.zone === zone && report.status === "Pendiente").length,
    }));
  }, [catalogs.zones, publicReports]);

  const userNotifications = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return notifications;
    return notifications.filter((item) => item.userEmail === user.email);
  }, [notifications, user, isAdmin]);

  const unreadNotifications = userNotifications.filter((item) => !item.read).length;

  const selectedReport = useMemo(
    () => visibleReports.find((report) => report.id === selectedId) || null,
    [visibleReports, selectedId]
  );

  const hiddenReportsCount = reports.filter((report) => report.hidden).length;

  function syncReports(next) {
    const normalized = next.map(ensureReportShape);
    setReports(normalized);
    saveReports(normalized);
  }

  function syncCatalogs(next) {
    setCatalogs(next);
    saveCatalogs(next);
  }

  function syncNotifications(next) {
    setNotifications(next);
    saveNotifications(next);
  }

  function appendAudit(action, actor, details) {
    const entry = buildAuditEntry(action, actor, details);
    setAuditTrail((previous) => {
      const next = [entry, ...previous].slice(0, 300);
      saveAuditTrail(next);
      return next;
    });
  }

  function announce(message) {
    setStatusMessage(message);
  }

  function onLogin(email, password) {
    if (email === "admin@admin.com" && password === "admin123") {
      const nextUser = { email, role: "admin" };
      setUser(nextUser);
      saveUser(nextUser);
      setPage("admin");
      appendAudit("auth.login", email, "Inicio de sesión como administrador.");
      announce("Sesión iniciada como administrador.");
      return;
    }

    if (email.includes("@") && password.length >= 4) {
      const nextUser = { email, role: "user" };
      setUser(nextUser);
      saveUser(nextUser);
      setPage("list");
      appendAudit("auth.login", email, "Inicio de sesión como ciudadano.");
      announce("Sesión iniciada correctamente.");
      return;
    }

    announce("Credenciales inválidas.");
    alert("Credenciales inválidas. Usa un correo válido y contraseña de 4 o más caracteres.");
  }

  function logout() {
    const actor = user?.email || "usuario";
    setUser(null);
    clearUser();
    setPage("login");
    appendAudit("auth.logout", actor, "Cierre de sesión.");
    announce("Sesión cerrada.");
  }

  function createReport({ type, description, location, zone }) {
    if (!user) {
      announce("Debes iniciar sesión antes de registrar un reporte.");
      alert("Debes iniciar sesión.");
      return;
    }

    const duplicateMatches = findDuplicates(reports, { type, description, location, zone });
    if (duplicateMatches.length > 0) {
      const proceed = window.confirm(
        `Se detectaron ${duplicateMatches.length} reportes similares en ${zone}. ¿Deseas crear el reporte de todas formas?`
      );
      if (!proceed) {
        appendAudit("report.duplicate_cancel", user.email, `Se canceló un reporte duplicado de ${type} en ${zone}.`);
        announce("Se canceló el alta del reporte por posible duplicado.");
        return;
      }
    }

    const newReport = {
      id: crypto.randomUUID(),
      type,
      description,
      location,
      zone,
      status: "Pendiente",
      createdAt: new Date().toISOString(),
      createdBy: user.email,
      hidden: false,
      hiddenReason: "",
      moderationHistory: [],
      statusHistory: [
        {
          id: crypto.randomUUID(),
          status: "Pendiente",
          date: new Date().toISOString(),
          by: user.email,
          note: "Reporte creado",
        },
      ],
      comments: [],
    };

    const nextReports = [newReport, ...reports];
    syncReports(nextReports);
    syncNotifications([
      buildNotification(user.email, "Reporte registrado", `Tu reporte de ${type} fue creado correctamente.`),
      ...notifications,
    ]);
    setSelectedId(newReport.id);
    setPage("list");
    appendAudit("report.create", user.email, `Nuevo reporte ${type} en ${zone}.`);
    announce("Reporte registrado correctamente.");
  }

  function updateStatus(id, status, note = "") {
    if (!user) return;

    let updatedOwner = null;
    let reportType = "reporte";
    const nextReports = reports.map((report) => {
      if (report.id !== id) return report;
      updatedOwner = report.createdBy;
      reportType = report.type;
      return {
        ...report,
        status,
        statusHistory: [
          {
            id: crypto.randomUUID(),
            status,
            date: new Date().toISOString(),
            by: user.email,
            note: note || `Estado actualizado a ${status}`,
          },
          ...(report.statusHistory || []),
        ],
      };
    });

    syncReports(nextReports);

    if (updatedOwner) {
      syncNotifications([
        buildNotification(updatedOwner, "Cambio de estado", `Tu reporte cambió a ${status}.`),
        ...notifications,
      ]);
    }

    appendAudit("report.status", user.email, `Se cambió a ${status} un reporte de ${reportType}.`);
    announce(`Estado actualizado a ${status}.`);
  }

  function addComment(reportId, text) {
    if (!user || !text.trim()) return;

    let owner = null;
    let reportType = "reporte";
    const nextReports = reports.map((report) => {
      if (report.id !== reportId) return report;
      owner = report.createdBy;
      reportType = report.type;
      return {
        ...report,
        comments: [
          {
            id: crypto.randomUUID(),
            text: text.trim(),
            by: user.email,
            date: new Date().toISOString(),
            hidden: false,
            moderationHistory: [],
          },
          ...(report.comments || []),
        ],
      };
    });

    syncReports(nextReports);

    if (owner && owner !== user.email) {
      syncNotifications([
        buildNotification(owner, "Nuevo comentario", `Hay un nuevo comentario en tu reporte de ${reportType}.`),
        ...notifications,
      ]);
    }

    appendAudit("report.comment", user.email, `Se agregó comentario a un reporte de ${reportType}.`);
    announce("Comentario agregado correctamente.");
  }

  function moderateReport(reportId, hidden, reason) {
    if (!user || !isAdmin) return;

    const cleanReason = reason?.trim() || (hidden ? "Contenido ocultado por moderación." : "Contenido restaurado.");
    let reportType = "reporte";

    const nextReports = reports.map((report) => {
      if (report.id !== reportId) return report;
      reportType = report.type;
      return {
        ...report,
        hidden,
        hiddenReason: hidden ? cleanReason : "",
        moderationHistory: [
          createModerationRecord(user.email, hidden, cleanReason),
          ...(report.moderationHistory || []),
        ],
      };
    });

    syncReports(nextReports);
    appendAudit(
      hidden ? "moderation.hide_report" : "moderation.restore_report",
      user.email,
      `${hidden ? "Se ocultó" : "Se restauró"} un reporte de ${reportType}. Motivo: ${cleanReason}`
    );
    announce(hidden ? "Reporte ocultado por moderación." : "Reporte restaurado.");
  }

  function moderateComment(reportId, commentId, hidden, reason) {
    if (!user || !isAdmin) return;

    const cleanReason = reason?.trim() || (hidden ? "Comentario ocultado por moderación." : "Comentario restaurado.");
    let reportType = "reporte";

    const nextReports = reports.map((report) => {
      if (report.id !== reportId) return report;
      reportType = report.type;
      return {
        ...report,
        comments: (report.comments || []).map((comment) => {
          if (comment.id !== commentId) return comment;
          return {
            ...comment,
            hidden,
            moderationHistory: [
              createModerationRecord(user.email, hidden, cleanReason),
              ...(comment.moderationHistory || []),
            ],
          };
        }),
      };
    });

    syncReports(nextReports);
    appendAudit(
      hidden ? "moderation.hide_comment" : "moderation.restore_comment",
      user.email,
      `${hidden ? "Se ocultó" : "Se restauró"} un comentario de un reporte de ${reportType}. Motivo: ${cleanReason}`
    );
    announce(hidden ? "Comentario ocultado." : "Comentario restaurado.");
  }

  function addCatalogItem(kind, value) {
    if (!user || !isAdmin) return;

    const clean = value.trim();
    if (!clean) return;
    if (catalogs[kind].includes(clean)) {
      alert("Ese valor ya existe en el catálogo.");
      announce("Ese valor ya existe en el catálogo.");
      return;
    }

    syncCatalogs({
      ...catalogs,
      [kind]: [...catalogs[kind], clean],
    });
    appendAudit("catalog.add", user.email, `Se agregó ${clean} al catálogo ${kind}.`);
    announce(`Se agregó ${clean} al catálogo.`);
  }

  function removeCatalogItem(kind, value) {
    if (!user || !isAdmin) return;

    const inUse =
      kind === "types"
        ? reports.some((report) => report.type === value)
        : reports.some((report) => report.zone === value);

    if (inUse) {
      alert("No puedes eliminar este elemento porque ya está en uso en reportes registrados.");
      announce("No se puede eliminar el elemento porque ya está en uso.");
      return;
    }

    syncCatalogs({
      ...catalogs,
      [kind]: catalogs[kind].filter((item) => item !== value),
    });
    appendAudit("catalog.remove", user.email, `Se eliminó ${value} del catálogo ${kind}.`);
    announce(`Se eliminó ${value} del catálogo.`);
  }

  function markAllNotificationsAsRead() {
    if (!user) return;

    const nextNotifications = notifications.map((item) => {
      const matchesUser = isAdmin || item.userEmail === user.email;
      return matchesUser ? { ...item, read: true } : item;
    });

    syncNotifications(nextNotifications);
    appendAudit("notification.mark_read", user.email, "Se marcaron notificaciones como leídas.");
    announce("Notificaciones marcadas como leídas.");
  }

  function exportReportsCsv(exportFilters) {
    if (!user || !isAdmin) return;

    const filteredReports = filterCollection(reports, exportFilters, exportFilters.showHidden);
    const csv = buildCsvRows(filteredReports);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_vecinal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    appendAudit(
      "export.csv",
      user.email,
      `Se exportaron ${filteredReports.length} reportes con filtros ${JSON.stringify(exportFilters)}.`
    );
    announce(`CSV exportado con ${filteredReports.length} reportes.`);
  }

  const summaryCards = [
    { label: "Pendientes", value: stats.Pendiente || 0 },
    { label: "En proceso", value: stats["En proceso"] || 0 },
    { label: "Resueltos", value: stats.Resuelto || 0 },
    { label: "Total público", value: publicReports.length, accent: true },
  ];

  if (isAdmin) {
    summaryCards.push({ label: "Ocultos", value: hiddenReportsCount, warning: true });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>

      <header className="topbar">
        <div>
          <p className="eyebrow">Portal ciudadano</p>
          <h1>ReporteVecinal GDL</h1>
        </div>

        <div className="topbar-actions">
          <nav className="nav-tabs" aria-label="Navegación principal">
            <button className={page === "list" ? "active" : ""} onClick={() => setPage("list")}>Explorar</button>
            <button className={page === "create" ? "active" : ""} onClick={() => setPage("create")}>Crear reporte</button>
            <button className={page === "map" ? "active" : ""} onClick={() => setPage("map")}>Mapa</button>
            <button className={page === "notifications" ? "active" : ""} onClick={() => setPage("notifications")}>
              Notificaciones {unreadNotifications > 0 && <span className="badge">{unreadNotifications}</span>}
            </button>
            <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")} disabled={!isAdmin}>
              Admin
            </button>
          </nav>

          {user ? (
            <div className="session-box">
              <span>{user.email} · {user.role}</span>
              <button onClick={logout}>Cerrar sesión</button>
            </div>
          ) : (
            <button onClick={() => setPage("login")}>Iniciar sesión</button>
          )}
        </div>
      </header>

      <div className="sr-only" aria-live="polite">{statusMessage}</div>

      {!user && page !== "login" && (
        <div className="alert-box">
          Para registrar incidencias, revisar notificaciones o administrar catálogos, primero inicia sesión.
        </div>
      )}

      <section className="stats-grid" aria-label="Resumen de indicadores">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`stat-card ${card.accent ? "accent" : ""} ${card.warning ? "warning" : ""}`.trim()}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <main id="main-content">
        {page === "login" && <Login onLogin={onLogin} />}

        {page === "create" && (
          <CreateReport
            user={user}
            reports={reports.filter((report) => !report.hidden)}
            catalogs={catalogs}
            onCreate={createReport}
          />
        )}

        {page === "list" && (
          <>
            <FilterBar catalogs={catalogs} filters={filters} onChange={setFilters} isAdmin={isAdmin} />
            <div className="content-grid">
              <ReportList
                reports={visibleReports}
                onSelect={(id) => {
                  setSelectedId(id);
                  announce("Reporte seleccionado para consulta de detalle.");
                }}
                selectedId={selectedId}
                isAdmin={isAdmin}
              />
              <ReportDetail
                report={selectedReport}
                user={user}
                isAdmin={isAdmin}
                onAddComment={addComment}
                onUpdateStatus={updateStatus}
                onModerateReport={moderateReport}
                onModerateComment={moderateComment}
              />
            </div>
          </>
        )}

        {page === "map" && <MapBoard zoneStats={zoneStats} reports={publicReports} />}

        {page === "notifications" && (
          <NotificationsPanel
            items={userNotifications}
            onMarkAllRead={markAllNotificationsAsRead}
          />
        )}

        {page === "admin" && (
          <AdminPanel
            user={user}
            reports={reports}
            catalogs={catalogs}
            auditTrail={auditTrail}
            onUpdateStatus={updateStatus}
            onAddCatalogItem={addCatalogItem}
            onRemoveCatalogItem={removeCatalogItem}
            onExportCsv={exportReportsCsv}
          />
        )}
      </main>

      <footer className="footer-note">
        &copy; 2026 Manuel Esparza
      </footer>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <section className="panel">
      <h2>Acceso al sistema</h2>
      <p className="muted">
        Usuario demo: cualquier correo válido con contraseña de 4 caracteres o más. Administrador: admin@admin.com / admin123
      </p>
      <div className="form-grid narrow">
        <label>
          Correo
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@correo.com" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" />
        </label>
        <button onClick={() => onLogin(email.trim(), password)}>Entrar</button>
      </div>
    </section>
  );
}

function CreateReport({ user, reports, catalogs, onCreate }) {
  const [type, setType] = useState(catalogs.types[0] || "Bache");
  const [zone, setZone] = useState(catalogs.zones[0] || "Centro");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const possibleDuplicates = useMemo(() => {
    if (!description.trim() || !location.trim()) return [];
    return findDuplicates(reports, { type, description, location, zone });
  }, [reports, type, description, location, zone]);

  if (!user) {
    return <section className="panel"><p>Inicia sesión para registrar reportes.</p></section>;
  }

  return (
    <section className="panel">
      <h2>Crear nuevo reporte</h2>
      <div className="form-grid">
        <label>
          Tipo de incidencia
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {catalogs.types.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          Zona
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            {catalogs.zones.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="full-width">
          Descripción
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe la incidencia"
          />
        </label>

        <label className="full-width">
          Ubicación
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Calle, número o referencia"
          />
        </label>

        <div className="full-width actions-row">
          <button
            onClick={() => {
              if (!description.trim() || !location.trim()) {
                alert("Completa descripción y ubicación.");
                return;
              }
              onCreate({ type, zone, description: description.trim(), location: location.trim() });
              setDescription("");
              setLocation("");
            }}
          >
            Enviar reporte
          </button>
        </div>
      </div>

      {possibleDuplicates.length > 0 && (
        <div className="warning-box">
          <strong>Posibles incidencias duplicadas:</strong>
          <ul>
            {possibleDuplicates.slice(0, 3).map((report) => (
              <li key={report.id}>{report.type} en {report.location} ({report.zone})</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FilterBar({ catalogs, filters, onChange, isAdmin }) {
  return (
    <section className="panel compact">
      <div className="filters-grid expanded">
        <label>
          Buscar
          <input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Tipo, ubicación, zona o usuario"
          />
        </label>

        <label>
          Estatus
          <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}>
            <option>Todos</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>

        <label>
          Zona
          <select value={filters.zone} onChange={(e) => onChange({ ...filters, zone: e.target.value })}>
            <option>Todas</option>
            {catalogs.zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>

        <label>
          Tipo
          <select value={filters.type} onChange={(e) => onChange({ ...filters, type: e.target.value })}>
            <option>Todos</option>
            {catalogs.types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        {isAdmin && (
          <label className="checkbox-row checkbox-card">
            <input
              type="checkbox"
              checked={filters.showHidden}
              onChange={(e) => onChange({ ...filters, showHidden: e.target.checked })}
            />
            <span>Mostrar reportes ocultos por moderación</span>
          </label>
        )}
      </div>
    </section>
  );
}

function ReportList({ reports, onSelect, selectedId, isAdmin }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Explorar reportes</h2>
        <span className="muted">{reports.length} coincidencias</span>
      </div>

      <div className="list-grid">
        {reports.length === 0 && <p className="muted">No hay reportes con esos filtros.</p>}
        {reports.map((report) => (
          <button
            key={report.id}
            type="button"
            className={`report-card ${selectedId === report.id ? "selected" : ""}`}
            onClick={() => onSelect(report.id)}
          >
            <div className="card-head">
              <strong>{report.type}</strong>
              <span className={`status-chip ${report.status.replace(/\s+/g, "-").toLowerCase()}`}>{report.status}</span>
            </div>
            <p>{report.description}</p>
            <small>{report.zone} · {report.location}</small>
            <small>{formatDate(report.createdAt)}</small>
            {report.hidden && isAdmin && <span className="status-chip hidden-chip">Oculto por moderación</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function ReportDetail({ report, user, isAdmin, onAddComment, onUpdateStatus, onModerateReport, onModerateComment }) {
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [moderationReason, setModerationReason] = useState("");

  if (!report) {
    return (
      <section className="panel">
        <h2>Detalle del reporte</h2>
        <p className="muted">Selecciona un reporte para consultar historial, comentarios, estatus y acciones de moderación.</p>
      </section>
    );
  }

  const visibleComments = isAdmin ? report.comments || [] : (report.comments || []).filter((entry) => !entry.hidden);

  return (
    <section className="panel">
      <div className="section-head">
        <h2>Detalle del reporte</h2>
        {report.hidden && <span className="status-chip hidden-chip">Contenido oculto</span>}
      </div>

      <div className="detail-block">
        <p><strong>Tipo:</strong> {report.type}</p>
        <p><strong>Zona:</strong> {report.zone}</p>
        <p><strong>Ubicación:</strong> {report.location}</p>
        <p><strong>Creado por:</strong> {report.createdBy}</p>
        <p><strong>Descripción:</strong> {report.description}</p>
        {report.hidden && report.hiddenReason && <p><strong>Motivo de moderación:</strong> {report.hiddenReason}</p>}
      </div>

      <div className="detail-block">
        <h3>Historial de estatus</h3>
        <ul className="timeline">
          {(report.statusHistory || []).map((entry) => (
            <li key={entry.id}>
              <strong>{entry.status}</strong> · {formatDate(entry.date)}<br />
              <span>{entry.by}</span>
              <p>{entry.note}</p>
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && (report.moderationHistory || []).length > 0 && (
        <div className="detail-block">
          <h3>Historial de moderación</h3>
          <ul className="timeline compact-list">
            {report.moderationHistory.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.hidden ? "Oculto" : "Restaurado"}</strong> · {formatDate(entry.date)}
                <p>{entry.by} · {entry.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="detail-block">
        <h3>Comentarios</h3>
        {visibleComments.length === 0 && <p className="muted">Aún no hay comentarios visibles.</p>}
        <ul className="timeline compact-list">
          {visibleComments.map((entry) => (
            <li key={entry.id}>
              <div className="comment-head">
                <div>
                  <strong>{entry.by}</strong> · {formatDate(entry.date)}
                  {entry.hidden && isAdmin && <span className="status-chip hidden-chip inline-chip">Oculto</span>}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="inline-action"
                    onClick={() => onModerateComment(report.id, entry.id, !entry.hidden, moderationReason)}
                  >
                    {entry.hidden ? "Restaurar" : "Ocultar"}
                  </button>
                )}
              </div>
              <p>{entry.text}</p>
            </li>
          ))}
        </ul>

        {user && !report.hidden && (
          <div className="form-grid narrow top-space">
            <label>
              Nuevo comentario
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <button onClick={() => {
              onAddComment(report.id, comment);
              setComment("");
            }}>Agregar comentario</button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="detail-block">
          <h3>Gestión administrativa</h3>
          <div className="form-grid">
            <label className="full-width">
              Nota administrativa / motivo de moderación
              <input
                value={moderationReason || note}
                onChange={(e) => {
                  setModerationReason(e.target.value);
                  setNote(e.target.value);
                }}
                placeholder="Opcional"
              />
            </label>
            <div className="full-width actions-row wrap">
              {STATUS_OPTIONS.map((status) => (
                <button key={status} type="button" onClick={() => {
                  onUpdateStatus(report.id, status, note);
                  setNote("");
                }}>
                  Marcar {status}
                </button>
              ))}
            </div>
            <div className="full-width actions-row wrap">
              <button
                type="button"
                className={report.hidden ? "success-btn" : "danger-btn"}
                onClick={() => {
                  onModerateReport(report.id, !report.hidden, moderationReason);
                  setModerationReason("");
                }}
              >
                {report.hidden ? "Restaurar reporte" : "Ocultar reporte"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MapBoard({ zoneStats, reports }) {
  return (
    <section className="panel">
      <h2>Mapa de incidencias por zona</h2>
      <p className="muted">Vista simplificada para ubicar incidencias por zonas del municipio.</p>

      <div className="zone-grid">
        {zoneStats.map((item) => (
          <article key={item.zone} className="zone-card">
            <strong>{item.zone}</strong>
            <span>{item.total} reportes</span>
            <small>{item.pending} pendientes</small>
          </article>
        ))}
      </div>

      <div className="map-legend">
        {reports.length === 0 && <p className="muted">No hay incidencias visibles para el mapa.</p>}
        {reports.map((report) => (
          <div key={report.id} className="legend-item">
            <span className={`dot ${report.status.replace(/\s+/g, "-").toLowerCase()}`}></span>
            <span>{report.zone} · {report.type} · {report.location}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotificationsPanel({ items, onMarkAllRead }) {
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Notificaciones</h2>
        <button onClick={onMarkAllRead}>Marcar todas como leídas</button>
      </div>

      <div className="list-grid">
        {items.length === 0 && <p className="muted">No hay notificaciones para mostrar.</p>}
        {items.map((item) => (
          <article key={item.id} className={`notification-card ${item.read ? "read" : "unread"}`}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <small>{formatDate(item.createdAt)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminPanel({
  user,
  reports,
  catalogs,
  auditTrail,
  onUpdateStatus,
  onAddCatalogItem,
  onRemoveCatalogItem,
  onExportCsv,
}) {
  const [typeInput, setTypeInput] = useState("");
  const [zoneInput, setZoneInput] = useState("");
  const [exportFilters, setExportFilters] = useState({
    status: "Todos",
    zone: "Todas",
    type: "Todos",
    search: "",
    showHidden: true,
  });

  const exportPreview = useMemo(
    () => filterCollection(reports, exportFilters, exportFilters.showHidden),
    [reports, exportFilters]
  );

  const moderatedItems = reports.filter(
    (report) => report.hidden || (report.comments || []).some((comment) => comment.hidden)
  );

  if (!user) return <section className="panel"><p>Inicia sesión.</p></section>;
  if (user.role !== "admin") return <section className="panel"><p>No tienes permisos de administrador.</p></section>;

  return (
    <section className="panel">
      <h2>Centro de administración</h2>
      <p className="muted">Sprint 3: moderación, exportación CSV, accesibilidad y trazabilidad con auditoría.</p>

      <div className="admin-stack">
        <section className="panel nested">
          <h3>Exportación CSV</h3>
          <div className="filters-grid expanded">
            <label>
              Buscar
              <input
                value={exportFilters.search}
                onChange={(e) => setExportFilters({ ...exportFilters, search: e.target.value })}
                placeholder="Filtrar antes de exportar"
              />
            </label>

            <label>
              Estatus
              <select value={exportFilters.status} onChange={(e) => setExportFilters({ ...exportFilters, status: e.target.value })}>
                <option>Todos</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              Zona
              <select value={exportFilters.zone} onChange={(e) => setExportFilters({ ...exportFilters, zone: e.target.value })}>
                <option>Todas</option>
                {catalogs.zones.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>

            <label>
              Tipo
              <select value={exportFilters.type} onChange={(e) => setExportFilters({ ...exportFilters, type: e.target.value })}>
                <option>Todos</option>
                {catalogs.types.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="checkbox-row checkbox-card">
              <input
                type="checkbox"
                checked={exportFilters.showHidden}
                onChange={(e) => setExportFilters({ ...exportFilters, showHidden: e.target.checked })}
              />
              <span>Incluir contenido moderado</span>
            </label>
          </div>

          <div className="toolbar-row">
            <span className="muted">Reportes listos para exportar: {exportPreview.length}</span>
            <button type="button" onClick={() => onExportCsv(exportFilters)}>
              Exportar CSV
            </button>
          </div>
        </section>

        <div className="content-grid admin-layout">
          <div className="panel nested">
            <h3>Catálogo de tipos</h3>
            <div className="inline-form">
              <input value={typeInput} onChange={(e) => setTypeInput(e.target.value)} placeholder="Nuevo tipo" />
              <button onClick={() => {
                onAddCatalogItem("types", typeInput);
                setTypeInput("");
              }}>Agregar</button>
            </div>
            <ul className="simple-list">
              {catalogs.types.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <button type="button" onClick={() => onRemoveCatalogItem("types", item)}>Eliminar</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel nested">
            <h3>Catálogo de zonas</h3>
            <div className="inline-form">
              <input value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} placeholder="Nueva zona" />
              <button onClick={() => {
                onAddCatalogItem("zones", zoneInput);
                setZoneInput("");
              }}>Agregar</button>
            </div>
            <ul className="simple-list">
              {catalogs.zones.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <button type="button" onClick={() => onRemoveCatalogItem("zones", item)}>Eliminar</button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className="panel nested">
          <div className="section-head">
            <h3>Contenido moderado</h3>
            <span className="muted">{moderatedItems.length} reportes con acciones de moderación</span>
          </div>
          <div className="list-grid">
            {moderatedItems.length === 0 && <p className="muted">No hay contenido moderado.</p>}
            {moderatedItems.map((report) => (
              <article key={report.id} className="report-card selected static-card">
                <div className="card-head">
                  <strong>{report.type}</strong>
                  {report.hidden && <span className="status-chip hidden-chip">Reporte oculto</span>}
                </div>
                <p>{report.description}</p>
                <small>{report.zone} · {report.location}</small>
                <small>Comentarios ocultos: {(report.comments || []).filter((comment) => comment.hidden).length}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel nested">
          <h3>Panel rápido de estatus</h3>
          <div className="list-grid">
            {reports.map((report) => (
              <article key={report.id} className="report-card selected static-card">
                <div className="card-head">
                  <strong>{report.type}</strong>
                  <select value={report.status} onChange={(e) => onUpdateStatus(report.id, e.target.value, "Cambio desde panel rápido")}> 
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <p>{report.description}</p>
                <small>{report.zone} · {report.location}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel nested">
          <div className="section-head">
            <h3>Bitácora de auditoría</h3>
            <span className="muted">Últimos {Math.min(auditTrail.length, 25)} eventos</span>
          </div>
          <div className="audit-list" role="list">
            {auditTrail.slice(0, 25).map((entry) => (
              <article key={entry.id} className="audit-item" role="listitem">
                <div>
                  <strong>{entry.action}</strong>
                  <p>{entry.details}</p>
                </div>
                <div className="audit-meta">
                  <span>{entry.actor}</span>
                  <small>{formatDate(entry.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
