import { supabase } from "./supabase";

export function crearEstadoInicial() {
  return {
    cargaInicialTerminada: false,
    figuritas: {}
  };
}

function convertirFilasAEstado(settings, figuritas) {
  const estado = crearEstadoInicial();

  estado.cargaInicialTerminada = Boolean(settings?.initial_load_done);

  for (const fila of figuritas || []) {
    if (!estado.figuritas[fila.team_id]) {
      estado.figuritas[fila.team_id] = [];
    }

    estado.figuritas[fila.team_id].push(fila.sticker_number);
  }

  for (const equipoId of Object.keys(estado.figuritas)) {
    estado.figuritas[equipoId].sort((a, b) => a - b);
  }

  return estado;
}

export async function cargarEstadoRemoto(userId) {
  const { data: settings, error: settingsError } = await supabase
    .from("album_user_settings")
    .select("initial_load_done")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsError) throw settingsError;

  const { data: figuritas, error: figuritasError } = await supabase
    .from("album_stickers")
    .select("team_id, sticker_number")
    .eq("user_id", userId);

  if (figuritasError) throw figuritasError;

  return convertirFilasAEstado(settings, figuritas);
}

export async function guardarCargaInicial(userId, terminada) {
  const { error } = await supabase
    .from("album_user_settings")
    .upsert(
      {
        user_id: userId,
        initial_load_done: terminada,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id"
      }
    );

  if (error) throw error;
}

export async function agregarFigurita(userId, equipoId, numero) {
  const { error } = await supabase
    .from("album_stickers")
    .upsert(
      {
        user_id: userId,
        team_id: equipoId,
        sticker_number: Number(numero)
      },
      {
        onConflict: "user_id,team_id,sticker_number"
      }
    );

  if (error) throw error;
}

export async function borrarFigurita(userId, equipoId, numero) {
  const { error } = await supabase
    .from("album_stickers")
    .delete()
    .eq("user_id", userId)
    .eq("team_id", equipoId)
    .eq("sticker_number", Number(numero));

  if (error) throw error;
}
