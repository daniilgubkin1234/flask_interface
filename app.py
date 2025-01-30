from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
tasks_data = []

@app.route("/")
def index():
    return render_template("tasks.html", tasks=tasks_data)

@app.route("/add_task", methods=["POST"])
def add_task():
    data = request.json
    task = {
        "id": len(tasks_data) + 1,
        "task": data["task"],
        "event": data["event"],
        "work": data["work"],
        "responsible": data["responsible"],
        "deadline": data["deadline"],
        "result": data["result"],
        "resources": data["resources"],
        "coexecutors": data["coexecutors"],
        "comments": data["comments"],
    }
    tasks_data.append(task)
    return jsonify({"message": "Задача добавлена", "task": task})

@app.route("/delete_task/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    global tasks_data
    tasks_data = [task for task in tasks_data if task["id"] != task_id]
    return jsonify({"message": "Задача удалена"})

@app.route("/edit_task/<int:task_id>", methods=["PUT"])
def edit_task(task_id):
    data = request.json
    for task in tasks_data:
        if task["id"] == task_id:
            task.update(data)
            return jsonify({"message": "Задача обновлена", "task": task})
    return jsonify({"error": "Задача не найдена"}), 404

if __name__ == "__main__":
    app.run(debug=True)
