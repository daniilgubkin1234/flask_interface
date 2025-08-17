# --- OAuth: добавлено redirect,url_for,abort ---
from flask import Response, Flask, render_template, request, jsonify, redirect, url_for, abort
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
from bson.objectid import ObjectId
# --- OAuth: добавлено ---
from datetime import datetime
# ---------- OAuth / Flask-Login ----------
from flask_login import LoginManager, UserMixin, login_user, \
    login_required, logout_user, current_user            # --- OAuth: добавлено ---
# --- OAuth: добавлено ---
from authlib.integrations.flask_client import OAuth
# --- OAuth: добавлено ---
from functools import wraps
import time
from werkzeug.utils import secure_filename
from flask import send_from_directory
from prometheus_flask_exporter import PrometheusMetrics
# -------------------------------------------------------------------------
# 1.  Загрузка переменных окружения
# -------------------------------------------------------------------------
load_dotenv()

app = Flask(__name__)
metrics = PrometheusMetrics(app)
app.secret_key = os.getenv("SECRET_KEY") or os.getenv(
    "FLASK_SECRET")  # --- OAuth: добавлено ---
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
if not app.config["MONGO_URI"]:
    raise ValueError("Ошибка: переменная MONGO_URI не найдена в .env!")

mongo = PyMongo(app)
# === Файлы регламентов ===
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # до 25 МБ
UPLOAD_FOLDER = os.path.join(app.root_path, 'uploads', 'regulations')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt',
    'png', 'jpg', 'jpeg', 'bpmn', 'xml', 'svg'
}
def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# -------------------------------------------------------------------------
# 2.  Flask-Login и OAuth настройка
# -------------------------------------------------------------------------
# --- OAuth: добавлено ---
login_manager = LoginManager(app)
# --- OAuth: добавлено ---
login_manager.login_view = "login"


# --- OAuth: добавлено ---
oauth = OAuth(app)
google = oauth.register(                                     # --- OAuth: добавлено ---
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    access_token_url="https://oauth2.googleapis.com/token",
    authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
    api_base_url="https://www.googleapis.com/oauth2/v3/",
    userinfo_endpoint="https://openidconnect.googleapis.com/v1/userinfo",
    client_kwargs={"scope": "openid email profile"},
    jwks_uri="https://www.googleapis.com/oauth2/v3/certs"
)

# -------------------------------------------------------------------------
# 3.  Класс пользователя и загрузка из базы
# -------------------------------------------------------------------------


class User(UserMixin):                                       # --- OAuth: добавлено ---
    def __init__(self, doc):
        self.id = str(doc["_id"])
        self.doc = doc


# --- OAuth: добавлено ---
@login_manager.user_loader
def load_user(user_id):
    doc = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    return User(doc) if doc else None

# -------------------------------------------------------------------------
# 4.  Хелпер для проверки ролей (по желанию)
# -------------------------------------------------------------------------


# --- OAuth: добавлено ---
def role_required(*roles):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            if current_user.is_authenticated and current_user.doc.get("role") in roles:
                return fn(*args, **kwargs)
            return abort(403)
        return decorated_view
    return wrapper


# -------------------------------------------------------------------------
# 5.  Коллекции Mongo
# -------------------------------------------------------------------------
tasks_collection = mongo.db.tasks
employees_collection = mongo.db.employees
business_goal_collection = mongo.db.business_goal
survey_collection = mongo.db.surveys
adaptation_plans_collection = mongo.db.adaptation_plans
meeting_protocol_collection = mongo.db.meeting_protocols
stimulation_system_collection = mongo.db.stimulation_system
job_description_collection = mongo.db.job_descriptions
business_processes_collection = mongo.db.business_processes
three_plus_twenty_collection = mongo.db.three_plus_twenty
regulations_collection = mongo.db.regulations_list
organizational_structure_coll = mongo.db.organizational_structure
users_collection = mongo.db.users                # --- OAuth: добавлено ---
regulation_files_collection = mongo.db.regulation_files

# -------------------------------------------------------------------------
# 6.  OAuth-роуты (вход / колбек / выход)
# -------------------------------------------------------------------------


