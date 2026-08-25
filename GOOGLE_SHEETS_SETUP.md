# Santabogela Egg Tracker — safe Google Sheets update

This update prevents column-layout mistakes from silently damaging new records. It does **not** delete or alter the existing records.

## Apply the update

1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/19ypSVoB-2DrWdr6kNQKLvpkHcGwNlMGPjizRJ1I2eRc/edit), then choose **Extensions → Apps Script**.
2. Replace the existing Apps Script code with the contents of `Code.gs` in this project.
3. Save the script.
4. Select **Deploy → Manage deployments**, edit the existing Web app deployment, set **Version** to **New version**, and deploy.

Keep the existing web-app URL. No change is needed in `app.js`.

## What this protects

- Checks both sheet header rows before reading or writing.
- Refuses to add a row if its columns do not match the approved layout.
- Rejects UUID codes entered as worker/customer names.
- Avoids duplicate entries with the same entry ID.
- Returns safe error messages instead of silently writing values to the wrong columns.

## Existing damaged rows

Rows created from 12 August 2026 onwards need manual correction from the original farm records. The update prevents additional damage but intentionally does not guess or overwrite those records.
