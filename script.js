// =======================
// Conexión a Supabase
// =======================
const SUPABASE_URL = "https://gfyuavrtiwvxmzmvorhi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeXVhdnJ0aXd2eG16bXZvcmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDQxNjIsImV4cCI6MjA3MDU4MDE2Mn0.7frMsWy2fB1sB4rfZjsHS2zVWaeDG2Nd2X05Aj8vs3g";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =======================
// Días de la semana y constantes
// =======================
const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_NAMES = {
  Lunes: 'monday',
  Martes: 'tuesday',
  Miércoles: 'wednesday',
  Jueves: 'thursday',
  Viernes: 'friday'
};
let dailyCapacity = 52;
const NOTIFICATION_DURATION = 3000;

// =======================
// Sistema de notificaciones
// =======================
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  if (!notification) {
    // If notification element doesn't exist, create a temporary alert
    alert(message);
    return;
  }

  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, NOTIFICATION_DURATION);
}

// =======================
// Funciones de carga inicial
// =======================
document.addEventListener("DOMContentLoaded", init);

async function init() {
  updateCurrentDate();
  const dailyCapacityInput = document.getElementById('dailyCapacityInput');
  if(dailyCapacityInput) {
    dailyCapacityInput.value = dailyCapacity;
    dailyCapacityInput.addEventListener('change', function(e) {
      updateDailyCapacity(e.target.value);
    });
  }
  
  await loadData();
  
  const equipoForm = document.getElementById('equipoForm');
  if (equipoForm) {
    equipoForm.addEventListener('submit', function(e) {
      e.preventDefault();
      addTeam();
    });
  }

  const reorganizeButton = document.getElementById('btn-reorganize');
  if (reorganizeButton) {
    reorganizeButton.addEventListener('click', redistributeTeams);
  }
}

async function loadData() {
  await listarEquiposEnCalendario();
  await renderTeamsList();
  await updateStats();
}

// =======================
// Funciones para TEAMS
// =======================
async function listarEquiposEnCalendario() {
  const { data: equipos, error } = await supabaseClient
    .from("teams")
    .select("*")
    .order("id");

  if (error) {
    console.error("Error listando equipos:", error);
    showNotification("Error cargando equipos: " + error.message, 'danger');
    return;
  }
  
  const scheduleContainer = document.getElementById("weekSchedule");
  if (!scheduleContainer) return;
  scheduleContainer.innerHTML = "";
  let dailyCounts = {};

  WEEK_DAYS.forEach(day => {
    dailyCounts[day] = 0;
    const dayColumn = document.createElement("div");
    dayColumn.classList.add("day-column");
    dayColumn.innerHTML = `
      <div class="day-header">${day}</div>
      <div class="day-content" id="day-content-${DAY_NAMES[day]}"></div>
      <div class="day-counter" id="day-counter-${DAY_NAMES[day]}"></div>
    `;
    scheduleContainer.appendChild(dayColumn);
  });

  equipos.forEach(team => {
    if (team.assigned_days) {
      team.assigned_days.forEach(day => {
        const dayKey = DAY_NAMES[day];
        if (document.getElementById(`day-content-${dayKey}`)) {
          const teamCard = document.createElement("div");
          teamCard.classList.add("team-in-day");
          teamCard.textContent = `${team.name} (${team.size})`;
          document.getElementById(`day-content-${dayKey}`).appendChild(teamCard);
          dailyCounts[day] += team.size;
        }
      });
    }
  });

  WEEK_DAYS.forEach(day => {
    const dayKey = DAY_NAMES[day];
    const count = dailyCounts[day] || 0;
    const percentage = ((count / dailyCapacity) * 100).toFixed(0);
    const counterElement = document.getElementById(`day-counter-${dayKey}`);
    if (counterElement) {
        counterElement.textContent = `${count}/${dailyCapacity} (${percentage}%)`;

        counterElement.classList.remove("success", "warning", "danger");
        if (count > dailyCapacity) {
            counterElement.classList.add("danger");
        } else if (count >= dailyCapacity * 0.8) {
            counterElement.classList.add("warning");
        } else {
            counterElement.classList.add("success");
        }
    }
  });
  return equipos;
}

