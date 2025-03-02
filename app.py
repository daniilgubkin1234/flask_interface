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
survey_collection = mongo.db.surveys
adaptation_plans_collection=mongo.db.adaptation_plans
meeting_protocol_collection=mongo.db.meeting_protocols
stimulation_system_collection=mongo.db.stimulation_system
job_description_collection=mongo.db.job_descriptions
@app.route("/")
def index():
    """ Главная страница с таблицей задач """
    return render_template("survey_ai.html")

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


@app.route("/tasks")
def survey():
    """Отображение страницы с опросником"""
    return render_template("tasks.html")

@app.route("/submit_survey", methods=["POST"])
def submit_survey():
    """Обработка и сохранение результатов опроса"""
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400

    # Подготовка данных для сохранения
    survey_result = {
        "user_answers": data
    }

    # Сохранение данных в MongoDB
    result = mongo.db.surveys.insert_one(survey_result)

    return jsonify({
        "message": "Опрос успешно сохранен!",
        "survey_id": str(result.inserted_id)
    }), 201

@app.route("/get_survey_results/<survey_id>", methods=["GET"])
def get_survey_results(survey_id):
    """Получение данных опроса по ID"""
    survey = mongo.db.surveys.find_one({"_id": ObjectId(survey_id)})
    if survey:
        survey["_id"] = str(survey["_id"])
        return jsonify(survey)
    return jsonify({"error": "Опрос не найден"}), 404

@app.route("/adaptation_plan")
def adaptation_plan():
    return render_template("adaptation_plan.html")

@app.route("/submit_adaptation_plan", methods=["POST"])
def submit_adaptation_plan():
    data = request.json
    print("Полученные данные:", data)
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400

    result = mongo.db.adaptation_plans.insert_one(data)

    return jsonify({
        "message": "Адаптационный план успешно сохранен!",
        "plan_id": str(result.inserted_id)
    }), 201

@app.route("/meeting_protocol")
def meeting_protocol():
    return render_template("meeting_protocol.html")

@app.route("/save_meeting_protocol", methods=["POST"])
def save_meeting_protocol():
    data = request.json
    print("Полученные данные:", data)
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400

    result = mongo.db.meeting_protocols.insert_one(data)

    return jsonify({
        "message": "Протокол успешно сохранен!",
        "plan_id": str(result.inserted_id)
    }), 201

@app.route("/stimulation_system")
def stimulation_page():
    return render_template("stimulation_system.html")

@app.route("/save_stimulation_system", methods=["POST"])
def save_stimulation():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400

    mongo.db.stimulation_system.insert_one(data)
    return jsonify({"message": "Данные успешно сохранены!"}), 201

@app.route("/job_description")
def job_description():
    """Отображение страницы должностной инструкции"""
    return render_template("job_description.html")


@app.route("/submit_job_description", methods=["POST"])
def submit_job_description():
    """Сохранение должностной инструкции в базу данных"""
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400

    result = mongo.db.job_descriptions.insert_one(data)

    return jsonify({
        "message": "Должностная инструкция успешно сохранена!",
        "doc_id": str(result.inserted_id)
    }), 201


@app.route("/get_job_description/<doc_id>", methods=["GET"])
def get_job_description(doc_id):
    """Получение данных должностной инструкции по ID"""
    job_description = mongo.db.job_descriptions.find_one({"_id": ObjectId(doc_id)})
    if job_description:
        job_description["_id"] = str(job_description["_id"])
        return jsonify(job_description)
    return jsonify({"error": "Должностная инструкция не найдена"}), 404

@app.route("/organizational_structure")
def organizational_structure_page():
    return render_template("organizational_structure.html")

@app.route('/save_organizational_structure', methods=['POST'])
def save_organizational_structure():
    data = request.json
    mongo.db.organizational_structure.insert_one(data)
    return jsonify({"message": "Данные успешно сохранены"}), 200

if __name__ == "__main__":
    app.run(debug=True)

