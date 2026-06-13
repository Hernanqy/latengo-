import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Search, LogOut, Save, User, RotateCcw } from "lucide-react";
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

function crearNumeros(cantidad) {
  return Array.from({ length: cantidad }, (_, index) => index + 1);
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
        texto: `Figurita ${numero} agregada.`
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
        texto: `Ingresá un número válido.`
      });
      return;
    }

    if (tieneFigurita(equipoSeleccionado.id, numero)) {
      setResultado({
        tipo: "ok",
        texto: `La tenés.`
      });
    } else {
      setResultado({
        tipo: "falta",
        texto: `Te falta.`
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
      <main className="app-shell center-shell">
        <section className="auth-card">
          <div className="brand-mark">26</div>
          <h1>Cargando...</h1>
        </section>
      </main>
    );
  }

  if (!usuario) {
    return (
      <main className="app-shell center-shell">
        <section className="auth-card">
          <div className="brand-banner">
            <div className="brand-mark">26</div>
            <div>
              <span className="eyebrow">ÁLBUM DIGITAL</span>
              <h1>Figuritas Mundial</h1>
            </div>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={modoAuth === "login" ? "active-tab" : "ghost"}
              onClick={() => {
                setModoAuth("login");
                setMensajeAuth("");
              }}
            >
              Entrar
            </button>

            <button
              type="button"
              className={modoAuth === "registro" ? "active-tab" : "ghost"}
              onClick={() => {
                setModoAuth("registro");
                setMensajeAuth("");
              }}
            >
              Crear cuenta
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
              placeholder="Mínimo 6 caracteres"
            />

            <button type="submit" className="primary-btn">
              <User size={18} />
              {modoAuth === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          {mensajeAuth && <div className="alert alert-warn">{mensajeAuth}</div>}
        </section>
      </main>
    );
  }

  if (cargandoDatos) {
    return (
      <main className="app-shell center-shell">
        <section className="auth-card">
          <div className="brand-mark">26</div>
          <h1>Cargando álbum...</h1>
        </section>
      </main>
    );
  }

  if (!estado.cargaInicialTerminada) {
    const equipo = ALBUM[equipoActual];
    const numeros = crearNumeros(equipo.cantidadFiguritas);
    const conseguidas = estado.figuritas[equipo.id]?.length || 0;

    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="eyebrow">ÁLBUM DIGITAL</span>
            <strong>Figuritas Mundial</strong>
          </div>

          <button className="ghost compact-btn" onClick={salir}>
            <LogOut size={16} />
            Salir
          </button>
        </header>

        {errorGeneral && <div className="alert alert-warn">{errorGeneral}</div>}

        <section className="card featured-card">
          <div className="section-header">
            <div>
              <span className="eyebrow">CARGA INICIAL</span>
              <h2>{equipo.nombre}</h2>
              <div className="meta-row">
                {equipo.grupo && <span className="tag">{equipo.grupo}</span>}
                <span className="tag soft">
                  {conseguidas}/{equipo.cantidadFiguritas}
                </span>
              </div>
            </div>

            <div className="step-badge">
              {equipoActual + 1}/{ALBUM.length}
            </div>
          </div>

          <div className="progress">
            <div
              className="progress-fill"
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
                className="primary-btn"
                onClick={() => setEquipoActual((actual) => actual + 1)}
              >
                Siguiente
              </button>
            ) : (
              <button
                className="primary-btn"
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
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="eyebrow">ÁLBUM DIGITAL</span>
          <strong>Figuritas Mundial</strong>
        </div>

        <button className="ghost compact-btn" onClick={salir}>
          <LogOut size={16} />
          Salir
        </button>
      </header>

      {errorGeneral && <div className="alert alert-warn">{errorGeneral}</div>}

      <section className="hero-card">
        <div>
          <span className="eyebrow">VERIFICADOR</span>
          <h1>Comprobar figurita</h1>
          <p className="hero-stat">
            {totalConseguidas} / {totalFiguritas}
          </p>
        </div>
      </section>

      <section className="card">
        <form onSubmit={verificarFigurita} className="form">
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

          <button type="submit" className="primary-btn">
            <Search size={18} />
            Verificar
          </button>
        </form>

        {resultado && (
          <div className={`alert alert-${resultado.tipo}`}>
            <div className="result-line">
              <strong>{resultado.texto}</strong>
            </div>

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
        )}
      </section>

      <section className="card">
        <div className="section-header small-gap">
          <div>
            <span className="eyebrow">RESUMEN</span>
            <h2>Mis equipos</h2>
          </div>

          <button className="ghost compact-btn" onClick={volverACargaInicial}>
            <RotateCcw size={16} />
            Editar
          </button>
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
