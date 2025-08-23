document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("threePlusTwentyForm");
  
    // --- 1. Автозагрузка ---
    fetch("/get_three_plus_twenty")
      .then(res => res.json())
      .then(data => {
        if (!data || Object.keys(data).length === 0) return;
  
        // 1.1 Должность (как и было)
        if (data.position && data.position[0] !== undefined) {
          document.getElementById("position_name").value = data.position[0];
        }
  
        // Хелпер: извлечь текст из разных форматов элементов
        const toText = (x) =>
          typeof x === "string"
            ? x
            : (x && (x.name || x.task || x.work || x.title || x.value)) || "";
  
        // 1.2 Источники данных
        const oldDirections = Array.isArray(data.directions) ? data.directions : [];
        const oldResp = Array.isArray(data.responsibilities) ? data.responsibilities : [];
  
        const mainFns = Array.isArray(data.main_functions) ? data.main_functions.map(toText) : [];
        const addFns  = Array.isArray(data.additional_functions) ? data.additional_functions.map(toText) : [];
  
        // 1.3 Направления (3 шт.)
        const directions = (mainFns.length ? mainFns.slice(0, 3) : oldDirections).slice(0, 3);
        for (let i = 0; i < 3; i++) {
          if (directions[i] !== undefined) {
            document.getElementById(`direction_${i + 1}`).value = directions[i];
          }
        }
  
        // 1.4 Обязанности (20 шт.)
        const responsibilities = (mainFns.concat(addFns)).length
          ? mainFns.concat(addFns)
          : oldResp;
        for (let i = 0; i < 20; i++) {
          if (responsibilities[i] !== undefined) {
            document.getElementById(`responsibility_${i + 1}`).value = responsibilities[i];
          }
        }
      });
      // --- 1.5 Автоподстановка из задач, если обязанности/направления ещё пустые ---
fetch("/get_tasks")
.then(r => r.json())
.then(tasks => {
  // Проверим: есть ли уже что-то в обязанностях/направлениях
  const anyRespFilled = Array.from({ length: 20 }, (_, i) =>
    document.getElementById(`responsibility_${i + 1}`)?.value.trim()
  ).some(Boolean);

  const d1 = document.getElementById("direction_1")?.value.trim() || "";
  const d2 = document.getElementById("direction_2")?.value.trim() || "";
  const d3 = document.getElementById("direction_3")?.value.trim() || "";

  // Если пусто — подставим из задач
  if (!anyRespFilled && Array.isArray(tasks) && tasks.length) {
    const names = tasks
      .map(t => (t.task || t.work || "").trim())
      .filter(Boolean);

    // Обязанности (до 20)
    for (let i = 1; i <= 20 && i <= names.length; i++) {
      const el = document.getElementById(`responsibility_${i}`);
      if (el && !el.value.trim()) el.value = names[i - 1];
    }

    // Три основных направления — первые 3 задачи, если они не заданы
    if (!d1) document.getElementById("direction_1").value = names[0] || "";
    if (!d2) document.getElementById("direction_2").value = names[1] || "";
    if (!d3) document.getElementById("direction_3").value = names[2] || "";

    // Триггерим автосохранение существующей функцией
    form.dispatchEvent(new Event("input"));
  }
})
.catch(() => {});

    // --- 2. Автосохранение ---
    function autoSave() {
      const position = [document.getElementById("position_name").value.trim()];
      const directions = [
        document.getElementById("direction_1").value.trim(),
        document.getElementById("direction_2").value.trim(),
        document.getElementById("direction_3").value.trim()
      ];
  
      const responsibilities = [];
      for (let i = 1; i <= 20; i++) {
        responsibilities.push(document.getElementById(`responsibility_${i}`).value.trim());
      }
  
      // Совместимость: сохраняем и старые, и новые поля
      const payload = {
        position,
        directions,
        responsibilities,
        // новые поля для единого формата
        main_functions: directions.filter(Boolean), // 3 «основные» попадут сюда
        additional_functions: responsibilities.filter(Boolean) // всё остальное
      };
  
      fetch("/save_three_plus_twenty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
  
    // --- 3. Вешаем автосохранение на любые изменения ---
    form.addEventListener("input", autoSave);
  
    // --- 4. Submit: просто alert, так как данные уже сохранены ---
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      alert("Данные успешно сохранены!");
    });
  });
  