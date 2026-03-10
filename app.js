function countUp(el, target, duration = 1000) {
  if (!el) return;
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = Math.floor(start);
    if (start >= target) clearInterval(timer);
  }, 16);
}

/** Show shared modal */
function showModal(icon, title, msg, btnClass = '') {
  const overlay = document.getElementById('sharedModal');
  if (!overlay) return;
  document.getElementById('modalIcon').textContent  = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent   = msg;
  const btn = overlay.querySelector('.modal-btn');
  btn.className = 'modal-btn' + (btnClass ? ' ' + btnClass : '');
  overlay.classList.add('show');
}

function closeModal() {
  const overlay = document.getElementById('sharedModal');
  if (overlay) overlay.classList.remove('show');
}

/** Setup modal: close on overlay click */
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('sharedModal');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
});

/* ══════════════════════════════════════════════════════════════
   INDEX PAGE
══════════════════════════════════════════════════════════════ */
function initIndex() {
  if (!document.getElementById('index-page')) return;

  // Feature scroll animation
  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) setTimeout(() => entry.target.classList.add('vis'), i * 120);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.feat').forEach(el => observer.observe(el));

  // Count-up on hero mockup numbers
  setTimeout(() => {
    [['n-icu',5],['n-gen',10],['n-vent',3],['n-doc',6]].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '0'; countUp(el, val); }
    });
  }, 800);
}

/* ══════════════════════════════════════════════════════════════
   LOGIN PAGE
══════════════════════════════════════════════════════════════ */
let selectedRole = '';

function selectRole(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const err = document.getElementById('errorMsg');
  if (err) err.classList.remove('show');
}

function handleLogin() {
  const staffId = (document.getElementById('staffId') || {}).value?.trim();
  const err     = document.getElementById('errorMsg');
  if (!selectedRole || !staffId) {
    if (err) err.classList.add('show');
    return;
  }
  sessionStorage.setItem('mt_role',    selectedRole);
  sessionStorage.setItem('mt_staffId', staffId);
  // Also sync resource state if present
  syncResourcesToSession();
  window.location.href = './dashboard.html';
}

function initLogin() {
  if (!document.getElementById('login-page')) return;
  const staffInput = document.getElementById('staffId');
  if (staffInput) staffInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD PAGE — STATE
══════════════════════════════════════════════════════════════ */
const INIT_RES = { icu: 10, gen: 12, vent: 5, doc: 8 };
const res      = { icu: 10, gen: 12, vent: 5, doc: 8 };
const patients = [];

const SEVERITY_RULES = {
  Critical: { color:'#EF4444', icon:'🔴', needIcu:true,  needVent:true,  needDoc:true  },
  Medium:   { color:'#F59E0B', icon:'🟡', needIcu:false, needVent:false, needDoc:true  },
  Low:      { color:'#22C55E', icon:'🟢', needIcu:false, needVent:false, needDoc:false },
};

/** Sync resource state to sessionStorage so patient page reads live values */
function syncResourcesToSession() {
  sessionStorage.setItem('res_icu',  res.icu);
  sessionStorage.setItem('res_gen',  res.gen);
  sessionStorage.setItem('res_vent', res.vent);
  sessionStorage.setItem('res_doc',  res.doc);
}

/* ── DASHBOARD INIT ──────────────────────────────────────── */
function initDashboard() {
  if (!document.getElementById('dashboard-page')) return;

  // Set user info
  const role = sessionStorage.getItem('mt_role')    || 'Staff';
  const id   = sessionStorage.getItem('mt_staffId') || 'DEMO';
  const emojiMap = { Nurse:'🏥', Doctor:'👨‍⚕️', Admin:'👑' };
  const roleEmoji = document.getElementById('roleEmoji');
  const userDisp  = document.getElementById('userDisplay');
  if (roleEmoji) roleEmoji.textContent = emojiMap[role] || '👤';
  if (userDisp)  userDisp.textContent  = `${role} · ${id}`;

  // Load any saved resource state
  if (sessionStorage.getItem('res_icu')) {
    res.icu  = parseInt(sessionStorage.getItem('res_icu'));
    res.gen  = parseInt(sessionStorage.getItem('res_gen'));
    res.vent = parseInt(sessionStorage.getItem('res_vent'));
    res.doc  = parseInt(sessionStorage.getItem('res_doc'));
  }

  updateAllDashboardUI();
  initPieChart();
  initBarChart();
  startClock();
}

function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString(); };
  tick(); setInterval(tick, 1000);
}

