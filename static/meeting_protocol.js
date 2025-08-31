document.addEventListener("DOMContentLoaded", () => {
    // --- Селекторы и счетчики ---
    const form = document.getElementById("protocolForm");
    const meetingDate = document.getElementById("meetingDate");
    const participantsSection = document.getElementById("participantsSection");
    const addParticipantButton = document.getElementById("addParticipant");
    let participantCount = 1;

    const discussionResultsSection = document.getElementById("discussionResultsSection");
    const addDiscussionResultButton = document.getElementById("addDiscussionResult");
    let discussionResultCount = 1;

    const nextStepsTable = document.getElementById("nextStepsTable").querySelector("tbody");
    const addNextStepButton = document.getElementById("addNextStep");
    let nextStepCount = 1;

    // --- 1. Автозагрузка последних данных ---
    fetch("/get_meeting_protocol")
        .then(res => res.json())
        .then(data => {
            if (!data || Object.keys(data).length === 0) return;

            // Дата
            meetingDate.value = data.meetingDate || '';

            // Участники
            const participants = Array.isArray(data.participants) ? data.participants : (data.participants ? [data.participants] : []);
            // Оставляем только первый, остальные удаляем
            while (participantsSection.querySelectorAll('.participant').length > 1)
                participantsSection.querySelectorAll('.participant')[1].remove();
            participantCount = 1;
            if (participants.length > 0) {
                participants.forEach((val, idx) => {
                    if (idx === 0) {
                        participantsSection.querySelector('input').value = val;
                    } else {
                        participantCount++;
                        const newParticipant = document.createElement("div");
                        newParticipant.classList.add("participant");
                        newParticipant.innerHTML = `
                            <label for="participant_${participantCount}">Участник ${participantCount}:</label>
                            <input type="text" id="participant_${participantCount}" name="participant_${participantCount}" value="${val}" required>
                        `;
                        participantsSection.insertBefore(newParticipant, addParticipantButton);
                    }
                });
            }

            // Результаты обсуждения
            const discussionResults = Array.isArray(data.discussionResults) ? data.discussionResults : (data.discussionResults ? [data.discussionResults] : []);
            while (discussionResultsSection.querySelectorAll('.discussion-result').length > 1)
                discussionResultsSection.querySelectorAll('.discussion-result')[1].remove();
            discussionResultCount = 1;
            if (discussionResults.length > 0) {
                discussionResults.forEach((val, idx) => {
                    if (idx === 0) {
                        discussionResultsSection.querySelector('textarea').value = val;
                    } else {
                        discussionResultCount++;
                        const newResult = document.createElement("div");
                        newResult.classList.add("discussion-result");
                        newResult.innerHTML = `
                            <label for="discussionResult_${discussionResultCount}">Результат ${discussionResultCount}:</label>
                            <textarea id="discussionResult_${discussionResultCount}" name="discussionResult_${discussionResultCount}" rows="3" required>${val}</textarea>
                        `;
                        discussionResultsSection.insertBefore(newResult, addDiscussionResultButton);
                    }
                });
            }

            // Следующие шаги
            const nextSteps = Array.isArray(data.nextSteps) ? data.nextSteps : (data.nextSteps ? [data.nextSteps] : []);
            while (nextStepsTable.rows.length > 1) nextStepsTable.deleteRow(1);
            nextStepCount = 1;
            if (nextSteps.length > 0) {
                nextSteps.forEach((step, idx) => {
                    if (idx === 0) {
                        nextStepsTable.rows[0].querySelector("textarea").value = step.task || "";
                        nextStepsTable.rows[0].querySelector("input[name^='executor_']").value = step.executor || "";
                        nextStepsTable.rows[0].querySelector("input[name^='deadline_']").value = step.deadline || "";
                    } else {
                        nextStepCount++;
                        const newRow = document.createElement("tr");
                        newRow.innerHTML = `
                            <td>${nextStepCount}</td>
                            <td><textarea name="task_${nextStepCount}" rows="2" required>${step.task || ""}</textarea></td>
                            <td><input type="text" name="executor_${nextStepCount}" value="${step.executor || ""}" required></td>
                            <td><input type="date" name="deadline_${nextStepCount}" value="${step.deadline || ""}" required></td>
                        `;
                        nextStepsTable.appendChild(newRow);
                    }
                });
            }
        });

    // --- 2. Автоматическое сохранение при любом изменении ---
    function autoSaveMeetingProtocol() {
        // Собираем участников
        const participants = Array.from(participantsSection.querySelectorAll('.participant input')).map(inp => inp.value.trim()).filter(Boolean);

        // Собираем результаты обсуждения
        const discussionResults = Array.from(discussionResultsSection.querySelectorAll('.discussion-result textarea')).map(t => t.value.trim()).filter(Boolean);

        // Следующие шаги (таблица)
        const nextSteps = [];
        Array.from(nextStepsTable.rows).forEach(row => {
            nextSteps.push({
                task: row.querySelector("textarea") ? row.querySelector("textarea").value : "",
                executor: row.querySelector("input[name^='executor_']") ? row.querySelector("input[name^='executor_']").value : "",
                deadline: row.querySelector("input[name^='deadline_']") ? row.querySelector("input[name^='deadline_']").value : ""
            });
        });

        const protocolData = {
            meetingDate: meetingDate.value,
            participants: participants,
            discussionResults: discussionResults,
            nextSteps: nextSteps
        };

        fetch("/save_meeting_protocol", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(protocolData)
        });
    }

    // Навешиваем автосохранение на всё (форму)
    form.addEventListener("input", autoSaveMeetingProtocol);

    // --- 3. Динамические элементы (оставь как было, но увеличь счетчики!) ---
    addParticipantButton.addEventListener("click", () => {
        participantCount++;
        const newParticipant = document.createElement("div");
        newParticipant.classList.add("participant");
        newParticipant.innerHTML = `
            <label for="participant_${participantCount}">Участник ${participantCount}:</label>
            <input type="text" id="participant_${participantCount}" name="participant_${participantCount}" placeholder="Введите имя участника" required>
        `;
        participantsSection.insertBefore(newParticipant, addParticipantButton);
        autoSaveMeetingProtocol();
    });

    addDiscussionResultButton.addEventListener("click", () => {
        discussionResultCount++;
        const newResult = document.createElement("div");
        newResult.classList.add("discussion-result");
        newResult.innerHTML = `
            <label for="discussionResult_${discussionResultCount}">Результат ${discussionResultCount}:</label>
            <textarea id="discussionResult_${discussionResultCount}" name="discussionResult_${discussionResultCount}" rows="3" required></textarea>
        `;
        discussionResultsSection.insertBefore(newResult, addDiscussionResultButton);
        autoSaveMeetingProtocol();
    });

    addNextStepButton.addEventListener("click", () => {
        nextStepCount++;
        const newRow = document.createElement("tr");
        newRow.innerHTML = `
            <td>${nextStepCount}</td>
            <td><textarea name="task_${nextStepCount}" rows="2" required></textarea></td>
            <td><input type="text" name="executor_${nextStepCount}" required></td>
            <td><input type="date" name="deadline_${nextStepCount}" required></td>
        `;
        nextStepsTable.appendChild(newRow);
        autoSaveMeetingProtocol();
    });

    // --- 4. Submit только для alert, без отправки (данные уже автосохраняются) ---
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        alert("Протокол совещания сохранён!");
    });
    const downloadBtn = document.getElementById("downloadProtocol");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const data = collectProtocolData();
      const html = buildProtocolDocHTML(data);
      const datePart = (data.date || new Date().toISOString().slice(0,10)).replaceAll("-", ".");
      downloadDoc(html, `Протокол_совещания_${datePart}.doc`);
    });
  }

  function collectProtocolData() {
    // Дата
    const date = meetingDate?.value || "";

    // Участники (все input внутри .participant)
    const participants = Array.from(
      participantsSection.querySelectorAll(".participant input")
    ).map(el => el.value.trim()).filter(Boolean);

    // Результаты обсуждения (все textarea внутри .discussion-result)
    const discussionResults = Array.from(
      discussionResultsSection.querySelectorAll(".discussion-result textarea")
    ).map(el => el.value.trim()).filter(Boolean);

    // Следующие шаги — пробегаемся по строкам tbody
    const nextSteps = Array.from(nextStepsTable.rows).map((row) => {
      const task = row.querySelector("textarea")?.value.trim() || "";
      const executor = row.querySelector("input[name^='executor_']")?.value.trim() || "";
      const deadline = row.querySelector("input[name^='deadline_']")?.value || "";
      return { task, executor, deadline };
    }).filter(s => s.task || s.executor || s.deadline);

    return { date, participants, discussionResults, nextSteps };
  }

  function buildProtocolDocHTML({ date, participants, discussionResults, nextSteps }) {
    const esc = (s) => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
    const formatDateRU = (iso) => {
      if (!iso) return "";
      const [y,m,d] = iso.split("-");
      return `${d}.${m}.${y}`;
    };

    const participantsHTML = participants.length
      ? `<ol>${participants.map(p => `<li>${esc(p)}</li>`).join("")}</ol>`
      : `<p style="color:#555;">—</p>`;

    const resultsHTML = discussionResults.length
      ? `<ol>${discussionResults.map(r => `<li>${esc(r)}</li>`).join("")}</ol>`
      : `<p style="color:#555;">—</p>`;

    const stepsRows = (nextSteps.length ? nextSteps : [{task:"",executor:"",deadline:""}])
      .map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(s.task)}</td>
          <td>${esc(s.executor)}</td>
          <td>${esc(formatDateRU(s.deadline))}</td>
        </tr>`).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Протокол совещания</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.35; }
  h1   { text-align: center; font-size: 18pt; margin: 0 0 12pt; }
  .meta p { margin: 0 0 6pt; }
  .section-title { font-weight: bold; margin: 12pt 0 6pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
  th, td { border: 1px solid #000; padding: 6pt; vertical-align: top; }
  th { text-align: center; }
</style>
</head>
<body>
  <h1>Протокол совещания</h1>

  <div class="meta">
    <p><b>Дата:</b> ${esc(formatDateRU(date))}</p>
  </div>

  <div class="section">
    <div class="section-title">Участники:</div>
    ${participantsHTML}
  </div>

  <div class="section">
    <div class="section-title">Результаты обсуждения:</div>
    ${resultsHTML}
  </div>

  <div class="section">
    <div class="section-title">Следующие шаги:</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;">№</th>
          <th>Задача</th>
          <th style="width:28%;">Исполнитель</th>
          <th style="width:18%;">Срок</th>
        </tr>
      </thead>
      <tbody>
        ${stepsRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  function downloadDoc(htmlString, filename) {
    const blob = new Blob([htmlString], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
});