@app.route("/login")
def login():
    """Стартуем OIDC flow через Google."""
    redirect_uri = url_for("auth_callback", _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route("/auth/callback")
def auth_callback():
    """Обрабатываем ответ от Google и логиним пользователя."""
    token = google.authorize_access_token()
    userinfo = google.get("userinfo").json()

    # ищем или создаём пользователя
    user_doc = users_collection.find_one({"google_id": userinfo["sub"]})
    if not user_doc:
        user_doc = {
            "google_id": userinfo["sub"],
            "email":     userinfo["email"],
            "name":      userinfo.get("name"),
            "picture":   userinfo.get("picture"),
            "role":      "user",
            "created_at": datetime.utcnow()
        }
        ins = users_collection.insert_one(user_doc)
        user_doc["_id"] = ins.inserted_id  # ВАЖНО: добавили _id для login_user
    else:
        # (необязательно) обновим базовые поля, если поменялись на стороне Google
        updates = {}
        if user_doc.get("email") != userinfo.get("email"):
            updates["email"] = userinfo.get("email")
        if user_doc.get("name") != userinfo.get("name"):
            updates["name"] = userinfo.get("name")
        if user_doc.get("picture") != userinfo.get("picture"):
            updates["picture"] = userinfo.get("picture")
        if updates:
            users_collection.update_one({"_id": user_doc["_id"]}, {"$set": updates})
            user_doc.update(updates)

    login_user(User(user_doc))
    return redirect(url_for("star_navigation"))


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("index_public"))

# -------------------------------------------------------------------------
# 7.  Публичная и защищённая главные страницы
# -------------------------------------------------------------------------


@app.route("/index_public")
def index_public():
    """Публичная страница — например, лендинг с кнопкой 'Войти'."""
    return render_template("index_public.html")


@app.route("/")
def landing():
    # вместо public.html рендерим landing.html
    # создайте при необходимости
    return render_template("landing.html")


@app.route("/star_navigation")
@login_required
def star_navigation():
    """ Главная страница — интерактивная звезда навигации """
    return render_template("star_navigation.html")


@app.route('/survey_ai')
def survey_ai():
    return render_template('survey_ai.html')
@app.route("/get_user_survey", methods=["GET"])
@login_required
def get_user_survey():
    doc = survey_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0, "user_answers": 1}
    )
    return jsonify(doc["user_answers"] if doc and "user_answers" in doc else {})

# Получение всех задач


# -------------------------------------------------------------------------
# 8.  Задачи (теперь привязаны к current_user)
# -------------------------------------------------------------------------
@app.route("/get_tasks", methods=["GET"])
@login_required
def get_tasks():
    docs = list(tasks_collection.find({"owner_id": ObjectId(current_user.id)}))
    tasks = []
    for d in docs:
        d["_id"] = str(d["_id"])
        d.pop("owner_id", None)
        tasks.append(d)
    return jsonify(tasks)


@app.route("/add_task", methods=["POST"])
@login_required
def add_task():
    data = request.json or {}
    if not data.get("task"):
        return jsonify({"error": "Название задачи обязательно"}), 400
    data["owner_id"] = ObjectId(current_user.id)
    ins = tasks_collection.insert_one(data)
    return jsonify({"message": "Задача успешно добавлена",
                    "inserted_id": str(ins.inserted_id)})


@app.route("/edit_task/<task_id>", methods=["PUT"])
@login_required
def edit_task(task_id):
    data = request.json or {}
    try:
        oid = ObjectId(task_id)
    except Exception:
        return jsonify({"error": "Некорректный ID"}), 400

    result = tasks_collection.update_one(
        {"_id": oid, "owner_id": ObjectId(current_user.id)},
        {"$set": data}
    )
    if result.matched_count:
        return jsonify({"message": "Задача успешно обновлена"})
    return jsonify({"error": "Задача не найдена"}), 404