function logout() {
  sessionStorage.clear();
  window.location.href = './index.html';
}

/* ── TAB SWITCHING ────────────────────────────────────────── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tb-tab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  if (btn)   btn.classList.add('active');
  if (name === 'analytics') updateAnalytics();
  if (name === 'patients')  renderPatientTable();
}

/* ── RESOURCE ALLOCATION ──────────────────────────────────── */
function allocateResources() {
  const nameEl = document.getElementById('patientName');
  const sevEl  = document.getElementById('severityLevel');
  if (!nameEl || !sevEl) return;

  const name = nameEl.value.trim();
  const sev  = sevEl.value;
  if (!name) { nameEl.focus(); return; }

  const rule = SEVERITY_RULES[sev];
  const allocated = [];
  let alertData = null;

  // BED ALLOCATION
  if (rule.needIcu) {
    if (res.icu > 0) { res.icu--; allocated.push('ICU Bed'); }
    else if (res.gen > 0) {
      res.gen--; allocated.push('General Bed');
      alertData = { icon:'⚠️', title:'ICU BEDS FULL', msg:`No ICU beds left. ${name} was redirected to General Ward. Notify senior staff.`, cls:'modal-btn-red' };
    } else {
      alertData = { icon:'🚨', title:'NO BEDS AVAILABLE', msg:`All beds occupied. Immediate administrative action required.`, cls:'modal-btn-red' };
    }
  } else {
    if (res.gen > 0) { res.gen--; allocated.push('General Bed'); }
  }

  // VENTILATOR
  if (rule.needVent) {
    if (res.vent > 0) { res.vent--; allocated.push('Ventilator'); }
    else {
      alertData = alertData || { icon:'🚨', title:'NO VENTILATORS', msg:`All ventilators in use. Patient ${name} needs ventilator support urgently.`, cls:'modal-btn-red' };
    }
  }

  // DOCTOR
  if (rule.needDoc && res.doc > 0) { res.doc--; allocated.push('Doctor'); }

  const patient = { id: Date.now(), name, sev, rule, allocated, time: new Date().toLocaleTimeString() };
  patients.unshift(patient);

  syncResourcesToSession();
  updateAllDashboardUI();
  showAllocResult(patient);
  if (alertData) showModal(alertData.icon, alertData.title, alertData.msg, alertData.cls);

  nameEl.value = '';
}

