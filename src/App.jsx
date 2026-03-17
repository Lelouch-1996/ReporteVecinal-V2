import "./App.css";
import { useEffect, useMemo, useState } from "react";

const REPORTS_KEY = "rv_reports_v2";
const USER_KEY = "rv_user_v2";
const CATALOGS_KEY = "rv_catalogs_v2";
const NOTIFICATIONS_KEY = "rv_notifications_v2";

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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function findDuplicates(reports, candidate) {
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

export default function App() {
  const [user, setUser] = useState(() => loadUser());
  const [page, setPage] = useState("list");
  const [reports, setReports] = useState(() => loadReports());
  const [catalogs, setCatalogs] = useState(() => loadCatalogs());
  const [notifications, setNotifications] = useState(() => loadNotifications());
  const [filters, setFilters] = useState({ status: "Todos", zone: "Todas", type: "Todos" });
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    seedIfEmpty();
    setReports(loadReports());
    setCatalogs(loadCatalogs());
    setNotifications(loadNotifications());
  }, []);

  const isAdmin = user?.role === "admin";

  const visibleReports = useMemo(() => {
    return reports.filter((report) => {
      const statusOk = filters.status === "Todos" || report.status === filters.status;
      const zoneOk = filters.zone === "Todas" || report.zone === filters.zone;
      const typeOk = filters.type === "Todos" || report.type === filters.type;
      return statusOk && zoneOk && typeOk;
    });
  }, [reports, filters]);

  const stats = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = reports.filter((report) => report.status === status).length;
      return acc;
    }, {});
  }, [reports]);

  const zoneStats = useMemo(() => {
    return catalogs.zones.map((zone) => ({
      zone,
      total: reports.filter((report) => report.zone === zone).length,
      pending: reports.filter((report) => report.zone === zone && report.status === "Pendiente").length,
    }));
  }, [catalogs.zones, reports]);

  const userNotifications = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return notifications;
    return notifications.filter((item) => item.userEmail === user.email);
  }, [notifications, user, isAdmin]);

  const unreadNotifications = userNotifications.filter((item) => !item.read).length;

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) || null,
    [reports, selectedId]
  );

  function syncReports(next) {
    setReports(next);
    saveReports(next);
  }

  function syncCatalogs(next) {
    setCatalogs(next);
    saveCatalogs(next);
  }

  function syncNotifications(next) {
    setNotifications(next);
    saveNotifications(next);
  }

  function onLogin(email, password) {
    if (email === "admin@admin.com" && password === "admin123") {
      const nextUser = { email, role: "admin" };
      setUser(nextUser);
      saveUser(nextUser);
      setPage("admin");
      return;
    }

    if (email.includes("@") && password.length >= 4) {
      const nextUser = { email, role: "user" };
      setUser(nextUser);
      saveUser(nextUser);
      setPage("list");
      return;
    }

    alert("Credenciales inválidas. Usa un correo válido y contraseña de 4 o más caracteres.");
  }

  function logout() {
    setUser(null);
    clearUser();
    setPage("login");
  }

  function createReport({ type, description, location, zone }) {
    if (!user) {
      alert("Debes iniciar sesión.");
      return;
    }

    const duplicateMatches = findDuplicates(reports, { type, description, location, zone });
    if (duplicateMatches.length > 0) {
      const proceed = window.confirm(
        `Se detectaron ${duplicateMatches.length} reportes similares en ${zone}. ¿Deseas crear el reporte de todas formas?`
      );
      if (!proceed) return;
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
  }

  function updateStatus(id, status, note = "") {
    if (!user) return;

    let updatedOwner = null;
    const nextReports = reports.map((report) => {
      if (report.id !== id) return report;
      updatedOwner = report.createdBy;
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
  }

  function addComment(reportId, text) {
    if (!user || !text.trim()) return;

    const nextReports = reports.map((report) => {
      if (report.id !== reportId) return report;
      return {
        ...report,
        comments: [
          {
            id: crypto.randomUUID(),
            text: text.trim(),
            by: user.email,
            date: new Date().toISOString(),
          },
          ...(report.comments || []),
        ],
      };
    });

    syncReports(nextReports);
  }

  function addCatalogItem(kind, value) {
    const clean = value.trim();
    if (!clean) return;
    if (catalogs[kind].includes(clean)) {
      alert("Ese valor ya existe en el catálogo.");
      return;
    }

    syncCatalogs({
      ...catalogs,
      [kind]: [...catalogs[kind], clean],
    });
  }

  function removeCatalogItem(kind, value) {
    const inUse =
      kind === "types"
        ? reports.some((report) => report.type === value)
        : reports.some((report) => report.zone === value);

    if (inUse) {
      alert("No puedes eliminar este elemento porque ya está en uso en reportes registrados.");
      return;
    }

    syncCatalogs({
      ...catalogs,
      [kind]: catalogs[kind].filter((item) => item !== value),
    });
  }

  function markAllNotificationsAsRead() {
    if (!user) return;

    const nextNotifications = notifications.map((item) => {
      const matchesUser = isAdmin || item.userEmail === user.email;
      return matchesUser ? { ...item, read: true } : item;
    });

    syncNotifications(nextNotifications);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Portal ciudadano</p>
          <h1>ReporteVecinal GDL</h1>
        </div>

        <div className="topbar-actions">
          <nav className="nav-tabs">
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

      {!user && page !== "login" && (
        <div className="alert-box">
          Para registrar incidencias, revisar notificaciones o administrar catálogos, primero inicia sesión.
        </div>
      )}

      <section className="stats-grid">
        {STATUS_OPTIONS.map((status) => (
          <article key={status} className="stat-card">
            <span>{status}</span>
            <strong>{stats[status] || 0}</strong>
          </article>
        ))}
        <article className="stat-card accent">
          <span>Total reportes</span>
          <strong>{reports.length}</strong>
        </article>
      </section>

      {page === "login" && <Login onLogin={onLogin} />}

      {page === "create" && (
        <CreateReport
          user={user}
          reports={reports}
          catalogs={catalogs}
          onCreate={createReport}
        />
      )}

      {page === "list" && (
        <>
          <FilterBar catalogs={catalogs} filters={filters} onChange={setFilters} />
          <div className="content-grid">
            <ReportList
              reports={visibleReports}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
            <ReportDetail
              report={selectedReport}
              user={user}
              isAdmin={isAdmin}
              onAddComment={addComment}
              onUpdateStatus={updateStatus}
            />
          </div>
        </>
      )}

      {page === "map" && <MapBoard zoneStats={zoneStats} reports={reports} />}

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
          onUpdateStatus={updateStatus}
          onAddCatalogItem={addCatalogItem}
          onRemoveCatalogItem={removeCatalogItem}
        />
      )}

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
      <p className="muted">Usuario demo: cualquier correo válido con contraseña de 4 caracteres o más. Administrador: admin@admin.com / admin123</p>
      <div className="form-grid narrow">
        <label>
          Correo:
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@correo.com" />
        </label>
        <label>
          Contraseña:
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

function FilterBar({ catalogs, filters, onChange }) {
  return (
    <section className="panel compact">
      <div className="filters-grid">
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
      </div>
    </section>
  );
}

function ReportList({ reports, onSelect, selectedId }) {
  return (
    <section className="panel">
      <h2>Explorar reportes</h2>
      <div className="list-grid">
        {reports.length === 0 && <p className="muted">No hay reportes con esos filtros.</p>}
        {reports.map((report) => (
          <article
            key={report.id}
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
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportDetail({ report, user, isAdmin, onAddComment, onUpdateStatus }) {
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");

  if (!report) {
    return (
      <section className="panel">
        <h2>Detalle del reporte</h2>
        <p className="muted">Selecciona un reporte para consultar historial, comentarios y estatus.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Detalle del reporte</h2>
      <div className="detail-block">
        <p><strong>Tipo:</strong> {report.type}</p>
        <p><strong>Zona:</strong> {report.zone}</p>
        <p><strong>Ubicación:</strong> {report.location}</p>
        <p><strong>Creado por:</strong> {report.createdBy}</p>
        <p><strong>Descripción:</strong> {report.description}</p>
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

      <div className="detail-block">
        <h3>Comentarios</h3>
        {(report.comments || []).length === 0 && <p className="muted">Aún no hay comentarios.</p>}
        <ul className="timeline compact-list">
          {(report.comments || []).map((entry) => (
            <li key={entry.id}>
              <strong>{entry.by}</strong> · {formatDate(entry.date)}
              <p>{entry.text}</p>
            </li>
          ))}
        </ul>

        {user && (
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
          <h3>Actualizar estatus</h3>
          <div className="form-grid narrow">
            <label>
              Nota administrativa
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
            </label>
            <div className="actions-row wrap">
              {STATUS_OPTIONS.map((status) => (
                <button key={status} onClick={() => {
                  onUpdateStatus(report.id, status, note);
                  setNote("");
                }}>
                  Marcar {status}
                </button>
              ))}
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

function AdminPanel({ user, reports, catalogs, onUpdateStatus, onAddCatalogItem, onRemoveCatalogItem }) {
  const [typeInput, setTypeInput] = useState("");
  const [zoneInput, setZoneInput] = useState("");

  if (!user) return <section className="panel"><p>Inicia sesión.</p></section>;
  if (user.role !== "admin") return <section className="panel"><p>No tienes permisos de administrador.</p></section>;

  return (
    <section className="panel">
      <h2>Administrar</h2>
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
                <button onClick={() => onRemoveCatalogItem("types", item)}>Eliminar</button>
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
                <button onClick={() => onRemoveCatalogItem("zones", item)}>Eliminar</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="top-space">
        <h3>Panel rápido de estatus</h3>
        <div className="list-grid">
          {reports.map((report) => (
            <article key={report.id} className="report-card selected">
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
      </div>
    </section>
  );
}