@app.route("/sync_tasks_from_sources", methods=["POST"])
@login_required
def sync_tasks_from_sources():
    owner = ObjectId(current_user.id)

    # --- Берём последнюю бизнес-цель и протокол ---
    bg = business_goal_collection.find_one(
        {"owner_id": owner}, sort=[("_id", -1)]
    ) or {}
    mp = meeting_protocol_collection.find_one(
        {"owner_id": owner}, sort=[("_id", -1)]
    ) or {}

    upserts = 0

    # --- 1) Этапы реализации из бизнес-цели -> задачи ---
    stages = (bg or {}).get("stages") or []
    for idx, st in enumerate(stages):
        task_doc = {
            "task": (st.get("stageNumber") or "Этап").strip(),
            "event": "Бизнес-цель",
            "work": (st.get("stageDescription") or "").strip(),
            "responsible": "",
            "deadline": (st.get("stageDate") or "").strip(),
            "result": "",
            "resources": "",
            "coexecutors": "",
            "comments": "",
            "owner_id": owner,
            "origin": {"type": "business_goal_stage", "source_id": str(bg.get("_id")), "key": f"{idx}"}
        }
        tasks_collection.update_one(
            {"owner_id": owner, "origin.type": "business_goal_stage",
             "origin.source_id": str(bg.get("_id")), "origin.key": f"{idx}"},
            {"$set": task_doc},
            upsert=True
        )
        upserts += 1

    # --- 2) Следующие шаги из протокола -> задачи ---
    next_steps = (mp or {}).get("nextSteps") or []
    meeting_date = (mp or {}).get("meetingDate") or ""
    for idx, ns in enumerate(next_steps):
        task_doc = {
            "task": (ns.get("task") or "Работа/поручение").strip(),
            "event": f"Протокол совещания {meeting_date}".strip(),
            "work": (ns.get("task") or "").strip(),
            "responsible": (ns.get("executor") or "").strip(),
            "deadline": (ns.get("deadline") or "").strip(),
            "result": "",
            "resources": "",
            "coexecutors": "",
            "comments": "",
            "owner_id": owner,
            "origin": {"type": "meeting_protocol_step", "source_id": str(mp.get("_id")), "key": f"{idx}"}
        }
        tasks_collection.update_one(
            {"owner_id": owner, "origin.type": "meeting_protocol_step",
             "origin.source_id": str(mp.get("_id")), "origin.key": f"{idx}"},
            {"$set": task_doc},
            upsert=True
        )
        upserts += 1

    return jsonify({"message": f"Синхронизировано элементов: {upserts}"}), 200

@app.route("/delete_task/<task_id>", methods=["DELETE"])
@login_required
def delete_task(task_id):
    try:
        oid = ObjectId(task_id)
    except Exception:
        return jsonify({"error": "Некорректный ID"}), 400

    result = tasks_collection.delete_one(
        {"_id": oid, "owner_id": ObjectId(current_user.id)}
    )
    if result.deleted_count:
        return jsonify({"message": "Задача успешно удалена"})
    return jsonify({"error": "Задача не найдена"}), 404

# -------------------------------------------------------------------------
# 9.  Персонал
# -------------------------------------------------------------------------


@app.route("/personnel")
@login_required
def personnel():
    return render_template("employee_profile.html")


@app.route("/add_employee", methods=["POST"])
@login_required
def add_employee():
    data = request.json
    if data:
        # --- OAuth: добавлено ---
        data["owner_id"] = ObjectId(current_user.id)
        employees_collection.insert_one(data)
        return jsonify({"message": "Сотрудник добавлен!"}), 201
    return jsonify({"error": "Ошибка при добавлении"}), 400


@app.route("/get_employee", methods=["GET"])
@login_required
def get_employee():
    name = request.args.get("name")
    query = {"owner_id": ObjectId(current_user.id)}
    if name:
        query["name"] = name
    # Если имя не указано — берём последний профиль пользователя
    employee = employees_collection.find_one(
        query,
        sort=[("_id", -1)]
    )
    if employee:
        employee["_id"] = str(employee["_id"])
        return jsonify(employee)
    return jsonify({"error": "Сотрудник не найден"}), 404


@app.route("/update_employee/<employee_id>", methods=["PUT"])
@login_required
def update_employee(employee_id):
    data = request.json
    if data:
        employees_collection.update_one(
            {"_id": ObjectId(employee_id), "owner_id": ObjectId(
                current_user.id)},  # --- OAuth ---
            {"$set": data}
        )
        return jsonify({"message": "Данные обновлены!"})
    return jsonify({"error": "Ошибка при обновлении"}), 400

# -------------------------------------------------------------------------
# 10.  Бизнес-цели
# -------------------------------------------------------------------------


@app.route("/business")
@login_required
def business_goals():
    return render_template("business_goal_form.html")


@app.route("/add_business_goal", methods=["POST"])
@login_required
def add_business_goal():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных"}), 400
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    business_goal_collection.insert_one(data)
    return jsonify({"message": "Бизнес-цель добавлена успешно!"}), 201
@app.route("/get_business_goal", methods=["GET"])
@login_required
def get_business_goal():
    doc = business_goal_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0}
    )
    return jsonify(doc if doc else {})

