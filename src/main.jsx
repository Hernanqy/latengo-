import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  Search,
  LogOut,
  Save,
  User,
  RotateCcw,
  CheckCircle2,
  ListChecks,
  XCircle,
  Trophy,
  MapPinned,
  ClipboardCheck,
  CircleHelp,
  Gamepad2,
  Radio,
  MonitorSpeaker
} from "lucide-react";
import { ALBUM } from "./data/album";
import { supabase } from "./lib/supabase";
import {
  agregarFigurita,
  borrarFigurita,
  cargarEstadoRemoto,
  crearEstadoInicial,
  guardarCargaInicial
} from "./lib/database";
import "./styles.css";

const FIGURITAS_POR_PAGINA = 20;

function crearNumeros(cantidad) {
  return Array.from({ length: cantidad }, (_, index) => index + 1);
}

function calcularPaginaEstimada(equipoId, numero) {
  const indiceEquipo = ALBUM.findIndex((equipo) => equipo.id === equipoId);

  if (indiceEquipo < 0 || !numero) return null;

  const figuritasPrevias = ALBUM.slice(0, indiceEquipo).reduce(
    (total, equipo) => total + equipo.cantidadFiguritas,
    0
  );

  const posicionGlobal = figuritasPrevias + Number(numero);

  return Math.ceil(posicionGlobal / FIGURITAS_POR_PAGINA);
}