/* ── UI UPDATERS ──────────────────────────────────────────── */
function updateAllDashboardUI() {
  const cards = [
    { id:'sc-icu',  bar:'bar-icu',  sub:'sub-icu',  val:res.icu,  init:INIT_RES.icu,  color:'#0D9488' },
    { id:'sc-gen',  bar:'bar-gen',  sub:'sub-gen',  val:res.gen,  init:INIT_RES.gen,  color:'#06B6D4' },
    { id:'sc-vent', bar:'bar-vent', sub:'sub-vent', val:res.vent, init:INIT_RES.vent, color:'#6366F1' },
    { id:'sc-doc',  bar:'bar-doc',  sub:'sub-doc',  val:res.doc,  init:INIT_RES.doc,  color:'#22C55E' },
  ];

  cards.forEach(c => {
    const pct  = Math.round((c.val / c.init) * 100);
    const numEl = document.getElementById(c.id);
    const barEl = document.getElementById(c.bar);
    const subEl = document.getElementById(c.sub);
    if (!numEl) return;

    numEl.textContent = c.val;
    if (barEl) barEl.style.width = pct + '%';
    if (subEl) subEl.textContent = `${c.val} of ${c.init} available`;

    const card = numEl.closest('.stat-card');
    const existing = card?.querySelector('.low-badge');
    if (c.val <= 1) {
      numEl.style.color = '#EF4444';
      if (card) card.style.borderTopColor = '#EF4444';
      if (!existing && card) {
        const b = document.createElement('div');
        b.className = 'low-badge'; b.textContent = 'LOW'; card.appendChild(b);
      }
    } else {
      numEl.style.color = c.color;
      if (card) card.style.borderTopColor = c.color;
      if (existing) existing.remove();
    }
  });

  // Occupancy ring
  const usedBeds  = (INIT_RES.icu - res.icu) + (INIT_RES.gen - res.gen);
  const totalBeds = INIT_RES.icu + INIT_RES.gen;
  const pct = Math.round((usedBeds / totalBeds) * 100);
  const ringColor = pct >= 85 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#0D9488';
  const ring = document.getElementById('occRing');
  const pctEl= document.getElementById('occPct');
  const statEl = document.getElementById('occStat');
  const stEl   = document.getElementById('occStatus');
  if (ring)  ring.style.background = `conic-gradient(${ringColor} ${pct*3.6}deg, #F1F5F9 0deg)`;
  if (pctEl) { pctEl.textContent = pct + '%'; pctEl.style.color = ringColor; }
  if (statEl) statEl.innerHTML = `<b>${usedBeds}</b> of <b>${totalBeds}</b> beds occupied`;
  if (stEl) {
    if (pct >= 85) { stEl.textContent = '🚨 CRITICAL — Above Safe Limit'; stEl.style.cssText = 'background:#FEF2F2;color:#EF4444;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;display:inline-block'; }
    else if (pct >= 70) { stEl.textContent = '⚠️ High — Monitor Closely'; stEl.style.cssText = 'background:#FFFBEB;color:#F59E0B;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;display:inline-block'; }
    else { stEl.textContent = '✅ Within Safe Limits'; stEl.style.cssText = 'background:#F0FDF4;color:#16A34A;font-size:12px;font-weight:700;padding:4px 12px;border-radius:99px;display:inline-block'; }
  }

  // Summary
  const crit   = patients.filter(p => p.sev === 'Critical').length;
  const resUsed= patients.reduce((a, p) => a + p.allocated.length, 0);
  const el = (id) => document.getElementById(id);
  if (el('sum-total')) el('sum-total').textContent = patients.length;
  if (el('sum-crit'))  el('sum-crit').textContent  = crit;
  if (el('sum-res'))   el('sum-res').textContent   = resUsed;

  // Legend
  if (el('l-icu'))  el('l-icu').textContent  = res.icu;
  if (el('l-gen'))  el('l-gen').textContent  = res.gen;
  if (el('l-vent')) el('l-vent').textContent = res.vent;
  if (el('l-doc'))  el('l-doc').textContent  = res.doc;

  // Update pie chart
  if (window.pieChart) {
    window.pieChart.data.datasets[0].data = [res.icu, res.gen, res.vent, res.doc];
    window.pieChart.update();
  }
}