# -------------------------------------------------------------------------
# 11.  Опросник (tasks.html)
# -------------------------------------------------------------------------


@app.route("/tasks")
@login_required
def survey():
    return render_template("tasks.html")


@app.route("/submit_survey", methods=["POST"])
@login_required
def submit_survey():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400
    survey_result = {
        # --- OAuth: добавлено ---
        "owner_id": ObjectId(current_user.id),
        "user_answers": data
    }
    result = survey_collection.insert_one(survey_result)
    return jsonify({
        "message": "Опрос успешно сохранен!",
        "survey_id": str(result.inserted_id)
    }), 201


@app.route("/get_survey_results/<survey_id>", methods=["GET"])
@login_required
def get_survey_results(survey_id):
    survey = survey_collection.find_one(
        {"_id": ObjectId(survey_id), "owner_id": ObjectId(
            current_user.id)}   # --- OAuth ---
    )
    if survey:
        survey["_id"] = str(survey["_id"])
        return jsonify(survey)
    return jsonify({"error": "Опрос не найден"}), 404

# -------------------------------------------------------------------------
# 12.  Адаптационный план
# (ниже аналогичные изменения: owner_id + @login_required)
# -------------------------------------------------------------------------


@app.route("/adaptation_plan")
@login_required
def adaptation_plan():
    return render_template("adaptation_plan.html")


@app.route("/submit_adaptation_plan", methods=["POST"])
@login_required
def submit_adaptation_plan():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    result = adaptation_plans_collection.insert_one(data)
    return jsonify({
        "message": "Адаптационный план успешно сохранен!",
        "plan_id": str(result.inserted_id)
    }), 201
@app.route("/get_adaptation_plan", methods=["GET"])
@login_required
def get_adaptation_plan():
    doc = adaptation_plans_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0, "tasks": 1}
    )
    return jsonify(doc.get("tasks", []) if doc else [])
# -------------------------------------------------------------------------
# 13.  Протокол совещания
# -------------------------------------------------------------------------


@app.route("/meeting_protocol")
@login_required
def meeting_protocol():
    return render_template("meeting_protocol.html")


@app.route("/save_meeting_protocol", methods=["POST"])
@login_required
def save_meeting_protocol():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    result = meeting_protocol_collection.insert_one(data)
    return jsonify({
        "message": "Протокол успешно сохранен!",
        "plan_id": str(result.inserted_id)
    }), 201
@app.route("/get_meeting_protocol", methods=["GET"])
@login_required
def get_meeting_protocol():
    doc = meeting_protocol_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0}
    )
    return jsonify(doc if doc else {})

# -------------------------------------------------------------------------
# 14.  Система стимулирования
# -------------------------------------------------------------------------


@app.route("/stimulation_system")
@login_required
def stimulation_page():
    return render_template("stimulation_system.html")


@app.route("/save_stimulation_system", methods=["POST"])
@login_required
def save_stimulation():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400
    owner_id = ObjectId(current_user.id)
    data["owner_id"] = owner_id
    stimulation_system_collection.update_one(
        {"owner_id": owner_id},
        {"$set": data},
        upsert=True
    )
    return jsonify({"message": "Данные успешно сохранены!"}), 200

@app.route("/get_stimulation_system", methods=["GET"])
@login_required
def get_stimulation_system():
    doc = stimulation_system_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0}
    )
    return jsonify(doc if doc else {})

# -------------------------------------------------------------------------
# 15.  Должностные инструкции
# -------------------------------------------------------------------------


@app.route("/job_description")
@login_required
def job_description():
    return render_template("job_description.html")


@app.route("/submit_job_description", methods=["POST"])
@login_required
def submit_job_description():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных для сохранения"}), 400
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    result = job_description_collection.insert_one(data)
    return jsonify({
        "message": "Должностная инструкция успешно сохранена!",
        "doc_id": str(result.inserted_id)
    }), 201

@app.route("/get_job_description", methods=["GET"])
@login_required
def get_job_description_for_user():
    doc = job_description_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0}
    )
    return jsonify(doc if doc else {})
@app.route("/get_job_description/<doc_id>", methods=["GET"])
@login_required
def get_job_description(doc_id):
    job_description = job_description_collection.find_one(
        {"_id": ObjectId(doc_id), "owner_id": ObjectId(
            current_user.id)}       # --- OAuth ---
    )
    if job_description:
        job_description["_id"] = str(job_description["_id"])
        return jsonify(job_description)
    return jsonify({"error": "Должностная инструкция не найдена"}), 404

