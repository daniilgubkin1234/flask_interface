document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("stimulation-form").addEventListener("submit", function (event) {
        event.preventDefault();

        let formData = new FormData(event.target);
        let stimulationData = {};

        formData.forEach((value, key) => {
            stimulationData[key] = value.trim();
        });

        fetch("/save_stimulation_system", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stimulationData)
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            event.target.reset();
        })
        .catch(error => console.error("Ошибка при отправке данных:", error));
    });
});