function showAllocResult(p) {
  const wrap = document.getElementById('allocResult');
  if (!wrap) return;
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="alloc-result" style="border-color:${p.rule.color}">
      <div class="alloc-header">
        <span style="font-size:13px;font-weight:700;color:${p.rule.color}">${p.rule.icon} ${p.sev} Severity</span>
        <span style="font-size:11px;color:#94A3B8">Latest Allocation</span>
      </div>
      <div class="alloc-name">${p.name}</div>
      <div class="alloc-tags" style="margin-top:10px">
        ${p.allocated.length
          ? p.allocated.map(a => `<span class="alloc-tag">✓ ${a} Assigned</span>`).join('')
          : `<span class="alloc-none">⚠️ No resources available</span>`}
      </div>
      <div class="alloc-time">Allocated at ${p.time}</div>
    </div>`;
}

/* ── PATIENT TABLE ────────────────────────────────────────── */
function renderPatientTable() {
  const wrap   = document.getElementById('patientTable');
  const badge  = document.getElementById('pt-count');
  if (!wrap) return;
  if (badge) badge.textContent = `${patients.length} patient${patients.length !== 1 ? 's' : ''}`;

  if (!patients.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="es-icon">📋</div><div class="es-title">No patients yet</div><div class="es-sub">Go to Dashboard and add a patient</div></div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Patient Name</th><th>Severity</th><th>Resources Allocated</th><th>Time</th></tr></thead>
      <tbody>
        ${patients.map((p, i) => `
          <tr>
            <td style="color:#94A3B8;font-size:13px">${patients.length - i}</td>
            <td class="td-name">${p.name}</td>
            <td><span class="sev-tbl ${p.sev === 'Critical' ? 'sev-cr' : p.sev === 'Medium' ? 'sev-me' : 'sev-lo'}">${p.rule.icon} ${p.sev}</span></td>
            <td>${p.allocated.length
                ? p.allocated.map(a => `<span class="res-tag">${a}</span>`).join('')
                : '<span style="color:#EF4444;font-size:12px;font-weight:600">None available</span>'}</td>
            <td style="color:#94A3B8;font-size:13px">${p.time}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── ANALYTICS ────────────────────────────────────────────── */
function updateAnalytics() {
  const total  = patients.length;
  const crit   = patients.filter(p => p.sev === 'Critical').length;
  const rateEl = document.getElementById('crit-rate');
  if (rateEl) rateEl.textContent = total ? Math.round((crit / total) * 100) + '%' : '0%';
}

/* ── CHARTS ───────────────────────────────────────────────── */
function initPieChart() {
  const canvas = document.getElementById('pieChart');
  if (!canvas || typeof Chart === 'undefined') return;
  window.pieChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['ICU Beds', 'General Beds', 'Ventilators', 'Doctors'],
      datasets: [{ data: [res.icu, res.gen, res.vent, res.doc], backgroundColor: ['#0D9488','#06B6D4','#6366F1','#22C55E'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: { responsive: false, cutout: '62%', plugins: { legend: { display: false } } }
  });
}

function initBarChart() {
  const canvas = document.getElementById('barChart');
  if (!canvas || typeof Chart === 'undefined') return;
  window.barChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [
        { label:'Admitted', data:[14,19,11,22,17,9,12], backgroundColor:'#06B6D4', borderRadius:6, borderSkipped:false },
        { label:'Critical',  data:[3,5,2,7,4,1,3],       backgroundColor:'#EF4444', borderRadius:6, borderSkipped:false }
      ]
    },
    options: {
      responsive: true, barPercentage: 0.55,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 12 }, color: '#94A3B8' } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { family: 'DM Sans', size: 12 }, color: '#94A3B8' } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   PATIENT PAGE
══════════════════════════════════════════════════════════════ */

const INIT_RES_PATIENT = { icu: 10, gen: 12, vent: 5, doc: 8 };

function getRes() {
  return {
    icu:  parseInt(sessionStorage.getItem('res_icu')  ?? INIT_RES_PATIENT.icu),
    gen:  parseInt(sessionStorage.getItem('res_gen')  ?? INIT_RES_PATIENT.gen),
    vent: parseInt(sessionStorage.getItem('res_vent') ?? INIT_RES_PATIENT.vent),
    doc:  parseInt(sessionStorage.getItem('res_doc')  ?? INIT_RES_PATIENT.doc),
  };
}