# -------------------------------------------------------------------------
# 16.  Организационная структура
# -------------------------------------------------------------------------


@app.route("/organizational_structure")
@login_required
def organizational_structure_page():
    return render_template("organizational_structure.html")


@app.route("/save_organizational_structure", methods=["POST"])
@login_required
def save_organizational_structure():
    data = request.json
    if not data or "rows" not in data:
        return jsonify({"error": "Нет данных"}), 400
    data["createdAt"] = datetime.utcnow()
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    organizational_structure_coll.insert_one(data)
    return jsonify({"message": "Оргструктура сохранена!"}), 201


@app.route('/get_organizational_structure')
@login_required
def get_org_structure():
    doc = organizational_structure_coll.find_one(
        # --- OAuth: добавлено ---
        {"owner_id": ObjectId(current_user.id)},
        sort=[('_id', -1)],
        projection={'_id': 0, 'rows': 1}
    )
    return jsonify(doc['rows'] if doc else [])

# -------------------------------------------------------------------------
# 17.  Бизнес-процессы
# -------------------------------------------------------------------------


@app.route("/business_processes")
@login_required
def business_processes_page():
    return render_template("business_processes.html")


@app.route("/save_business_processes", methods=["POST"])
@login_required
def save_business_processes():
    try:
        data = request.get_json(force=True)
        # --- OAuth: добавлено ---
        data["owner_id"] = ObjectId(current_user.id)
        business_processes_collection.insert_one(data)
        return jsonify({"message": "Данные успешно сохранены!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/get_business_processes", methods=["GET"])
@login_required
def get_business_processes():
    # Получаем последний документ бизнес-процессов для текущего пользователя
    doc = business_processes_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],   # последний сохранённый документ
        projection={"_id": 0, "rows": 1}   # только сами данные
    )
    # Если документ найден — вернуть rows, иначе пустой массив
    return jsonify(doc.get('rows', []) if doc else [])
# -------------------------------------------------------------------------
# 18.  «3 + 20»
# -------------------------------------------------------------------------


@app.route("/three_plus_twenty")
@login_required
def three_plus_twenty_page():
    return render_template("three_plus_twenty.html")


@app.route("/save_three_plus_twenty", methods=["POST"])
@login_required
def save_three_plus_twenty():
    data = request.json
    if not data:
        return jsonify({"error": "Нет данных"}), 400
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    three_plus_twenty_collection.insert_one(data)
    return jsonify({"message": "Данные успешно сохранены!"}), 201
@app.route("/get_three_plus_twenty", methods=["GET"])
@login_required
def get_three_plus_twenty():
    doc = three_plus_twenty_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("_id", -1)],
        projection={"_id": 0}
    )
    return jsonify(doc if doc else {})
# -------------------------------------------------------------------------
# 19.  Перечень регламентов
# -------------------------------------------------------------------------


@app.route('/regulations_list')
@login_required
def regulations_list():
    return render_template('regulations_list.html')
@app.route('/upload_regulation', methods=['POST'])
@login_required
def upload_regulation():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "Файл не получен"}), 400

    file = request.files['file']
    title = (request.form.get('title') or '').strip() or file.filename

    if file.filename == '':
        return jsonify({"success": False, "error": "Имя файла пустое"}), 400
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Недопустимый формат файла"}), 400

    safe_name = secure_filename(f"{current_user.id}_{int(time.time())}_{file.filename}")
    save_path = os.path.join(UPLOAD_FOLDER, safe_name)
    file.save(save_path)

    doc = {
        "owner_id": ObjectId(current_user.id),
        "title": title,
        "filename": safe_name,
        "original_filename": file.filename,
        "content_type": file.mimetype,
        "size": os.path.getsize(save_path),
        "uploaded_at": datetime.utcnow(),
    }
    ins = regulation_files_collection.insert_one(doc)

    url = url_for('get_regulation_file', filename=safe_name)
    return jsonify({
        "success": True,
        "doc": {
            "_id": str(ins.inserted_id),
            "title": title,
            "url": url,
            "content_type": doc["content_type"],
            "size": doc["size"],
            "uploaded_at": doc["uploaded_at"].isoformat() + "Z"
        }
    }), 201

