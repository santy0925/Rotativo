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
  if (dailyCapacityInput) {
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
  const dateElement = document.getElementById('currentDate');
  if(dateElement) dateElement.textContent = today.toLocaleDateString('es-ES', options);
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

  const totalTeamsElement = document.getElementById('totalTeams');
  if(totalTeamsElement) totalTeamsElement.textContent = totalTeams;
  
  const totalPeopleElement = document.getElementById('totalPeople');
  if(totalPeopleElement) totalPeopleElement.textContent = totalPeople;
  
  const dailyCapacityElement = document.getElementById('dailyCapacity');
  if(dailyCapacityElement) dailyCapacityElement.textContent = dailyCapacity;

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
  const todayOccupancyElement = document.getElementById('todayOccupancy');
  if(todayOccupancyElement) todayOccupancyElement.textContent = todayOccupancy;
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
// LÓGICA DE ROTACIÓN CORREGIDA
// =======================

// Función para calcular días iniciales para un equipo nuevo
function calcularDiasInicial(daysPerWeek) {
  const shuffledDays = [...WEEK_DAYS].sort(() => 0.5 - Math.random());
  return shuffledDays.slice(0, daysPerWeek);
}

// Función principal de redistribución con validación de capacidad
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

    // Asignar nuevos días per week aleatorios (2 o 3)
    equipos.forEach(equipo => {
      equipo.days_per_week = Math.random() < 0.5 ? 2 : 3;
    });

    // Algoritmo de redistribución inteligente
    const nuevaAsignacion = distribuirEquiposConCapacidad(equipos);
    
    if (nuevaAsignacion === null) {
      showNotification("No se pudo realizar la redistribución respetando la capacidad diaria", 'warning');
      return;
    }

    // Actualizar en la base de datos
    let equiposActualizados = 0;
    for (const equipo of equipos) {
      if (nuevaAsignacion[equipo.id]) {
        const { error: updateError } = await supabaseClient
          .from("teams")
          .update({ 
            assigned_days: nuevaAsignacion[equipo.id],
            days_per_week: equipo.days_per_week
          })
          .eq("id", equipo.id);
        
        if (!updateError) {
          equiposActualizados++;
        }
      }
    }
    
    await loadData();
    showNotification(`Reorganización completada: ${equiposActualizados} equipos redistribuidos`, 'success');
    
  } catch (error) {
    console.error("Error durante la reorganización:", error);
    showNotification("Error durante la reorganización: " + error.message, 'danger');
  }
}

// Algoritmo de distribución que respeta la capacidad diaria
function distribuirEquiposConCapacidad(equipos) {
  const maxIntentos = 100;
  let mejorAsignacion = null;
  let menorExceso = Infinity;

  // Intentar múltiples combinaciones para encontrar la mejor distribución
  for (let intento = 0; intento < maxIntentos; intento++) {
    const asignacion = {};
    const ocupacionDiaria = {
      "Lunes": 0,
      "Martes": 0,
      "Miércoles": 0,
      "Jueves": 0,
      "Viernes": 0
    };

    // Ordenar equipos aleatoriamente para cada intento
    const equiposAleatorios = [...equipos].sort(() => 0.5 - Math.random());

    let asignacionExitosa = true;

    // Asignar cada equipo
    for (const equipo of equiposAleatorios) {
      const diasPosibles = encontrarMejoresDias(ocupacionDiaria, equipo.size, equipo.days_per_week);
      
      if (diasPosibles.length >= equipo.days_per_week) {
        // Tomar los mejores días disponibles
        const diasAsignados = diasPosibles.slice(0, equipo.days_per_week);
        asignacion[equipo.id] = diasAsignados;
        
        // Actualizar ocupación
        diasAsignados.forEach(dia => {
          ocupacionDiaria[dia] += equipo.size;
        });
      } else {
        asignacionExitosa = false;
        break;
      }
    }

    if (asignacionExitosa) {
      // Calcular exceso total
      const excesoTotal = Object.values(ocupacionDiaria).reduce((sum, ocupacion) => {
        return sum + Math.max(0, ocupacion - dailyCapacity);
      }, 0);

      // Si no hay exceso, esta es la asignación perfecta
      if (excesoTotal === 0) {
        return asignacion;
      }

      // Si es mejor que la anterior, guardarla
      if (excesoTotal < menorExceso) {
        menorExceso = excesoTotal;
        mejorAsignacion = asignacion;
      }
    }
  }

  // Retornar la mejor asignación encontrada (puede tener algo de exceso)
  return mejorAsignacion;
}

// Encontrar los mejores días para asignar un equipo
function encontrarMejoresDias(ocupacionDiaria, tamañoEquipo, diasNecesarios) {
  // Crear array de días con su ocupación actual
  const diasConOcupacion = WEEK_DAYS.map(dia => ({
    dia: dia,
    ocupacion: ocupacionDiaria[dia],
    espacioDisponible: dailyCapacity - ocupacionDiaria[dia],
    nuevaOcupacion: ocupacionDiaria[dia] + tamañoEquipo
  }));

  // Ordenar por prioridad:
  // 1. Días que no excedan la capacidad
  // 2. Días con menor ocupación actual
  // 3. Aleatorización para variedad
  diasConOcupacion.sort((a, b) => {
    // Priorizar días que no excedan capacidad
    const aExcede = a.nuevaOcupacion > dailyCapacity;
    const bExcede = b.nuevaOcupacion > dailyCapacity;
    
    if (aExcede && !bExcede) return 1;
    if (!aExcede && bExcede) return -1;
    
    // Si ambos exceden o ambos no exceden, ordenar por ocupación actual
    if (a.ocupacion !== b.ocupacion) {
      return a.ocupacion - b.ocupacion;
    }
    
    // Aleatorizar para variedad
    return Math.random() - 0.5;
  });

  return diasConOcupacion.map(item => item.dia);
}

// =======================
// Funciones del Modal de Miembros (sin usar)
// =======================
function openMembersModal() { console.log('Función no implementada con Supabase'); }
function closeMembersModal() { console.log('Función no implementada con Supabase'); }
function addMemberToTeam() { console.log('Función no implementada con Supabase'); }
function deleteMemberFromTeam() { console.log('Función no implementada con Supabase'); }
function toggleMemberEdit() { console.log('Función no implementada con Supabase'); }
function saveMemberEdit() { console.log('Función no implementada con Supabase'); }
function saveMembersChanges() { console.log('Función no implementada con Supabase'); }