async function addTeam() {
  const name = document.getElementById('teamName').value.trim();
  const size = parseInt(document.getElementById('teamSize').value);
  const daysPerWeek = Math.random() < 0.5 ? 2 : 3;
  const assignedDays = calcularDiasInicial(daysPerWeek);

  if (!name || size <= 0 || size > dailyCapacity) {
    alert('⚠️ Verifica el nombre y el tamaño del equipo.');
    return;
  }

  const { error } = await supabaseClient
    .from("teams")
    .insert([{ name, size, days_per_week: daysPerWeek, assigned_days: assignedDays }]);

  if (error) {
    alert("Error insertando equipo: " + error.message);
  } else {
    document.getElementById('equipoForm').reset();
    showNotification('✅ Equipo agregado exitosamente', 'success');
    loadData();
  }
}

async function deleteTeam(id) {
  if (confirm('¿Eliminar este equipo?')) {
    const { error } = await supabaseClient
      .from("teams")
      .delete()
      .eq("id", id);
    if (error) {
      showNotification('Error eliminando equipo: ' + error.message, 'danger');
    } else {
      showNotification('🗑️ Equipo eliminado', 'info');
      loadData();
    }
  }
}

function editTeam(id) {
  document.querySelector(`#edit-form-${id}`).classList.toggle('active');
  document.querySelector(`#team-card-${id}`).classList.toggle('editing');
}

async function saveTeamEdit(id) {
  const newName = document.getElementById(`edit-name-${id}`).value.trim();
  const newSize = parseInt(document.getElementById(`edit-size-${id}`).value);
  const newDays = parseInt(document.getElementById(`edit-days-${id}`).value);

  if (!newName || newSize <= 0 || newSize > dailyCapacity || newDays < 1 || newDays > 5) {
    alert('⚠️ Datos inválidos');
    return;
  }

  const { error } = await supabaseClient
    .from("teams")
    .update({ name: newName, size: newSize, days_per_week: newDays })
    .eq("id", id);

  if (error) {
    showNotification('Error actualizando equipo: ' + error.message, 'danger');
  } else {
    showNotification('✏️ Equipo actualizado', 'success');
    loadData();
  }
}

// =======================
// Funciones de utilidad
// =======================
function updateCurrentDate() {
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = today.toLocaleDateString('es-ES', options);
}

function updateDailyCapacity(value) {
  dailyCapacity = parseInt(value) || 52;
  loadData();
}

async function updateStats() {
  const { data: equipos, error } = await supabaseClient
    .from("teams")
    .select("size, assigned_days");
  
  if (error) return;

  const totalTeams = equipos.length;
  const totalPeople = equipos.reduce((sum, t) => sum + t.size, 0);

  document.getElementById('totalTeams').textContent = totalTeams;
  document.getElementById('totalPeople').textContent = totalPeople;
  document.getElementById('dailyCapacity').textContent = dailyCapacity;

  const today = new Date();
  const dayIndex = today.getDay(); // Domingo es 0, Lunes es 1
  const dayName = (dayIndex > 0 && dayIndex < 6) ? WEEK_DAYS[dayIndex - 1] : null;

  let todayOccupancy = 0;
  if (dayName) {
    for(const equipo of equipos) {
      if (equipo.assigned_days && equipo.assigned_days.includes(dayName)) {
        todayOccupancy += equipo.size;
      }
    }
  }
  document.getElementById('todayOccupancy').textContent = todayOccupancy;
}

