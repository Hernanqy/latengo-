export function crearEstadoInicial() {
  return {
    cargaInicialTerminada: false,
    figuritas: {}
  };
}

function normalizarUsuario(usuario) {
  return usuario
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function obtenerClave(usuario) {
  return `album-figuritas-${normalizarUsuario(usuario)}`;
}

export function guardarUsuarioActivo(usuario) {
  localStorage.setItem("album-usuario-activo", usuario);
}

export function obtenerUsuarioActivo() {
  return localStorage.getItem("album-usuario-activo") || "";
}

export function cerrarSesion() {
  localStorage.removeItem("album-usuario-activo");
}

export function cargarEstado(usuario) {
  const clave = obtenerClave(usuario);
  const guardado = localStorage.getItem(clave);

  if (!guardado) {
    return crearEstadoInicial();
  }

  try {
    return JSON.parse(guardado);
  } catch {
    return crearEstadoInicial();
  }
}

export function guardarEstado(usuario, estado) {
  const clave = obtenerClave(usuario);
  localStorage.setItem(clave, JSON.stringify(estado));
}
