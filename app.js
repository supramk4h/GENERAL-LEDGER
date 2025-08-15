/* ==================== CONFIG ===================== */
const WEB_APP_URL = "https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/AKfycbxi7g8SVmn0j7lPsjNPtq6KgS57TtW7LS5LEnJvrTDducMjU8-m5Fr0XMkq_0xrAqljGA/exec"; // Replace with your Web App URL

/* ==================== State ======================= */
let transactions = [];
const selectors = { 
  ledgerBody: document.getElementById("ledgerBody"),
  form: document.getElementById("transactionForm"),
  date: document.getElementById("date"),
  account: document.getElementById("account"),
  accountsList: document.getElementById("accountsList"),
  type: document.getElementById("type"),
  amount: document.getElementById("amount"),
  description: document.getElementById("description"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  filterAccount: document.getElementById("filterAccount"),
  filterType: document.getElementById("filterType"),
  filterFrom: document.getElementById("filterFrom"),
  filterTo: document.getElementById("filterTo"),
  applyFilters: document.getElementById("applyFilters"),
  clearFilters: document.getElementById("clearFilters"),
  exportCsv: document.getElementById("exportCsv"),
  printBtn: document.getElementById("printBtn"),
  totalDebits: document.getElementById("totalDebits"),
  totalCredits: document.getElementById("totalCredits"),
  netWealth: document.getElementById("netWealth")
};

/* ==================== Initialization ===================== */
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDate();
  bindEvents();
  fetchTransactions();
});

/* ---------------- set today's date as default ---------------- */
function setDefaultDate(){
  selectors.date.value = new Date().toISOString().slice(0,10);
}

/* ---------------- bind UI events ---------------- */
function bindEvents(){
  selectors.form.addEventListener("submit", onFormSubmit);
  selectors.resetBtn.addEventListener("click", () => selectors.form.reset() );
  selectors.applyFilters.addEventListener("click", applyFilters);
  selectors.clearFilters.addEventListener("click", clearFilters);
  selectors.exportCsv.addEventListener("click", exportCSV);
  selectors.printBtn.addEventListener("click", () => window.print());
}

/* ==================== Fetch / Post ===================== */
async function fetchTransactions(){
  if (!WEB_APP_URL) {
    alert("Please set the WEB_APP_URL in app.js");
    return;
  }

  try {
    const res = await fetch(WEB_APP_URL + "?action=getAll");
    if (!res.ok) throw new Error(`Network error: ${res.status}`);
    const data = await res.json();
    transactions = data.map(row => ({
      Date: row.Date,
      Account: row.Account,
      Type: row.Type,
      Amount: parseFloat(row.Amount) || 0,
      Description: row.Description || "",
      Timestamp: row.Timestamp || ""
    }));
    populateAccountDatalist();
    renderTable(transactions);
    populateFilters();
    calculateSummary(transactions);
  } catch (err) {
    console.error("Fetch error:", err);
    alert("Failed to fetch transactions. Make sure the Web App URL is correct, deployed as 'Anyone, even anonymous', and your browser allows network requests.");
  }
}

async function postTransaction(payload){
  try {
    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const rjson = await res.json();
    if (!res.ok || rjson.status === "error") throw new Error(rjson.message || "POST failed");
    return rjson;
  } catch (err) {
    console.error("POST error:", err);
    throw err;
  }
}

/* ==================== Form handling ===================== */
function onFormSubmit(e){
  e.preventDefault();

  const date = selectors.date.value;
  const account = selectors.account.value.trim();
  const type = selectors.type.value;
  const amount = selectors.amount.value;
  const description = selectors.description.value.trim();

  const validation = validateForm({date, account, type, amount});
  if (!validation.ok){
    alert("Validation error: " + validation.message);
    return;
  }

  const payload = {
    Date: date,
    Account: account,
    Type: type,
    Amount: parseFloat(parseFloat(amount).toFixed(2)),
    Description: description
  };

  selectors.submitBtn.disabled = true;
  selectors.submitBtn.textContent = "Adding...";

  postTransaction(payload)
    .then(() => {
      selectors.form.reset();
      setDefaultDate();
      fetchTransactions();
    })
    .catch(err => {
      alert("Failed to add transaction: " + (err.message || err));
    })
    .finally(() => {
      selectors.submitBtn.disabled = false;
      selectors.submitBtn.textContent = "Add Transaction";
    });
}

