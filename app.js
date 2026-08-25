const STORAGE_KEY = "santabogela-egg-tracker-records";
const WORKERS_KEY = "santabogela-egg-tracker-workers";
const LOANS_KEY = "santabogela-egg-tracker-loans";
const SYNC_QUEUE_KEY = "santabogela-egg-tracker-google-sync-queue";
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz-O8Tz4ThgdFxMBwig0m_YdhDHdKuw3T2LWb6Iy7c_1FwqRwiKPCREC-f1Al9ZvNWo/exec";
const DEFAULT_WORKERS = [
    "Mashele - Farm Worker",
    "Natalie - Sales",
    "Kgopotso - Sales"
];

const form = document.querySelector("#entry-form");
const loanForm = document.querySelector("#loan-form");
const workerForm = document.querySelector("#worker-form");
const workerSelect = document.querySelector("#worker-name");
const loanWorkerSelect = document.querySelector("#loan-worker");
const workerList = document.querySelector("#worker-list");
const saveStatus = document.querySelector("#save-status");
const loanStatus = document.querySelector("#loan-status");
const historyBody = document.querySelector("#history-body");
const loanBody = document.querySelector("#loan-body");
const rowTemplate = document.querySelector("#row-template");
const loanRowTemplate = document.querySelector("#loan-row-template");
const emptyState = document.querySelector("#empty-state");
const loanEmptyState = document.querySelector("#loan-empty-state");
const searchInput = document.querySelector("#history-search");
const rangeSelect = document.querySelector("#history-range");
const exportButton = document.querySelector("#export-button");
const exportLoansButton = document.querySelector("#export-loans-button");
const clearButton = document.querySelector("#clear-button");
const syncOldButton = document.querySelector("#sync-old-button");
const installButton = document.querySelector("#install-button");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");

const totals = {
    collected: document.querySelector("#total-collected"),
    sold: document.querySelector("#total-sold"),
    traysSold: document.querySelector("#total-trays-sold"),
    damaged: document.querySelector("#total-damaged"),
    stock: document.querySelector("#current-stock"),
    loaned: document.querySelector("#total-loaned")
};

const stockDetails = {
    collected: document.querySelector("#stock-collected"),
    sold: document.querySelector("#stock-sold"),
    damaged: document.querySelector("#stock-damaged"),
    onHand: document.querySelector("#stock-on-hand"),
    loaned: document.querySelector("#stock-loaned"),
    available: document.querySelector("#stock-available")
};

let records = loadRecords();
let loans = loadLoans();
let workers = loadWorkers();
let syncQueue = loadSyncQueue();
let deferredInstallPrompt = null;

function selectTab(tabName) {
    tabButtons.forEach(function (button) {
        const isActive = button.dataset.tab === tabName;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.tabIndex = isActive ? 0 : -1;
    });

    tabPanels.forEach(function (panel) {
        panel.hidden = panel.dataset.tabPanel !== tabName;
    });
}

tabButtons.forEach(function (button, index) {
    button.addEventListener("click", function () {
        selectTab(button.dataset.tab);
    });

    button.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }

        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + direction + tabButtons.length) % tabButtons.length;
        tabButtons[nextIndex].focus();
        selectTab(tabButtons[nextIndex].dataset.tab);
    });
});

function loadRecords() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function loadWorkers() {
    try {
        const savedWorkers = JSON.parse(localStorage.getItem(WORKERS_KEY));
        return Array.isArray(savedWorkers) && savedWorkers.length > 0 ? savedWorkers : DEFAULT_WORKERS.slice();
    } catch (error) {
        return DEFAULT_WORKERS.slice();
    }
}

