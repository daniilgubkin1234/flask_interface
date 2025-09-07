document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("threePlusTwentyForm");

  // ---------------- helpers ----------------
  const $ = (id) => document.getElementById(id);

  async function fetchJSON(url, options = {}) {
    const opts = {
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.headers || {}) },
      ...options,
    };
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      // вернулся HTML/редирект — считаем, что нужна авторизация
      throw new Error("Не удалось получить данные (возможен выход из аккаунта).");
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Ошибка ${res.status}`);
    }
    return data;
  }

  // ---------------- 1) Загрузка сохранённой версии 3+20 ----------------
  async function loadThreePlusTwenty() {
    try {
      const data = await fetchJSON("/get_three_plus_twenty");
      if (!data || Object.keys(data).length === 0) return;

      // 1.1 Должность
      const position = Array.isArray(data.position) ? data.position : [data.position].filter(Boolean);
      if (position[0] !== undefined && $("position_name")) {
        $("position_name").value = String(position[0] ?? "");
      }

      // 1.2 Источники полей (совместимость со старыми версиями)
      const toText = (x) =>
        typeof x === "string"
          ? x
          : (x && (x.name || x.task || x.work || x.title || x.value)) || "";

      const oldDirections = Array.isArray(data.directions) ? data.directions : [];
      const oldResp = Array.isArray(data.responsibilities) ? data.responsibilities : [];

      const mainFns = Array.isArray(data.main_functions) ? data.main_functions.map(toText) : [];
      const addFns = Array.isArray(data.additional_functions) ? data.additional_functions.map(toText) : [];

      // 1.3 Основные направления (3 шт.) — берём main_functions, иначе старое поле directions
      const directions = (mainFns.length ? mainFns.slice(0, 3) : oldDirections).slice(0, 3);
      for (let i = 0; i < 3; i++) {
        if ($(`direction_${i + 1}`)) {
          $(`direction_${i + 1}`).value = directions[i] || "";
        }
      }

      // 1.4 Должностные обязанности (20 шт.) — ТОЛЬКО из additional_functions или старого responsibilities
      const responsibilities = (addFns.length ? addFns : oldResp);
      for (let i = 1; i <= 20; i++) {
        if ($(`responsibility_${i}`)) {
          $(`responsibility_${i}`).value = responsibilities[i - 1] || "";
        }
      }
    } catch (e) {
      console.warn("Не удалось загрузить 3+20:", e.message || e);
    }
  }

  // ---------------- 2) Datalist со списком задач для Направлений ----------------
  async function attachTaskDatalistToDirections() {
    // создаём единый datalist
    let dl = document.getElementById("task-options");
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = "task-options";
      document.body.appendChild(dl);
    }
    // привязываем к полям Направление 1–3
    ["direction_1", "direction_2", "direction_3"].forEach((id) => {
      const input = $(id);
      if (input) input.setAttribute("list", "task-options");
    });

    try {
      const tasks = await fetchJSON("/get_tasks");
      const names = [...new Set((tasks || [])
        .map((t) => (t.task || "").trim())
        .filter(Boolean))];

      dl.innerHTML = "";
      names.forEach((n) => {
        const opt = document.createElement("option");
        opt.value = n;
        dl.appendChild(opt);
      });
    } catch (e) {
      console.warn("Не удалось загрузить список задач для направлений:", e.message || e);
    }
  }

  // ---------------- 3) Автосохранение ----------------
  // (Без дебаунса — при необходимости можно добавить)
  async function autoSave() {
    const position = [$("position_name")?.value?.trim() || ""];

    const directions = [
      $("direction_1")?.value?.trim() || "",
      $("direction_2")?.value?.trim() || "",
      $("direction_3")?.value?.trim() || "",
    ];

    const responsibilities = [];
    for (let i = 1; i <= 20; i++) {
      responsibilities.push($(`responsibility_${i}`)?.value?.trim() || "");
    }

    // Единый формат: main_functions = направления, additional_functions = обязанности
    const payload = {
      position,
      directions,
      responsibilities,
      main_functions: directions.filter(Boolean),
      additional_functions: responsibilities.filter(Boolean),
    };

    try {
      await fetchJSON("/save_three_plus_twenty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("Не удалось сохранить 3+20:", e.message || e);
    }
  }

  // ---------------- 4) Init ----------------
  (async () => {
    await loadThreePlusTwenty();          // поднять сохранённые данные
    await attachTaskDatalistToDirections(); // подключить выпадающий список задач к направлениям

    // навешиваем автосохранение на любые изменения формы
    form?.addEventListener("input", autoSave);

    // submit просто показывает уведомление (автосохранение уже сработало)
    form?.addEventListener("submit", function (event) {
      event.preventDefault();
      alert("Данные успешно сохранены!");
    });
  })();
});
