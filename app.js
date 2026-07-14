const STORAGE_KEY = "santabogela-egg-tracker-records";
const WORKERS_KEY = "santabogela-egg-tracker-workers";
const LOANS_KEY = "santabogela-egg-tracker-loans";
const SYNC_QUEUE_KEY = "santabogela-egg-tracker-google-sync-queue";
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwsuAOcDrZQmH7ksvoOQLy4EvC2KQpd41lCL--LWgRry_wUSJXPVYAgm70M7916Z_ZH/exec";
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

function stockChange(record) {
    return record.collected - record.sold - ((record.traysSold || 0) * 30) - record.damaged;
}

function loanEggTotal(loan) {
    return loan.eggs + ((loan.trays || 0) * 30);
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
    const loaned = loans.reduce(function (sum, loan) {
        return loan.status === "Paid" ? sum : sum + loanEggTotal(loan);
    }, 0);

    totals.collected.textContent = formatNumber(result.collected);
    totals.sold.textContent = formatNumber(result.sold);
    totals.traysSold.textContent = formatNumber(result.traysSold);
    totals.damaged.textContent = formatNumber(result.damaged);
    totals.stock.textContent = formatNumber(result.stock - loaned);
    totals.loaned.textContent = formatNumber(loaned);
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
        const change = stockChange(record);

        cells[0].textContent = formatDate(record.date);
        cells[1].textContent = record.worker;
        cells[2].textContent = formatNumber(record.collected);
        cells[3].textContent = formatNumber(record.sold);
        cells[4].textContent = formatNumber(record.traysSold || 0);
        cells[5].textContent = formatNumber(record.damaged);
        cells[6].textContent = (change >= 0 ? "+" : "") + formatNumber(change);
        cells[6].className = change >= 0 ? "positive" : "negative";
        cells[7].textContent = record.notes || "-";

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
        cells[6].className = loan.status === "Paid" ? "positive" : "negative";
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
    const payload = {
        type: type,
        app: "Santabogela Egg Tracker",
        sentAt: new Date().toISOString(),
        item: item
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

function buildCsv() {
    const headers = ["Date", "Worker", "Collected", "Sold", "Trays Sold", "Damaged", "Stock Change", "Notes"];
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
                stockChange(record),
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
        showSavedMessage(synced ? "Daily entry saved and sent to Google Sheets." : "Daily entry saved. It will sync when internet returns.");
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
        loanStatus.textContent = synced ? "Loan record saved and sent to Google Sheets." : "Loan record saved. It will sync when internet returns.";
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

window.addEventListener("online", flushGoogleSheetSync);

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
flushGoogleSheetSync();
