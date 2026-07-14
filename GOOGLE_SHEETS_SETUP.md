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
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwsuAOcDrZQmH7ksvoOQLy4EvC2KQpd41lCL--LWgRry_wUSJXPVYAgm70M7916Z_ZH/exec";
```

Then Codex will push the update to GitHub Pages.
