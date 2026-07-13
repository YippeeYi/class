/************************************************************
 * quotes.js
 * 名言列表页面
 ************************************************************/

const container = document.getElementById("quotes-list");
let quoteList = [];
let recordList = [];
let currentSortKey = "id";
let currentSortOrder = "asc";

const cacheReady = window.cacheReadyPromise || Promise.resolve();

cacheReady.then(async () => {
    const records = await loadAllRecords();
    const quotes = await loadAllQuotes({ records });
    return [quotes, records];
  })
  .then(([quotes, records]) => {
    quoteList = quotes;
    recordList = records;
    renderQuotes(currentSortKey, currentSortOrder);
  })
  .catch((error) => {
    console.warn("名言数据加载失败：", error);
    container.innerHTML = '<div class="record-empty"><strong>名言加载失败。</strong><span>请刷新页面或检查记录标记。</span></div>';
  });

function renderQuotes(sortKey = "id", sortOrder = "asc") {
  container.innerHTML = "";
  const list = sortQuotes(quoteList, sortKey, sortOrder);

  const table = document.createElement("table");
  table.className = "quotes-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>序号</th>
        <th>ID</th>
        <th>内容</th>
      </tr>
    </thead>
    <tbody>
      ${list.map((quote, index) => `
        <tr data-id="${escapeRecordAttribute(quote.id)}">
          <td>${index + 1}</td>
          <td>${escapeRecordText(quote.id)}</td>
          <td>${formatContent(quote.quote || quote.id)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  container.appendChild(table);
  bindRowClick();
}

function findQuoteRecords(quoteId) {
  const quote = quoteList.find((item) => item.id === quoteId);
  const recordFile = String(quote?.recordFile || "").replace(/\.json$/i, "");
  if (recordFile) {
    const direct = recordList.find((record) => String(record.fileName || record.id || "").replace(/\.json$/i, "") === recordFile);
    if (direct) return [direct];
  }
  return recordList.filter((record) => extractMentionedQuoteIds(record.content || "").includes(quoteId));
}

function navigateToRecord(record) {
  const anchor = getRecordAnchorId(record);
  if (typeof window.ClassRecordPrepareRecordJump === "function") {
    window.ClassRecordPrepareRecordJump(anchor, location.href);
  } else {
    try {
      sessionStorage.setItem("classrecord:pending-record-jump", JSON.stringify({
        targetAnchorId: anchor,
        originHref: location.href,
        createdAt: Date.now()
      }));
    } catch (error) {
      // Storage may be unavailable; the hash jump still works.
    }
  }
  const href = typeof window.ClassRecordGetRecordListHref === "function"
    ? window.ClassRecordGetRecordListHref(anchor)
    : `record.html?view=list#${anchor}`;
  if (typeof window.navigateTo === "function") window.navigateTo(href);
  else location.href = href;
}

function bindRowClick() {
  document.querySelectorAll(".quotes-table tbody tr").forEach((row) => {
    row.onclick = () => {
      const quoteId = row.dataset.id;
      const matches = findQuoteRecords(quoteId);
      if (matches.length === 1) {
        navigateToRecord(matches[0]);
        return;
      }
      const message = matches.length === 0
        ? "没有找到这条名言对应的记录。"
        : "这条名言匹配到多条记录，请检查记录标记。";
      window.alert(message);
      console.warn(message, { quoteId, matches });
    };
  });
}

function sortQuotes(list, key, order) {
  return [...list].sort((a, b) => {
    const A = key === "quote" ? stripRecordMarkup(a.quote || "") : (a[key] || "");
    const B = key === "quote" ? stripRecordMarkup(b.quote || "") : (b[key] || "");
    return order === "asc"
      ? A.localeCompare(B)
      : B.localeCompare(A);
  });
}

const sortControls = document.querySelector(".sort-controls");
const sortDropdown = sortControls?.querySelector(".sort-dropdown");
const keyTrigger = sortControls?.querySelector(".dropdown-trigger");
const keyLabel = keyTrigger?.querySelector(".dropdown-label");
const orderToggle = sortControls?.querySelector(".sort-order-toggle");

const sortKeyText = {
  id: "按 ID",
  quote: "按内容"
};

function updateSortControls() {
  if (!sortControls || !keyTrigger || !keyLabel || !orderToggle) return;
  keyTrigger.dataset.value = currentSortKey;
  keyLabel.textContent = sortKeyText[currentSortKey] || "按 ID";
  orderToggle.dataset.value = currentSortOrder;
  orderToggle.textContent = currentSortOrder === "asc" ? "升序" : "降序";
  sortControls.querySelectorAll(".sort-option").forEach((option) => {
    option.classList.toggle("is-active", option.dataset.value === currentSortKey);
  });
}

sortControls?.addEventListener("click", (event) => {
  const option = event.target.closest(".sort-option");
  if (option) {
    currentSortKey = option.dataset.value || "id";
    closeSortDropdown(false);
    updateSortControls();
    renderQuotes(currentSortKey, currentSortOrder);
    return;
  }

  if (event.target.closest(".sort-order-toggle")) {
    currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
    updateSortControls();
    renderQuotes(currentSortKey, currentSortOrder);
  }
});

const DROPDOWN_CLOSE_DELAY = 140;
let dropdownCloseTimer = null;

function openSortDropdown() {
  if (dropdownCloseTimer) {
    clearTimeout(dropdownCloseTimer);
    dropdownCloseTimer = null;
  }
  sortDropdown?.classList.add("is-open");
}

function closeSortDropdown(withDelay = true) {
  if (dropdownCloseTimer) clearTimeout(dropdownCloseTimer);
  if (!withDelay) {
    sortDropdown?.classList.remove("is-open");
    dropdownCloseTimer = null;
    return;
  }
  dropdownCloseTimer = setTimeout(() => {
    sortDropdown?.classList.remove("is-open");
    dropdownCloseTimer = null;
  }, DROPDOWN_CLOSE_DELAY);
}

sortDropdown?.addEventListener("mouseenter", openSortDropdown);
sortDropdown?.addEventListener("mouseleave", () => closeSortDropdown(true));

updateSortControls();
