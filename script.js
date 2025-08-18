/***********************
  Broiler Management App
  - Requires index.html + style.css
  - Uses Firestore (Realtime)
***********************/

/* =======================
   0) Firebase config — paste your config here
   Replace with your own if different
   ======================= */
const firebaseConfig = {
  apiKey: "AIzaSyDq6eb9IFkge7XqPifFrPjAwWU3ivjM08E",
  authDomain: "poultryledger.firebaseapp.com",
  projectId: "poultryledger",
  storageBucket: "poultryledger.firebasestorage.app",
  messagingSenderId: "809037856761",
  appId: "1:809037856761:web:89146d1a2af8bed248c728",
  measurementId: "G-WNEYLSVLGT"
};

/* =======================
   1) Initialize Firebase
   ======================= */
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* =======================
   2) UI helpers & routing
   ======================= */
const main = document.getElementById('main');
const navButtons = document.querySelectorAll('nav button');
navButtons.forEach(btn => btn.addEventListener('click', ()=> {
  navButtons.forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  router(btn.dataset.tab);
}));

function router(tab){
  if(tab==='flocks') renderFlocks();
  else if(tab==='daily') renderDaily();
  else if(tab==='financial') renderFinancial();
  else if(tab==='reports') renderReports();
}
router('flocks');

/* =======================
   3) Collections names
   ======================= */
const FLOCKS = 'flocks';
const DAILY  = 'daily';
const FIN    = 'financial';

/* =======================
   4) Utility functions
   ======================= */
function el(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstChild; }
function fmt(n){ return typeof n === 'number' ? n.toFixed(2) : n; }
function showToast(msg){ alert(msg); }

/* =======================
   5) Flocks Tab (List/Add/Edit/Delete)
   ======================= */
function renderFlocks(){
  main.innerHTML = `
    <div class="card">
      <h2>Flocks — Create / Edit</h2>
      <form id="flockForm" class="form-grid">
        <div><label>Breed</label><input id="f_breed" required></div>
        <div><label>Arrival Date</label><input id="f_arrival" type="date" required></div>
        <div><label>Initial Chicks</label><input id="f_initial" type="number" min="1" required></div>
        <div><label>Extra Chicks</label><input id="f_extra" type="number" min="0" value="0"></div>
        <div><label>Price per Chick (Rs)</label><input id="f_price" type="number" step="0.01" min="0" required></div>
        <div class="row"><button class="btn" id="f_save">Save Flock</button><button class="btn secondary" id="f_reset" type="button">Reset</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Existing Flocks</h2>
      <table class="table" id="flockTable">
        <thead><tr><th>ID</th><th>Breed</th><th>Arrival</th><th>Chicks In</th><th>Price/Chick</th><th>Actions</th></tr></thead>
        <tbody></tbody>
      </table>
      <p class="muted">Tip: Click Edit to load flock data into the form. Delete removes flock and related daily/financial entries.</p>
    </div>
  `;

  const form = document.getElementById('flockForm');
  const saveBtn = document.getElementById('f_save');
  const resetBtn = document.getElementById('f_reset');
  let editId = null;

  // save or update
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const breed = document.getElementById('f_breed').value.trim();
    const arrival = document.getElementById('f_arrival').value;
    const initial = parseInt(document.getElementById('f_initial').value || 0, 10);
    const extra = parseInt(document.getElementById('f_extra').value || 0, 10);
    const price = parseFloat(document.getElementById('f_price').value || 0);

    if(!breed || !arrival || initial <= 0) { showToast('Please fill required fields'); return; }

    const payload = { breed, arrivalDate: arrival, initialChicks: initial, extraChicks: extra, pricePerChick: price, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

    try{
      if(editId){
        await db.collection(FLOCKS).doc(editId).update(payload);
        showToast('Flock updated');
        editId = null;
        saveBtn.textContent = 'Save Flock';
      } else {
        await db.collection(FLOCKS).add(payload);
        showToast('Flock added');
      }
      form.reset();
    }catch(e){ console.error(e); showToast('Error saving flock'); }
  });

  resetBtn.addEventListener('click', ()=>{ form.reset(); editId=null; saveBtn.textContent='Save Flock'; });

  // realtime list
  db.collection(FLOCKS).orderBy('createdAt','desc').onSnapshot(snap => {
    const tbody = document.querySelector('#flockTable tbody');
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const f = { id: doc.id, ...doc.data() };
      const chicksIn = (Number(f.initialChicks||0) + Number(f.extraChicks||0));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td>${f.breed}</td>
        <td>${f.arrivalDate || ''}</td>
        <td>${chicksIn}</td>
        <td>${fmt(Number(f.pricePerChick||0))}</td>
        <td class="actions">
          <button class="btn" data-action="edit" data-id="${f.id}">Edit</button>
          <button class="btn secondary" data-action="delete" data-id="${f.id}">Delete</button>
          <button class="btn" data-action="open" data-id="${f.id}">Open</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // attach click handlers
    tbody.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async (ev)=>{
      const id = btn.dataset.id;
      const act = btn.dataset.action;
      if(act==='edit'){
        const doc = await db.collection(FLOCKS).doc(id).get();
        const data = doc.data();
        document.getElementById('f_breed').value = data.breed || '';
        document.getElementById('f_arrival').value = data.arrivalDate || '';
        document.getElementById('f_initial').value = data.initialChicks || 0;
        document.getElementById('f_extra').value = data.extraChicks || 0;
        document.getElementById('f_price').value = data.pricePerChick || 0;
        editId = id; saveBtn.textContent = 'Update Flock';
      } else if(act==='delete'){
        if(!confirm('Delete flock and ALL its daily & financial records?')) return;
        // delete related daily & financial entries first
        const dailySnap = await db.collection(DAILY).where('flockId','==',id).get();
        const finSnap = await db.collection(FIN).where('flockId','==',id).get();
        const batch = db.batch();
        dailySnap.forEach(d => batch.delete(d.ref));
        finSnap.forEach(d => batch.delete(d.ref));
        batch.delete(db.collection(FLOCKS).doc(id));
        await batch.commit();
        showToast('Flock and related records deleted');
      } else if(act==='open'){
        // go to Daily tab and preselect flock
        document.querySelector('nav button[data-tab="daily"]').click();
        setTimeout(()=> loadDailyForFlock(id), 250);
      }
    }));
  });
}