@app.route('/upload_regulation_text', methods=['POST'])
@login_required
def upload_regulation_text():
    """
    Принимает JSON: { "filename": "diagram.bpmn", "title": "Название", "content": "<xml...>", "content_type": "application/xml" }
    Создаёт файл в uploads/regulations и регистрирует его как документ регламентов.
    """
    data = request.get_json(force=True, silent=True) or {}
    filename = (data.get('filename') or '').strip()
    title = (data.get('title') or '').strip() or filename or 'Документ'
    content = data.get('content') or ''
    content_type = (data.get('content_type') or 'application/octet-stream').strip()

    if not filename or '.' not in filename:
        return jsonify({"success": False, "error": "Некорректное имя файла"}), 400
    ext = filename.rsplit('.', 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"success": False, "error": f"Запрещённое расширение: .{ext}"}), 400
    if not content:
        return jsonify({"success": False, "error": "Пустое содержимое"}), 400

    safe_name = secure_filename(f"{current_user.id}_{int(time.time())}_{filename}")
    save_path = os.path.join(UPLOAD_FOLDER, safe_name)
    try:
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка записи файла: {e}"}), 500

    doc = {
        "owner_id": ObjectId(current_user.id),
        "title": title,
        "filename": safe_name,
        "original_filename": filename,
        "content_type": content_type,
        "size": os.path.getsize(save_path),
        "uploaded_at": datetime.utcnow(),
    }
    ins = regulation_files_collection.insert_one(doc)
    url = url_for('get_regulation_file', filename=safe_name)
    return jsonify({
        "success": True,
        "doc": {
            "_id": str(ins.inserted_id),
            "title": title,
            "url": url,
            "content_type": doc["content_type"],
            "size": doc["size"],
            "uploaded_at": doc["uploaded_at"].isoformat() + "Z"
        }
    }), 201
@app.route('/get_regulation_files', methods=['GET'])
@login_required
def get_regulation_files():
    docs = list(regulation_files_collection
                .find({"owner_id": ObjectId(current_user.id)})
                .sort("uploaded_at", -1))
    result = []
    for d in docs:
        result.append({
            "_id": str(d["_id"]),
            "title": d.get("title") or d.get("original_filename"),
            "url": url_for('get_regulation_file', filename=d["filename"]),
            "content_type": d.get("content_type", ""),
            "size": d.get("size", 0),
            "uploaded_at": d.get("uploaded_at", datetime.utcnow()).isoformat() + "Z"
        })
    return jsonify({"success": True, "items": result})


@app.route('/delete_regulation_file/<doc_id>', methods=['DELETE'])
@login_required
def delete_regulation_file(doc_id):
    try:
        _id = ObjectId(doc_id)
    except:
        return jsonify({"success": False, "error": "Некорректный ID"}), 400

    doc = regulation_files_collection.find_one({"_id": _id, "owner_id": ObjectId(current_user.id)})
    if not doc:
        return jsonify({"success": False, "error": "Документ не найден"}), 404

    try:
        os.remove(os.path.join(UPLOAD_FOLDER, doc["filename"]))
    except FileNotFoundError:
        pass

    regulation_files_collection.delete_one({"_id": _id})
    return jsonify({"success": True})


@app.route('/uploads/regulations/<path:filename>')
@login_required
def get_regulation_file(filename):
    # Просмотр в браузере (без принудительного скачивания)
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)


@app.route('/save_regulations_list', methods=['POST'])
@login_required
def save_regulations_list():
    data = request.get_json()
    if not data or 'regulations' not in data:
        return jsonify({"success": False, "error": "Нет данных"}), 400
    # --- OAuth: добавлено ---
    data["owner_id"] = ObjectId(current_user.id)
    try:
        regulations_collection.insert_one(data)
        return jsonify({"success": True, "message": "Перечень регламентов сохранён!"}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------------------------------------------------
# 20.  Вопрос-ответ
# -------------------------------------------------------------------------

@app.route('/question_answer')
@login_required
def question_answer():
    return render_template('question_answer.html')

# -------------------------------------------------------------------------
# 21.  Запуск приложения
# -------------------------------------------------------------------------
if __name__ == "__main__":

    env = os.getenv("FLASK_ENV", "development")

    cert = ("certs/localhost+2.pem", "certs/localhost+2-key.pem")

    if env == "production":
        app.run(
            host="127.0.0.1",
            port=5000,
            debug=True,
            use_reloader=False,
            ssl_context=cert
        )
    else:
        app.run(
            host="0.0.0.0",
            port=443,
            debug=False,
            use_reloader=False,
            ssl_context=cert
        )
