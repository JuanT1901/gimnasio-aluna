"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FaSignOutAlt,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaHome,
  FaChevronDown,
  FaChevronUp,
  FaUserPlus,
  FaUpload,
  FaList,
  FaBullhorn,
  FaUsersCog,
  FaFileSignature,
  FaCommentDots,
  FaBook,
  FaIdCard,
  FaBars,
  FaTimes,
  FaCalendarAlt,
  FaEdit,
  FaClipboardCheck,
  FaCalendarTimes,
  FaFileAlt,
  FaCog,
  FaFlagCheckered,
} from "react-icons/fa";
import sidebarStyles from "app/styles/components/PlatformSidebar.module.scss";
import horarioStyles from "app/styles/pages/Horario.module.scss";
import { contarSolicitudesNuevas } from "app/app/plataformas/admin/certificados/actions";

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [menuAbierto, setMenuAbierto] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (
      pathname?.includes("/estudiantes") ||
      pathname?.includes("/boletines") ||
      pathname?.includes("/sugerencias-preescolar")
    ) {
      setMenuAbierto("estudiantes");
    } else if (
      pathname?.includes("/profesores") ||
      pathname?.includes("/materias") ||
      pathname?.includes("/cursos")
    ) {
      setMenuAbierto("profesores");
    } else if (pathname?.includes("/horario")) {
      setMenuAbierto("horario");
    } else if (pathname?.includes("/certificados")) {
      setMenuAbierto("certificados");
    } else if (pathname?.includes("/fin-de-anio")) {
      setMenuAbierto("fin-de-anio");
    }
  }, [pathname]);

  // Aviso de solicitudes de certificados nuevas: al cambiar de página y cada 2 minutos
  const [solicitudesNuevas, setSolicitudesNuevas] = useState(0);
  useEffect(() => {
    const actualizar = () => {
      contarSolicitudesNuevas().then(setSolicitudesNuevas).catch(() => {});
    };
    actualizar();
    const intervalo = setInterval(actualizar, 120000);
    return () => clearInterval(intervalo);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const toggleMenu = (menu: string) => {
    setMenuAbierto(menuAbierto === menu ? "" : menu);
  };

  const btnStyle = {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 15px",
    color: "#f8fafc",
    background: "none",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background 0.2s",
    textAlign: "left" as const,
  };
  const linkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 15px 10px 40px",
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: "0.9rem",
    borderRadius: "8px",
    transition: "all 0.2s",
  };

  return (
    <>
      <button
        type="button"
        className={sidebarStyles.menuButton}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <FaBars />
      </button>

      <div
        className={`${sidebarStyles.overlay} ${mobileOpen ? sidebarStyles.open : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`${sidebarStyles.sidebar} ${mobileOpen ? sidebarStyles.open : ""}`}
        style={{ backgroundColor: "#0f172a" }}
      >
        <button
          type="button"
          className={sidebarStyles.closeButton}
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <FaTimes />
        </button>

        <div
          style={{
            padding: "25px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#38bdf8" }}>
            Ludo Club
          </h2>
          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: "0.85rem",
              marginTop: "5px",
            }}
          >
            Portal Administrativo
          </p>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 15px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <Link
            href="/plataformas/admin"
            style={{
              ...btnStyle,
              justifyContent: "flex-start",
              gap: "10px",
              backgroundColor:
                pathname === "/plataformas/admin"
                  ? "rgba(56, 189, 248, 0.1)"
                  : "transparent",
              color: pathname === "/plataformas/admin" ? "#38bdf8" : "#f8fafc",
            }}
          >
            <FaHome /> Inicio
          </Link>

          <div>
            <button
              onClick={() => toggleMenu("estudiantes")}
              style={{
                ...btnStyle,
                backgroundColor:
                  menuAbierto === "estudiantes"
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FaUserGraduate
                  color={menuAbierto === "estudiantes" ? "#38bdf8" : "white"}
                />{" "}
                Estudiantes
              </div>
              {menuAbierto === "estudiantes" ? (
                <FaChevronUp size={12} color="#94a3b8" />
              ) : (
                <FaChevronDown size={12} color="#94a3b8" />
              )}
            </button>

            <div
              style={{
                display: menuAbierto === "estudiantes" ? "flex" : "none",
                flexDirection: "column",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <Link
                href="/plataformas/admin/estudiantes"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/estudiantes"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaList /> Ver Listado
              </Link>
              <Link
                href="/plataformas/admin/estudiantes/crear"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/estudiantes/crear"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaUserPlus /> Crear Manual
              </Link>
              <Link
                href="/plataformas/admin/estudiantes/importar"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/estudiantes/importar"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaUpload /> Subir Matriz Excel
              </Link>
              <Link
                href="/plataformas/admin/boletines"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/boletines"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaFileSignature /> Boletines
              </Link>
              <Link
                href="/plataformas/admin/sugerencias-preescolar"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/sugerencias-preescolar"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaCommentDots /> Sugerencias Preescolar
              </Link>
            </div>
          </div>

          <div>
            <button
              onClick={() => toggleMenu("profesores")}
              style={{
                ...btnStyle,
                backgroundColor:
                  menuAbierto === "profesores"
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FaChalkboardTeacher
                  color={menuAbierto === "profesores" ? "#38bdf8" : "white"}
                />{" "}
                Docentes
              </div>
              {menuAbierto === "profesores" ? (
                <FaChevronUp size={12} color="#94a3b8" />
              ) : (
                <FaChevronDown size={12} color="#94a3b8" />
              )}
            </button>

            <div
              style={{
                display: menuAbierto === "profesores" ? "flex" : "none",
                flexDirection: "column",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <Link
                href="/plataformas/admin/profesores"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/profesores"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaList /> Gestión Docente
              </Link>
              <Link
                href="/plataformas/admin/profesores/crear"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/profesores/crear"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaUserPlus /> Contratar Manual
              </Link>
              <Link
                href="/plataformas/admin/profesores/importar"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/profesores/importar"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaUpload /> Subir Matriz Académica
              </Link>
              <Link
                href="/plataformas/admin/materias"
                style={{
                  ...linkStyle,
                  color: pathname?.includes("/materias")
                    ? "#38bdf8"
                    : "#cbd5e1",
                }}
              >
                <FaBook /> Malla Curricular
              </Link>
              <Link
                href="/plataformas/admin/cursos"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/cursos"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaUsersCog /> Directores de Curso
              </Link>
            </div>
          </div>

          <div>
            <button
              onClick={() => toggleMenu("horario")}
              style={{
                ...btnStyle,
                backgroundColor:
                  menuAbierto === "horario"
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FaCalendarAlt
                  color={menuAbierto === "horario" ? "#38bdf8" : "white"}
                />{" "}
                Horario
              </div>
              {menuAbierto === "horario" ? (
                <FaChevronUp size={12} color="#94a3b8" />
              ) : (
                <FaChevronDown size={12} color="#94a3b8" />
              )}
            </button>

            <div
              style={{
                display: menuAbierto === "horario" ? "flex" : "none",
                flexDirection: "column",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <Link
                href="/plataformas/admin/horario"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/horario"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaCalendarAlt /> Ver Horario
              </Link>
              <Link
                href="/plataformas/admin/horario/editar"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/horario/editar"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaEdit /> Editar Horario
              </Link>
              <Link
                href="/plataformas/admin/horario/planeacion"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/horario/planeacion"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaClipboardCheck /> Planeación Semanal
              </Link>
              <Link
                href="/plataformas/admin/horario/dias-sin-clase"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/horario/dias-sin-clase"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaCalendarTimes /> Días sin Clase
              </Link>
            </div>
          </div>

          <div>
            <button
              onClick={() => toggleMenu("certificados")}
              style={{
                ...btnStyle,
                backgroundColor:
                  menuAbierto === "certificados"
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FaFileAlt
                  color={menuAbierto === "certificados" ? "#38bdf8" : "white"}
                />{" "}
                Certificados
                {solicitudesNuevas > 0 && (
                  <span className={horarioStyles.badge} title="Solicitudes nuevas">
                    {solicitudesNuevas > 99 ? "99+" : solicitudesNuevas}
                  </span>
                )}
              </div>
              {menuAbierto === "certificados" ? (
                <FaChevronUp size={12} color="#94a3b8" />
              ) : (
                <FaChevronDown size={12} color="#94a3b8" />
              )}
            </button>

            <div
              style={{
                display: menuAbierto === "certificados" ? "flex" : "none",
                flexDirection: "column",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <Link
                href="/plataformas/admin/certificados"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/certificados" ||
                    /^\/plataformas\/admin\/certificados\/\d+/.test(pathname ?? "")
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaList /> Solicitudes
              </Link>
              <Link
                href="/plataformas/admin/certificados/exalumnos"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/certificados/exalumnos"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaUserGraduate /> Exalumnos
              </Link>
              <Link
                href="/plataformas/admin/certificados/configuracion"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/certificados/configuracion"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaCog /> Configuración
              </Link>
            </div>
          </div>

          <div>
            <button
              onClick={() => toggleMenu("fin-de-anio")}
              style={{
                ...btnStyle,
                backgroundColor:
                  menuAbierto === "fin-de-anio"
                    ? "rgba(255,255,255,0.05)"
                    : "transparent",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <FaFlagCheckered
                  color={menuAbierto === "fin-de-anio" ? "#38bdf8" : "white"}
                />{" "}
                Fin de Año
              </div>
              {menuAbierto === "fin-de-anio" ? (
                <FaChevronUp size={12} color="#94a3b8" />
              ) : (
                <FaChevronDown size={12} color="#94a3b8" />
              )}
            </button>

            <div
              style={{
                display: menuAbierto === "fin-de-anio" ? "flex" : "none",
                flexDirection: "column",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <Link
                href="/plataformas/admin/fin-de-anio"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/fin-de-anio"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaClipboardCheck /> Revisión
              </Link>
              <Link
                href="/plataformas/admin/fin-de-anio/configuracion"
                style={{
                  ...linkStyle,
                  color:
                    pathname === "/plataformas/admin/fin-de-anio/configuracion"
                      ? "#38bdf8"
                      : "#cbd5e1",
                }}
              >
                <FaCog /> Configuración
              </Link>
            </div>
          </div>

          <div>
            <Link
              href="/plataformas/admin/circulares"
              style={{
                ...btnStyle,
                justifyContent: "flex-start",
                gap: "10px",
                backgroundColor: pathname?.includes("/circulares")
                  ? "rgba(56, 189, 248, 0.1)"
                  : "transparent",
                color: pathname?.includes("/circulares")
                  ? "#38bdf8"
                  : "#f8fafc",
                marginTop: "10px",
              }}
            >
              <FaBullhorn /> Gestión de Circulares
            </Link>
          </div>

          <div>
            <Link
              href="/plataformas/admin/mis-datos"
              style={{
                ...btnStyle,
                justifyContent: "flex-start",
                gap: "10px",
                backgroundColor: pathname?.includes("/mis-datos")
                  ? "rgba(56, 189, 248, 0.1)"
                  : "transparent",
                color: pathname?.includes("/mis-datos") ? "#38bdf8" : "#f8fafc",
              }}
            >
              <FaIdCard /> Mis Datos
            </Link>
          </div>
        </nav>

        <div
          style={{
            padding: "20px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            backgroundColor: "#0f172a",
          }}
        >
          <button
            onClick={cerrarSesion}
            style={{
              width: "100%",
              padding: "12px 15px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              fontSize: "1rem",
              fontWeight: "bold",
            }}
          >
            <FaSignOutAlt /> Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