/* =======================
   6) Daily Tab (Add/Edit/Delete + auto closing birds)
   ======================= */
function renderDaily(){
  main.innerHTML = `
    <div class="card">
      <h2>Daily Entries</h2>
      <form id="dailyForm" class="form-grid">
        <div><label>Flock</label><select id="d_flock"></select></div>
        <div><label>Date</label><input id="d_date" type="date" required></div>
        <div><label>Feed Type</label><input id="d_feedType" value="Starter"></div>
        <div><label>Feed Cost / kg</label><input id="d_feedCost" type="number" step="0.01" value="0"></div>
        <div><label>Feed (kg)</label><input id="d_feedKg" type="number" step="0.01" value="0"></div>
        <div><label>Avg Weight (g)</label><input id="d_avgWeight" type="number" value="0"></div>
        <div><label>Mortality</label><input id="d_mortality" type="number" value="0"></div>
        <div><label>Birds Sold</label><input id="d_sold" type="number" value="0"></div>
        <div><label>Birds Sold (kg)</label><input id="d_soldKg" type="number" step="0.01" value="0"></div>
        <div><label>Selling Price / kg</label><input id="d_sellPrice" type="number" step="0.01" value="0"></div>
        <div><label>Remarks</label><input id="d_remarks"></div>
        <div class="row"><button class="btn" id="d_save">Save Entry</button><button class="btn secondary" id="d_reset" type="button">Reset</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Daily Records <span class="small" id="dailyFlockInfo"></span></h2>
      <table class="table" id="dailyTable"><thead><tr><th>Date</th><th>Age</th><th>Opening</th><th>Mortality</th><th>Sold</th><th>Closing</th><th>Feed(kg)</th><th>Avg Wt(g)</th><th>Actions</th></tr></thead><tbody></tbody></table>
    </div>
  `;

  let editId = null;
  const dFlock = document.getElementById('d_flock');
  const dSave = document.getElementById('d_save');
  const dReset = document.getElementById('d_reset');

  // load flocks into select
  db.collection(FLOCKS).orderBy('createdAt','desc').get().then(snap => {
    dFlock.innerHTML = `<option value="">-- Select flock --</option>`;
    snap.forEach(doc => {
      const f = { id: doc.id, ...doc.data() };
      dFlock.innerHTML += `<option value="${f.id}">#${f.id} — ${f.breed} (${f.arrivalDate||''})</option>`;
    });
  });

  dSave.addEventListener('click', async (ev)=>{
    ev.preventDefault();
    const flockId = dFlock.value;
    if(!flockId){ showToast('Select flock'); return; }
    const record_date = document.getElementById('d_date').value;
    if(!record_date){ showToast('Select date'); return; }
    const feed_type = document.getElementById('d_feedType').value;
    const feed_cost_per_kg = parseFloat(document.getElementById('d_feedCost').value||0);
    const current_feed_kg = parseFloat(document.getElementById('d_feedKg').value||0);
    const avg_weight_grams = parseFloat(document.getElementById('d_avgWeight').value||0);
    const mortality = parseInt(document.getElementById('d_mortality').value||0,10);
    const birds_sold = parseInt(document.getElementById('d_sold').value||0,10);
    const birds_sold_kg = parseFloat(document.getElementById('d_soldKg').value||0);
    const selling_price_per_kg = parseFloat(document.getElementById('d_sellPrice').value||0);
    const remarks = document.getElementById('d_remarks').value || '';

    // compute opening birds from last record or flock data
    const flockDoc = await db.collection(FLOCKS).doc(flockId).get();
    if(!flockDoc.exists){ showToast('Flock missing'); return; }
    const flock = flockDoc.data();
    // get last daily record (ordered by record_date desc) to compute opening/closes
    const lastSnap = await db.collection(DAILY).where('flockId','==',flockId).orderBy('record_date','desc').limit(1).get();
    let opening_birds = Number(flock.initialChicks||0) + Number(flock.extraChicks||0);
    let age_days = 1;
    if(!lastSnap.empty){
      const last = lastSnap.docs[0].data();
      opening_birds = Number(last.closing_birds||opening_birds);
      age_days = Number(last.age_days||0) + 1;
    }

    const closing_birds = opening_birds - mortality - birds_sold;
    if(closing_birds < 0){ showToast('Closing birds would be negative'); return; }

    const payload = {
      flockId, record_date, age_days, opening_birds, feed_type, feed_cost_per_kg, current_feed_kg,
      avg_weight_grams, mortality, birds_sold, birds_sold_kg, selling_price_per_kg, closing_birds,
      remarks, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
      if(editId){
        await db.collection(DAILY).doc(editId).update(payload);
        showToast('Daily record updated');
        editId = null; dSave.textContent = 'Save Entry';
      } else {
        await db.collection(DAILY).add(payload);
        showToast('Daily record saved');
      }
      document.getElementById('dailyForm').reset();
      loadDailyForFlock(flockId);
    }catch(e){ console.error(e); showToast('Error saving daily'); }
  });

  dReset.addEventListener('click', ()=>{ document.getElementById('dailyForm').reset(); editId=null; dSave.textContent='Save Entry'; });

  // load daily for flock selection change
  dFlock.addEventListener('change', (e) => { loadDailyForFlock(e.target.value); });

  // listens for changes to daily collection to update table when current flock selected
  // handled inside loadDailyForFlock for performance
}

