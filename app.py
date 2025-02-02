from flask import Flask, render_template, request, jsonify
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
from bson.objectid import ObjectId
# Загружаем переменные из .env
load_dotenv()

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
# Проверяем, загрузилась ли переменная
if not app.config["MONGO_URI"]:
    raise ValueError("Ошибка: переменная MONGO_URI не найдена в .env!")

mongo = PyMongo(app)
tasks_collection = mongo.db.tasks
employees_collection = mongo.db.employees
business_goal_collection = mongo.db.business_goal
@app.route("/")
def index():
    """ Главная страница с таблицей задач """
    return render_template("tasks.html")

# Получение всех задач
@app.route("/get_tasks", methods=["GET"])
def get_tasks():
    """ Возвращает все задачи в формате JSON """
    tasks = list(tasks_collection.find({}, {"_id": 0}))  # Получаем все задачи без Mongo `_id`
    return jsonify(tasks)

# Добавление новой задачи
@app.route("/add_task", methods=["POST"])
def add_task():
    """ Добавляет новую задачу в базу данных """
    data = request.json
    print("Полученные данные:", data)
    if not data.get("task"):  # Проверяем, есть ли название задачи
        return jsonify({"error": "Название задачи обязательно"}), 400

    tasks_collection.insert_one(data)  # Сохраняем в MongoDB
    return jsonify({"message": "Задача успешно добавлена", "task": data})

# Обновление задачи
@app.route("/edit_task/<task_id>", methods=["PUT"])
def edit_task(task_id):
    """ Обновляет существующую задачу по task_id """
    data = request.json
    result = tasks_collection.update_one({"task": task_id}, {"$set": data})

    if result.matched_count:
        return jsonify({"message": "Задача успешно обновлена"})
    return jsonify({"error": "Задача не найдена"}), 404

# Удаление задачи
@app.route("/delete_task/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    """ Удаляет задачу из базы данных """
    result = tasks_collection.delete_one({"task": task_id})

    if result.deleted_count:
        return jsonify({"message": "Задача успешно удалена"})
    return jsonify({"error": "Задача не найдена"}), 404


# Страница "Персонал"
@app.route("/personnel")
def personnel():
    return render_template("employee_profile.html")
@app.route("/add_employee", methods=["POST"])
def add_employee():
    data = request.json
    if data:
        mongo.db.personnel.insert_one(data)
        return jsonify({"message": "Сотрудник добавлен!"}), 201
    return jsonify({"error": "Ошибка при добавлении"}), 400

@app.route("/get_employee", methods=["GET"])
def get_employee():
    name = request.args.get("name")
    employee = mongo.db.personnel.find_one({"name": name})
    if employee:
        employee["_id"] = str(employee["_id"])
        return jsonify(employee)
    return jsonify({"error": "Сотрудник не найден"}), 404

@app.route("/update_employee/<employee_id>", methods=["PUT"])
def update_employee(employee_id):
    data = request.json
    if data:
        mongo.db.personnel.update_one({"_id": employee_id}, {"$set": data})
        return jsonify({"message": "Данные обновлены!"})
    return jsonify({"error": "Ошибка при обновлении"}), 400

@app.route("/business")
def business_goals():
    """Страница бизнес-целей"""
    return render_template("business_goal_form.html")

@app.route("/add_business_goal", methods=["POST"])
def add_business_goal():
    """Добавление бизнес-цели в MongoDB"""
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных"}), 400

    mongo.db.business_goal.insert_one(data)
    return jsonify({"message": "Бизнес-цель добавлена успешно!"}), 201


if __name__ == "__main__":
    app.run(debug=True)