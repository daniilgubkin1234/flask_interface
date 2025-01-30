from flask import Flask, render_template, request, jsonify
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os

# Загружаем переменные из .env
load_dotenv()

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
# Проверяем, загрузилась ли переменная
if not app.config["MONGO_URI"]:
    raise ValueError("Ошибка: переменная MONGO_URI не найдена в .env!")

mongo = PyMongo(app)
tasks_collection = mongo.db.tasks


@app.route("/")
def index():
    tasks = list(tasks_collection.find({}, {"_id": 0}))  # Загружаем все задачи
    return render_template("tasks.html", tasks=tasks)

@app.route("/add_task", methods=["POST"])
def add_task():
    data = request.json
    tasks_collection.insert_one(data)
    return jsonify({"message": "Задача добавлена", "task": data})

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
