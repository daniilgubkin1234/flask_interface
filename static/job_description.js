document.addEventListener("DOMContentLoaded", () => {
    // --- Селекторы и счётчики ---
    const form = document.getElementById("protocolForm");
    const protocolName = document.getElementById("protocolName");
    const meetingDate = document.getElementById("meetingDate");
    
    // Переменные для автосохранения в localStorage
    let autoSaveTimeout = null;
    const AUTO_SAVE_DELAY = 1000; // 1 секунда
    const STORAGE_KEY = 'jobDescriptionDraft';
    
    // Управление боковым меню
    document
        .querySelector(".toggle-sidebar")
        .addEventListener("click", function () {
            const sidebar = document.querySelector(".recommendation-block");
            const button = document.querySelector(".toggle-sidebar");

            // Одновременно применяем классы для синхронной анимации
            sidebar.classList.toggle("show");
            button.classList.toggle("menu-open");
        });

    // Закрытие меню при клике вне области
    document.addEventListener("click", function (e) {
        const sidebar = document.querySelector(".recommendation-block");
        const button = document.querySelector(".toggle-sidebar");

        if (
            sidebar.classList.contains("show") &&
            !sidebar.contains(e.target) &&
            !button.contains(e.target)
        ) {
            sidebar.classList.remove("show");
            button.classList.remove("menu-open");
        }
    });

    const participantsSection = document.getElementById("participantsSection");
    const addParticipantButton = document.getElementById("addParticipant");
    let participantCount = 1;

    const discussionResultsSection = document.getElementById(
        "discussionResultsSection"
    );
    const addDiscussionResultButton = document.getElementById(
        "addDiscussionResult"
    );
    let discussionResultCount = 1;

    const nextStepsTable = document
        .getElementById("nextStepsTable")
        .querySelector("tbody");
    const addNextStepButton = document.getElementById("addNextStep");
    let nextStepCount = 1;

    // --- Новые переменные для управления протоколами ---
    let currentProtocolId = null;
    let protocolsList = [];
    const protocolSelector = document.getElementById("protocolSelector");
    const newProtocolBtn = document.getElementById("newProtocolBtn");
    const deleteProtocolBtn = document.getElementById("deleteProtocolBtn");

    // --- Функции для работы с localStorage ---
    function saveToLocalStorage() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            const protocolData = collectProtocolData();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...protocolData,
                _timestamp: new Date().toISOString(),
                _currentProtocolId: currentProtocolId
            }));
            console.log("Данные автосохранены в localStorage");
        }, AUTO_SAVE_DELAY);
    }

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                
                // Проверяем, не устарели ли данные (больше 24 часов)
                const savedTime = new Date(data._timestamp);
                const currentTime = new Date();
                const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24) { // Данные актуальны менее 24 часов
                    return data;
                } else {
                    // Удаляем устаревшие данные
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (error) {
            console.error("Ошибка загрузки из localStorage:", error);
        }
        return null;
    }

    function clearLocalStorage() {
        localStorage.removeItem(STORAGE_KEY);
        console.log("Данные очищены из localStorage");
    }

    function restoreFromDraft() {
        const draft = loadFromLocalStorage();
        if (draft && confirm('Обнаружены несохраненные данные. Восстановить их?')) {
            loadProtocolData(draft);
            return true;
        }
        return false;
    }

    // --- 1. Загрузка списка протоколов ---
    function loadProtocolsList() {
        fetch("/get_meeting_protocols_list")
            .then((res) => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then((data) => {
                protocolsList = data.protocols || [];
                updateProtocolSelector();
                updateDeleteButtonState();

                // Если есть протоколы, загружаем последний, иначе создаем новый
                if (protocolsList.length > 0) {
                    loadSelectedProtocol(protocolsList[0]._id);
                } else {
                    createNewProtocol();
                }
            })
            .catch((error) => {
                console.error("Ошибка загрузки списка протоколов:", error);
                protocolsList = [];
                updateProtocolSelector();
                updateDeleteButtonState();
                createNewProtocol();
            });
    }

    // --- 2. Обновление выпадающего списка ---
    function updateProtocolSelector() {
        if (!protocolSelector) return;

        protocolSelector.innerHTML =
            '<option value="">-- Создать новый протокол --</option>';

        protocolsList.forEach((protocol) => {
            const option = document.createElement("option");
            option.value = protocol._id;

            const title =
                protocol.protocolName ||
                (protocol.date
                    ? `Протокол от ${formatDateForDisplay(protocol.date)}`
                    : "Протокол без названия");

            option.textContent = title;
            if (protocol._id === currentProtocolId) {
                option.selected = true;
            }
            protocolSelector.appendChild(option);
        });
    }

    // --- 2A. Обновление состояния кнопки удаления ---
    function updateDeleteButtonState() {
        if (deleteProtocolBtn) {
            deleteProtocolBtn.disabled = !currentProtocolId;
        }
    }

    // --- 3. Форматирование даты для отображения ---
    function formatDateForDisplay(isoDate) {
        if (!isoDate) return "";
        const [year, month, day] = isoDate.split("-");
        return `${day}.${month}.${year}`;
    }

    // --- 4. Создание нового протокола ---
    function createNewProtocol() {
        // Сначала проверяем, есть ли черновик для нового протокола
        const draft = loadFromLocalStorage();
        if (!draft || draft._currentProtocolId) {
            // Нет черновика или черновик от другого протокола - сбрасываем форму
            currentProtocolId = null;
            resetForm();
            if (protocolSelector) protocolSelector.value = "";
            updateDeleteButtonState();

            // Устанавливаем сегодняшнюю дату по умолчанию
            const today = new Date().toISOString().split("T")[0];
            meetingDate.value = today;
        } else {
            // Есть черновик для нового протокола - используем его
            currentProtocolId = null;
            resetForm();
            if (protocolSelector) protocolSelector.value = "";
            updateDeleteButtonState();
            loadProtocolData(draft);
        }
        console.log("Создан новый протокол");
    }

    // --- 5. Сброс формы ---
    function resetForm() {
        form.reset();

        // Сброс динамических полей участников (оставить только первого)
        const participantDivs =
            participantsSection.querySelectorAll(".participant");
        for (let i = 1; i < participantDivs.length; i++) {
            participantDivs[i].remove();
        }
        participantCount = 1;

        // Сброс динамических полей результатов (оставить только первого)
        const resultDivs =
            discussionResultsSection.querySelectorAll(".discussion-result");
        for (let i = 1; i < resultDivs.length; i++) {
            resultDivs[i].remove();
        }
        discussionResultCount = 1;

        // Сброс таблицы следующих шагов (оставить только первую строку)
        const rows = nextStepsTable.querySelectorAll("tr");
        for (let i = 1; i < rows.length; i++) {
            rows[i].remove();
        }
        nextStepCount = 1;

        // Очищаем значения первой строки таблицы
        const firstRow = nextStepsTable.rows[0];
        if (firstRow) {
            firstRow.querySelector("input[name^='goal_']").value = "";
            firstRow.querySelector("input[name^='event_']").value = "";
            firstRow.querySelector("textarea[name^='task_']").value = "";
            firstRow.querySelector("input[name^='executor_']").value = "";
            firstRow.querySelector("input[name^='deadline_']").value = "";
        }
    }

    // --- 6. Загрузка выбранного протокола ---
    function loadSelectedProtocol(protocolId) {
        // Проверяем, есть ли несохраненные изменения для текущего протокола
        const draft = loadFromLocalStorage();
        if (draft && draft._currentProtocolId === currentProtocolId && currentProtocolId !== protocolId) {
            if (!confirm('У вас есть несохраненные изменения. Перейти без сохранения?')) {
                // Восстанавливаем предыдущее значение в селекторе
                if (protocolSelector && currentProtocolId) {
                    protocolSelector.value = currentProtocolId;
                }
                return;
            }
        }

        fetch(`/get_meeting_protocol/${protocolId}`)
            .then((res) => {
                if (!res.ok) throw new Error("Protocol not found");
                return res.json();
            })
            .then((data) => {
                if (data.error) {
                    alert("Ошибка загрузки протокола: " + data.error);
                    return;
                }
                loadProtocolData(data);
                currentProtocolId = protocolId;
                updateDeleteButtonState();
                // Очищаем черновик при успешной загрузке из БД
                clearLocalStorage();
            })
            .catch((error) => {
                console.error("Ошибка загрузки протокола:", error);
                alert("Ошибка загрузки протокола");
            });
    }

    // --- 7. Загрузка данных протокола в форму ---
    function loadProtocolData(data) {
        if (!data) return;

        // Сначала сбрасываем форму
        resetForm();

        // Заполняем основные поля
        protocolName.value = data.protocolName || "";
        meetingDate.value = data.meetingDate || "";

        // Участники
        const participants = Array.isArray(data.participants)
            ? data.participants
            : data.participants
            ? [data.participants]
            : [];

        // Заполняем первого участника
        if (participants.length > 0) {
            participantsSection.querySelector("input").value = participants[0];
        }

        // Добавляем остальных участников с кнопками удаления
        for (let i = 1; i < participants.length; i++) {
            participantCount++;
            const newParticipant = document.createElement("div");
            newParticipant.classList.add("participant");
            newParticipant.innerHTML = `
            <label for="participant_${participantCount}">Участник ${participantCount}:</label>
            <input type="text" id="participant_${participantCount}" name="participant_${participantCount}" value="${participants[i]}" required>
            <button type="button" class="remove-participant">×</button>
        `;
            participantsSection.insertBefore(
                newParticipant,
                addParticipantButton
            );
        }

        // Результаты обсуждения
        const discussionResults = Array.isArray(data.discussionResults)
            ? data.discussionResults
            : data.discussionResults
            ? [data.discussionResults]
            : [];

        // Заполняем первый результат
        if (discussionResults.length > 0) {
            discussionResultsSection.querySelector("textarea").value =
                discussionResults[0];
        }

        // Добавляем остальные результаты с кнопками удаления
        for (let i = 1; i < discussionResults.length; i++) {
            discussionResultCount++;
            const newResult = document.createElement("div");
            newResult.classList.add("discussion-result");
            newResult.innerHTML = `
            <label for="discussionResult_${discussionResultCount}">Результат ${discussionResultCount}:</label>
            <textarea id="discussionResult_${discussionResultCount}" name="discussionResult_${discussionResultCount}" rows="3" required>${discussionResults[i]}</textarea>
            <button type="button" class="remove-result">×</button>
        `;
            discussionResultsSection.insertBefore(
                newResult,
                addDiscussionResultButton
            );
        }

        // Следующие шаги
        const nextSteps = Array.isArray(data.nextSteps)
            ? data.nextSteps
            : data.nextSteps
            ? [data.nextSteps]
            : [];

        // Заполняем первую строку таблицы
        if (nextSteps.length > 0) {
            const firstRow = nextStepsTable.rows[0];
            const firstStep = nextSteps[0];

            firstRow.querySelector("input[name^='goal_']").value =
                firstStep.goal || firstStep.task || "";
            firstRow.querySelector("input[name^='event_']").value =
                firstStep.event || "";
            firstRow.querySelector("textarea[name^='task_']").value =
                firstStep.work || firstStep.task || "";
            firstRow.querySelector("input[name^='executor_']").value =
                firstStep.executor || "";
            firstRow.querySelector("input[name^='deadline_']").value =
                firstStep.deadline || "";
        }

        // Добавляем остальные строки таблицы с кнопками удаления
        for (let i = 1; i < nextSteps.length; i++) {
            nextStepCount++;
            const step = nextSteps[i];
            const newRow = document.createElement("tr");
            newRow.innerHTML = `
            <td>${nextStepCount}</td>
            <td><input type="text" name="goal_${nextStepCount}" value="${(
                step.goal ||
                step.task ||
                ""
            ).replace(/"/g, "&quot;")}"></td>
            <td><input type="text" name="event_${nextStepCount}" value="${(
                step.event || ""
            ).replace(/"/g, "&quot;")}"></td>
            <td><textarea name="task_${nextStepCount}" rows="2" required>${
                step.work || step.task || ""
            }</textarea></td>
            <td><input type="text" name="executor_${nextStepCount}" value="${(
                step.executor || ""
            ).replace(/"/g, "&quot;")}" required></td>
            <td><input type="date" name="deadline_${nextStepCount}" value="${
                step.deadline || ""
            }" required></td>
            <td><button type="button" class="remove-step">×</button></td>
        `;
            nextStepsTable.appendChild(newRow);
        }

        // Если нет следующих шагов, убедимся что первая строка чистая
        if (nextSteps.length === 0) {
            const firstRow = nextStepsTable.rows[0];
            firstRow.querySelector("input[name^='goal_']").value = "";
            firstRow.querySelector("input[name^='event_']").value = "";
            firstRow.querySelector("textarea[name^='task_']").value = "";
            firstRow.querySelector("input[name^='executor_']").value = "";
            firstRow.querySelector("input[name^='deadline_']").value = "";
        }
    }

    // --- 8. Сбор данных формы ---
    function collectProtocolData() {
        const protocolNameValue = protocolName.value.trim();
        // Участники
        const participants = Array.from(
            participantsSection.querySelectorAll(".participant input")
        )
            .map((inp) => inp.value.trim())
            .filter(Boolean);

        // Результаты обсуждения
        const discussionResults = Array.from(
            discussionResultsSection.querySelectorAll(
                ".discussion-result textarea"
            )
        )
            .map((t) => t.value.trim())
            .filter(Boolean);

        // Следующие шаги
        const nextSteps = [];
        Array.from(nextStepsTable.rows).forEach((row) => {
            const goal = row.querySelector("input[name^='goal_']")?.value || "";
            const event =
                row.querySelector("input[name^='event_']")?.value || "";
            const work =
                row.querySelector("textarea[name^='task_']")?.value || "";
            const executor =
                row.querySelector("input[name^='executor_']")?.value || "";
            const deadline =
                row.querySelector("input[name^='deadline_']")?.value || "";

            // Добавляем только если есть хотя бы одно заполненное поле
            if (goal || event || work || executor || deadline) {
                nextSteps.push({
                    goal: goal.trim(),
                    event: event.trim(),
                    work: work.trim(),
                    executor: executor.trim(),
                    deadline: deadline.trim(),
                });
            }
        });

        return {
            protocolName: protocolNameValue,
            meetingDate: meetingDate.value,
            participants,
            discussionResults,
            nextSteps,
        };
    }

    // --- 9. Функция сохранения в БД ---
    async function saveMeetingProtocol() {
        const protocolData = collectProtocolData();

        if (currentProtocolId) {
            protocolData._id = currentProtocolId;
        }

        const url = currentProtocolId ? "/update_meeting_protocol" : "/save_meeting_protocol";

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(protocolData),
            });
            
            const data = await response.json();
            
            if (!currentProtocolId && data.protocol_id) {
                currentProtocolId = data.protocol_id;
                loadProtocolsList();
            }
            
            // Очищаем localStorage после успешного сохранения в БД
            clearLocalStorage();
            return data;
        } catch (error) {
            console.error("Ошибка сохранения протокола:", error);
            throw error;
        }
    }

    // --- 10. Обработчики событий для элементов управления протоколами ---
    if (protocolSelector) {
        protocolSelector.addEventListener("change", function () {
            const selectedId = this.value;
            if (selectedId) {
                loadSelectedProtocol(selectedId);
            } else {
                createNewProtocol();
            }
        });
    }

    if (newProtocolBtn) {
        newProtocolBtn.addEventListener("click", function() {
            // Проверяем, есть ли несохраненные изменения
            const draft = loadFromLocalStorage();
            if (draft) {
                if (!confirm('У вас есть несохраненные изменения. Создать новый протокол без сохранения?')) {
                    return;
                }
            }
            clearLocalStorage();
            createNewProtocol();
        });
    }

    // --- 10A. Обработчик удаления протокола ---
    if (deleteProtocolBtn) {
        deleteProtocolBtn.addEventListener("click", function () {
            if (!currentProtocolId) {
                alert("Нет выбранного протокола для удаления.");
                return;
            }

            if (
                !confirm(
                    "Вы уверены, что хотите удалить этот протокол? Это действие нельзя отменить."
                )
            ) {
                return;
            }

            fetch(`/delete_meeting_protocol/${currentProtocolId}`, {
                method: "DELETE",
            })
                .then((response) => response.json())
                .then((data) => {
                    if (data.error) {
                        alert("Ошибка при удалении протокола: " + data.error);
                    } else {
                        alert("Протокол успешно удален.");
                        // После удаления создаем новый протокол и обновляем список
                        createNewProtocol();
                        loadProtocolsList();
                        clearLocalStorage();
                    }
                })
                .catch((error) => {
                    console.error("Ошибка при удалении протокола:", error);
                    alert("Ошибка при удалении протокола.");
                });
        });
    }

    // --- 11. Динамические элементы (участники, результаты, шаги) ---
    addParticipantButton.addEventListener("click", () => {
        participantCount++;
        const el = document.createElement("div");
        el.classList.add("participant");
        el.innerHTML = `
        <label for="participant_${participantCount}">Участник ${participantCount}:</label>
        <input type="text" id="participant_${participantCount}" name="participant_${participantCount}" placeholder="Введите имя участника" required>
        <button type="button" class="remove-participant">×</button>
    `;
        participantsSection.insertBefore(el, addParticipantButton);
        saveToLocalStorage();
    });

    addDiscussionResultButton.addEventListener("click", () => {
        discussionResultCount++;
        const el = document.createElement("div");
        el.classList.add("discussion-result");
        el.innerHTML = `
        <label for="discussionResult_${discussionResultCount}">Результат ${discussionResultCount}:</label>
        <textarea id="discussionResult_${discussionResultCount}" name="discussionResult_${discussionResultCount}" rows="3" required></textarea>
        <button type="button" class="remove-result">×</button>
    `;
        discussionResultsSection.insertBefore(el, addDiscussionResultButton);
        saveToLocalStorage();
    });

    addNextStepButton.addEventListener("click", () => {
        nextStepCount++;
        const newRow = document.createElement("tr");
        newRow.innerHTML = `
        <td>${nextStepCount}</td>
        <td><input type="text" name="goal_${nextStepCount}" placeholder="Введите задачу"></td>
        <td><input type="text" name="event_${nextStepCount}" placeholder="Введите мероприятие"></td>
        <td><textarea name="task_${nextStepCount}" rows="2" required></textarea></td>
        <td><input type="text" name="executor_${nextStepCount}" required></td>
        <td><input type="date" name="deadline_${nextStepCount}" required></td>
        <td><button type="button" class="remove-step">×</button></td>
    `;
        nextStepsTable.appendChild(newRow);
        saveToLocalStorage();
    });

    // --- 11A. Обработчики удаления динамических элементов ---
    participantsSection.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-participant")) {
            // Не удаляем первого участника
            if (
                participantsSection.querySelectorAll(".participant").length > 1
            ) {
                e.target.closest(".participant").remove();
                // Пересчитываем номера участников
                updateParticipantLabels();
                saveToLocalStorage();
            }
        }
    });

    discussionResultsSection.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-result")) {
            if (
                discussionResultsSection.querySelectorAll(".discussion-result")
                    .length > 1
            ) {
                e.target.closest(".discussion-result").remove();
                updateDiscussionResultLabels();
                saveToLocalStorage();
            }
        }
    });

    nextStepsTable.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-step")) {
            const row = e.target.closest("tr");
            if (nextStepsTable.rows.length > 1) {
                row.remove();
                updateNextStepNumbers();
                saveToLocalStorage();
            }
        }
    });

    // --- 11B. Функции обновления номеров после удаления ---
    function updateParticipantLabels() {
        const participants =
            participantsSection.querySelectorAll(".participant");
        participants.forEach((div, index) => {
            const label = div.querySelector("label");
            const input = div.querySelector("input");
            label.textContent = `Участник ${index + 1}:`;
            label.setAttribute("for", `participant_${index + 1}`);
            input.id = `participant_${index + 1}`;
            input.name = `participant_${index + 1}`;
        });
        participantCount = participants.length;
    }

    function updateDiscussionResultLabels() {
        const results =
            discussionResultsSection.querySelectorAll(".discussion-result");
        results.forEach((div, index) => {
            const label = div.querySelector("label");
            const textarea = div.querySelector("textarea");
            label.textContent = `Результат ${index + 1}:`;
            label.setAttribute("for", `discussionResult_${index + 1}`);
            textarea.id = `discussionResult_${index + 1}`;
            textarea.name = `discussionResult_${index + 1}`;
        });
        discussionResultCount = results.length;
    }

    function updateNextStepNumbers() {
        const rows = nextStepsTable.querySelectorAll("tr");
        rows.forEach((row, index) => {
            row.cells[0].textContent = index + 1;
            // Обновляем имена полей в строке
            const goalInput = row.querySelector("input[name^='goal_']");
            const eventInput = row.querySelector("input[name^='event_']");
            const taskTextarea = row.querySelector("textarea[name^='task_']");
            const executorInput = row.querySelector("input[name^='executor_']");
            const deadlineInput = row.querySelector("input[name^='deadline_']");

            if (goalInput) goalInput.name = `goal_${index + 1}`;
            if (eventInput) eventInput.name = `event_${index + 1}`;
            if (taskTextarea) taskTextarea.name = `task_${index + 1}`;
            if (executorInput) executorInput.name = `executor_${index + 1}`;
            if (deadlineInput) deadlineInput.name = `deadline_${index + 1}`;
        });
        nextStepCount = rows.length;
    }

    // --- 12. Навешиваем автосохранение в localStorage ---
    form.addEventListener("input", saveToLocalStorage);

    // --- 13. Обработчик отправки формы ---
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            // Сохраняем протокол в БД
            await saveMeetingProtocol();
            
            // Синхронизируем задачи
            await fetch("/sync_tasks_from_sources", {
                method: "POST",
                headers: { Accept: "application/json" },
            });
            alert("Протокол сохранён и задачи синхронизированы!");
            loadProtocolsList(); // Обновляем список после сохранения
        } catch (error) {
            console.error("Ошибка сохранения или синхронизации:", error);
            alert("Ошибка сохранения протокола или синхронизации задач.");
        }
    });

    // --- 14. Экспорт .doc ---
    const downloadBtn = document.getElementById("downloadProtocol");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            const data = collectProtocolData();
            const html = buildProtocolDocHTML(data);
            const datePart = (
                data.meetingDate || new Date().toISOString().slice(0, 10)
            ).replaceAll("-", ".");
            downloadDoc(html, `Протокол_совещания_${datePart}.doc`);
        });
    }

    function buildProtocolDocHTML({
        meetingDate: date,
        participants,
        discussionResults,
        nextSteps,
    }) {
        const esc = (s) =>
            String(s)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");
        const formatDateRU = (iso) => {
            if (!iso) return "";
            const [y, m, d] = iso.split("-");
            return `${d}.${m}.${y}`;
        };

        const participantsHTML = participants.length
            ? `<ol>${participants
                  .map((p) => `<li>${esc(p)}</li>`)
                  .join("")}</ol>`
            : `<p style="color:#555;">—</p>`;

        const resultsHTML = discussionResults.length
            ? `<ol>${discussionResults
                  .map((r) => `<li>${esc(r)}</li>`)
                  .join("")}</ol>`
            : `<p style="color:#555;">—</p>`;

        const stepsRows = (
            nextSteps.length
                ? nextSteps
                : [
                      {
                          goal: "",
                          event: "",
                          work: "",
                          executor: "",
                          deadline: "",
                      },
                  ]
        )
            .map(
                (s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${esc(s.goal)}</td>
                    <td>${esc(s.event)}</td>
                    <td>${esc(s.work)}</td>
                    <td>${esc(s.executor)}</td>
                    <td>${esc(formatDateRU(s.deadline))}</td>
                </tr>`
            )
            .join("");

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
                    <th>Мероприятие</th>
                    <th>Работа/Поручение</th>
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
        const blob = new Blob([htmlString], {
            type: "application/msword;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // --- 15. Инициализация ---
    // Загружаем список протоколов при старте
    loadProtocolsList();

    // Если в URL есть параметр protocol_id, загружаем соответствующий протокол
    const urlParams = new URLSearchParams(window.location.search);
    const protocolIdFromUrl = urlParams.get("protocol_id");
    if (protocolIdFromUrl) {
        loadSelectedProtocol(protocolIdFromUrl);
    } else {
        // При загрузке страницы проверяем, есть ли черновик
        setTimeout(() => {
            restoreFromDraft();
        }, 500);
    }

    // Обработчик перед закрытием страницы - предупреждаем о несохраненных данных
    window.addEventListener('beforeunload', (event) => {
        const draft = loadFromLocalStorage();
        if (draft) {
            event.preventDefault();
            event.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
            return event.returnValue;
        }
    });
});