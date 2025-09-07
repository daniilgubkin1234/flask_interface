document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("tasks-form");
  const tbody = document.querySelector("#tasks-table tbody");

  const submitBtn = document.getElementById("submitTask");
  const saveBtn = document.getElementById("saveChanges");
  const syncBtn = document.getElementById("syncSources");

  // -------- helpers --------
  const $ = (id) => document.getElementById(id);

  async function fetchJSON(url, options = {}) {
    const opts = {
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.headers || {}) },
      ...options,
    };
    const res = await fetch(url, opts);

    // если редирект на логин или отдан HTML/текст — покажем понятное сообщение
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text();
      if (res.redirected || res.status === 401 || /<html|<!doctype/i.test(text)) {
        throw new Error("Похоже, требуется вход в систему. Обновите страницу и войдите заново.");
      }
      throw new Error(text.slice(0, 300) || `Неожиданный ответ (${res.status})`);
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error("Некорректный JSON от сервера");
    }
    if (!res.ok) {
      throw new Error(data.error || `Ошибка ${res.status}`);
    }
    return data;
  }

  // ---------- datalists: ТОЛЬКО этапы -> список «Задача» ----------
  async function preloadStageNames() {
    try {
      const doc = await fetchJSON("/get_business_goal");

      // Собираем названия этапов из возможных форматов
      const names = [];

      // формат: { stages: [ { stageNumber, stageDescription, stageDate }, ... ] }
      if (Array.isArray(doc?.stages)) {
        for (const s of doc.stages) {
          const v = (s?.stageNumber || "").trim();
          if (v) names.push(v);
        }
      }

      // запасной формат: { stageNumber: ["Этап 1", "Этап 2", ...] }
      if (Array.isArray(doc?.stageNumber)) {
        for (const v of doc.stageNumber) {
          if (typeof v === "string" && v.trim()) names.push(v.trim());
        }
      }

      const uniq = [...new Set(names)];
      const dl = $("task-list");
      if (!dl) return;
      dl.innerHTML = "";
      uniq.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        dl.appendChild(opt);
      });
    } catch (e) {
      console.error("Не удалось загрузить названия этапов:", e);
      // тихо игнорируем, поле просто останется пустым
    }
  }

  // ---------- datalists: «Мероприятие» — НЕ трогаем «Задача» ----------
  async function preloadEventList() {
    const eventList = $("event-list");
    if (!eventList) return;
    eventList.innerHTML = "";
    try {
      const mp = await fetchJSON("/get_meeting_protocol");
      ["Бизнес-цель", mp.meetingDate ? `Протокол совещания ${mp.meetingDate}` : ""]
        .filter(Boolean)
        .forEach((name) => {
          const o = document.createElement("option");
          o.value = name;
          eventList.appendChild(o);
        });
    } catch {
      // если протокола нет — оставим только «Бизнес-цель»
      const o = document.createElement("option");
      o.value = "Бизнес-цель";
      eventList.appendChild(o);
    }
  }

  // ---------- загрузка / рендер задач ----------
  async function loadTasks() {
    try {
      const tasks = await fetchJSON("/get_tasks");
      tbody.innerHTML = "";

      (tasks || []).forEach((t, i) => {
        const id = t._id || "";
        const tr = document.createElement("tr");
        tr.setAttribute("data-id", id);
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${t.task || ""}</td>
          <td>${t.event || ""}</td>
          <td>${t.work || ""}</td>
          <td>${t.responsible || ""}</td>
          <td>${t.deadline || ""}</td>
          <td>${t.result || ""}</td>
          <td>${t.resources || ""}</td>
          <td>${t.coexecutors || ""}</td>
          <td>${t.comments || ""}</td>
          <td>
            <button class="edit-task btn btn-primary" data-id="${id}">Редактировать</button>
            <button class="delete-task btn btn-danger" data-id="${id}">Удалить</button>
            <button class="copy-row btn">Копировать в буфер</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      bindRowActions();
    } catch (e) {
      console.error("Ошибка загрузки задач:", e);
      alert(String(e.message || e));
    }
  }

  // ---------- действия по рядам ----------
  function bindRowActions() {
    // Удаление с подтверждением
    tbody.querySelectorAll(".delete-task").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        if (!id) return;

        const row = btn.closest("tr");
        const title = row?.children?.[1]?.textContent?.trim() || "эту задачу";
        const deadline = row?.children?.[5]?.textContent?.trim();
        const msg = `Удалить «${title}»${deadline ? ` (срок: ${deadline})` : ""}?`;

        if (!confirm(msg)) return;

        try {
          const data = await fetchJSON(`/delete_task/${encodeURIComponent(id)}`, { method: "DELETE" });
          alert(data.message || "Готово");
          await loadTasks();
        } catch (e) {
          alert(String(e.message || e));
        }
      };
    });

    // Редактирование
    tbody.querySelectorAll(".edit-task").forEach((btn) => {
      btn.onclick = () => {
        const row = btn.closest("tr").children;
        $("task").value = row[1].textContent;
        $("event").value = row[2].textContent;
        $("work").value = row[3].textContent;
        $("responsible").value = row[4].textContent;
        $("deadline").value = row[5].textContent;
        $("result").value = row[6].textContent;
        $("resources").value = row[7].textContent;
        $("coexecutors").value = row[8].textContent;
        $("comments").value = row[9].textContent;

        saveBtn.dataset.id = btn.dataset.id || "";
        submitBtn.style.display = "none";
        saveBtn.style.display = "inline-block";
      };
    });
  }

  // ---------- обработчики формы ----------
  function bindFormHandlers() {
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (saveBtn.style.display !== "none" && saveBtn.dataset.id) {
        doSaveChanges();
      } else {
        addTask();
      }
    });

    submitBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      addTask();
    });

    saveBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      doSaveChanges();
    });
  }

  async function addTask() {
    const payload = collectForm();
    if (!payload.task) {
      alert("Название задачи обязательно");
      return;
    }
    try {
      const data = await fetchJSON("/add_task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert(data.message || "Готово");
      form.reset();
      await loadTasks();
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  async function doSaveChanges() {
    const id = saveBtn.dataset.id;
    if (!id) return;
    const payload = collectForm();
    try {
      const data = await fetchJSON(`/edit_task/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert(data.message || "Готово");
      saveBtn.style.display = "none";
      saveBtn.dataset.id = "";
      submitBtn.style.display = "inline-block";
      form.reset();
      await loadTasks();
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  function collectForm() {
    return {
      task: $("task").value,
      event: $("event").value,
      work: $("work").value,
      responsible: $("responsible").value,
      deadline: $("deadline").value,
      result: $("result").value,
      resources: $("resources").value,
      coexecutors: $("coexecutors").value,
      comments: $("comments").value,
    };
  }

  // ---------- синхронизация ----------
  function bindSyncButton() {
    if (!syncBtn) return;
    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      try {
        const data = await fetchJSON("/sync_tasks_from_sources", { method: "POST" });
        alert(data.message || "Готово");
        await Promise.all([preloadStageNames(), preloadEventList(), loadTasks()]);
      } catch (e) {
        alert("Ошибка синхронизации: " + String(e.message || e));
      } finally {
        syncBtn.disabled = false;
      }
    });
  }

  // ---------- копирование строки ----------
  function bindCopyDelegation() {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".copy-row");
      if (!btn) return;
      const row = btn.closest("tr");
      const cells = Array.from(row.children).slice(0, 10).map((td) => td.textContent.trim());
      navigator.clipboard
        .writeText(cells.join(" | "))
        .then(() => alert("Скопировано в буфер"))
        .catch(() => alert("Не удалось скопировать"));
    });
  }

  // ---------- фильтр ----------
  function bindFilter() {
    const filterInput = $("filter-input");
    const filterColumn = $("filter-column");
    if (!filterInput || !filterColumn) return;

    const colIndexByName = {
      task: 1,
      event: 2,
      work: 3,
      responsible: 4,
      deadline: 5,
      result: 6,
      resources: 7,
      coexecutors: 8,
      comments: 9,
    };

    function applyFilter() {
      const q = filterInput.value.trim().toLowerCase();
      const col = filterColumn.value;

      Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
        const cells = tr.querySelectorAll("td");
        let match = false;

        if (col === "all") {
          for (let i = 1; i <= 9; i++) {
            if ((cells[i]?.textContent || "").toLowerCase().includes(q)) {
              match = true;
              break;
            }
          }
        } else {
          const idx = colIndexByName[col];
          match = (cells[idx]?.textContent || "").toLowerCase().includes(q);
        }

        tr.style.display = match ? "" : "none";
      });
    }

    filterInput.addEventListener("input", applyFilter);
    filterColumn.addEventListener("change", applyFilter);
  }

  // ----- старт -----
  (async () => {
    await Promise.all([loadTasks(), preloadStageNames(), preloadEventList()]);
    bindSyncButton();
    bindCopyDelegation();
    bindFilter();
    bindFormHandlers();
  })();
});
