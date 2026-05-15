import "./App.css";
import { useEffect, useMemo, useState } from "react";

// --- CONSTANTES ---
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

// --- CAPA DE DATOS BASE (A abstraer) ---
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

// ============================================================================
// MODIFICACIÓN: Abstracción de Capa de Datos (Preparación para API REST/PostgreSQL)
// Todas las llamadas de almacenamiento ahora pasan por este servicio,
// lo que permitirá cambiar a fetch('/api/...') fácilmente en el futuro.
// ============================================================================
const ApiService = {
  getReports: () => safeRead(REPORTS_KEY, []).map(ensureReportShape),
  saveReports: (data) => saveJson(REPORTS_KEY, data),
  
  getUser: () => safeRead(USER_KEY, null),
  saveUser: (user) => saveJson(USER_KEY, user),
  clearUser: () => localStorage.removeItem(USER_KEY),
  
  getCatalogs: () => {
    const stored = safeRead(CATALOGS_KEY, null);
    if (!stored) return DEFAULT_CATALOGS;
    return {
      types: Array.isArray(stored.types) && stored.types.length ? stored.types : DEFAULT_CATALOGS.types,
      zones: Array.isArray(stored.zones) && stored.zones.length ? stored.zones : DEFAULT_CATALOGS.zones,
    };
  },
  saveCatalogs: (data) => saveJson(CATALOGS_KEY, data),
  
  getNotifications: () => safeRead(NOTIFICATIONS_KEY, []),
  saveNotifications: (data) => saveJson(NOTIFICATIONS_KEY, data),
  
  getAuditTrail: () => safeRead(AUDIT_KEY, []),
  saveAuditTrail: (data) => saveJson(AUDIT_KEY, data),
};

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
      statusHistory: [{ id: crypto.randomUUID(), status: "Pendiente", date: new Date(now - 1000 * 60 * 60 * 24).toISOString(), by: "vecino1@demo.com", note: "Reporte creado" }],
      comments: [{ id: crypto.randomUUID(), text: "El bache ya tiene varios días.", by: "vecino1@demo.com", date: new Date(now - 1000 * 60 * 60 * 20).toISOString(), hidden: false, moderationHistory: [] }],
    }
  ];
}

function seedIfEmpty() {
  if (!localStorage.getItem(CATALOGS_KEY)) ApiService.saveCatalogs(DEFAULT_CATALOGS);
  if (!localStorage.getItem(REPORTS_KEY)) ApiService.saveReports(makeSeedReports());
  if (!localStorage.getItem(NOTIFICATIONS_KEY)) ApiService.saveNotifications([{ id: crypto.randomUUID(), userEmail: "vecino2@demo.com", title: "Bienvenida", message: "Sistema iniciado.", read: false, createdAt: new Date().toISOString() }]);
  if (!localStorage.getItem(AUDIT_KEY)) ApiService.saveAuditTrail([{ id: crypto.randomUUID(), action: "seed.init", actor: "sistema", details: "Se inicializaron datos demo.", createdAt: new Date().toISOString() }]);
}

function buildNotification(userEmail, title, message) {
  return { id: crypto.randomUUID(), userEmail, title, message, read: false, createdAt: new Date().toISOString() };
}

function buildAuditEntry(action, actor, details) {
  return { id: crypto.randomUUID(), action, actor, details, createdAt: new Date().toISOString() };
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
    const similarDesc = description.length >= 8 && (normalizeText(report.description).includes(description.slice(0, 12)) || description.includes(normalizeText(report.description).slice(0, 12)));
    return sameType && ((sameZone && sameLocation) || (sameZone && similarDesc));
  });
}

function escapeCsvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export function buildCsvRows(reports) {
  const headers = ["ID", "Tipo", "Zona", "Ubicación", "Estatus", "Oculto", "Motivo de moderación", "Creado por", "Fecha", "Comentarios visibles"];
  const rows = reports.map((report) => [
    report.id, report.type, report.zone, report.location, report.status, report.hidden ? "Sí" : "No", report.hiddenReason || "", report.createdBy, formatDate(report.createdAt), (report.comments || []).filter((c) => !c.hidden).length,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function filterCollection(reports, filters, includeHidden = false) {
  return reports.filter((report) => {
    const statusOk = filters.status === "Todos" || report.status === filters.status;
    const zoneOk = filters.zone === "Todas" || report.zone === filters.zone;
    const typeOk = filters.type === "Todos" || report.type === filters.type;
    const searchOk = !filters.search || [report.type, report.description, report.location, report.zone, report.createdBy].join(" ").toLowerCase().includes(filters.search.toLowerCase());
    const hiddenOk = includeHidden || !report.hidden;
    return statusOk && zoneOk && typeOk && searchOk && hiddenOk;
  });
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true); // MODIFICACIÓN: Estado de carga asíncrona
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("list");
  const [reports, setReports] = useState([]);
  const [catalogs, setCatalogs] = useState(DEFAULT_CATALOGS);
  const [notifications, setNotifications] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Iniciando conexión con servidor...");
  const [filters, setFilters] = useState({ status: "Todos", zone: "Todas", type: "Todos", search: "", showHidden: false });
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    // MODIFICACIÓN: Simulación de petición de red para cargar datos (Preparación para API)
    setTimeout(() => {
      seedIfEmpty();
      setUser(ApiService.getUser());
      setReports(ApiService.getReports());
      setCatalogs(ApiService.getCatalogs());
      setNotifications(ApiService.getNotifications());
      setAuditTrail(ApiService.getAuditTrail());
      setIsLoading(false);
      setStatusMessage("Datos cargados correctamente. Entorno preparado para API.");
    }, 600);
  }, []);

  const isAdmin = user?.role === "admin";
  const publicReports = useMemo(() => reports.filter((r) => !r.hidden), [reports]);
  const visibleReports = useMemo(() => filterCollection(reports, filters, isAdmin && filters.showHidden), [reports, filters, isAdmin]);
  
  const stats = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = publicReports.filter((r) => r.status === status).length;
      return acc;
    }, {});
  }, [publicReports]);

  const zoneStats = useMemo(() => catalogs.zones.map((zone) => ({
    zone,
    total: publicReports.filter((r) => r.zone === zone).length,
    pending: publicReports.filter((r) => r.zone === zone && r.status === "Pendiente").length,
  })), [catalogs.zones, publicReports]);

  const userNotifications = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return notifications;
    return notifications.filter((item) => item.userEmail === user.email);
  }, [notifications, user, isAdmin]);

  const unreadNotifications = userNotifications.filter((item) => !item.read).length;

  const selectedReport = useMemo(() => visibleReports.find((r) => r.id === selectedId) || null, [visibleReports, selectedId]);

  function syncReports(next) {
    const normalized = next.map(ensureReportShape);
    setReports(normalized);
    ApiService.saveReports(normalized);
  }

  function appendAudit(action, actor, details) {
    const entry = buildAuditEntry(action, actor, details);
    setAuditTrail((prev) => {
      const next = [entry, ...prev].slice(0, 300);
      ApiService.saveAuditTrail(next);
      return next;
    });
  }

  function announce(msg) { setStatusMessage(msg); }

  function onLogin(email, password) {
    if (email === "admin@admin.com" && password === "admin123") {
      const nextUser = { email, role: "admin" };
      setUser(nextUser);
      ApiService.saveUser(nextUser);
      setPage("admin");
      appendAudit("auth.login", email, "Inicio de sesión como administrador.");
      announce("Sesión iniciada.");
      return;
    }
    if (email.includes("@") && password.length >= 4) {
      const nextUser = { email, role: "user" };
      setUser(nextUser);
      ApiService.saveUser(nextUser);
      setPage("list");
      appendAudit("auth.login", email, "Inicio de sesión como ciudadano.");
      announce("Sesión iniciada.");
      return;
    }
    alert("Credenciales inválidas.");
  }

  function logout() {
    const actor = user?.email || "usuario";
    setUser(null);
    ApiService.clearUser();
    setPage("login");
    appendAudit("auth.logout", actor, "Cierre de sesión.");
  }

  function createReport(data) {
    const newReport = {
      id: crypto.randomUUID(), ...data, status: "Pendiente",
      createdAt: new Date().toISOString(), createdBy: user.email,
      hidden: false, hiddenReason: "", moderationHistory: [],
      statusHistory: [{ id: crypto.randomUUID(), status: "Pendiente", date: new Date().toISOString(), by: user.email, note: "Reporte creado" }],
      comments: [],
    };
    syncReports([newReport, ...reports]);
    const nextNotif = [buildNotification(user.email, "Reporte registrado", `Tu reporte fue creado.`), ...notifications];
    setNotifications(nextNotif);
    ApiService.saveNotifications(nextNotif);
    setSelectedId(newReport.id);
    setPage("list");
    appendAudit("report.create", user.email, `Nuevo reporte en ${data.zone}.`);
  }

  function updateStatus(id, status, note = "") {
    const nextReports = reports.map((r) => {
      if (r.id !== id) return r;
      return { ...r, status, statusHistory: [{ id: crypto.randomUUID(), status, date: new Date().toISOString(), by: user.email, note: note || `Estado actualizado a ${status}` }, ...r.statusHistory] };
    });
    syncReports(nextReports);
    appendAudit("report.status", user.email, `Se cambió a ${status} un reporte.`);
  }

  function exportReportsCsv(exportFilters) {
    if (!user || !isAdmin) return;
    const filteredReports = filterCollection(reports, exportFilters, exportFilters.showHidden);
    const csv = buildCsvRows(filteredReports);
    
    // MODIFICACIÓN: Integración del BOM (Byte Order Mark) \uFEFF para arreglar acentos en Excel
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_vecinal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    appendAudit("export.csv", user.email, `Exportados ${filteredReports.length} reportes.`);
    announce(`CSV exportado correctamente.`);
  }

  if (isLoading) {
    return (
      <div className="app-shell loading-screen">
        <div className="spinner"></div>
        <p>Conectando con la base de datos local...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>

      <header className="topbar">
        <div>
          <p className="eyebrow">Portal ciudadano</p>
          <h1>
            ReporteVecinal GDL
            <span className="api-badge" title="Arquitectura refactorizada en este sprint">Listo para API</span>
          </h1>
        </div>

        <div className="topbar-actions">
          <nav className="nav-tabs">
            <button className={page === "list" ? "active" : ""} onClick={() => setPage("list")}>Explorar</button>
            <button className={page === "create" ? "active" : ""} onClick={() => setPage("create")}>Crear reporte</button>
            <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")} disabled={!isAdmin}>Admin</button>
          </nav>
          {user ? (
            <div className="session-box">
              <span>{user.email}</span>
              <button onClick={logout}>Salir</button>
            </div>
          ) : (
            <button onClick={() => setPage("login")}>Iniciar sesión</button>
          )}
        </div>
      </header>

      <main id="main-content">
        {page === "login" && <Login onLogin={onLogin} />}
        {page === "create" && <CreateReport user={user} reports={reports} catalogs={catalogs} onCreate={createReport} />}
        {page === "list" && (
          <>
            <FilterBar catalogs={catalogs} filters={filters} onChange={setFilters} isAdmin={isAdmin} />
            <div className="content-grid">
              <ReportList reports={visibleReports} onSelect={setSelectedId} selectedId={selectedId} isAdmin={isAdmin} />
              <ReportDetail report={selectedReport} isAdmin={isAdmin} onUpdateStatus={updateStatus} />
            </div>
          </>
        )}
        {page === "admin" && (
          <AdminPanel user={user} reports={reports} catalogs={catalogs} auditTrail={auditTrail} onUpdateStatus={updateStatus} onExportCsv={exportReportsCsv} />
        )}
      </main>
    </div>
  );
}