function validateForm({date, account, type, amount}){
  if (!date) return {ok:false, message:"Date is required"};
  if (!account) return {ok:false, message:"Account name is required"};
  if (!type || (type !== "Debit" && type !== "Credit")) return {ok:false, message:"Select Debit or Credit"};
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return {ok:false, message:"Amount must be a positive number"};
  return {ok:true};
}

/* ==================== Rendering ===================== */
function renderTable(data){
  selectors.ledgerBody.innerHTML = "";
  if (!data.length){
    selectors.ledgerBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:20px">No transactions found.</td></tr>`;
    return;
  }

  const sorted = data.slice().sort((a,b) => new Date(a.Date) - new Date(b.Date));
  selectors.ledgerBody.innerHTML = sorted.map(tx => `
    <tr>
      <td>${escapeHtml(tx.Date)}</td>
      <td>${escapeHtml(tx.Account)}</td>
      <td>${escapeHtml(tx.Type)}</td>
      <td class="right">${formatCurrency(tx.Amount)}</td>
      <td>${escapeHtml(tx.Description)}</td>
    </tr>`).join("");
}

function populateAccountDatalist(){
  const unique = [...new Set(transactions.map(t => t.Account).filter(Boolean))].sort();
  selectors.accountsList.innerHTML = unique.map(a => `<option value="${escapeHtml(a)}">`).join("");
}

function populateFilters(){
  const unique = [...new Set(transactions.map(t => t.Account).filter(Boolean))].sort();
  selectors.filterAccount.innerHTML = `<option value="All">All</option>` + unique.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
}

/* ==================== Summary ===================== */
function calculateSummary(data){
  let totalDebits=0, totalCredits=0;
  for (const tx of data){
    if (tx.Type==="Debit") totalDebits+=Number(tx.Amount)||0;
    if (tx.Type==="Credit") totalCredits+=Number(tx.Amount)||0;
  }
  selectors.totalDebits.textContent=formatCurrency(totalDebits);
  selectors.totalCredits.textContent=formatCurrency(totalCredits);
  selectors.netWealth.textContent=formatCurrency(totalDebits - totalCredits);
}

/* ==================== Filters ===================== */
function applyFilters(){
  let filtered = transactions.slice();
  const acc = selectors.filterAccount.value;
  const type = selectors.filterType.value;
  const from = selectors.filterFrom.value;
  const to = selectors.filterTo.value;

  if(acc && acc!=="All") filtered=filtered.filter(t=>t.Account===acc);
  if(type && type!=="All") filtered=filtered.filter(t=>t.Type===type);
  if(from) filtered=filtered.filter(t=>new Date(t.Date)>=new Date(from));
  if(to) filtered=filtered.filter(t=>new Date(t.Date)<=new Date(to));

  renderTable(filtered);
  calculateSummary(filtered);
}

function clearFilters(){
  selectors.filterAccount.value="All";
  selectors.filterType.value="All";
  selectors.filterFrom.value="";
  selectors.filterTo.value="";
  renderTable(transactions);
  calculateSummary(transactions);
}

/* ==================== Export CSV ===================== */
function exportCSV(){
  if(!transactions.length){ alert("No data to export."); return; }

  const rows=[["Date","Account","Type","Amount","Description"]];
  Array.from(selectors.ledgerBody.querySelectorAll("tr")).forEach(tr=>{
    const tds=Array.from(tr.querySelectorAll("td"));
    if(tds.length!==5) return;
    rows.push(tds.map(td=>td.textContent.trim()));
  });

  const csvContent = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csvContent],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`ledger_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ==================== Helpers ===================== */
function formatCurrency(num){ return Number(num||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function escapeHtml(str){ if(str===undefined||str===null) return ""; return String(str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }
