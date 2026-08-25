const SPREADSHEET_ID = "19ypSVoB-2DrWdr6kNQKLvpkHcGwNlMGPjizRJ1I2eRc";
const DAILY_HEADERS = ["Received At", "Entry ID", "Date", "Worker", "Eggs Collected", "Eggs Sold", "Egg Trays Sold", "Damaged Eggs", "Notes", "Created At"];
const LOAN_HEADERS = ["Received At", "Loan ID", "Date", "Worker", "Customer", "Eggs", "Trays", "Total Eggs", "Amount", "Status", "Notes", "Created At"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (payload.type === "daily_record") appendDailyRecord(spreadsheet, payload.item);
    else if (payload.type === "customer_loan") appendCustomerLoan(spreadsheet, payload.item);
    else throw new Error("Unknown record type.");
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function doGet(e) {
  try {
    if (!e || !e.parameter || e.parameter.action !== "read") return jsonResponse({ ok: true, message: "Santabogela Egg Tracker bridge is running." }, e);
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    return jsonResponse({ ok: true, records: readDailyRecords(spreadsheet), loans: readCustomerLoans(spreadsheet) }, e);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, e);
  }
}

function appendDailyRecord(spreadsheet, item) {
  validateDailyRecord(item);
  const sheet = getVerifiedSheet(spreadsheet, "Daily Records", DAILY_HEADERS);
  if (hasId(sheet, 2, item.id)) return;
  sheet.appendRow([new Date(), item.id, item.date, item.worker.trim(), number(item.collected), number(item.sold), number(item.traysSold), number(item.damaged), item.notes || "", new Date(item.createdAt || Date.now())]);
}

function appendCustomerLoan(spreadsheet, item) {
  validateCustomerLoan(item);
  const sheet = getVerifiedSheet(spreadsheet, "Customer Loans", LOAN_HEADERS);
  if (hasId(sheet, 2, item.id)) return;
  const trays = number(item.trays), eggs = number(item.eggs);
  sheet.appendRow([new Date(), item.id, item.date, item.worker.trim(), item.customer.trim(), eggs, trays, eggs + (trays * 30), number(item.amount), item.status, item.notes || "", new Date(item.createdAt || Date.now())]);
}

function readDailyRecords(spreadsheet) {
  const values = getVerifiedSheet(spreadsheet, "Daily Records", DAILY_HEADERS).getDataRange().getValues();
  return values.slice(1).filter(row => row[1]).map(row => ({ id: row[1], date: toIsoDate(row[2]), worker: row[3], collected: number(row[4]), sold: number(row[5]), traysSold: number(row[6]), damaged: number(row[7]), notes: row[8] || "", createdAt: toTimestamp(row[9]) }));
}

function readCustomerLoans(spreadsheet) {
  const values = getVerifiedSheet(spreadsheet, "Customer Loans", LOAN_HEADERS).getDataRange().getValues();
  return values.slice(1).filter(row => row[1]).map(row => ({ id: row[1], date: toIsoDate(row[2]), worker: row[3], customer: row[4], eggs: number(row[5]), trays: number(row[6]), totalEggs: number(row[7]), amount: number(row[8]), status: row[9] || "Unpaid", notes: row[10] || "", createdAt: toTimestamp(row[11]) }));
}

function getVerifiedSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) { sheet = spreadsheet.insertSheet(sheetName); sheet.appendRow(headers); sheet.setFrozenRows(1); return sheet; }
  const actualHeaders = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (!headers.every((header, index) => actualHeaders[index] === header)) throw new Error(sheetName + " headers do not match the tracker layout. No record was changed.");
  return sheet;
}

function hasId(sheet, column, id) { return sheet.getLastRow() >= 2 && sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues().some(row => row[0] === String(id)); }
function validateDailyRecord(item) { if (!item || !item.id || !isDate(item.date) || !validPerson(item.worker)) throw new Error("Daily record is missing a valid date or worker name."); }
function validateCustomerLoan(item) { if (!item || !item.id || !isDate(item.date) || !validPerson(item.worker) || !validPerson(item.customer) || !["Unpaid", "Partly Paid", "Paid"].includes(item.status)) throw new Error("Loan record has invalid required fields."); }
function validPerson(value) { const text = String(value || "").trim(); return text.length > 1 && !UUID_PATTERN.test(text) && !/^\d{4}-\d{2}-\d{2}T/.test(text); }
function isDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }
function number(value) { return Number(value) || 0; }
function toIsoDate(value) { return Object.prototype.toString.call(value) === "[object Date]" ? Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(value || "").slice(0, 10); }
function toTimestamp(value) { return Object.prototype.toString.call(value) === "[object Date]" ? value.getTime() : Number(value) || Date.now(); }
function jsonResponse(data, e) { const callback = e && e.parameter && e.parameter.callback; const output = callback ? callback + "(" + JSON.stringify(data) + ")" : JSON.stringify(data); return ContentService.createTextOutput(output).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON); }