function loadLoans() {
    try {
        return JSON.parse(localStorage.getItem(LOANS_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function loadSyncQueue() {
    try {
        return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)) || [];
    } catch (error) {
        return [];
    }
}

function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveLoans() {
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
}

function saveWorkers() {
    localStorage.setItem(WORKERS_KEY, JSON.stringify(workers));
}

function saveSyncQueue() {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function toNumber(value) {
    return Number.parseInt(value, 10) || 0;
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-ZA").format(value);
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date(value + "T00:00:00"));
}

function normalizeDateValue(value) {
    if (!value) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return String(value);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).slice(0, 10);
    }

    return parsed.toISOString().slice(0, 10);
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isInvalidSharedDailyRecord(record) {
    return !record || !record.id || !record.date || !record.worker || isUuid(record.worker);
}

function isInvalidSharedLoan(loan) {
    return !loan || !loan.id || !loan.date || !loan.worker || !loan.customer ||
        isUuid(loan.customer) || /^\d{4}-\d{2}-\d{2}T/.test(String(loan.worker)) ||
        !["Unpaid", "Partly Paid", "Paid"].includes(String(loan.status || ""));
}

function uniqueById(items) {
    const seen = new Set();
    return items.filter(function (item) {
        if (!item.id || seen.has(item.id)) {
            return false;
        }

        seen.add(item.id);
        return true;
    });
}

function mergeUniqueById(primaryItems, secondaryItems) {
    const merged = [];
    const seen = new Set();

    primaryItems.concat(secondaryItems).forEach(function (item) {
        if (!item.id || seen.has(item.id)) {
            return;
        }

        seen.add(item.id);
        merged.push(item);
    });

    return merged;
}

function stockChange(record) {
    return record.collected - record.sold - record.damaged;
}

function loanEggTotal(loan) {
    return toNumber(loan.totalEggs) || (loan.eggs + ((loan.trays || 0) * 30));
}

function updateTotals() {
    const result = records.reduce(function (accumulator, record) {
        accumulator.collected += record.collected;
        accumulator.sold += record.sold;
        accumulator.traysSold += record.traysSold || 0;
        accumulator.damaged += record.damaged;
        accumulator.stock += stockChange(record);
        return accumulator;
    }, { collected: 0, sold: 0, traysSold: 0, damaged: 0, stock: 0 });
    const paidLoanEggs = loans.reduce(function (sum, loan) {
        return String(loan.status || "").toLowerCase() === "paid" ? sum + loanEggTotal(loan) : sum;
    }, 0);
    const loaned = loans.reduce(function (sum, loan) {
        return String(loan.status || "").toLowerCase() === "paid" ? sum : sum + loanEggTotal(loan);
    }, 0);
    const totalSold = result.sold + paidLoanEggs;
    const stockOnHand = result.collected - totalSold - result.damaged;

    totals.collected.textContent = formatNumber(result.collected);
    totals.sold.textContent = formatNumber(totalSold);
    totals.traysSold.textContent = formatNumber(result.traysSold);
    totals.damaged.textContent = formatNumber(result.damaged);
    totals.stock.textContent = formatNumber(stockOnHand);
    totals.loaned.textContent = formatNumber(loaned);

    if (stockDetails.collected) {
        stockDetails.collected.textContent = formatNumber(result.collected);
        stockDetails.sold.textContent = formatNumber(totalSold);
        stockDetails.damaged.textContent = formatNumber(result.damaged);
        stockDetails.onHand.textContent = formatNumber(stockOnHand);
        stockDetails.loaned.textContent = formatNumber(loaned);
        stockDetails.available.textContent = formatNumber(stockOnHand - loaned);
    }
}

function filteredRecords() {
    const query = searchInput.value.trim().toLowerCase();
    const range = rangeSelect.value;
    const now = new Date(today() + "T00:00:00");

    return records
        .filter(function (record) {
            if (range === "all") {
                return true;
            }

            const entryDate = new Date(record.date + "T00:00:00");
            const ageDays = Math.floor((now - entryDate) / 86400000);
            return ageDays >= 0 && ageDays < Number(range);
        })
        .filter(function (record) {
            if (!query) {
                return true;
            }

            const searchable = [
                record.date,
                record.worker,
                record.notes,
                record.collected,
                record.sold,
                record.traysSold || 0,
                record.damaged
            ].join(" ").toLowerCase();

            return searchable.includes(query);
        })
        .sort(function (a, b) {
            return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
        });
}

function renderHistory() {
    const visibleRecords = filteredRecords();
    historyBody.innerHTML = "";
    emptyState.classList.toggle("is-visible", visibleRecords.length === 0);

    visibleRecords.forEach(function (record) {
        const row = rowTemplate.content.firstElementChild.cloneNode(true);
        const cells = row.querySelectorAll("td");

        cells[0].textContent = formatDate(record.date);
        cells[1].textContent = record.worker;
        cells[2].textContent = formatNumber(record.collected);
        cells[3].textContent = formatNumber(record.sold);
        cells[4].textContent = formatNumber(record.traysSold || 0);
        cells[5].textContent = formatNumber(record.damaged);
        cells[6].textContent = record.notes || "-";

        historyBody.appendChild(row);
    });
}

function renderLoans() {
    const visibleLoans = loans.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
    });

    loanBody.innerHTML = "";
    loanEmptyState.classList.toggle("is-visible", visibleLoans.length === 0);

    visibleLoans.forEach(function (loan) {
        const row = loanRowTemplate.content.firstElementChild.cloneNode(true);
        const cells = row.querySelectorAll("td");

        cells[0].textContent = formatDate(loan.date);
        cells[1].textContent = loan.customer;
        cells[2].textContent = loan.worker;
        cells[3].textContent = formatNumber(loan.eggs);
        cells[4].textContent = formatNumber(loan.trays || 0);
        cells[5].textContent = "R " + Number(loan.amount || 0).toFixed(2);
        cells[6].textContent = loan.status;
        cells[6].className = String(loan.status || "").toLowerCase() === "paid" ? "positive" : "negative";
        cells[7].textContent = loan.notes || "-";

        loanBody.appendChild(row);
    });
}

