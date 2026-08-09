# Santabogela Egg Tracker Google Sheets Setup

Follow these steps to make every phone entry copy into your Google Sheet.

## 1. Google Sheet

Your Google Sheet is already created:

`https://docs.google.com/spreadsheets/d/19ypSVoB-2DrWdr6kNQKLvpkHcGwNlMGPjizRJ1I2eRc/edit`

## 2. Add the Google Apps Script bridge

1. In the Google Sheet, click **Extensions**.
2. Click **Apps Script**.
3. Delete the starter code.
4. Paste this code:

```javascript
const SPREADSHEET_ID = "19ypSVoB-2DrWdr6kNQKLvpkHcGwNlMGPjizRJ1I2eRc";

const DAILY_HEADERS = [
  "Received At",
  "Entry ID",
  "Date",
  "Worker",
  "Eggs Collected",
  "Eggs Sold",
  "Egg Trays Sold",
  "Damaged Eggs",
  "Notes",
  "Created At"
];

const LOAN_HEADERS = [
  "Received At",
  "Loan ID",
  "Date",
  "Worker",
  "Customer",
  "Eggs",
  "Trays",
  "Total Eggs",
  "Amount",
  "Status",
  "Notes",
  "Created At"
];

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const receivedAt = new Date();

  if (payload.type === "daily_record") {
    const sheet = getSheet(spreadsheet, "Daily Records", DAILY_HEADERS);
    const item = payload.item;

    sheet.appendRow([
      receivedAt,
      item.id,
      item.date,
      item.worker,
      item.collected,
      item.sold,
      item.traysSold || 0,
      item.damaged,
      item.notes || "",
      new Date(item.createdAt)
    ]);
  }

  if (payload.type === "customer_loan") {
    const sheet = getSheet(spreadsheet, "Customer Loans", LOAN_HEADERS);
    const item = payload.item;

    sheet.appendRow([
      receivedAt,
      item.id,
      item.date,
      item.worker,
      item.customer,
      item.eggs,
      item.trays || 0,
      item.eggs + ((item.trays || 0) * 30),
      item.amount || 0,
      item.status,
      item.notes || "",
      new Date(item.createdAt)
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action !== "read") {
    return jsonResponse({ ok: true, message: "Santabogela Egg Tracker bridge is running." });
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const records = readDailyRecords(spreadsheet);
  const loans = readCustomerLoans(spreadsheet);

  return jsonResponse({
    ok: true,
    records: records,
    loans: loans
  });
}

function readDailyRecords(spreadsheet) {
  const sheet = getSheet(spreadsheet, "Daily Records", DAILY_HEADERS);
  const values = sheet.getDataRange().getValues();

  return values.slice(1).filter(function (row) {
    return row[1];
  }).map(function (row) {
    return {
      id: row[1],
      date: toIsoDate(row[2]),
      worker: row[3],
      collected: Number(row[4]) || 0,
      sold: Number(row[5]) || 0,
      traysSold: Number(row[6]) || 0,
      damaged: Number(row[7]) || 0,
      notes: row[8] || "",
      createdAt: toTimestamp(row[9])
    };
  });
}

function readCustomerLoans(spreadsheet) {
  const sheet = getSheet(spreadsheet, "Customer Loans", LOAN_HEADERS);
  const values = sheet.getDataRange().getValues();

  return values.slice(1).filter(function (row) {
    return row[1];
  }).map(function (row) {
    return {
      id: row[1],
      date: toIsoDate(row[2]),
      worker: row[3],
      customer: row[4],
      eggs: Number(row[5]) || 0,
      trays: Number(row[6]) || 0,
      amount: Number(row[8]) || 0,
      status: row[9] || "Unpaid",
      notes: row[10] || "",
      createdAt: toTimestamp(row[11])
    };
  });
}

function getSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function toIsoDate(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return String(value).slice(0, 10);
}

function toTimestamp(value) {
  if (!value) {
    return Date.now();
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.getTime();
  }

  return Number(value) || Date.now();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

5. Click **Save**.

## 3. Deploy the script as a web app

1. Click **Deploy**.
2. Click **New deployment**.
3. Choose type: **Web app**.
4. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **Deploy**.
6. Authorize the script when Google asks.
7. Copy the **Web app URL**.

## 4. Connect the tracker

Send the Web app URL to Codex.

Codex will paste it into `app.js` here:

```javascript
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyEC2pTUYmNzjzMhmA0Q6-Rqp947vLWE4I9xcHzQjj3-cUGoWQfsRR5SZ-H87YIX4s/exec";
```



function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      records: [],
      loans: []
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

Then Codex will push the update to GitHub Pages.