// ... [Componentes UI simplificados para mantener concisión en el entregable] ...
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <section className="panel">
      <h2>Acceso</h2>
      <div className="form-grid narrow">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" />
        <button onClick={() => onLogin(email, password)}>Entrar</button>
      </div>
    </section>
  );
}

function CreateReport({ user, catalogs, onCreate }) {
  const [type, setType] = useState(catalogs.types[0]);
  const [zone, setZone] = useState(catalogs.zones[0]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  if (!user) return <p>Inicia sesión.</p>;
  return (
    <section className="panel">
      <h2>Nuevo reporte</h2>
      <div className="form-grid">
        <select value={type} onChange={(e)=>setType(e.target.value)}>{catalogs.types.map(t=><option key={t}>{t}</option>)}</select>
        <select value={zone} onChange={(e)=>setZone(e.target.value)}>{catalogs.zones.map(z=><option key={z}>{z}</option>)}</select>
        <textarea className="full-width" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Descripción" />
        <input className="full-width" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Ubicación" />
        <button onClick={() => onCreate({type, zone, description, location})}>Enviar</button>
      </div>
    </section>
  );
}

function FilterBar({ filters, onChange }) {
  return (
    <section className="panel compact">
      <input value={filters.search} onChange={(e) => onChange({...filters, search: e.target.value})} placeholder="Buscar..." />
    </section>
  );
}

function ReportList({ reports, onSelect, selectedId }) {
  return (
    <section className="panel list-grid">
      {reports.map((r) => (
        <button key={r.id} className={`report-card ${selectedId === r.id ? "selected" : ""}`} onClick={() => onSelect(r.id)}>
          <strong>{r.type}</strong> - {r.status} <br/> {r.location}
        </button>
      ))}
    </section>
  );
}

function ReportDetail({ report, isAdmin, onUpdateStatus }) {
  if (!report) return <section className="panel"><p>Selecciona un reporte.</p></section>;
  return (
    <section className="panel">
      <h2>{report.type} en {report.zone}</h2>
      <p>{report.description}</p>
      {isAdmin && (
        <select value={report.status} onChange={(e) => onUpdateStatus(report.id, e.target.value)}>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      )}
    </section>
  );
}

function AdminPanel({ reports, auditTrail, onExportCsv }) {
  return (
    <section className="panel">
      <h2>Panel Administrativo</h2>
      <button onClick={() => onExportCsv({ status: "Todos", zone: "Todas", type: "Todos", search: "", showHidden: true })}>
        Exportar CSV (Acentos corregidos)
      </button>
      <h3>Auditoría ({auditTrail.length})</h3>
      <ul>{auditTrail.slice(0,5).map(a => <li key={a.id}>{a.action} - {a.actor}</li>)}</ul>
    </section>
  );
}
