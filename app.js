/* ============================================================
   TENNIS TEAM APP — met Firebase Firestore sync
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js'
import { getFirestore, doc, getDoc, setDoc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js'

// ============================================================
// FIREBASE
// ============================================================

const firebaseConfig = {
  apiKey:            'AIzaSyBuSfjF4O00A5ycijDDhbXFXP5L3SWJCtY',
  authDomain:        'voorjaarscompetitie-2026.firebaseapp.com',
  projectId:         'voorjaarscompetitie-2026',
  storageBucket:     'voorjaarscompetitie-2026.firebasestorage.app',
  messagingSenderId: '855290831568',
  appId:             '1:855290831568:web:689914acb456fccc1d74d5'
}

const fbApp  = initializeApp(firebaseConfig)
const db     = getFirestore(fbApp)
const STATE  = doc(db, 'tennis', 'state')

// ============================================================
// STATE
// ============================================================

const DEMO_STATE = {
  teamName:  'Voorjaarscompetitie 2026',
  teamPhoto: null,
  players:   [],
  matches:   [],
  trainings: [],
  standings: [],
  knltbUrl:  ''
}

let state = {}

// Current UI state
let activeTab       = 'matches'
let selectedMatchId = null

// ============================================================
// PERSISTENCE — Firebase
// ============================================================

async function loadState() {
  try {
    const snap = await getDoc(STATE)
    if (snap.exists()) {
      state = snap.data()
      state.trainings = state.trainings || []
      state.standings = state.standings || []
      if (state.knltbUrl === undefined) state.knltbUrl = ''
    } else {
      state = JSON.parse(JSON.stringify(DEMO_STATE))
      saveState()
    }
  } catch (e) {
    console.error('Firebase laden mislukt:', e)
    state = JSON.parse(JSON.stringify(DEMO_STATE))
  }
}

function saveState() {
  setDoc(STATE, state).catch(e => console.error('Firebase opslaan mislukt:', e))
}

// Real-time sync: als een teamgenoot iets wijzigt, update jij ook meteen
function setupSync() {
  onSnapshot(STATE, snap => {
    if (!snap.exists()) return
    state = snap.data()
    state.trainings = state.trainings || []
    state.standings = state.standings || []
    if (state.knltbUrl === undefined) state.knltbUrl = ''
    renderHeader()
    renderTeamPhoto()
    renderMatchList()
    renderPlayerList()
    renderTrainingList()
    renderStandings()
    renderKnltbLink()
    // Overlays NIET opnieuw renderen om invulvelden niet te verstoren
  })
}

// ============================================================
// HELPERS
// ============================================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const MONTHS   = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
const WEEKDAYS = ['zo','ma','di','wo','do','vr','za']

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function getPlayer(id)    { return state.players.find(p => p.id === id) }
function playerName(id)   { return getPlayer(id)?.name ?? '?' }

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function avatarHtml(player, small = false) {
  const cls = small ? 'avatar-sm' : ''
  if (player?.photo) {
    return `<img class="avatar ${cls}" src="${player.photo}" alt="${escHtml(player.name)}">`
  }
  return `<span class="avatar-initials ${cls}">${escHtml(getInitials(player?.name ?? '?'))}</span>`
}

// Compress an image file to a base64 JPEG string
function compressImage(file, maxW, maxH, quality) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function parseScore(str) {
  if (!str) return null
  const m = str.trim().match(/^(\d+)-(\d+)$/)
  if (!m) return null
  return { ours: parseInt(m[1]), theirs: parseInt(m[2]) }
}

function resultBadgeHtml(match) {
  if (!match.result?.score) return ''
  const s = parseScore(match.result.score)
  if (!s) return `<span class="badge">${match.result.score}</span>`
  if (s.ours > s.theirs) return `<span class="badge badge-win">Gewonnen ${match.result.score}</span>`
  if (s.ours < s.theirs) return `<span class="badge badge-loss">Verloren ${match.result.score}</span>`
  return `<span class="badge badge-draw">Gelijk ${match.result.score}</span>`
}

// ============================================================
// RENDERING — MATCH LIST
// ============================================================

function renderTeamPhoto() {
  const area = document.getElementById('team-photo-area')
  if (!area) return
  if (state.teamPhoto) {
    area.innerHTML = `<img src="${state.teamPhoto}" class="team-photo-banner"
      data-action="open-settings" title="Klik om foto te wijzigen" alt="Teamfoto">`
  } else {
    area.innerHTML = `<div class="team-photo-placeholder" data-action="open-settings">
      📷 Teamfoto toevoegen (via ⚙️ Instellingen)
    </div>`
  }
}

function renderMatchList() {
  const container = document.getElementById('matches-list')

  if (!state.matches || state.matches.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nog geen wedstrijden gepland.</p>
        <p>Klik op "+ Toevoegen" om te beginnen.</p>
      </div>`
    return
  }

  const today    = new Date().toISOString().slice(0, 10)
  const sorted   = [...state.matches].sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = sorted.filter(m => m.date >= today)
  const past     = sorted.filter(m => m.date <  today).reverse()

  let html = ''
  if (upcoming.length) {
    html += '<h3 class="section-label">Aankomend</h3>'
    html += upcoming.map(m => matchCardHtml(m, false)).join('')
  }
  if (past.length) {
    html += '<h3 class="section-label">Gespeeld</h3>'
    html += past.map(m => matchCardHtml(m, true)).join('')
  }

  container.innerHTML = html
}

function matchCardHtml(match, isPast) {
  const playing = (state.players || []).filter(p => match.lineup?.[p.id] === 'plays')
  const reserve  = (state.players || []).filter(p => match.lineup?.[p.id] === 'reserve')
  const drivers  = (match.drivers  || []).map(playerName)
  const cake     = (match.cakeDuty || []).map(playerName)

  const playingStr = playing.length
    ? playing.map(p => p.name).join(', ')
    : '<em>Nog geen opstelling</em>'
  const reserveStr = reserve.length ? `Reserve: ${reserve.map(p => p.name).join(', ')}` : ''
  const driverStr  = drivers.length ? `🚗 ${drivers.join(', ')}` : ''
  const cakeStr    = cake.length    ? `🍰 ${cake.join(', ')}`    : ''
  const invStr     = (match.invallers || []).length ? `🔄 ${match.invallers.join(', ')}` : ''

  return `
    <div class="match-card ${match.isHome ? 'home' : 'away'} ${isPast ? 'past' : ''}"
         data-action="open-match" data-id="${match.id}">
      <div class="match-card-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${match.isHome ? 'badge-home' : 'badge-away'}">${match.isHome ? 'Thuis' : 'Uit'}</span>
          <span class="match-opponent">${escHtml(match.opponent)}</span>
        </div>
        ${resultBadgeHtml(match)}
      </div>
      <div class="match-datetime">${formatDate(match.date)}${match.time ? ' om ' + match.time : ''}</div>
      ${match.location ? `<a class="match-location" href="https://maps.google.com/?q=${encodeURIComponent(match.location)}" target="_blank" rel="noopener">📍 ${escHtml(match.location)} <span class="maps-icon">🗺️</span></a>` : ''}
      <div class="match-players">${playingStr}</div>
      ${reserveStr ? `<div class="match-reserve">${reserveStr}</div>` : ''}
      ${(driverStr || cakeStr || invStr) ? `
        <div class="match-meta">
          ${driverStr ? `<span class="match-meta-item">${driverStr}</span>` : ''}
          ${cakeStr   ? `<span class="match-meta-item">${cakeStr}</span>`   : ''}
          ${invStr    ? `<span class="match-meta-item">${invStr}</span>`    : ''}
        </div>` : ''}
    </div>`
}

// ============================================================
// RENDERING — PLAYER LIST
// ============================================================

function renderPlayerList() {
  const container = document.getElementById('players-list')

  if (!state.players || state.players.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nog geen speelsters toegevoegd.</p>
        <p>Klik op "+ Toevoegen" om te beginnen.</p>
      </div>`
    return
  }

  container.innerHTML = state.players.map(p => `
    <div class="player-card">
      ${avatarHtml(p)}
      <div class="player-card-info">
        <span class="player-card-name">${escHtml(p.name)}</span>
      </div>
      <div class="player-card-actions">
        <button class="btn-icon-edit" data-action="edit-player" data-id="${p.id}" title="Bewerken">✏️</button>
        <button class="btn-icon-danger" data-action="delete-player" data-id="${p.id}" title="Verwijderen">🗑️</button>
      </div>
    </div>`).join('')
}

// ============================================================
// RENDERING — TRAINING LIST
// ============================================================

let selectedTrainingId = null

function renderTrainingList() {
  const container = document.getElementById('training-list')
  if (!container) return
  const trainings = state.trainings || []

  if (trainings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nog geen trainingen voorgesteld.</p>
        <p>Klik op "+ Voorstel" om een datum te prikken.</p>
      </div>`
    return
  }

  const today   = new Date().toISOString().slice(0, 10)
  const sorted  = [...trainings].sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = sorted.filter(t => t.date >= today)
  const past     = sorted.filter(t => t.date <  today).reverse()

  let html = ''
  if (upcoming.length) {
    html += '<h3 class="section-label">Aankomend</h3>'
    html += upcoming.map(t => trainingCardHtml(t, false)).join('')
  }
  if (past.length) {
    html += '<h3 class="section-label">Geweest</h3>'
    html += past.map(t => trainingCardHtml(t, true)).join('')
  }
  container.innerHTML = html
}

function trainingCardHtml(training, isPast) {
  const avail   = training.availability || {}
  const players = state.players || []
  const yes     = players.filter(p => avail[p.id] === 'yes').length
  const no      = players.filter(p => avail[p.id] === 'no').length
  const maybe   = players.filter(p => avail[p.id] === 'maybe').length

  return `
    <div class="training-card ${isPast ? 'past' : ''}" data-action="open-training" data-id="${training.id}">
      <div class="training-date">${formatDate(training.date)}${training.time ? ' om ' + training.time : ''}</div>
      ${training.location ? `<a class="training-meta" href="https://maps.google.com/?q=${encodeURIComponent(training.location)}" target="_blank" rel="noopener">📍 ${escHtml(training.location)} <span class="maps-icon">🗺️</span></a>` : ''}
      ${training.notes    ? `<div class="training-meta">💬 ${escHtml(training.notes)}</div>` : ''}
      <div class="training-avail-summary">
        <span class="avail-pill avail-yes">✅ ${yes}</span>
        <span class="avail-pill avail-maybe">❓ ${maybe}</span>
        <span class="avail-pill avail-no">❌ ${no}</span>
      </div>
    </div>`
}

function openTrainingDetail(trainingId) {
  const training = (state.trainings || []).find(t => t.id === trainingId)
  if (!training) return

  selectedTrainingId = trainingId

  document.getElementById('overlay-training-title').textContent =
    `Training ${formatDate(training.date)}${training.time ? ' ' + training.time : ''}`

  const avail   = training.availability || {}
  const players = state.players || []

  const playerRows = players.length === 0
    ? `<p class="hint">Voeg eerst speelsters toe via het tabblad "Speelsters".</p>`
    : players.map(p => {
        const s = avail[p.id] ?? null
        return `
          <div class="lineup-row">
            ${avatarHtml(p, true)}
            <span class="lineup-name">${escHtml(p.name)}</span>
            <div class="lineup-btns">
              <button class="avail-btn ${s === 'yes'   ? 'active-yes'   : ''}"
                data-action="set-avail" data-player="${p.id}" data-status="yes">✅</button>
              <button class="avail-btn ${s === 'maybe' ? 'active-maybe' : ''}"
                data-action="set-avail" data-player="${p.id}" data-status="maybe">❓</button>
              <button class="avail-btn ${s === 'no'    ? 'active-no'    : ''}"
                data-action="set-avail" data-player="${p.id}" data-status="no">❌</button>
            </div>
          </div>`
      }).join('')

  document.getElementById('overlay-training-content').innerHTML = `
    <div class="detail-info">
      <div class="detail-row">
        <span class="detail-label">Datum</span>
        <span>${formatDate(training.date)}</span>
      </div>
      ${training.time     ? `<div class="detail-row"><span class="detail-label">Tijd</span><span>${training.time}</span></div>` : ''}
      ${training.location ? `<div class="detail-row"><span class="detail-label">Locatie</span><a class="maps-link" href="https://maps.google.com/?q=${encodeURIComponent(training.location)}" target="_blank" rel="noopener">📍 ${escHtml(training.location)} 🗺️</a></div>` : ''}
      ${training.notes    ? `<div class="detail-row"><span class="detail-label">Notities</span><span>${escHtml(training.notes)}</span></div>` : ''}
    </div>

    <div class="detail-section">
      <h4>🙋 Wie kan er?</h4>
      <div class="lineup-list">${playerRows}</div>
    </div>

    <div class="detail-actions">
      <button class="btn-secondary" data-action="edit-training">✏️ Bewerken</button>
      <button class="btn-danger"    data-action="delete-training">🗑️ Verwijderen</button>
    </div>`

  document.getElementById('overlay-training').classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

function closeTrainingOverlay() {
  document.getElementById('overlay-training').classList.add('hidden')
  document.body.style.overflow = ''
  selectedTrainingId = null
}

function setTrainingAvailability(trainingId, playerId, status) {
  const training = (state.trainings || []).find(t => t.id === trainingId)
  if (!training) return
  if (!training.availability) training.availability = {}
  training.availability[playerId] === status
    ? delete training.availability[playerId]
    : (training.availability[playerId] = status)
  saveState()
  renderTrainingList()
  openTrainingDetail(trainingId)
}

function openTrainingForm(trainingId) {
  const form = document.getElementById('form-training')
  form.reset()
  if (trainingId) {
    const t = (state.trainings || []).find(x => x.id === trainingId)
    if (!t) return
    document.getElementById('modal-training-title').textContent = 'Training bewerken'
    form.elements.trainingId.value = t.id
    form.elements.date.value       = t.date
    form.elements.time.value       = t.time     || ''
    form.elements.location.value   = t.location || ''
    form.elements.notes.value      = t.notes    || ''
  } else {
    document.getElementById('modal-training-title').textContent = 'Training voorstellen'
    form.elements.trainingId.value = ''
  }
  document.getElementById('modal-training').classList.remove('hidden')
}

function saveTrainingForm(e) {
  e.preventDefault()
  const form = e.target
  const data = {
    date:     form.elements.date.value,
    time:     form.elements.time.value,
    location: form.elements.location.value.trim(),
    notes:    form.elements.notes.value.trim(),
  }
  if (!state.trainings) state.trainings = []
  const trainingId = form.elements.trainingId.value
  if (trainingId) {
    const t = state.trainings.find(x => x.id === trainingId)
    if (t) Object.assign(t, data)
  } else {
    state.trainings.push({ id: generateId(), availability: {}, ...data })
  }
  saveState()
  closeModal('modal-training')
  renderTrainingList()
  if (trainingId && trainingId === selectedTrainingId) openTrainingDetail(trainingId)
}

function deleteTraining(trainingId) {
  if (!confirm('Weet je zeker dat je dit trainingsvoorstel wilt verwijderen?')) return
  state.trainings = (state.trainings || []).filter(t => t.id !== trainingId)
  saveState()
  closeTrainingOverlay()
  renderTrainingList()
}

// ============================================================
// RENDERING — STANDINGS
// ============================================================

function renderKnltbLink() {
  const el = document.getElementById('standings-knltb-btn')
  if (!el) return
  el.innerHTML = `
    <div class="knltb-section">
      ${state.knltbUrl
        ? `<button class="knltb-link-btn" data-action="open-knltb">🔗 Bekijk stand op KNLTB</button>`
        : `<p class="knltb-hint">Voer hieronder de KNLTB-link in zodra de competitie is begonnen.</p>`}
      <div class="knltb-edit">
        <input type="text" id="input-knltb-url" class="knltb-input"
          placeholder="https://mijnknltb.toernooi.nl/..."
          value="${escAttr(state.knltbUrl || '')}">
        <button class="btn-secondary btn-sm" data-action="save-knltb-url">Opslaan</button>
      </div>
    </div>`
}

function saveKnltbUrl() {
  let url = (document.getElementById('input-knltb-url')?.value ?? '').trim()
  if (url && !url.startsWith('http')) url = 'https://' + url
  state.knltbUrl = url
  saveState()
  renderKnltbLink()
}

function renderStandings() {
  const container = document.getElementById('standings-table')
  if (!container) return
  const standings = state.standings || []

  if (standings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Nog geen ploegen toegevoegd.</p>
        <p>Klik op "+ Ploeg" om de stand in te vullen.</p>
      </div>`
    return
  }

  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.won    !== a.won)    return b.won - a.won
    const aDiff = (a.setsFor || 0) - (a.setsAgainst || 0)
    const bDiff = (b.setsFor || 0) - (b.setsAgainst || 0)
    return bDiff - aDiff
  })
  container.innerHTML = `
    <div class="standings-wrap">
      <table class="standings-tbl">
        <thead>
          <tr>
            <th>#</th>
            <th class="col-team">Ploeg</th>
            <th title="Gespeeld">Ges</th>
            <th title="Gewonnen">W</th>
            <th title="Gelijk">G</th>
            <th title="Verloren">V</th>
            <th title="Punten">Ptn</th>
            <th title="Sets voor-tegen">Sets</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((s, i) => `
            <tr>
              <td class="col-pos">${i + 1}</td>
              <td class="col-team">${escHtml(s.team)}</td>
              <td>${(s.won || 0) + (s.draw || 0) + (s.lost || 0)}</td>
              <td>${s.won || 0}</td>
              <td>${s.draw || 0}</td>
              <td>${s.lost || 0}</td>
              <td class="col-pts"><strong>${s.points || 0}</strong></td>
              <td class="col-sets">${s.setsFor || 0}-${s.setsAgainst || 0}</td>
              <td class="col-actions">
                <button class="btn-icon-edit" data-action="edit-standing" data-id="${s.id}" title="Bewerken">✏️</button>
                <button class="btn-icon-danger" data-action="delete-standing" data-id="${s.id}" title="Verwijderen">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p class="standings-hint">Ptn = W×2 + G×1 · Tiebreaker: sets</p>
    </div>`
}

// ============================================================
// RENDERING — MATCH DETAIL OVERLAY
// ============================================================

function openMatchDetail(matchId) {
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return

  selectedMatchId = matchId

  document.getElementById('overlay-title').textContent =
    `${match.isHome ? 'Thuis' : 'Uit'}: ${match.opponent}`

  const noPlayers = !state.players || state.players.length === 0

  const lineupSection = noPlayers
    ? `<p class="hint">Voeg eerst speelsters toe via het tabblad "Speelsters".</p>`
    : `
      <div class="detail-section">
        <h4>👥 Opstelling</h4>
        <div class="lineup-list">
          ${state.players.map(p => {
            const s = match.lineup?.[p.id] ?? null
            return `
              <div class="lineup-row">
                ${avatarHtml(p, true)}
                <span class="lineup-name">${escHtml(p.name)}</span>
                <div class="lineup-btns">
                  <button class="lineup-btn ${s === 'plays'   ? 'active-plays'   : ''}"
                    data-action="set-lineup" data-player="${p.id}" data-status="plays">Speelt</button>
                  <button class="lineup-btn ${s === 'reserve' ? 'active-reserve' : ''}"
                    data-action="set-lineup" data-player="${p.id}" data-status="reserve">Reserve</button>
                  <button class="lineup-btn ${s === 'out'     ? 'active-out'     : ''}"
                    data-action="set-lineup" data-player="${p.id}" data-status="out">Speelt niet</button>
                </div>
              </div>`
          }).join('')}
        </div>
      </div>

      ${!match.isHome ? `
      <div class="detail-section">
        <h4>🚗 Vervoer — wie rijdt?</h4>
        <div class="check-grid">
          ${state.players.map(p => `
            <label class="check-item-avatar">
              <input type="checkbox" data-action="toggle-driver" data-player="${p.id}"
                ${(match.drivers || []).includes(p.id) ? 'checked' : ''}>
              ${avatarHtml(p, true)}
              <span>${escHtml(p.name)}</span>
            </label>`).join('')}
        </div>
      </div>` : ''}

      ${match.isHome ? `
      <div class="detail-section">
        <h4>🍰 Gebak — wie neemt het mee?</h4>
        <div class="check-grid">
          ${state.players.map(p => `
            <label class="check-item-avatar">
              <input type="checkbox" data-action="toggle-cake" data-player="${p.id}"
                ${(match.cakeDuty || []).includes(p.id) ? 'checked' : ''}>
              ${avatarHtml(p, true)}
              <span>${escHtml(p.name)}</span>
            </label>`).join('')}
        </div>
      </div>` : ''}`

  document.getElementById('overlay-content').innerHTML = `
    <div class="detail-info">
      <div class="detail-row">
        <span class="detail-label">Datum</span>
        <span>${formatDate(match.date)}</span>
      </div>
      ${match.time ? `<div class="detail-row"><span class="detail-label">Tijd</span><span>${match.time}</span></div>` : ''}
      ${match.location ? `<div class="detail-row"><span class="detail-label">Locatie</span><a class="maps-link" href="https://maps.google.com/?q=${encodeURIComponent(match.location)}" target="_blank" rel="noopener">📍 ${escHtml(match.location)} 🗺️</a></div>` : ''}
      ${match.notes ? `<div class="detail-row"><span class="detail-label">Notities</span><span>${escHtml(match.notes)}</span></div>` : ''}
    </div>

    ${lineupSection}

    <div class="detail-section">
      <h4>🔄 Invallers</h4>
      <div id="invaller-list">
        ${(match.invallers || []).length
          ? (match.invallers).map((name, i) => `
              <div class="invaller-row">
                <span>${escHtml(name)}</span>
                <button class="btn-icon-danger" data-action="remove-invaller" data-index="${i}" title="Verwijderen">✕</button>
              </div>`).join('')
          : '<p class="hint" style="margin:0 0 8px">Nog geen invallers toegevoegd.</p>'}
      </div>
      <div class="invaller-add">
        <input type="text" id="input-invaller" class="invaller-input" placeholder="Naam invaller">
        <button class="btn-primary" data-action="add-invaller">+ Toevoegen</button>
      </div>
    </div>

    <div class="detail-section">
      <h4>🎾 Uitslag</h4>
      <div class="result-form">
        <div class="result-score-row">
          <input type="text" id="input-score" class="input-score"
            placeholder="bv. 3-1" maxlength="10"
            value="${escAttr(match.result?.score ?? '')}">
          <span class="result-score-label">Eindstand (bv. 3-1)</span>
        </div>
        <div class="rubber-inputs">
          ${[0,1,2,3].map(i => `
            <div class="rubber-row">
              <span class="rubber-label">Wedstrijd ${i+1}</span>
              <input type="text" class="input-rubber" data-rubber="${i}"
                placeholder="bv. 6-3 6-2"
                value="${escAttr(match.result?.rubbers?.[i] ?? '')}">
            </div>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
          <button class="btn-primary" data-action="save-result">Uitslag opslaan</button>
          ${resultBadgeHtml(match)}
        </div>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn-secondary" data-action="edit-match">✏️ Bewerken</button>
      <button class="btn-danger"    data-action="delete-match">🗑️ Verwijderen</button>
    </div>`

  document.getElementById('overlay-match').classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

function closeOverlay() {
  document.getElementById('overlay-match').classList.add('hidden')
  document.body.style.overflow = ''
  selectedMatchId = null
}

function addInvaller(matchId) {
  const input = document.getElementById('input-invaller')
  if (!input) return
  const name = input.value.trim()
  if (!name) return
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return
  if (!match.invallers) match.invallers = []
  match.invallers.push(name)
  input.value = ''
  saveState()
  renderMatchList()
  openMatchDetail(matchId)
}

function removeInvaller(matchId, index) {
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return
  match.invallers = (match.invallers || []).filter((_, i) => i !== index)
  saveState()
  renderMatchList()
  openMatchDetail(matchId)
}

// ============================================================
// MATCH FORM
// ============================================================

function openMatchForm(matchId) {
  const form  = document.getElementById('form-match')
  const modal = document.getElementById('modal-match')

  form.reset()

  if (matchId) {
    const match = state.matches.find(m => m.id === matchId)
    if (!match) return
    document.getElementById('modal-match-title').textContent = 'Wedstrijd bewerken'
    form.elements.matchId.value  = match.id
    form.elements.date.value     = match.date
    form.elements.time.value     = match.time
    form.elements.opponent.value = match.opponent
    form.elements.location.value = match.location
    form.elements.notes.value    = match.notes
    form.querySelector(`[name="isHome"][value="${match.isHome}"]`).checked = true
  } else {
    document.getElementById('modal-match-title').textContent = 'Wedstrijd toevoegen'
    form.elements.matchId.value = ''
  }

  modal.classList.remove('hidden')
}

function saveMatchForm(e) {
  e.preventDefault()
  const form = e.target
  const data = {
    date:     form.elements.date.value,
    time:     form.elements.time.value,
    isHome:   form.elements.isHome.value === 'true',
    opponent: form.elements.opponent.value.trim(),
    location: form.elements.location.value.trim(),
    notes:    form.elements.notes.value.trim(),
  }

  const matchId = form.elements.matchId.value

  if (matchId) {
    const match = state.matches.find(m => m.id === matchId)
    if (match) Object.assign(match, data)
  } else {
    state.matches.push({ id: generateId(), lineup: {}, drivers: [], cakeDuty: [], invallers: [], result: null, ...data })
  }

  saveState()
  closeModal('modal-match')
  renderMatchList()

  if (matchId && matchId === selectedMatchId) openMatchDetail(matchId)
}

// ============================================================
// PLAYER FORM
// ============================================================

function openPlayerForm() {
  document.getElementById('form-player').reset()
  document.getElementById('modal-player').classList.remove('hidden')
  document.querySelector('#modal-player [name="name"]').focus()
}

function savePlayerForm(e) {
  e.preventDefault()
  const name = e.target.elements.name.value.trim()
  if (!name) return
  state.players.push({ id: generateId(), name })
  saveState()
  closeModal('modal-player')
  renderPlayerList()
}

// ============================================================
// SETTINGS
// ============================================================

function openSettings() {
  document.getElementById('input-teamname').value = state.teamName
  // Show current team photo preview
  const preview = document.getElementById('team-photo-settings-preview')
  preview.innerHTML = state.teamPhoto
    ? `<img src="${state.teamPhoto}" class="photo-preview" style="width:80px;height:80px">`
    : `<span class="photo-preview-initials" style="width:56px;height:56px">📷</span>`
  document.getElementById('modal-settings').classList.remove('hidden')
}

async function saveSettings() {
  const name = document.getElementById('input-teamname').value.trim()
  if (name) state.teamName = name

  const photoInput = document.getElementById('input-team-photo')
  if (photoInput.files[0]) {
    state.teamPhoto = await compressImage(photoInput.files[0], 800, 400, 0.8)
    photoInput.value = ''
  }

  saveState()
  renderHeader()
  renderTeamPhoto()
  closeModal('modal-settings')
}

// ============================================================
// EDIT PLAYER
// ============================================================

function openEditPlayerModal(playerId) {
  const player = getPlayer(playerId)
  if (!player) return

  const form = document.getElementById('form-edit-player')
  form.elements.playerId.value = playerId
  form.elements.name.value     = player.name

  // Show current photo or initials
  const preview = document.getElementById('edit-player-photo-preview')
  if (player.photo) {
    preview.outerHTML = `<img id="edit-player-photo-preview" class="photo-preview" src="${player.photo}" alt="${escHtml(player.name)}">`
  } else {
    preview.textContent = getInitials(player.name)
    preview.className = 'photo-preview-initials'
  }

  document.getElementById('modal-edit-player').classList.remove('hidden')
}

async function saveEditPlayerForm(e) {
  e.preventDefault()
  const form     = e.target
  const playerId = form.elements.playerId.value
  const player   = getPlayer(playerId)
  if (!player) return

  player.name = form.elements.name.value.trim() || player.name

  const photoFile = form.elements.photo.files[0]
  if (photoFile) {
    player.photo = await compressImage(photoFile, 200, 200, 0.75)
  }

  saveState()
  closeModal('modal-edit-player')
  renderPlayerList()

  // Re-render match detail if open (to update avatars)
  if (selectedMatchId) openMatchDetail(selectedMatchId)
}

// Live photo preview in edit-player modal
document.getElementById('edit-player-photo-input').addEventListener('change', async e => {
  const file = e.target.files[0]
  if (!file) return
  const data = await compressImage(file, 200, 200, 0.75)
  const container = document.querySelector('#edit-player-photo-preview, .photo-preview-initials')
  const img = document.createElement('img')
  img.id = 'edit-player-photo-preview'
  img.className = 'photo-preview'
  img.src = data
  container.replaceWith(img)
})

// Live team photo preview in settings
document.getElementById('input-team-photo').addEventListener('change', async e => {
  const file = e.target.files[0]
  if (!file) return
  const data = await compressImage(file, 800, 400, 0.8)
  const preview = document.getElementById('team-photo-settings-preview')
  preview.innerHTML = `<img src="${data}" class="photo-preview" style="width:80px;height:80px">`
})

// ============================================================
// MATCH DETAIL ACTIONS
// ============================================================

function setLineup(matchId, playerId, status) {
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return
  if (!match.lineup) match.lineup = {}
  match.lineup[playerId] === status ? delete match.lineup[playerId] : (match.lineup[playerId] = status)
  saveState()
  renderMatchList()
  openMatchDetail(matchId)
}

function toggleDriver(matchId, playerId, checked) {
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return
  if (!match.drivers) match.drivers = []
  match.drivers = checked
    ? [...new Set([...match.drivers, playerId])]
    : match.drivers.filter(id => id !== playerId)
  saveState()
  renderMatchList()
}

function toggleCake(matchId, playerId, checked) {
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return
  if (!match.cakeDuty) match.cakeDuty = []
  match.cakeDuty = checked
    ? [...new Set([...match.cakeDuty, playerId])]
    : match.cakeDuty.filter(id => id !== playerId)
  saveState()
  renderMatchList()
}

function saveResult(matchId) {
  const match = state.matches.find(m => m.id === matchId)
  if (!match) return
  const score   = document.getElementById('input-score').value.trim()
  const rubbers = Array.from(document.querySelectorAll('.input-rubber')).map(el => el.value.trim())
  match.result = score ? { score, rubbers } : null
  saveState()
  renderMatchList()
  openMatchDetail(matchId)
}

function deleteMatch(matchId) {
  if (!confirm('Weet je zeker dat je deze wedstrijd wilt verwijderen?')) return
  state.matches = state.matches.filter(m => m.id !== matchId)
  saveState()
  closeOverlay()
  renderMatchList()
}

function deletePlayer(playerId) {
  const p = getPlayer(playerId)
  if (!p) return
  if (!confirm(`Weet je zeker dat je "${p.name}" wilt verwijderen?`)) return
  state.players = state.players.filter(pl => pl.id !== playerId)
  state.matches.forEach(m => {
    if (m.lineup) delete m.lineup[playerId]
    m.drivers  = (m.drivers  || []).filter(id => id !== playerId)
    m.cakeDuty = (m.cakeDuty || []).filter(id => id !== playerId)
  })
  saveState()
  renderPlayerList()
}

// ============================================================
// STANDINGS ACTIONS
// ============================================================

function openStandingForm(standingId) {
  const form = document.getElementById('form-standing')
  form.reset()
  if (standingId) {
    const s = (state.standings || []).find(x => x.id === standingId)
    if (!s) return
    document.getElementById('modal-standing-title').textContent = 'Ploeg bewerken'
    form.elements.standingId.value = s.id
    form.elements.team.value       = s.team
    form.elements.won.value        = s.won         || 0
    form.elements.draw.value       = s.draw        || 0
    form.elements.lost.value       = s.lost        || 0
    form.elements.points.value     = s.points      || 0
    form.elements.setsFor.value    = s.setsFor     || 0
    form.elements.setsAgainst.value = s.setsAgainst || 0
  } else {
    document.getElementById('modal-standing-title').textContent = 'Ploeg toevoegen'
    form.elements.standingId.value = ''
  }
  document.getElementById('modal-standing').classList.remove('hidden')
}

function saveStandingForm(e) {
  e.preventDefault()
  const form = e.target
  const data = {
    team:        form.elements.team.value.trim(),
    won:         parseInt(form.elements.won.value)         || 0,
    draw:        parseInt(form.elements.draw.value)        || 0,
    lost:        parseInt(form.elements.lost.value)        || 0,
    points:      parseInt(form.elements.points.value)      || 0,
    setsFor:     parseInt(form.elements.setsFor.value)     || 0,
    setsAgainst: parseInt(form.elements.setsAgainst.value) || 0,
  }
  if (!state.standings) state.standings = []
  const standingId = form.elements.standingId.value
  if (standingId) {
    const s = state.standings.find(x => x.id === standingId)
    if (s) Object.assign(s, data)
  } else {
    state.standings.push({ id: generateId(), ...data })
  }
  saveState()
  closeModal('modal-standing')
  renderStandings()
}

function deleteStanding(standingId) {
  if (!confirm('Weet je zeker dat je deze ploeg wilt verwijderen?')) return
  state.standings = (state.standings || []).filter(s => s.id !== standingId)
  saveState()
  renderStandings()
}

// ============================================================
// HELPERS
// ============================================================

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden')
}

function renderHeader() {
  document.getElementById('team-name-display').textContent = state.teamName
  renderTeamPhoto()
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function escAttr(str) { return escHtml(str) }

// ============================================================
// EVENT DELEGATION
// ============================================================

document.addEventListener('click', e => {
  // Laat link-klikken (bijv. Google Maps) gewoon door
  if (e.target.closest('a')) return

  const tabBtn = e.target.closest('.tab-btn')
  if (tabBtn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
    tabBtn.classList.add('active')
    document.getElementById(`tab-${tabBtn.dataset.tab}`).classList.add('active')
    activeTab = tabBtn.dataset.tab
    return
  }

  const closeBtn = e.target.closest('.modal-close')
  if (closeBtn) { closeModal(closeBtn.dataset.modal); return }

  const btn = e.target.closest('[data-action]')
  if (!btn) return

  switch (btn.dataset.action) {
    case 'open-match':    openMatchDetail(btn.dataset.id); break
    case 'close-overlay': closeOverlay(); break
    case 'add-match':     openMatchForm(null); break
    case 'edit-match':    openMatchForm(selectedMatchId); break
    case 'delete-match':  deleteMatch(selectedMatchId); break
    case 'add-player':    openPlayerForm(); break
    case 'edit-player':   openEditPlayerModal(btn.dataset.id); break
    case 'delete-player': deletePlayer(btn.dataset.id); break
    case 'set-lineup':
      if (selectedMatchId) setLineup(selectedMatchId, btn.dataset.player, btn.dataset.status)
      break
    case 'save-result':
      if (selectedMatchId) saveResult(selectedMatchId)
      break
    case 'add-invaller':
      if (selectedMatchId) addInvaller(selectedMatchId)
      break
    case 'remove-invaller':
      if (selectedMatchId) removeInvaller(selectedMatchId, parseInt(btn.dataset.index))
      break
    case 'open-maps':
      window.open(`https://maps.google.com/?q=${encodeURIComponent(btn.dataset.location)}`, '_blank')
      break
    case 'open-training':         openTrainingDetail(btn.dataset.id); break
    case 'close-training-overlay': closeTrainingOverlay(); break
    case 'add-training':          openTrainingForm(null); break
    case 'edit-training':         openTrainingForm(selectedTrainingId); break
    case 'delete-training':       deleteTraining(selectedTrainingId); break
    case 'set-avail':
      if (selectedTrainingId) setTrainingAvailability(selectedTrainingId, btn.dataset.player, btn.dataset.status)
      break
    case 'open-settings':   openSettings(); break
    case 'save-settings':   saveSettings(); break
    case 'add-standing':    openStandingForm(null); break
    case 'edit-standing':   openStandingForm(btn.dataset.id); break
    case 'delete-standing': deleteStanding(btn.dataset.id); break
    case 'open-knltb':      if (state.knltbUrl) window.open(state.knltbUrl, '_blank'); break
    case 'save-knltb-url':  saveKnltbUrl(); break
  }
})

document.addEventListener('change', e => {
  const input = e.target
  if (!selectedMatchId) return
  if (input.dataset.action === 'toggle-driver') toggleDriver(selectedMatchId, input.dataset.player, input.checked)
  if (input.dataset.action === 'toggle-cake')   toggleCake(selectedMatchId, input.dataset.player, input.checked)
})

document.getElementById('overlay-match').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeOverlay()
})

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === e.currentTarget) modal.classList.add('hidden')
  })
})

document.getElementById('form-match').addEventListener('submit', saveMatchForm)
document.getElementById('form-player').addEventListener('submit', savePlayerForm)
document.getElementById('form-edit-player').addEventListener('submit', saveEditPlayerForm)
document.getElementById('form-standing').addEventListener('submit', saveStandingForm)
document.getElementById('form-training').addEventListener('submit', saveTrainingForm)

document.getElementById('overlay-training').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeTrainingOverlay()
})

// ============================================================
// INIT
// ============================================================

async function init() {
  document.getElementById('matches-list').innerHTML =
    '<div class="empty-state"><p>Verbinden met Firebase...</p></div>'

  await loadState()
  setupSync()
  renderHeader()
  renderMatchList()
  renderPlayerList()
  renderTrainingList()
  renderStandings()
  renderKnltbLink()
}

init()

// Service worker registreren (maakt app installeerbaar)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.log('SW registratie mislukt:', err))
  })
  // Automatisch herladen als een nieuwe SW de controle overneemt
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