function render() {
    updateTotals();
    renderHistory();
    renderLoans();
}

function renderWorkers() {
    const selectedWorker = workerSelect.value;
    const selectedLoanWorker = loanWorkerSelect.value;
    workerSelect.innerHTML = '<option value="">Select worker</option>';
    loanWorkerSelect.innerHTML = '<option value="">Select worker</option>';
    workerList.innerHTML = "";

    workers.forEach(function (worker) {
        const option = document.createElement("option");
        option.value = worker;
        option.textContent = worker;
        workerSelect.appendChild(option);
        loanWorkerSelect.appendChild(option.cloneNode(true));

        const button = document.createElement("button");
        button.type = "button";
        button.className = "worker-chip";
        button.textContent = worker;
        button.addEventListener("click", function () {
            workerSelect.value = worker;
        });
        workerList.appendChild(button);
    });

    if (workers.includes(selectedWorker)) {
        workerSelect.value = selectedWorker;
    }

    if (workers.includes(selectedLoanWorker)) {
        loanWorkerSelect.value = selectedLoanWorker;
    }
}

function showSavedMessage(message) {
    saveStatus.textContent = message;
    window.setTimeout(function () {
        saveStatus.textContent = "";
    }, 2800);
}

function isGoogleSheetsConnected() {
    return GOOGLE_SHEETS_WEB_APP_URL.trim().startsWith("https://");
}

function queueGoogleSheetSync(type, item) {
    const isDailyRecord = type === "daily_record";
    const payload = {
        type: type,
        action: isDailyRecord ? "daily" : "loan",
        app: "Santabogela Egg Tracker",
        sentAt: new Date().toISOString(),
        item: item,
        record: isDailyRecord ? item : undefined,
        loan: isDailyRecord ? undefined : item
    };

    syncQueue.push(payload);
    saveSyncQueue();
    return flushGoogleSheetSync();
}

