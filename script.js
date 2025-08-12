// =======================
// Conexión a Supabase
// =======================
// ⚠️ Cambia este valor por tu Project URL real desde Project Settings → API
const SUPABASE_URL = "https://gfyuavrtiwvxmzmvorhi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeXVhdnJ0aXd2eG16bXZvcmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDQxNjIsImV4cCI6MjA3MDU4MDE2Mn0.7frMsWy2fB1sB4rfZjsHS2zVWaeDG2Nd2X05Aj8vs3g";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =======================
// Días de la semana
// =======================
const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// =======================
// Funciones para TEAMS
// =======================
async function insertarEquipo(name, size, daysPerWeek) {
  const assignedDays = calcularDiasInicial(daysPerWeek);

  const { error } = await supabaseClient
    .from("teams")
    .insert([{ name, size, days_per_week: daysPerWeek, assigned_days: assignedDays }]);

  if (error) {
    alert("Error insertando equipo: " + error.message);
  } else {
    listarEquipos();
  }
}

async function listarEquipos() {
  const { data, error } = await supabaseClient
    .from("teams")
    .select("*")
    .order("id");

  if (error) {
    console.error("Error listando equipos:", error);
    return;
  }

  const tbody = document.getElementById("tabla-equipos");
  tbody.innerHTML = "";
  data.forEach(team => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${team.id}</td>
      <td>${team.name}</td>
      <td>${team.size}</td>
      <td>${team.days_per_week || ""}</td>
      <td>${team.assigned_days ? team.assigned_days.join(", ") : ""}</td>
      <td><button onclick="listarIntegrantes(${team.id})">Ver</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// =======================
// Rotar equipos
// =======================
async function rotarEquipos() {
  const { data: equipos, error } = await supabaseClient
    .from("teams")
    .select("*");

  if (error) {
    console.error("Error obteniendo equipos:", error);
    return;
  }

  for (const equipo of equipos) {
    if (!equipo.days_per_week) continue;

    const nuevosDias = rotarDias(equipo.assigned_days, equipo.days_per_week);

    await supabaseClient
      .from("teams")
      .update({ assigned_days: nuevosDias })
      .eq("id", equipo.id);
  }

  listarEquipos();
  alert("Rotación completada");
}

// =======================
// Funciones para MEMBERS
// =======================
async function insertarIntegrante(teamId, name) {
  const { error } = await supabaseClient
    .from("members")
    .insert([{ team_id: teamId, name }]);

  if (error) {
    alert("Error insertando integrante: " + error.message);
  } else {
    listarIntegrantes(teamId);
  }
}

async function listarIntegrantes(teamId) {
  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .eq("team_id", teamId);

  if (error) {
    console.error("Error listando integrantes:", error);
    return;
  }

  const ul = document.getElementById("ul-integrantes");
  ul.innerHTML = "";
  data.forEach(member => {
    const li = document.createElement("li");
    li.textContent = member.name;
    ul.appendChild(li);
  });
}

// =======================
// Lógica de asignación y rotación (solo si es 2 o 3 días/semana)
// =======================
function calcularDiasInicial(daysPerWeek) {
  if (daysPerWeek < 2 || daysPerWeek > 3) {
    return []; // No asigna días si no es 2 o 3
  }
  return WEEK_DAYS.slice(0, daysPerWeek);
}

function rotarDias(diasActuales, daysPerWeek) {
  if (daysPerWeek < 2 || daysPerWeek > 3) {
    return diasActuales; // No rota si no es 2 o 3
  }

  if (!diasActuales || diasActuales.length === 0) {
    return calcularDiasInicial(daysPerWeek);
  }

  let startIndex = WEEK_DAYS.indexOf(diasActuales[0]);
  let newStartIndex = (startIndex + 1) % WEEK_DAYS.length;

  let nuevosDias = [];
  for (let i = 0; i < daysPerWeek; i++) {
    nuevosDias.push(WEEK_DAYS[(newStartIndex + i) % WEEK_DAYS.length]);
  }
  return nuevosDias;
}

// =======================
// Eventos
// =======================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-agregar-equipo").addEventListener("click", () => {
    const nombre = document.getElementById("equipo-nombre").value.trim();
    const tamano = parseInt(document.getElementById("equipo-tamano").value);
    const diasSemana = parseInt(document.getElementById("equipo-dias").value);

    if (!nombre || !tamano || !diasSemana) {
      alert("Completa nombre, tamaño y días por semana");
      return;
    }

    insertarEquipo(nombre, tamano, diasSemana);
  });

  document.getElementById("btn-agregar-integrante").addEventListener("click", () => {
    const teamId = parseInt(document.getElementById("integrante-team-id").value);
    const nombre = document.getElementById("integrante-nombre").value.trim();

    if (!teamId || !nombre) {
      alert("Completa ID y nombre");
      return;
    }

    insertarIntegrante(teamId, nombre);
  });

  document.getElementById("btn-rotar-equipos").addEventListener("click", rotarEquipos);

  listarEquipos();
});

// =======================
// Funciones globales para el HTML
// =======================
window.insertarEquipo = insertarEquipo;
window.insertarIntegrante = insertarIntegrante;
window.listarIntegrantes = listarIntegrantes;
window.rotarEquipos = rotarEquipos;
