document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tasks-form");
    const filterInput = document.getElementById("filter-input");
    const filterColumn = document.getElementById("filter-column");
    const tableBody = document.querySelector("#tasks-table tbody");


    filterInput.addEventListener("input", () => {
        const filterValue = filterInput.value.toLowerCase();
        const selectedColumn = filterColumn.value;

        Array.from(tableBody.querySelectorAll("tr")).forEach((row) => {
            let cells;
            
            if (selectedColumn === "all") {
                cells = Array.from(row.querySelectorAll("td"));
            } else {

                const columnIndex = {
                    task: 1,
                    event: 2,
                    work: 3,
                    responsible: 4,
                    deadline: 5,
                    result: 6,
                    resources: 7,
                    coexecutors: 8,
                    comments: 9,
                }[selectedColumn];

                cells = [row.children[columnIndex]];
            }

            const match = cells.some((cell) =>
                cell.textContent.toLowerCase().includes(filterValue)
            );

            row.style.display = match ? "" : "none";
        });
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const taskData = {
            task: document.getElementById("task").value,
            event: document.getElementById("event").value,
            work: document.getElementById("work").value,
            responsible: document.getElementById("responsible").value,
            deadline: document.getElementById("deadline").value,
            result: document.getElementById("result").value,
            resources: document.getElementById("resources").value,
            coexecutors: document.getElementById("coexecutors").value,
            comments: document.getElementById("comments").value,
        };

        const response = await fetch("/add_task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskData),
        });

        if (response.ok) {
            location.reload(); 
        }
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const taskId = btn.getAttribute("data-id");
            await fetch(`/delete_task/${taskId}`, { method: "DELETE" });
            location.reload();
        });
    });
});
