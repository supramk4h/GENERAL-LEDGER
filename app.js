/**
 * Book Ledger frontend script
 * - Replace WEB_APP_URL with your deployed Google Apps Script Web App URL (see instructions).
 * - This file handles: form validation, fetch GET/POST, rendering table, filters, summaries, export CSV, print.
 */

/* ==================== CONFIG ===================== */
// TODO: Replace this with your Apps Script Web App URL after deploying the script
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyVjNenej8DX-Nw7j9WqLOO-yLXEJErB6eqMh5eBGP8Wld_sTkteGtzJmMeQpnKVcMXOw/exec";

/* ==================== State ======================= */
let transactions = []; // will hold all transactions fetched from Google Sheets
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
  fetchTransactions(); // load data from Google Sheets on startup
});

/* ---------------- set today's date as default ---------------- */
function setDefaultDate(){
  const today = new Date().toISOString().slice(0,10);
  selectors.date.value = today;
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

/* ==================== Fetch / Post to Google Sheets ===================== */

/**
 * Fetch all transactions from the Apps Script doGet endpoint.
 * Expects the Web App to return JSON array of transactions.
 */
async function fetchTransactions(){
  if (!WEB_APP_URL || WEB_APP_URL.includes("https://script.google.com/macros/s/AKfycbyVjNenej8DX-Nw7j9WqLOO-yLXEJErB6eqMh5eBGP8Wld_sTkteGtzJmMeQpnKVcMXOw/exec")){
    alert("https://script.google.com/macros/s/AKfycbyVjNenej8DX-Nw7j9WqLOO-yLXEJErB6eqMh5eBGP8Wld_sTkteGtzJmMeQpnKVcMXOw/exec");
    return;
  }

  try {
    // GET request to fetch all transactions
    const res = await fetch(WEB_APP_URL + "?action=getAll");
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    // Expect data to be an array of objects: { Date, Account, Type, Amount, Description, Timestamp }
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
    console.error("Error fetching transactions:", err);
    alert("Error fetching transactions. Check the WEB_APP_URL, deployment permissions, and that the Apps Script web app is deployed with access 'Anyone, even anonymous'.");
  }
}

/**
 * Post a new transaction to the Apps Script doPost endpoint.
 * The Apps Script expects JSON with Date, Account, Type, Amount, Description.
 */
async function postTransaction(payload){
  try {
    const res = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const rjson = await res.json();
    if (!res.ok) throw new Error(rjson.message || "POST failed");
    return rjson;
  } catch (err) {
    console.error("Error posting transaction:", err);
    throw err;
  }
}

/* ==================== Form handling & validation ===================== */
function onFormSubmit(e){
  e.preventDefault();
  // gather values
  const date = selectors.date.value;
  const account = selectors.account.value.trim();
  const type = selectors.type.value;
  const amount = selectors.amount.value;
  const description = selectors.description.value.trim();

  // client-side validation
  const validation = validateForm({date, account, type, amount});
  if (!validation.ok){
    alert("Validation: " + validation.message);
    return;
  }

  // prepare payload
  const payload = {
    Date: date,
    Account: account,
    Type: type,
    Amount: parseFloat(parseFloat(amount).toFixed(2)), // ensure numeric
    Description: description
  };

  // disable submit button while posting
  selectors.submitBtn.disabled = true;
  selectors.submitBtn.textContent = "Adding...";

  // POST to Google Sheets
  postTransaction(payload)
    .then(result => {
      // on success: refresh transactions from server to maintain single source of truth
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

/**
 * validateForm — basic validation
 * - required: date, account, type, amount
 * - amount must be positive number
 */
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

  // sort by date ascending (oldest first). For consistent behavior, parse as Date object
  const sorted = data.slice().sort((a,b) => new Date(a.Date) - new Date(b.Date));

  const rowsHtml = sorted.map(tx => {
    return `<tr>
      <td>${escapeHtml(tx.Date)}</td>
      <td>${escapeHtml(tx.Account)}</td>
      <td>${escapeHtml(tx.Type)}</td>
      <td class="right">${formatCurrency(tx.Amount)}</td>
      <td>${escapeHtml(tx.Description || '')}</td>
    </tr>`;
  }).join("");

  selectors.ledgerBody.innerHTML = rowsHtml;
}

/* Populate account datalist (for the form's autocomplete) */
function populateAccountDatalist(){
  const unique = [...new Set(transactions.map(t => t.Account).filter(Boolean))].sort();
  selectors.accountsList.innerHTML = unique.map(a => `<option value="${escapeHtml(a)}">`).join("");
}

/* Populate filter dropdown with accounts */
function populateFilters(){
  const unique = [...new Set(transactions.map(t => t.Account).filter(Boolean))].sort();
  selectors.filterAccount.innerHTML = `<option value="All">All</option>` + unique.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
}

/* ==================== Summary calculations ===================== */
/**
 * calculateSummary
 * - totalDebits = sum of amounts where Type == 'Debit'
 * - totalCredits = sum of amounts where Type == 'Credit'
 * - net = totalDebits - totalCredits
 *
 * NOTE: In basic single-entry ledger used here, Debits increase asset-like values,
 * Credits increase liabilities. We show simple numeric totals for bookkeeping visibility.
 */
function calculateSummary(data){
  let totalDebits = 0;
  let totalCredits = 0;
  for (const tx of data){
    if (tx.Type === "Debit") totalDebits += Number(tx.Amount) || 0;
    if (tx.Type === "Credit") totalCredits += Number(tx.Amount) || 0;
  }
  selectors.totalDebits.textContent = formatCurrency(totalDebits);
  selectors.totalCredits.textContent = formatCurrency(totalCredits);
  const net = totalDebits - totalCredits;
  selectors.netWealth.textContent = formatCurrency(net);
}

/* ==================== Filtering ===================== */
function applyFilters(){
  const acc = selectors.filterAccount.value;
  const type = selectors.filterType.value;
  const from = selectors.filterFrom.value;
  const to = selectors.filterTo.value;

  let filtered = transactions.slice();

  if (acc && acc !== "All") filtered = filtered.filter(t => t.Account === acc);
  if (type && type !== "All") filtered = filtered.filter(t => t.Type === type);
  if (from) filtered = filtered.filter(t => new Date(t.Date) >= new Date(from));
  if (to) filtered = filtered.filter(t => new Date(t.Date) <= new Date(to));

  renderTable(filtered);
  calculateSummary(filtered);
}

function clearFilters(){
  selectors.filterAccount.value = "All";
  selectors.filterType.value = "All";
  selectors.filterFrom.value = "";
  selectors.filterTo.value = "";
  renderTable(transactions);
  calculateSummary(transactions);
}

/* ==================== Export CSV ===================== */
function exportCSV(){
  if (!transactions.length){
    alert("No data to export.");
    return;
  }

  // Use the current filtered table rows if filters set (simpler approach: regenerate from DOM)
  // Here we will export the currently displayed rows in the table (DOM)
  const rows = [ ["Date","Account","Type","Amount","Description"] ];
  const trs = Array.from(selectors.ledgerBody.querySelectorAll("tr"));
  trs.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll("td"));
    if (tds.length !== 5) return;
    rows.push(tds.map(td => td.textContent.trim()));
  });

  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ==================== Helpers ===================== */
function formatCurrency(num){
  // display always 2 decimals
  return Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return "";
  return String(unsafe).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
  });
}