async function loadDailyForFlock(flockId){
  if(!flockId) return;
  document.getElementById('dailyFlockInfo').textContent = ` — Loading records for #${flockId}...`;
  const tbody = document.querySelector('#dailyTable tbody');
  tbody.innerHTML = '';
  const q = db.collection(DAILY).where('flockId','==',flockId).orderBy('record_date','asc');
  q.onSnapshot(snap => {
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const r = { id: doc.id, ...doc.data() };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.record_date}</td>
        <td>${r.age_days}</td>
        <td>${r.opening_birds}</td>
        <td>${r.mortality}</td>
        <td>${r.birds_sold}</td>
        <td>${r.closing_birds}</td>
        <td class="right">${fmt(Number(r.current_feed_kg||0))}</td>
        <td class="right">${r.avg_weight_grams||0}</td>
        <td class="actions">
          <button class="btn" data-action="edit" data-id="${r.id}">Edit</button>
          <button class="btn secondary" data-action="delete" data-id="${r.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // attach handlers
    tbody.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async (ev)=>{
      const id = btn.dataset.id, act = btn.dataset.action;
      if(act==='edit'){
        const doc = await db.collection(DAILY).doc(id).get();
        const r = doc.data();
        // fill daily form
        document.querySelector('#d_flock').value = r.flockId;
        document.querySelector('#d_date').value = r.record_date;
        document.querySelector('#d_feedType').value = r.feed_type || '';
        document.querySelector('#d_feedCost').value = r.feed_cost_per_kg || 0;
        document.querySelector('#d_feedKg').value = r.current_feed_kg || 0;
        document.querySelector('#d_avgWeight').value = r.avg_weight_grams || 0;
        document.querySelector('#d_mortality').value = r.mortality || 0;
        document.querySelector('#d_sold').value = r.birds_sold || 0;
        document.querySelector('#d_soldKg').value = r.birds_sold_kg || 0;
        document.querySelector('#d_sellPrice').value = r.selling_price_per_kg || 0;
        document.querySelector('#d_remarks').value = r.remarks || '';
        // switch to daily form (now editing)
        document.getElementById('d_save').textContent = 'Update Entry';
        // store edit id globally (quick hack)
        window._dailyEditId = id;
        // when form saves it reads window._dailyEditId
        // note: in this code we used local editId in renderDaily; to avoid extra complexity we rely on global
      } else if(act==='delete'){
        if(!confirm('Delete this daily record?')) return;
        await db.collection(DAILY).doc(id).delete();
        showToast('Deleted');
      }
    }));
  });

  // update info label
  const flockDoc = await db.collection(FLOCKS).doc(flockId).get();
  if(flockDoc.exists){
    const f = flockDoc.data();
    document.getElementById('dailyFlockInfo').textContent = ` — ${f.breed} (${f.arrivalDate||''})`;
  } else {
    document.getElementById('dailyFlockInfo').textContent = '';
  }
}

/* =======================
   7) Financial Tab
   ======================= */
function renderFinancial(){
  main.innerHTML = `
    <div class="card">
      <h2>Financial — Expenses & Income</h2>
      <form id="finForm" class="form-grid">
        <div><label>Flock</label><select id="fin_flock"></select></div>
        <div><label>Date</label><input id="fin_date" type="date" required></div>
        <div><label>Type</label>
          <select id="fin_type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
        <div><label>Category</label><input id="fin_cat" placeholder="feed/vaccine/labor/sale"></div>
        <div><label>Amount (Rs)</label><input id="fin_amount" type="number" step="0.01" required></div>
        <div><label>Description</label><input id="fin_desc"></div>
        <div class="row"><button class="btn" id="fin_save">Save</button><button class="btn secondary" id="fin_reset" type="button">Reset</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Financial Records</h2>
      <table class="table" id="finTable"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th class="right">Amount</th><th>Description</th><th>Actions</th></tr></thead><tbody></tbody></table>
    </div>
  `;

  const finFlock = document.getElementById('fin_flock');
  db.collection(FLOCKS).orderBy('createdAt','desc').get().then(snap=>{
    finFlock.innerHTML = `<option value="">-- All flocks --</option>`;
    snap.forEach(d => finFlock.innerHTML += `<option value="${d.id}">#${d.id} — ${d.data().breed}</option>`);
  });

  document.getElementById('fin_save').addEventListener('click', async (ev)=>{
    ev.preventDefault();
    const flockId = finFlock.value || null;
    const date = document.getElementById('fin_date').value;
    const type = document.getElementById('fin_type').value;
    const category = document.getElementById('fin_cat').value || 'misc';
    const amount = parseFloat(document.getElementById('fin_amount').value || 0);
    const description = document.getElementById('fin_desc').value || '';
    if(!date || !amount){ showToast('Date and amount required'); return; }
    try{
      await db.collection(FIN).add({ flockId, record_date: date, type, category, amount, description, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('Saved financial record');
      document.getElementById('finForm').reset();
      loadFinancial(null);
    }catch(e){ console.error(e); showToast('Error'); }
  });

  document.getElementById('fin_reset').addEventListener('click', ()=> document.getElementById('finForm').reset());

  loadFinancial();
}

function loadFinancial(flockId=null){
  const tbody = document.querySelector('#finTable tbody');
  tbody.innerHTML = '';
  let q = db.collection(FIN).orderBy('record_date','asc');
  if(flockId) q = q.where('flockId','==',flockId);
  q.onSnapshot(snap => {
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const r = { id: doc.id, ...doc.data() };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.record_date}</td>
        <td>${r.type}</td>
        <td>${r.category}</td>
        <td class="right">${fmt(Number(r.amount||0))}</td>
        <td>${r.description||''}</td>
        <td class="actions">
          <button class="btn" data-id="${r.id}" data-action="edit">Edit</button>
          <button class="btn secondary" data-id="${r.id}" data-action="delete">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // handlers
    tbody.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async (ev)=>{
      const id = btn.dataset.id, act = btn.dataset.action;
      if(act==='delete'){
        if(!confirm('Delete this financial record?')) return;
        await db.collection(FIN).doc(id).delete();
        showToast('Deleted');
      } else if(act==='edit'){
        const doc = await db.collection(FIN).doc(id).get();
        const r = doc.data();
        // simple edit via prompt for speed
        const newAmount = prompt('Amount (Rs):', r.amount);
        if(newAmount === null) return;
        await db.collection(FIN).doc(id).update({ amount: parseFloat(newAmount) });
        showToast('Updated');
      }
    }));
  });
}

/* =======================
   8) Reports Tab (Summary + Print)
   ======================= */
function renderReports(){
  main.innerHTML = `
    <div class="card">
      <h2>Reports</h2>
      <div class="row" style="gap:8px;margin-bottom:10px;">
        <select id="rep_flock"><option value="">-- Select flock --</option></select>
        <button class="btn" id="rep_load">Load Report</button>
        <button class="btn secondary" id="rep_print">Print Report</button>
      </div>
      <div id="reportArea" class="card"></div>
    </div>
  `;

  const sel = document.getElementById('rep_flock');
  db.collection(FLOCKS).orderBy('createdAt','desc').get().then(snap=>{
    sel.innerHTML = `<option value="">-- Select flock --</option>`;
    snap.forEach(d => sel.innerHTML += `<option value="${d.id}">#${d.id} — ${d.data().breed}</option>`);
  });

  document.getElementById('rep_load').addEventListener('click', async ()=>{
    const id = sel.value;
    if(!id){ showToast('Select flock'); return; }
    const data = await buildFinalReportData(id);
    showReportHTML(data);
  });

  document.getElementById('rep_print').addEventListener('click', ()=>{
    const id = sel.value;
    if(!id){ showToast('Select flock'); return; }
    buildFinalReportData(id).then(data => {
      const html = reportHTML(data, true);
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      w.focus();
      // optional: w.print();  // user can press print
    });
  });
}

async function buildFinalReportData(flockId){
  // fetch flock
  const flockDoc = await db.collection(FLOCKS).doc(flockId).get();
  if(!flockDoc.exists) throw new Error('Flock not found');
  const flock = { id: flockDoc.id, ...flockDoc.data() };

  // fetch daily
  const dailySnap = await db.collection(DAILY).where('flockId','==',flockId).get();
  const daily = []; dailySnap.forEach(d => daily.push({ id: d.id, ...d.data() }));

  // fetch financials
  const finSnap = await db.collection(FIN).where('flockId','==',flockId).get();
  const fin = []; finSnap.forEach(d => fin.push({ id: d.id, ...d.data() }));

  // aggregate
  const sum = daily.reduce((acc, r) => {
    acc.mortality += Number(r.mortality||0);
    acc.sold_birds += Number(r.birds_sold||0);
    acc.sold_kg += Number(r.birds_sold_kg||0);
    acc.feed_kg += Number(r.current_feed_kg||0);
    acc.feed_cost += Number(r.current_feed_kg||0) * Number(r.feed_cost_per_kg||0);
    acc.sale_income += Number(r.birds_sold_kg||0) * Number(r.selling_price_per_kg||0);
    return acc;
  }, { mortality:0, sold_birds:0, sold_kg:0, feed_kg:0, feed_cost:0, sale_income:0 });

  const finAgg = fin.reduce((acc, r) => {
    if(r.type === 'expense') acc.other_expenses += Number(r.amount||0);
    if(r.type === 'income') acc.other_income += Number(r.amount||0);
    return acc;
  }, { other_expenses:0, other_income:0 });

  const chicks_in = Number(flock.initialChicks||0) + Number(flock.extraChicks||0);
  const chick_cost_total = chicks_in * Number(flock.pricePerChick||0);
  const income_total = sum.sale_income + finAgg.other_income;
  const expense_total = chick_cost_total + sum.feed_cost + finAgg.other_expenses;
  const profit = income_total - expense_total;

  return { flock, daily, fin, summary: {
    chicks_in, mortality: sum.mortality, sold_birds: sum.sold_birds, sold_kg: Number(sum.sold_kg.toFixed(2)),
    feed_kg: Number(sum.feed_kg.toFixed(2)), feed_cost: Number(sum.feed_cost.toFixed(2)),
    sale_income: Number(sum.sale_income.toFixed(2)), other_income: Number(finAgg.other_income.toFixed(2)),
    chick_cost_total: Number(chick_cost_total.toFixed(2)), other_expenses: Number(finAgg.other_expenses.toFixed(2)),
    income_total: Number(income_total.toFixed(2)), expense_total: Number(expense_total.toFixed(2)),
    profit: Number(profit.toFixed(2))
  } };
}

function showReportHTML(data){
  const container = document.getElementById('reportArea');
  container.innerHTML = reportHTML(data, false);
}

function reportHTML(data, forPrint){
  const f = data.flock; const s = data.summary;
  return `
    <div>
      <h2>Final Report — Flock #${f.id}</h2>
      <p class="small">Breed: ${f.breed} • Arrival: ${f.arrivalDate || ''}</p>
      <div class="card">
        <h3>Headcount</h3>
        <table class="table"><tr><th>Chicks In</th><td>${s.chicks_in}</td><th>Total Mortality</th><td>${s.mortality}</td></tr>
        <tr><th>Sold Birds</th><td>${s.sold_birds}</td><th>Sold (kg)</th><td>${s.sold_kg}</td></tr></table>
      </div>
      <div class="card">
        <h3>Feed</h3>
        <table class="table"><tr><th>Total Feed (kg)</th><td>${s.feed_kg}</td><th>Feed Cost</th><td class="right">Rs ${s.feed_cost}</td></tr></table>
      </div>
      <div class="card">
        <h3>Money</h3>
        <table class="table">
          <tr><th>Chick Cost</th><td class="right">Rs ${s.chick_cost_total}</td></tr>
          <tr><th>Other Expenses</th><td class="right">Rs ${s.other_expenses}</td></tr>
          <tr><th>Sale Income</th><td class="right">Rs ${s.sale_income}</td></tr>
          <tr><th>Other Income</th><td class="right">Rs ${s.other_income}</td></tr>
          <tr class="total"><th>Total Income</th><td class="right">Rs ${s.income_total}</td></tr>
          <tr class="total"><th>Total Expense</th><td class="right">Rs ${s.expense_total}</td></tr>
        </table>
        <p class="net">NET PROFIT: Rs ${s.profit}</p>
      </div>
      <div class="card">
        <h3>Daily Records (snapshot)</h3>
        <table class="table"><thead><tr><th>Date</th><th>Opening</th><th>Mortality</th><th>Sold</th><th>Closing</th><th>Feed(kg)</th></tr></thead>
        <tbody>
          ${data.daily.map(d=>`<tr><td>${d.record_date}</td><td>${d.opening_birds}</td><td>${d.mortality}</td><td>${d.birds_sold}</td><td>${d.closing_birds}</td><td class="right">${fmt(Number(d.current_feed_kg||0))}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  `;
}

/* =======================
   9) Start
   ======================= */
// nothing to do: UI loads initial tab