const SERVICES_DATA = [
  { icon:'🧪', name:'Emergency Department', desc:'Critical & urgent care, 24/7',         avail:true,  wait:'5–10 min' },
  { icon:'🩺', name:'General OPD',          desc:'Outpatient consultations & checkups',   avail:true,  wait:'20–40 min' },
  { icon:'❤️', name:'Cardiology',           desc:'Heart conditions & ECG services',       avail:true,  wait:'30–60 min' },
  { icon:'🦴', name:'Orthopaedics',         desc:'Bone, joint & fracture treatment',      avail:true,  wait:'45–90 min' },
  { icon:'🧠', name:'Neurology',            desc:'Brain, spine & nervous system',         avail:false, wait:'Not available today' },
  { icon:'👁️', name:'Ophthalmology',        desc:'Eye care & vision tests',               avail:true,  wait:'20–35 min' },
  { icon:'👶', name:'Paediatrics',          desc:'Child & infant healthcare',             avail:true,  wait:'15–30 min' },
  { icon:'🩻', name:'Radiology / X-Ray',    desc:'Imaging, MRI, CT scans',               avail:true,  wait:'40–60 min' },
  { icon:'🔬', name:'Pathology / Lab',      desc:'Blood tests & diagnostics',             avail:true,  wait:'1–2 hours (results)' },
  { icon:'💊', name:'Pharmacy',             desc:'Prescription & OTC medicines',          avail:true,  wait:'5–10 min' },
  { icon:'🛏️', name:'ICU Admissions',       desc:'Critical care unit',                    avail:true,  wait:'Subject to availability' },
  { icon:'🦷', name:'Dental',              desc:'Oral care & surgery',                    avail:false, wait:'Closed today' },
];

const SYMPTOMS_DATA = [
  { icon:'🤒', label:'Fever' },           { icon:'💔', label:'Chest Pain' },
  { icon:'😮‍💨', label:'Breathlessness' },  { icon:'🤢', label:'Nausea / Vomiting' },
  { icon:'🦴', label:'Bone / Joint Pain'},{ icon:'🤕', label:'Head Injury' },
  { icon:'👁️', label:'Eye Problem' },     { icon:'🧠', label:'Dizziness' },
  { icon:'🩸', label:'Bleeding' },        { icon:'😣', label:'Stomach Pain' },
  { icon:'👶', label:'Child Illness' },   { icon:'🦷', label:'Tooth Pain' },
];

const SYMPTOM_ADVICE_DATA = {
  'Chest Pain':         { urgency:'urgent',   title:'🚨 Go to Emergency NOW',    msg:'Chest pain can indicate a heart attack. Go to Emergency immediately or call 108.',          depts:['Emergency','Cardiology'] },
  'Breathlessness':     { urgency:'urgent',   title:'🚨 Urgent Care Needed',     msg:'Difficulty breathing requires immediate attention. Go to Emergency right away.',            depts:['Emergency','Cardiology'] },
  'Head Injury':        { urgency:'urgent',   title:'🚨 Emergency Required',     msg:'Head injuries can be serious. Go to Emergency immediately.',                                depts:['Emergency','Neurology'] },
  'Bleeding':           { urgency:'urgent',   title:'🚨 Emergency Department',   msg:'Significant bleeding needs immediate attention. Go to Emergency or call 108.',              depts:['Emergency'] },
  'Fever':              { urgency:'moderate', title:'⚠️ Visit OPD Today',        msg:'Fever needs evaluation. If above 104°F or lasting 3+ days, seek urgent care.',             depts:['General OPD','Paediatrics (if child)'] },
  'Nausea / Vomiting':  { urgency:'moderate', title:'⚠️ Visit OPD Today',        msg:'Persistent nausea should be evaluated. Go to Emergency if unable to keep fluids down.',   depts:['General OPD'] },
  'Stomach Pain':       { urgency:'moderate', title:'⚠️ Visit OPD Today',        msg:'Abdominal pain should be assessed. If severe or sudden, go to Emergency.',                 depts:['General OPD','Emergency (if severe)'] },
  'Dizziness':          { urgency:'moderate', title:'⚠️ Get Checked Soon',       msg:'Sit down safely, then visit OPD or Neurology for evaluation.',                             depts:['General OPD','Neurology'] },
  'Bone / Joint Pain':  { urgency:'mild',     title:'✅ Schedule OPD Visit',     msg:'Visit Orthopaedics during OPD hours for evaluation.',                                       depts:['Orthopaedics'] },
  'Eye Problem':        { urgency:'mild',     title:'✅ Visit Ophthalmology',     msg:'Visit Ophthalmology during OPD hours. For sudden vision loss, go to Emergency.',           depts:['Ophthalmology'] },
  'Child Illness':      { urgency:'moderate', title:'⚠️ Visit Paediatrics',      msg:'Visit Paediatrics department. For very young infants with fever, seek urgent care.',        depts:['Paediatrics'] },
  'Tooth Pain':         { urgency:'mild',     title:'✅ Visit Dental Dept',       msg:'Visit Dental during OPD hours. Note: Dental is currently closed today.',                   depts:['Dental'] },
};