function GuiaUso() {
  const pasos = [
    {
      icono: <Gamepad2 size={18} />,
      titulo: "Cargá",
      texto: "Marcá solo las que ya tenés."
    },
    {
      icono: <MonitorSpeaker size={18} />,
      titulo: "Consultá",
      texto: "Elegí equipo y número."
    },
    {
      icono: <Radio size={18} />,
      titulo: "Resolvé",
      texto: "La app te dice si la tenés o te falta."
    }
  ];

  return (
    <section className="guide-strip">
      {pasos.map((paso, index) => (
        <div className="guide-pill" key={index}>
          <div className="guide-icon">{paso.icono}</div>
          <div>
            <strong>{paso.titulo}</strong>
            <small>{paso.texto}</small>
          </div>
        </div>
      ))}
    </section>
  );
}

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [modoAuth, setModoAuth] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mensajeAuth, setMensajeAuth] = useState("");
  const [errorGeneral, setErrorGeneral] = useState("");

  const [estado, setEstado] = useState(crearEstadoInicial());
  const [equipoActual, setEquipoActual] = useState(0);
  const [equipoConsulta, setEquipoConsulta] = useState(ALBUM[0].id);
  const [numeroConsulta, setNumeroConsulta] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null);
      setCargandoSesion(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUsuario(session?.user || null);
        setResultado(null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function cargarDatos() {
      if (!usuario) {
        setEstado(crearEstadoInicial());
        return;
      }

      setCargandoDatos(true);
      setErrorGeneral("");

      try {
        const estadoRemoto = await cargarEstadoRemoto(usuario.id);
        setEstado(estadoRemoto);
      } catch (error) {
        setErrorGeneral("No se pudieron cargar los datos.");
        console.error(error);
      } finally {
        setCargandoDatos(false);
      }
    }

    cargarDatos();
  }, [usuario]);

  const equipoSeleccionado = useMemo(() => {
    return ALBUM.find((equipo) => equipo.id === equipoConsulta) || ALBUM[0];
  }, [equipoConsulta]);

  const totalFiguritas = ALBUM.reduce(
    (total, equipo) => total + equipo.cantidadFiguritas,
    0
  );

  const totalConseguidas = ALBUM.reduce((total, equipo) => {
    const lista = estado.figuritas[equipo.id] || [];
    return total + lista.length;
  }, 0);

  const porcentajeGeneral = Math.round((totalConseguidas / totalFiguritas) * 100);

  const estadoVerificador = !resultado
    ? { clase: "idle", texto: "Listo para verificar" }
    : resultado.tipo === "ok"
    ? { clase: "ok", texto: "Figurita encontrada" }
    : resultado.tipo === "falta"
    ? { clase: "falta", texto: "Falta en tu colección" }
    : { clase: "error", texto: "Revisá los datos" };

  async function enviarAuth(evento) {
    evento.preventDefault();

    setMensajeAuth("");
    setErrorGeneral("");

    if (!email.trim() || !password.trim()) {
      setMensajeAuth("Completá email y contraseña.");
      return;
    }

    if (password.length < 6) {
      setMensajeAuth("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      if (modoAuth === "registro") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });

        if (error) throw error;

        if (data.session) {
          setMensajeAuth("Cuenta creada correctamente.");
        } else {
          setMensajeAuth("Cuenta creada. Revisá tu email.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;
      }
    } catch (error) {
      setMensajeAuth(error.message || "No se pudo completar el ingreso.");
    }
  }

  async function salir() {
    await supabase.auth.signOut();
    setUsuario(null);
    setEstado(crearEstadoInicial());
    setResultado(null);
  }

  function tieneFigurita(equipoId, numero) {
    const lista = estado.figuritas[equipoId] || [];
    return lista.includes(Number(numero));
  }

  function actualizarEstadoLocal(equipoId, numero, accion) {
    setEstado((estadoAnterior) => {
      const listaActual = estadoAnterior.figuritas[equipoId] || [];
      const numeroFinal = Number(numero);

      let nuevaLista = listaActual;

      if (accion === "agregar" && !listaActual.includes(numeroFinal)) {
        nuevaLista = [...listaActual, numeroFinal].sort((a, b) => a - b);
      }

      if (accion === "borrar") {
        nuevaLista = listaActual.filter((item) => item !== numeroFinal);
      }

      return {
        ...estadoAnterior,
        figuritas: {
          ...estadoAnterior.figuritas,
          [equipoId]: nuevaLista
        }
      };
    });
  }

  async function alternarFigurita(equipoId, numero) {
    if (!usuario || guardando) return;

    setGuardando(true);
    setErrorGeneral("");

    try {
      if (tieneFigurita(equipoId, numero)) {
        await borrarFigurita(usuario.id, equipoId, numero);
        actualizarEstadoLocal(equipoId, numero, "borrar");
      } else {
        await agregarFigurita(usuario.id, equipoId, numero);
        actualizarEstadoLocal(equipoId, numero, "agregar");
      }
    } catch (error) {
      setErrorGeneral("No se pudo guardar el cambio.");
      console.error(error);
    } finally {
      setGuardando(false);
    }
  }

  async function marcarComoConseguida(equipoId, numero) {
    if (!usuario || !numero) return;

    setGuardando(true);
    setErrorGeneral("");

    try {
      await agregarFigurita(usuario.id, equipoId, numero);
      actualizarEstadoLocal(equipoId, numero, "agregar");

      setResultado({
        tipo: "ok",
        texto: "Ahora la tenés.",
        equipo: equipoSeleccionado.nombre,
        numero: Number(numero),
        pagina: calcularPaginaEstimada(equipoId, numero)
      });
    } catch (error) {
      setErrorGeneral("No se pudo guardar.");
      console.error(error);
    } finally {
      setGuardando(false);
    }
  }

  function verificarFigurita(evento) {
    evento.preventDefault();

    const numero = Number(numeroConsulta);

    if (!numero || numero < 1 || numero > equipoSeleccionado.cantidadFiguritas) {
      setResultado({
        tipo: "error",
        texto: "Ingresá un número válido.",
        equipo: equipoSeleccionado.nombre,
        numero: null,
        pagina: null
      });
      return;
    }

    const pagina = calcularPaginaEstimada(equipoSeleccionado.id, numero);

    if (tieneFigurita(equipoSeleccionado.id, numero)) {
      setResultado({
        tipo: "ok",
        texto: "La tenés.",
        equipo: equipoSeleccionado.nombre,
        numero,
        pagina
      });
    } else {
      setResultado({
        tipo: "falta",
        texto: "Te falta.",
        equipo: equipoSeleccionado.nombre,
        numero,
        pagina
      });
    }
  }

  async function terminarCargaInicial() {
    if (!usuario) return;

    setGuardando(true);
    setErrorGeneral("");

    try {
      await guardarCargaInicial(usuario.id, true);

      setEstado((estadoAnterior) => ({
        ...estadoAnterior,
        cargaInicialTerminada: true
      }));
    } catch (error) {
      setErrorGeneral("No se pudo guardar.");
      console.error(error);
    } finally {
      setGuardando(false);
    }
  }

  async function volverACargaInicial() {
    if (!usuario) return;

    setGuardando(true);
    setErrorGeneral("");

    try {
      await guardarCargaInicial(usuario.id, false);

      setEstado((estadoAnterior) => ({
        ...estadoAnterior,
        cargaInicialTerminada: false
      }));
    } catch (error) {
      setErrorGeneral("No se pudo volver a editar.");
      console.error(error);
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoSesion) {
    return (
      <main className="app-shell center-shell screen-auth">
        <section className="auth-card stadium-card">
          <div className="brand-emblem">
            <Trophy size={34} />
          </div>
          <h1>¿La tengo?</h1>
          <p>Preparando tu colección...</p>
        </section>
      </main>
    );
  }

  if (!usuario) {
    return (
      <main className="app-shell center-shell screen-auth">
        <section className="auth-card stadium-card">
          <div className="brand-banner">
            <div className="brand-emblem">
              <Trophy size={34} />
            </div>

            <div>
              <span className="eyebrow">MUNDIAL 2026</span>
              <h1>¿La tengo?</h1>
              <p className="intro-text">
                Controlá qué figuritas tenés y cuáles te faltan.
              </p>
            </div>
          </div>

          <GuiaUso />

          <div className="auth-tabs">
            <button
              type="button"
              className={modoAuth === "login" ? "active-tab" : "ghost"}
              onClick={() => {
                setModoAuth("login");
                setMensajeAuth("");
              }}
            >
              Ingresar
            </button>

            <button
              type="button"
              className={modoAuth === "registro" ? "active-tab" : "ghost"}
              onClick={() => {
                setModoAuth("registro");
                setMensajeAuth("");
              }}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={enviarAuth} className="form">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              placeholder="tuemail@ejemplo.com"
            />

            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              placeholder="Elegí una contraseña"
            />

            <button type="submit" className="primary-btn">
              <User size={18} />
              Continuar
            </button>
          </form>

          {mensajeAuth && <div className="alert alert-warn">{mensajeAuth}</div>}
        </section>
      </main>
    );
  }

  if (cargandoDatos) {
    return (
      <main className="app-shell center-shell screen-auth">
        <section className="auth-card stadium-card">
          <div className="brand-emblem">
            <Trophy size={34} />
          </div>
          <h1>¿La tengo?</h1>
          <p>Cargando tus figuritas...</p>
        </section>
      </main>
    );
  }

  if (!estado.cargaInicialTerminada) {
    const equipo = ALBUM[equipoActual];
    const numeros = crearNumeros(equipo.cantidadFiguritas);
    const conseguidas = estado.figuritas[equipo.id]?.length || 0;
    const porcentajeEquipo = Math.round((conseguidas / equipo.cantidadFiguritas) * 100);

    return (
      <main className="app-shell screen-edit">
        <header className="app-header">
          <div>
            <span className="eyebrow">MODO CARGA</span>
            <h1>Marcá las que tenés</h1>
            <p>Esta zona es para editar tu colección.</p>
          </div>

          <button className="ghost compact-btn" onClick={salir}>
            <LogOut size={16} />
            Salir
          </button>
        </header>

        {errorGeneral && <div className="alert alert-warn">{errorGeneral}</div>}

        <section className="mode-panel edit-panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">SELECCIÓN</span>
              <h2>{equipo.nombre}</h2>
              <div className="meta-row">
                {equipo.grupo && <span className="tag">{equipo.grupo}</span>}
                <span className="tag soft">
                  {conseguidas}/{equipo.cantidadFiguritas}
                </span>
              </div>
            </div>

            <div className="circle-progress">
              <strong>{porcentajeEquipo}%</strong>
              <small>{equipoActual + 1}/{ALBUM.length}</small>
            </div>
          </div>

          <div className="progress">
            <div
              className="progress-fill edit-fill"
              style={{
                width: `${((equipoActual + 1) / ALBUM.length) * 100}%`
              }}
            />
          </div>

          <div className="grid stickers-grid">
            {numeros.map((numero) => {
              const activa = tieneFigurita(equipo.id, numero);

              return (
                <button
                  key={numero}
                  disabled={guardando}
                  className={activa ? "sticker active" : "sticker"}
                  onClick={() => alternarFigurita(equipo.id, numero)}
                >
                  <span>{numero}</span>
                  {activa && <Check size={16} />}
                </button>
              );
            })}
          </div>

          <div className="actions">
            <button
              className="ghost"
              disabled={equipoActual === 0}
              onClick={() => setEquipoActual((actual) => actual - 1)}
            >
              Anterior
            </button>

            {equipoActual < ALBUM.length - 1 ? (
              <button
                className="primary-btn edit-btn"
                onClick={() => setEquipoActual((actual) => actual + 1)}
              >
                Siguiente
              </button>
            ) : (
              <button
                className="primary-btn edit-btn"
                onClick={terminarCargaInicial}
                disabled={guardando}
              >
                <Save size={18} />
                Finalizar
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell screen-check">
      <header className="app-header">
        <div>
          <span className="eyebrow">MODO CONSULTA</span>
          <h1>¿La tengo?</h1>
          <p>Buscá una figurita y resolvelo al instante.</p>
        </div>

        <button className="ghost compact-btn" onClick={salir}>
          <LogOut size={16} />
          Salir
        </button>
      </header>

      {errorGeneral && <div className="alert alert-warn">{errorGeneral}</div>}

      <section className="score-hero">
        <div>
          <span className="eyebrow">MI COLECCIÓN</span>
          <h2>{porcentajeGeneral}% completa</h2>
          <p>
            {totalConseguidas} de {totalFiguritas} figuritas cargadas.
          </p>
        </div>

        <div className="hero-ball">
          <Trophy size={44} />
        </div>
      </section>

      <GuiaUso />

      <section className="mode-panel check-panel verifier-panel">
        <div className="verifier-topbar">
          <div>
            <span className="eyebrow verifier-eyebrow">VERIFICADOR</span>
            <h2>Consultá una figurita</h2>
            <p className="verifier-subtext">
              Elegí equipo y número. La respuesta aparece al instante.
            </p>
          </div>

          <button className="ghost compact-btn" onClick={volverACargaInicial}>
            <RotateCcw size={16} />
            Editar
          </button>
        </div>

        <div className="verifier-status">
          <span className={`status-dot status-${estadoVerificador.clase}`}></span>
          <span>{estadoVerificador.texto}</span>
        </div>

        <div className="verifier-card">
          <form onSubmit={verificarFigurita} className="form verifier-form">
            <label>Equipo</label>
            <select
              value={equipoConsulta}
              onChange={(evento) => {
                setEquipoConsulta(evento.target.value);
                setResultado(null);
              }}
            >
              {ALBUM.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </select>

            <label>Número</label>
            <input
              type="number"
              min="1"
              max={equipoSeleccionado.cantidadFiguritas}
              value={numeroConsulta}
              onChange={(evento) => {
                setNumeroConsulta(evento.target.value);
                setResultado(null);
              }}
              placeholder={`1 a ${equipoSeleccionado.cantidadFiguritas}`}
            />

            <button type="submit" className="primary-btn check-btn verify-btn">
              <Search size={18} />
              Verificar ahora
            </button>
          </form>
        </div>

        {resultado && (
          <div className={`result-card result-${resultado.tipo} verifier-result`}>
            <div className="result-icon">
              {resultado.tipo === "ok" && <CheckCircle2 size={42} />}
              {resultado.tipo === "falta" && <XCircle size={42} />}
              {resultado.tipo === "error" && <CircleHelp size={42} />}
            </div>

            <div className="result-content">
              <span>
                {resultado.equipo}
                {resultado.numero ? ` · Nº ${resultado.numero}` : ""}
              </span>

              <strong>{resultado.texto}</strong>

              {resultado.pagina && (
                <div className="page-chip">
                  <MapPinned size={16} />
                  Página estimada para pegarla: <b>{resultado.pagina}</b>
                </div>
              )}

              {resultado.tipo === "falta" && (
                <button
                  className="primary-btn inline-btn"
                  disabled={guardando}
                  onClick={() =>
                    marcarComoConseguida(equipoSeleccionado.id, numeroConsulta)
                  }
                >
                  Marcar como conseguida
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mode-panel summary-panel">
        <div className="section-header small-gap">
          <div>
            <span className="eyebrow">RESUMEN</span>
            <h2>Mis equipos</h2>
          </div>
        </div>

        <div className="team-list">
          {ALBUM.map((equipo) => {
            const cantidad = estado.figuritas[equipo.id]?.length || 0;

            return (
              <div className="team-row" key={equipo.id}>
                <div className="team-row-info">
                  <span>{equipo.nombre}</span>
                  {equipo.grupo && <small>{equipo.grupo}</small>}
                </div>
                <strong>
                  {cantidad}/{equipo.cantidadFiguritas}
                </strong>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