async function flushGoogleSheetSync() {
    if (!isGoogleSheetsConnected() || syncQueue.length === 0 || !navigator.onLine) {
        return false;
    }

    const remaining = [];

    for (const payload of syncQueue) {
        try {
            await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (error) {
            remaining.push(payload);
        }
    }

    syncQueue = remaining;
    saveSyncQueue();
    return remaining.length === 0;
}

function loadGoogleSheetJsonp() {
    return new Promise(function (resolve, reject) {
        const callbackName = "santabogelaSheetCallback" + Date.now() + Math.random().toString(16).slice(2);
        const script = document.createElement("script");
        const separator = GOOGLE_SHEETS_WEB_APP_URL.includes("?") ? "&" : "?";

        window[callbackName] = function (data) {
            delete window[callbackName];
            script.remove();
            resolve(data);
        };

        script.onerror = function () {
            delete window[callbackName];
            script.remove();
            reject(new Error("Could not load Google Sheets data."));
        };

        script.src = GOOGLE_SHEETS_WEB_APP_URL + separator + "action=read&callback=" + encodeURIComponent(callbackName) + "&cacheBust=" + Date.now();
        document.body.appendChild(script);
    });
}

async function loadSharedGoogleSheetData(options) {
    const shouldShowStatus = options && options.showStatus;
    const keepLocalRecords = options && options.keepLocalRecords;

    if (!isGoogleSheetsConnected() || !navigator.onLine) {
        return false;
    }

    try {
        if (shouldShowStatus) {
            showSavedMessage("Refreshing shared Google Sheet data...");
        }

        const data = await loadGoogleSheetJsonp();

        if (!data.ok) {
            throw new Error(data.error || "Google Sheets did not return shared records.");
        }

        if ((data.records || []).some(isInvalidSharedDailyRecord) || (data.loans || []).some(isInvalidSharedLoan)) {
            throw new Error("The shared sheet has an invalid column layout. No new sheet data was saved on this device.");
        }

        const sharedRecords = uniqueById((data.records || []).map(function (record) {
            return {
                id: record.id,
                date: normalizeDateValue(record.date),
                worker: record.worker || "",
                collected: toNumber(record.collected),
                sold: toNumber(record.sold),
                traysSold: toNumber(record.traysSold),
                damaged: toNumber(record.damaged),
                notes: record.notes || "",
                createdAt: Number(record.createdAt) || Date.now()
            };
        }));

        const sharedLoans = uniqueById((data.loans || []).map(function (loan) {
            return {
                id: loan.id,
                date: normalizeDateValue(loan.date),
                worker: loan.worker || "",
                customer: loan.customer || "",
                eggs: toNumber(loan.eggs),
                trays: toNumber(loan.trays),
                totalEggs: toNumber(loan.totalEggs),
                amount: Number.parseFloat(loan.amount) || 0,
                status: loan.status || "Unpaid",
                notes: loan.notes || "",
                createdAt: Number(loan.createdAt) || Date.now()
            };
        }));

        records = keepLocalRecords ? mergeUniqueById(sharedRecords, records) : sharedRecords;
        loans = keepLocalRecords ? mergeUniqueById(sharedLoans, loans) : sharedLoans;

        saveRecords();
        saveLoans();
        render();

        if (shouldShowStatus) {
            showSavedMessage("Shared Google Sheet data refreshed.");
        }

        return true;
    } catch (error) {
        console.error(error);
        if (shouldShowStatus) {
            showSavedMessage("Shared sheet needs repair. Existing phone records were kept safe.");
        }

        return false;
    }
}

async function uploadOldSavedRecords() {
    if (!isGoogleSheetsConnected()) {
        showSavedMessage("Google Sheets is not connected yet.");
        return;
    }

    if (!navigator.onLine) {
        showSavedMessage("Connect to the internet before uploading old records.");
        return;
    }

    syncOldButton.disabled = true;
    showSavedMessage("Checking old saved records...");

    try {
        const localRecords = loadRecords();
        const localLoans = loadLoans();
        await loadSharedGoogleSheetData();

        const syncedDailyIds = new Set((records || []).map(function (record) {
            return record.id;
        }));
        const syncedLoanIds = new Set((loans || []).map(function (loan) {
            return loan.id;
        }));
        let uploadedCount = 0;

        for (const record of localRecords) {
            if (!record.id || syncedDailyIds.has(record.id)) {
                continue;
            }

            const synced = await queueGoogleSheetSync("daily_record", record);
            if (synced) {
                uploadedCount += 1;
                syncedDailyIds.add(record.id);
            }
        }

        for (const loan of localLoans) {
            if (!loan.id || syncedLoanIds.has(loan.id)) {
                continue;
            }

            const synced = await queueGoogleSheetSync("customer_loan", loan);
            if (synced) {
                uploadedCount += 1;
                syncedLoanIds.add(loan.id);
            }
        }

        await loadSharedGoogleSheetData({ keepLocalRecords: true });
        showSavedMessage(uploadedCount > 0 ? "Uploaded " + uploadedCount + " old saved record(s)." : "No old records needed uploading.");
    } catch (error) {
        showSavedMessage("Could not upload old records yet. Try again.");
    } finally {
        syncOldButton.disabled = false;
    }
}

function buildCsv() {
    const headers = ["Date", "Worker", "Collected", "Sold", "Trays Sold", "Damaged", "Notes"];
    const rows = records
        .slice()
        .sort(function (a, b) {
            return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
        })
        .map(function (record) {
            return [
                record.date,
                record.worker,
                record.collected,
                record.sold,
                record.traysSold || 0,
                record.damaged,
                record.notes
            ];
        });

    return [headers].concat(rows).map(function (row) {
        return row.map(function (cell) {
            return '"' + String(cell ?? "").replace(/"/g, '""') + '"';
        }).join(",");
    }).join("\n");
}

function buildLoansCsv() {
    const headers = ["Date", "Customer", "Worker", "Eggs", "Trays", "Total Eggs", "Amount", "Status", "Notes"];
    const rows = loans
        .slice()
        .sort(function (a, b) {
            return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
        })
        .map(function (loan) {
            return [
                loan.date,
                loan.customer,
                loan.worker,
                loan.eggs,
                loan.trays || 0,
                loanEggTotal(loan),
                loan.amount || 0,
                loan.status,
                loan.notes
            ];
        });

    return [headers].concat(rows).map(function (row) {
        return row.map(function (cell) {
            return '"' + String(cell ?? "").replace(/"/g, '""') + '"';
        }).join(",");
    }).join("\n");
}

function downloadCsv() {
    if (records.length === 0) {
        showSavedMessage("Add records before exporting.");
        return;
    }

    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "egg-tracker-records.csv";
    link.click();
    URL.revokeObjectURL(link.href);
}

function downloadLoansCsv() {
    if (loans.length === 0) {
        showSavedMessage("Add loan records before exporting.");
        return;
    }

    const blob = new Blob([buildLoansCsv()], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "egg-loan-records.csv";
    link.click();
    URL.revokeObjectURL(link.href);
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const data = new FormData(form);
    const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        date: data.get("date"),
        worker: data.get("worker").trim(),
        collected: toNumber(data.get("collected")),
        sold: toNumber(data.get("sold")),
        traysSold: toNumber(data.get("traysSold")),
        damaged: toNumber(data.get("damaged")),
        notes: data.get("notes").trim(),
        createdAt: Date.now()
    };

    if (!record.date || !record.worker) {
        showSavedMessage("Please complete the date and worker name.");
        return;
    }

    if (record.collected + record.sold + record.traysSold + record.damaged === 0) {
        showSavedMessage("Add at least one collection, sale, tray, or damaged egg number.");
        return;
    }

    records.push(record);
    saveRecords();
    form.reset();
    document.querySelector("#entry-date").value = today();
    document.querySelector("#trays-sold").value = "0";
    document.querySelector("#eggs-damaged").value = "0";
    if (!isGoogleSheetsConnected()) {
        showSavedMessage("Daily entry saved on this phone. Google Sheets is not connected yet.");
    } else {
        showSavedMessage("Daily entry saved. Sending to Google Sheets...");
        const synced = await queueGoogleSheetSync("daily_record", record);
                if (synced) {
            await loadSharedGoogleSheetData();
        }
        showSavedMessage(synced ? "Daily entry saved and shared with all devices." : "Daily entry saved. It will sync when internet returns.");
    }

    render();
});

loanForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const data = new FormData(loanForm);
    const loan = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        date: data.get("date"),
        worker: data.get("worker"),
        customer: data.get("customer").trim(),
        eggs: toNumber(data.get("eggs")),
        trays: toNumber(data.get("trays")),
        amount: Number.parseFloat(data.get("amount")) || 0,
        status: data.get("status"),
        notes: data.get("notes").trim(),
        createdAt: Date.now()
    };

    if (!loan.date || !loan.worker || !loan.customer) {
        loanStatus.textContent = "Please complete the date, worker, and customer name.";
        return;
    }

    if (loan.eggs + loan.trays === 0) {
        loanStatus.textContent = "Add eggs or trays loaned before saving.";
        return;
    }

    loans.push(loan);
    saveLoans();
    loanForm.reset();
    document.querySelector("#loan-date").value = today();
    if (!isGoogleSheetsConnected()) {
        loanStatus.textContent = "Loan record saved on this phone. Google Sheets is not connected yet.";
    } else {
        loanStatus.textContent = "Loan record saved. Sending to Google Sheets...";
        const synced = await queueGoogleSheetSync("customer_loan", loan);
                if (synced) {
            await loadSharedGoogleSheetData();
        }
        loanStatus.textContent = synced ? "Loan record saved and shared with all devices." : "Loan record saved. It will sync when internet returns.";
    }

    window.setTimeout(function () {
        loanStatus.textContent = "";
    }, 2800);
    render();
});

workerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const input = document.querySelector("#new-worker-name");
    const workerName = input.value.trim();

    if (!workerName) {
        showSavedMessage("Type a worker name before saving.");
        return;
    }

    const exists = workers.some(function (worker) {
        return worker.toLowerCase() === workerName.toLowerCase();
    });

    if (exists) {
        showSavedMessage("That worker name is already saved.");
        input.value = "";
        return;
    }

    workers.push(workerName);
    workers.sort(function (a, b) {
        return a.localeCompare(b);
    });
    saveWorkers();
    input.value = "";
    renderWorkers();
    workerSelect.value = workerName;
    showSavedMessage("Worker name saved.");
});

searchInput.addEventListener("input", renderHistory);
rangeSelect.addEventListener("change", renderHistory);
exportButton.addEventListener("click", downloadCsv);
syncOldButton.addEventListener("click", uploadOldSavedRecords);
exportLoansButton.addEventListener("click", downloadLoansCsv);

clearButton.addEventListener("click", function () {
    if (records.length === 0) {
        showSavedMessage("There are no records to clear.");
        return;
    }

    const confirmed = window.confirm("Clear all saved egg records on this device?");
    if (!confirmed) {
        return;
    }

    records = [];
    saveRecords();
    showSavedMessage("Daily records cleared.");
    render();
});

window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
});

window.addEventListener("online", async function () {
    await flushGoogleSheetSync();
    await loadSharedGoogleSheetData();
});

installButton.addEventListener("click", async function () {
    if (!deferredInstallPrompt) {
        return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js");
}

document.querySelector("#entry-date").value = today();
document.querySelector("#loan-date").value = today();
selectTab("daily");
renderWorkers();
render();
flushGoogleSheetSync().then(function () {
    return loadSharedGoogleSheetData({ showStatus: true });
});
window.setInterval(loadSharedGoogleSheetData, 60000);