let selectedSymptoms = new Set();
let visibleServicesList = SERVICES_DATA;

function initPatient() {
  if (!document.getElementById('patient-page')) return;
  renderPatientResources();
  renderServices();
  renderSymptomGrid();
  setInterval(() => {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }, 60000);
}

function renderPatientResources() {
  const r = getRes();
  const items = [
    { icon:'🛏️', label:'ICU Beds',    val:r.icu,  max:INIT_RES_PATIENT.icu,  color:'#0D9488', info:'Intensive Care Unit beds for critical patients requiring 24/7 monitoring.' },
    { icon:'🏨', label:'Gen. Beds',   val:r.gen,  max:INIT_RES_PATIENT.gen,  color:'#06B6D4', info:'General ward beds available for admitted patients.' },
    { icon:'🫁', label:'Ventilators', val:r.vent, max:INIT_RES_PATIENT.vent, color:'#6366F1', info:'Mechanical ventilators for patients who need breathing assistance.' },
    { icon:'👨‍⚕️', label:'Doctors',    val:r.doc,  max:INIT_RES_PATIENT.doc,  color:'#22C55E', info:'Doctors currently on duty and available for consultation.' },
  ];
  const pct = (v, m) => Math.round((v / m) * 100);
  const statusInfo = (p) => p === 0 ? ['Full — Not Available', 'status-crit'] : p <= 30 ? ['Very Limited', 'status-crit'] : p <= 60 ? ['Limited Availability', 'status-warn'] : ['Available', 'status-good'];
  const grid = document.getElementById('resAvailGrid');
  if (!grid) return;
  grid.innerHTML = items.map(item => {
    const p = pct(item.val, item.max);
    const [slabel, sclass] = statusInfo(p);
    const borderColor = p === 0 ? '#EF4444' : p <= 30 ? '#F59E0B' : item.color;
    return `
    <div class="res-avail-card" style="border-top-color:${borderColor}">
      <div class="rac-tooltip" onclick="showModal('${item.icon}','${item.label}','${item.info}')">ℹ️</div>
      <div class="rac-icon">${item.icon}</div>
      <div class="rac-num" style="color:${borderColor}">${item.val}</div>
      <div class="rac-label">${item.label} available</div>
      <div class="rac-bar"><div class="rac-fill" style="width:${p}%;background:${borderColor}"></div></div>
      <div class="rac-status ${sclass}">${slabel}</div>
    </div>`;
  }).join('');
}