async function renderTeamsList() {
  const { data: teams, error } = await supabaseClient
    .from("teams")
    .select("*");

  if (error) return;
  
  const container = document.getElementById('teamsList');
  if (!container) return;
  container.innerHTML = teams.length === 0
    ? '<p style="text-align:center;">📝 No hay equipos registrados</p>'
    : teams.map(team => `
      <div class="team-card" id="team-card-${team.id}">
        <div class="team-header">
          <div class="team-info">
            <div class="team-name">👥 ${team.name}</div>
            <div class="team-details">
              ${team.size} personas • ${team.days_per_week} días<br>
              📅 ${team.assigned_days ? team.assigned_days.join(', ') : 'Sin asignar'}
              <br>
            </div>
          </div>
          <div class="team-actions">
            <button class="btn btn-edit" onclick="event.stopPropagation(); editTeam(${team.id});">✏️ Editar</button>
            <button class="btn btn-delete" onclick="event.stopPropagation(); deleteTeam(${team.id});">🗑️ Eliminar</button>
          </div>
        </div>
        <div class="edit-form" id="edit-form-${team.id}" onclick="event.stopPropagation();">
          <input type="text" id="edit-name-${team.id}" value="${team.name}" class="inline-input">
          <input type="number" id="edit-size-${team.id}" value="${team.size}" min="1" max="${dailyCapacity}" class="inline-input">
          <input type="number" id="edit-days-${team.id}" value="${team.days_per_week}" min="1" max="5" class="inline-input">
          <button class="btn btn-save" onclick="saveTeamEdit(${team.id})">💾 Guardar</button>
        </div>
      </div>
    `).join('');
}


// =======================
// Lógica de rotación
// =======================
async function redistributeTeams() {
  try {
    const { data: equipos, error } = await supabaseClient
      .from("teams")
      .select("*");

    if (error) {
      console.error("Error obteniendo equipos:", error);
      showNotification("Error obteniendo equipos: " + error.message, 'danger');
      return;
    }

    if (equipos.length === 0) {
      showNotification("No hay equipos para reorganizar", 'info');
      return;
    }

    const nuevasAsignaciones = {};
    for (const equipo of equipos) {
      if (!equipo.days_per_week) continue;
      nuevasAsignaciones[equipo.id] = rotarDias(equipo.assigned_days, equipo.days_per_week);
    }
    
    // Se elimina la validación para permitir la rotación sin importar el límite
    // const validacionExitosa = validarRotacion(equipos, nuevasAsignaciones);
    // if (!validacionExitosa) {
    //   showNotification("¡Error! La reorganización excedería el límite diario de personas.", 'danger');
    //   return;
    // }

    let equiposActualizados = 0;
    for (const equipo of equipos) {
      if (nuevasAsignaciones[equipo.id]) {
        await supabaseClient
          .from("teams")
          .update({ assigned_days: nuevasAsignaciones[equipo.id] })
          .eq("id", equipo.id);
        
        equiposActualizados++;
      }
    }
    
    await loadData();
    showNotification(`Reorganización completada: ${equiposActualizados} equipos actualizados`);
  } catch (error) {
    showNotification("Error durante la reorganización: " + error.message, 'danger');
  }
}

function validarRotacion(equipos, nuevasAsignaciones) {
  let dailyCounts = {};
  WEEK_DAYS.forEach(day => dailyCounts[day] = 0);

  for (const equipo of equipos) {
    const asignacionFinal = nuevasAsignaciones[equipo.id] || equipo.assigned_days;
    if (asignacionFinal) {
      asignacionFinal.forEach(day => {
        dailyCounts[day] += equipo.size;
      });
    }
  }

  for (const day in dailyCounts) {
    if (dailyCounts[day] > dailyCapacity) {
      return false;
    }
  }
  return true;
}

function calcularDiasInicial(daysPerWeek) {
  if (daysPerWeek < 1 || daysPerWeek > 5) {
    return [];
  }
  return WEEK_DAYS.slice(0, daysPerWeek);
}

function rotarDias(diasActuales, daysPerWeek) {
  if (daysPerWeek < 1 || daysPerWeek > 5 || !diasActuales || diasActuales.length === 0) {
    return diasActuales;
  }
  
  const allDays = WEEK_DAYS;
  let newDays = [];

  const firstDayIndex = allDays.indexOf(diasActuales[0]);
  if (firstDayIndex === -1) {
    return diasActuales;
  }

  const newStartIndex = (firstDayIndex + 1) % allDays.length;

  for (let i = 0; i < daysPerWeek; i++) {
    newDays.push(allDays[(newStartIndex + i) % allDays.length]);
  }

  return newDays;
}