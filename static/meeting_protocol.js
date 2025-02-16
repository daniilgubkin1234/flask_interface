document.addEventListener("DOMContentLoaded", () => {
    // Добавление участников
    const participantsSection = document.getElementById("participantsSection");
    const addParticipantButton = document.getElementById("addParticipant");
    let participantCount = 1;

    addParticipantButton.addEventListener("click", () => {
        participantCount++;
        const newParticipant = document.createElement("div");
        newParticipant.classList.add("participant");
        newParticipant.innerHTML = `
            <label for="participant_${participantCount}">Участник ${participantCount}:</label>
            <input type="text" id="participant_${participantCount}" name="participant_${participantCount}" placeholder="Введите имя участника" required>
        `;
        participantsSection.insertBefore(newParticipant, addParticipantButton);
    });

    // Добавление результатов обсуждения
    const discussionResultsSection = document.getElementById("discussionResultsSection");
    const addDiscussionResultButton = document.getElementById("addDiscussionResult");
    let discussionResultCount = 1;

    addDiscussionResultButton.addEventListener("click", () => {
        discussionResultCount++;
        const newResult = document.createElement("div");
        newResult.classList.add("discussion-result");
        newResult.innerHTML = `
            <label for="discussionResult_${discussionResultCount}">Результат ${discussionResultCount}:</label>
            <textarea id="discussionResult_${discussionResultCount}" name="discussionResult_${discussionResultCount}" rows="3" placeholder="Введите результат обсуждения" required></textarea>
        `;
        discussionResultsSection.insertBefore(newResult, addDiscussionResultButton);
    });

    // Добавление строк в таблицу "Следующие шаги"
    const nextStepsTable = document.getElementById("nextStepsTable").querySelector("tbody");
    const addNextStepButton = document.getElementById("addNextStep");
    let nextStepCount = 1;

    addNextStepButton.addEventListener("click", () => {
        nextStepCount++;
        const newRow = document.createElement("tr");
        newRow.innerHTML = `
            <td>${nextStepCount}</td>
            <td><textarea name="task_${nextStepCount}" rows="2" placeholder="Введите задачу" required></textarea></td>
            <td><input type="text" name="executor_${nextStepCount}" placeholder="Введите исполнителя" required></td>
            <td><input type="date" name="deadline_${nextStepCount}" required></td>
        `;
        nextStepsTable.appendChild(newRow);
    });
});