function renderServices(list = visibleServicesList) {
  const wrap = document.getElementById('servicesTable');
  if (!wrap) return;
  wrap.innerHTML = list.map(s => {
    const badge = s.avail
      ? `<span class="sr-badge badge-open">✅ Available</span>`
      : `<span class="sr-badge badge-full">❌ Unavailable</span>`;
    return `
    <div class="service-row" style="${!s.avail ? 'opacity:0.55' : ''}">
      <div class="sr-icon">${s.icon}</div>
      <div class="sr-info">
        <div class="sr-name">${s.name}</div>
        <div class="sr-desc">${s.desc}</div>
      </div>
      <div class="sr-status-wrap">
        <span style="font-size:12px;color:${s.avail ? '#0D9488' : '#94A3B8'};font-weight:600;white-space:nowrap">${s.wait}</span>
        ${badge}
      </div>
    </div>`;
  }).join('');
}

function filterServices() {
  const q = (document.getElementById('serviceSearch') || {}).value?.toLowerCase().trim();
  const tag = document.getElementById('searchTag');
  if (!q) { visibleServicesList = SERVICES_DATA; if (tag) tag.style.display = 'none'; renderServices(); return; }
  visibleServicesList = SERVICES_DATA.filter(s => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  if (tag) { tag.style.display = 'inline-block'; tag.textContent = `${visibleServicesList.length} result${visibleServicesList.length !== 1 ? 's' : ''}`; }
  renderServices(visibleServicesList);
}

function renderSymptomGrid() {
  const grid = document.getElementById('symptomGrid');
  if (!grid) return;
  grid.innerHTML = SYMPTOMS_DATA.map(s => `
    <div class="sym-chip" onclick="toggleSymptom(this,'${s.label}')">
      <div class="sym-icon">${s.icon}</div>
      <div class="sym-label">${s.label}</div>
    </div>`).join('');
}

function toggleSymptom(el, label) {
  if (selectedSymptoms.has(label)) { selectedSymptoms.delete(label); el.classList.remove('selected'); }
  else { selectedSymptoms.add(label); el.classList.add('selected'); }
  const btn = document.getElementById('checkBtn');
  if (!btn) return;
  btn.disabled = selectedSymptoms.size === 0;
  btn.textContent = selectedSymptoms.size
    ? `Check ${selectedSymptoms.size} symptom${selectedSymptoms.size > 1 ? 's' : ''} →`
    : 'Select symptoms above to check →';
  const rec = document.getElementById('recommendation');
  if (rec) rec.style.display = 'none';
}

function checkSymptoms() {
  if (!selectedSymptoms.size) return;
  const rank = { urgent:3, moderate:2, mild:1 };
  let result = null;
  selectedSymptoms.forEach(sym => {
    const advice = SYMPTOM_ADVICE_DATA[sym];
    if (!advice) return;
    if (!result || rank[advice.urgency] > rank[result.urgency]) result = advice;
  });
  if (!result) result = { urgency:'mild', title:'✅ Visit OPD', msg:'Please visit General OPD for an evaluation.', depts:['General OPD'] };
  const rec = document.getElementById('recommendation');
  if (!rec) return;
  rec.style.display = 'block';
  rec.innerHTML = `
    <div class="rec-box ${result.urgency}">
      <div class="rec-title">${result.title}</div>
      <div class="rec-msg">${result.msg}</div>
      <div class="rec-dept">${result.depts.map(d => `<span class="rec-dept-tag">→ ${d}</span>`).join('')}</div>
    </div>`;
}

function simulateRefresh() {
  const btn = document.getElementById('refreshBtn');
  if (!btn) return;
  btn.classList.add('loading');
  setTimeout(() => {
    btn.classList.remove('loading');
    renderPatientResources();
    renderServices();
    const lu = document.getElementById('lastUpdated');
    if (lu) lu.textContent = 'just now';
    showModal('✅', 'Updated!', 'Hospital availability data has been refreshed successfully.');
  }, 1200);
}

/* ══════════════════════════════════════════════════════════════
   AUTO-INIT ON PAGE LOAD
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initIndex();
  initLogin();
  initDashboard();
  initPatient();
});
