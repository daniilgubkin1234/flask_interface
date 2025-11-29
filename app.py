# --- OAuth: добавлено redirect,url_for,abort ---
from flask import Response, Flask, render_template, request, jsonify, redirect, url_for, abort
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
import re
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
from pymongo import ReturnDocument
import requests
# -------------------------------------------------------------------------
# 1.  Загрузка переменных окружения
# -------------------------------------------------------------------------
load_dotenv()

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True
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
yandex = oauth.register(
    name="yandex",
    client_id=os.getenv("YANDEX_CLIENT_ID"),
    client_secret=os.getenv("YANDEX_CLIENT_SECRET"),
    access_token_url="https://oauth.yandex.ru/token",
    authorize_url="https://oauth.yandex.ru/authorize",
    api_base_url="https://login.yandex.ru/",
    userinfo_endpoint="https://login.yandex.ru/info",
    client_kwargs={"scope": "login:email login:info", "response_type": "code"},
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
bpmn_xml_collection = mongo.db.bpmn_xml_store

# -------------------------------------------------------------------------
# 6.  OAuth-роуты (вход / колбек / выход)
# -------------------------------------------------------------------------


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", (name or "").strip(), flags=re.U).strip("_")
    return s[:80] or "process"


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
            users_collection.update_one(
                {"_id": user_doc["_id"]}, {"$set": updates})
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
@app.route("/login/yandex")
def login_yandex():
    """Стартуем OAuth flow через Яндекс."""
    redirect_uri = url_for("auth_yandex_callback", _external=True)
    app.logger.info(f"Yandex OAuth redirect_uri: {redirect_uri}")
    return yandex.authorize_redirect(redirect_uri)


@app.route("/auth/yandex/callback")
def auth_yandex_callback():
    """Обрабатываем ответ от Яндекс и логиним пользователя."""
    try:
        token = yandex.authorize_access_token()
        app.logger.info(f"Yandex token received successfully")
    except Exception as e:
        app.logger.error(f"Yandex OAuth token error: {e}")
        return redirect(url_for('landing'))
    
    # Получаем информацию о пользователеe
    try:
        resp = yandex.get('info', token=token)
        app.logger.info(f"Yandex API response status: {resp.status_code}")
        
        if resp.status_code != 200:
            app.logger.error(f"Yandex API error: {resp.status_code}, {resp.text}")
            return redirect(url_for('landing'))
        
        userinfo = resp.json()
        app.logger.info(f"Yandex userinfo received: {userinfo}")
        
    except Exception as e:
        app.logger.error(f"Yandex API call error: {e}")
        return redirect(url_for('landing'))
    
    # Проверяем наличие обязательных полей
    if "id" not in userinfo:
        app.logger.error(f"Missing 'id' in userinfo: {userinfo}")
        return redirect(url_for('landing'))
    
    try:
        # Ищем или создаём пользователя
        user_doc = users_collection.find_one({"yandex_id": userinfo["id"]})
        if not user_doc:
            # Если нет по yandex_id, проверяем по email
            email = userinfo.get("default_email", "")
            if email:
                user_doc = users_collection.find_one({"email": email})
        
        if not user_doc:
            # Создаем нового пользователя
            user_doc = {
                "yandex_id": userinfo["id"],
                "email": userinfo.get("default_email", ""),
                "name": userinfo.get("real_name", "") or userinfo.get("display_name", "") or "Пользователь",
                "login": userinfo.get("login", ""),
                "picture": None,
                "role": "user",
                "created_at": datetime.utcnow()
            }
            ins = users_collection.insert_one(user_doc)
            user_doc["_id"] = ins.inserted_id
            app.logger.info(f"Created new user with id: {user_doc['_id']}")
        else:
            # Обновляем базовые поля, если нужно
            updates = {}
            email = userinfo.get("default_email", "")
            if email and user_doc.get("email") != email:
                updates["email"] = email
            
            name = userinfo.get("real_name", "") or userinfo.get("display_name", "")
            if name and user_doc.get("name") != name:
                updates["name"] = name
                
            if not user_doc.get("yandex_id"):
                updates["yandex_id"] = userinfo["id"]
                
            if updates:
                users_collection.update_one(
                    {"_id": user_doc["_id"]}, 
                    {"$set": updates}
                )
                user_doc.update(updates)
                app.logger.info(f"Updated user: {updates}")

        # Создаем объект пользователя и логиним
        user_obj = User(user_doc)
        login_user(user_obj)
        app.logger.info(f"User {user_doc['email']} logged in successfully")
        
        # Перенаправляем на star_navigation
        return redirect(url_for("star_navigation"))
        
    except Exception as e:
        app.logger.error(f"Error during user processing: {e}")
        return redirect(url_for('landing'))


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
    
    mp = meeting_protocol_collection.find_one(
        {"owner_id": owner}, sort=[("_id", -1)]
    ) or {}

    upserts = 0

    # --- 2) Следующие шаги из протокола -> задачи ---
    next_steps = (mp or {}).get("nextSteps") or []
    meeting_date = (mp or {}).get("meetingDate") or ""
    for idx, ns in enumerate(next_steps):
        task_doc = {
    "task":        (ns.get("goal")     or "").strip(),   # Задача
    "event":       (ns.get("event")    or "").strip(),   # Мероприятие
    "work":        (ns.get("work")     or "").strip(),   # Работа/Поручение
    "responsible": (ns.get("executor") or "").strip(),   # Исполнитель → Ответственный
    "deadline":    (ns.get("deadline") or "").strip(),   # Срок
    "result": "", "resources": "", "coexecutors": "", "comments": "",
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
# 9.  Портрет сотрудника (страница)
# -------------------------------------------------------------------------


@app.route("/employee_profile")
@login_required
def employee_profile_page():
    return render_template("employee_profile.html")

# -------------------------------------------------------------------------
# 9A.  API сотрудников (изолированный, без конфликтов имён)
# -------------------------------------------------------------------------


def _emp_norm(doc):
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    doc.pop("owner_id", None)
    return doc


@app.route("/api/employees", methods=["GET", "POST"])
@login_required
def api_employees():
    owner = ObjectId(current_user.id)
    if request.method == "GET":
        docs = list(employees_collection.find({"owner_id": owner}))
        docs = [_emp_norm(d) for d in docs]
        docs.sort(key=lambda d: (d.get("name") or "").lower())
        return jsonify(docs), 200

    # POST — создание ТОЛЬКО по явной команде с фронта
    data = request.get_json(force=True, silent=True) or {}

    # Требуем маркер ручного сохранения — иначе отклоняем
    if not data.pop("_manual", False):
        return jsonify({"ok": False, "error": "explicit save required"}), 400

    # Мини-валидация
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "error": "name is required"}), 400

    data["name"] = name
    data["owner_id"] = owner
    ins = employees_collection.insert_one(data)
    return jsonify({"_id": str(ins.inserted_id)}), 201


@app.route("/api/employees/<employee_id>", methods=["GET", "PUT", "DELETE"])
@login_required
def api_employee_one(employee_id):
    owner = ObjectId(current_user.id)
    try:
        _id = ObjectId(employee_id)
    except Exception:
        return jsonify({"error": "Некорректный ID"}), 400

    if request.method == "GET":
        d = employees_collection.find_one({"_id": _id, "owner_id": owner})
        if not d:
            return jsonify({"error": "Сотрудник не найден"}), 404
        return jsonify(_emp_norm(d)), 200

    if request.method == "PUT":
        payload = request.get_json(force=True, silent=True) or {}

        # Маркер ручного сохранения обязателен
        if not payload.pop("_manual", False):
            return jsonify({"ok": False, "error": "explicit save required"}), 400

        # Если меняем ФИО — подчистим
        if "name" in payload:
            payload["name"] = (payload.get("name") or "").strip()

        r = employees_collection.update_one(
            {"_id": _id, "owner_id": owner},
            {"$set": payload}
        )
        return jsonify({"ok": r.matched_count == 1}), 200

    # DELETE
    r = employees_collection.delete_one({"_id": _id, "owner_id": owner})
    return jsonify({"ok": r.deleted_count == 1}), 200


@app.route("/api/employees:submit", methods=["POST"])
@login_required
def api_employees_submit():
    """
    «Отправить все портреты» — сюда прилетает { employees: [...] }.
    Здесь можно сделать экспорт/почту и т.д.
    """
    payload = request.get_json(force=True, silent=True) or {}
    employees = payload.get("employees", [])
    return jsonify({"ok": True, "count": len(employees)}), 200

@app.get("/api/employees/positions")
@login_required
def api_employees_positions():
    """
    Список уникальных наименований должностей из портретов сотрудника.
    Возвращает массив строк, отсортированный по алфавиту (без пустых значений).
    """
    owner = ObjectId(current_user.id)
    cursor = employees_collection.find(
        {"owner_id": owner},
        projection={"_id": 0, "name": 1}
    )
    seen = set()
    names = []
    for d in cursor:
        nm = (d.get("name") or "").strip()
        key = nm.lower()
        if nm and key not in seen:
            seen.add(key)
            names.append(nm)
    names.sort(key=lambda s: s.lower())
    return jsonify(names), 200

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

@app.route("/api/adaptation_plans/positions", methods=["GET"])
@login_required
def ap_positions_list():
    """Список названий должностей, под которые есть планы у пользователя."""
    owner = ObjectId(current_user.id)
    cursor = adaptation_plans_collection.find(
        {"owner_id": owner},
        projection={"_id": 0, "position": 1}
    )
    names = []
    for d in cursor:
        pos = (d.get("position") or "").strip()
        if pos and pos not in names:
            names.append(pos)
    names.sort(key=lambda s: s.lower())
    return jsonify(names), 200

@app.route("/api/adaptation_plans/by_position", methods=["GET"])
@login_required
def ap_get_by_position():
    """Получить план по названию должности (последняя версия)."""
    position = (request.args.get("position") or "").strip()
    if not position:
        return jsonify({"error": "position required"}), 400
    owner = ObjectId(current_user.id)
    doc = adaptation_plans_collection.find_one(
        {"owner_id": owner, "position": position},
        sort=[("updated_at", -1), ("_id", -1)],
        projection={"_id": 0, "tasks": 1, "position": 1, "updated_at": 1}
    )
    if not doc:
        return jsonify({"position": position, "tasks": []}), 200
    return jsonify(doc), 200

@app.route("/api/adaptation_plans", methods=["POST"])
@login_required
def ap_upsert():
    """
    Upsert по паре (owner_id, position). Тело: { position: str, tasks: [...] }.
    Если записи нет — создаём; если есть — перезаписываем задачи и updated_at.
    """
    payload = request.get_json(force=True, silent=True) or {}
    position = (payload.get("position") or "").strip()
    tasks    = payload.get("tasks")
    if not position or not isinstance(tasks, list):
        return jsonify({"ok": False, "error": "position (str) and tasks (list) are required"}), 400

    owner = ObjectId(current_user.id)
    doc = adaptation_plans_collection.find_one_and_update(
        {"owner_id": owner, "position": position},
        {"$set": {
            "owner_id": owner,
            "position": position,
            "tasks": tasks,
            "updated_at": datetime.utcnow()
        }},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return jsonify({"ok": True, "position": position, "updated_at": doc.get("updated_at").isoformat()+"Z"}), 200
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

# Добавить в раздел протоколов совещания

@app.route("/get_meeting_protocols_list", methods=["GET"])
@login_required
def get_meeting_protocols_list():
    """Получить список всех протоколов пользователя"""
    docs = list(meeting_protocol_collection.find(
        {"owner_id": ObjectId(current_user.id)},
        projection={"_id": 1, "meetingDate": 1, "protocolName": 1}  # ДОБАВЛЯЕМ protocolName
    ).sort("_id", -1))  # Сортировка по убыванию ID (новые сначала)
    
    protocols = []
    for doc in docs:
        protocols.append({
            "_id": str(doc["_id"]),
            "date": doc.get("meetingDate", ""),
            "protocolName": doc.get("protocolName", ""),  # ДОБАВЛЯЕМ
            "title": doc.get("protocolName") or f"Протокол от {doc.get('meetingDate', '')}"
        })
    
    return jsonify({"protocols": protocols})
@app.route("/get_meeting_protocol/<protocol_id>", methods=["GET"])
@login_required
def get_meeting_protocol_by_id(protocol_id):
    """Получить конкретный протокол по ID"""
    try:
        oid = ObjectId(protocol_id)
    except:
        return jsonify({"error": "Invalid protocol ID"}), 400

    doc = meeting_protocol_collection.find_one(
        {"_id": oid, "owner_id": ObjectId(current_user.id)}
    )
    if doc:
        doc["_id"] = str(doc["_id"])
        return jsonify(doc)
    return jsonify({"error": "Protocol not found"}), 404

@app.route("/update_meeting_protocol", methods=["POST"])
@login_required
def update_meeting_protocol():
    """Обновить существующий протокол"""
    data = request.json
    if not data:
        return jsonify({"error": "No data"}), 400

    protocol_id = data.get("_id")
    if not protocol_id:
        return jsonify({"error": "Protocol ID required"}), 400

    try:
        oid = ObjectId(protocol_id)
    except:
        return jsonify({"error": "Invalid protocol ID"}), 400

    # Удаляем _id из данных для обновления
    data.pop("_id", None)
    
    result = meeting_protocol_collection.update_one(
        {"_id": oid, "owner_id": ObjectId(current_user.id)},
        {"$set": data}
    )
    
    if result.matched_count:
        return jsonify({"message": "Protocol updated successfully", "protocol_id": protocol_id})
    return jsonify({"error": "Protocol not found"}), 404

@app.route("/delete_meeting_protocol/<protocol_id>", methods=["DELETE"])
@login_required
def delete_meeting_protocol(protocol_id):
    """Удалить протокол по ID"""
    try:
        oid = ObjectId(protocol_id)
    except:
        return jsonify({"error": "Invalid protocol ID"}), 400

    result = meeting_protocol_collection.delete_one({
        "_id": oid, 
        "owner_id": ObjectId(current_user.id)
    })
    if result.deleted_count:
        return jsonify({"message": "Protocol deleted successfully"})
    return jsonify({"error": "Protocol not found"}), 404

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
        projection={"_id": 0, "owner_id": 0}  # было {"_id": 0}
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


@app.route("/tpt_positions", methods=["GET"])
@login_required
def tpt_positions():
    owner = ObjectId(current_user.id)
    # все версии 3+20, самые свежие — первыми
    docs = list(three_plus_twenty_collection.find(
        {"owner_id": owner}).sort([("_id", -1)]))

    seen = {}
    for d in docs:
        pos_arr = d.get("position") if isinstance(
            d.get("position"), list) else [d.get("position")]
        position = (pos_arr[0] or "").strip() if pos_arr else ""
        if not position or position in seen:
            continue
        main = d.get("main_functions")
        if not main:
            main = [x for x in (d.get("directions") or [])
                    if isinstance(x, str) and x.strip()]
        seen[position] = [s.strip()
                          for s in (main or []) if isinstance(s, str) and s.strip()]

    out = [{"position": p, "main_functions": mf} for p, mf in seen.items()]
    return jsonify(out)

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


@app.route("/save_bpmn_xml", methods=["POST"])
@login_required
def save_bpmn_xml():
    data = request.get_json(force=True) or {}
    name = data.get("name", "") or "Без названия"
    xml = data.get("xml", "") or ""
    if not xml:
        return jsonify({"ok": False, "error": "Пустой XML"}), 400

    slug = _slugify(name)
    bpmn_xml_collection.update_one(
        {"owner_id": ObjectId(current_user.id), "slug": slug},
        {"$set": {
            "owner_id": ObjectId(current_user.id),
            "slug": slug,
            "name": name,
            "xml": xml,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    return jsonify({"ok": True, "slug": slug})


@app.route("/get_bpmn_xml", methods=["GET"])
@login_required
def get_bpmn_xml():
    name = request.args.get("name", "") or ""
    if not name:
        return jsonify({"found": False})
    slug = _slugify(name)
    doc = bpmn_xml_collection.find_one(
        {"owner_id": ObjectId(current_user.id), "slug": slug}
    )
    if not doc:
        return jsonify({"found": False})
    return jsonify({"found": True, "xml": doc.get("xml", ""), "slug": slug})


@app.route("/delete_bpmn_xml", methods=["POST"])
@login_required
def delete_bpmn_xml():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "error": "Нет имени"}), 400

    slug = _slugify(name)
    result = bpmn_xml_collection.delete_one({
        "owner_id": ObjectId(current_user.id),
        "slug": slug
    })
    return jsonify({"ok": True, "deleted": result.deleted_count})
# -------------------------------------------------------------------------
# 18.  «3 + 20»
# -------------------------------------------------------------------------

@app.get("/api/tpt/by_position")
@login_required
def tpt_get_by_position():
    """
    Вернуть последнюю версию 3+20 по названию должности.
    Поддерживает старые документы, где position мог быть строкой или массивом.
    """
    position = (request.args.get("position") or "").strip()
    if not position:
        return jsonify({"error": "position required"}), 400

    owner = ObjectId(current_user.id)
    doc = three_plus_twenty_collection.find_one(
        {
            "owner_id": owner,
            # сработает и для строк, и для массивов
            "position": {"$in": [position]}
        },
        sort=[("updated_at", -1), ("_id", -1)]
    )
    if not doc:
        # пустой ответ — фронт просто покажет чистую форму
        return jsonify({})
    doc["_id"] = str(doc["_id"])
    doc.pop("owner_id", None)
    return jsonify(doc)


@app.delete("/api/tpt/by_position")
@login_required
def tpt_delete_by_position():
    """
    Удалить все версии 3+20 по должности (при желании можно сделать 'последнюю').
    """
    position = (request.args.get("position") or "").strip()
    if not position:
        return jsonify({"ok": False, "error": "position required"}), 400

    owner = ObjectId(current_user.id)
    res = three_plus_twenty_collection.delete_many({
        "owner_id": owner,
        "position": {"$in": [position]}
    })
    return jsonify({"ok": True, "deleted": res.deleted_count})

@app.post("/api/tpt/delete")
@login_required
def tpt_delete_post():
    """
    Альтернатива DELETE: удаляет все версии 3+20 по должности по POST JSON.
    Тело: { "position": "..." }
    Корректно работает и с документами, где position = "..." и где position = ["..."].
    """
    payload = request.get_json(force=True, silent=True) or {}
    position = (payload.get("position") or "").strip()
    if not position:
        return jsonify({"ok": False, "error": "position required"}), 400

    owner = ObjectId(current_user.id)
    res = three_plus_twenty_collection.delete_many({
        "owner_id": owner,
        "$or": [
            {"position": position},                      # строковое поле
            {"position": {"$elemMatch": {"$eq": position}}}  # массив, содержащий строку
        ]
    })
    return jsonify({"ok": True, "deleted": res.deleted_count}), 200

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
    from datetime import datetime  # наверху уже импортировано в файле
    data["updated_at"] = datetime.utcnow()
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


@app.route("/tpt_add_main_function_from_task", methods=["POST"])
@login_required
def tpt_add_main_function_from_task():
    """
    Кладёт переданное название задачи в 'Основные направления деятельности' (первые 3),
    не перезаписывая уже заполненные и не создавая дубликатов.
    Храним версионность как и раньше — вставкой нового документа.
    """
    payload = request.get_json(force=True, silent=True) or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "error": "Пустое имя задачи"}), 400

    owner = ObjectId(current_user.id)

    # Берём последнюю версию 3+20
    prev = three_plus_twenty_collection.find_one(
        {"owner_id": owner}, sort=[("_id", -1)]
    ) or {}

    # Нормализация массивов
    def _arr(x, size=None):
        arr = []
        if isinstance(x, list):
            arr = [str(v).strip() for v in x if str(v).strip()]
        elif isinstance(x, str) and x.strip():
            arr = [x.strip()]
        if size:
            arr = (arr + [""] * size)[:size]
        return arr

    position = _arr(prev.get("position"))
    # 3 основных направления
    directions = _arr(prev.get("directions"), size=3)
    responsibilities = _arr(prev.get("responsibilities"))
    main_functions = _arr(prev.get("main_functions"))
    additional_fns = _arr(prev.get("additional_functions"))

    # Если уже есть — делаем вызов идемпотентным
    if name in directions or name in main_functions:
        return jsonify({"ok": True, "updated": False})

    # Кладём в первую свободную «дырку» среди 3 направлений
    placed = False
    for i in range(3):
        if not directions[i]:
            directions[i] = name
            placed = True
            break

    if not placed:
        # Все 3 направления заняты — ничего не меняем (можно поменять логику на "сдвиг", если нужно)
        return jsonify({"ok": True, "updated": False})

    # Поддерживаем новый унифицированный формат:
    # main_functions = directions, additional_functions оставляем как было
    doc = {
        "owner_id": owner,
        "position": position,
        "directions": directions,
        "responsibilities": responsibilities,
        "main_functions": [d for d in directions if d],
        "additional_functions": additional_fns,
        "updated_at": datetime.utcnow()
    }

    three_plus_twenty_collection.insert_one(doc)
    return jsonify({"ok": True, "updated": True})
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

    safe_name = secure_filename(
        f"{current_user.id}_{int(time.time())}_{file.filename}")
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
    content_type = (data.get('content_type')
                    or 'application/octet-stream').strip()

    if not filename or '.' not in filename:
        return jsonify({"success": False, "error": "Некорректное имя файла"}), 400
    ext = filename.rsplit('.', 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"success": False, "error": f"Запрещённое расширение: .{ext}"}), 400
    if not content:
        return jsonify({"success": False, "error": "Пустое содержимое"}), 400

    safe_name = secure_filename(
        f"{current_user.id}_{int(time.time())}_{filename}")
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

@app.get('/get_regulations_list')
@login_required
def get_regulations_list():
    """
    Возвращаем сохранённый реестр для текущего пользователя.
    Берём самый свежий документ по updated_at, а не по _id.
    """
    doc = regulations_collection.find_one(
        {"owner_id": ObjectId(current_user.id)},
        sort=[("updated_at", -1), ("_id", -1)]
    ) or {}
    items = doc.get("items") or doc.get("regulations") or []
    return jsonify({"success": True, "items": items})



@app.route('/delete_regulation_file/<doc_id>', methods=['DELETE'])
@login_required
def delete_regulation_file(doc_id):
    try:
        _id = ObjectId(doc_id)
    except:
        return jsonify({"success": False, "error": "Некорректный ID"}), 400

    doc = regulation_files_collection.find_one(
        {"_id": _id, "owner_id": ObjectId(current_user.id)})
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


@app.post('/save_regulations_list')
@login_required
def save_regulations_list():
    """
    Сохраняем реестр одним документом на пользователя.
    После upsert удаляем старые дубликаты с тем же owner_id.
    """
    payload = request.get_json(force=True, silent=True) or {}
    regs = payload.get('regulations', [])
    owner = ObjectId(current_user.id)

    # upsert и получить обновлённый документ
    doc = regulations_collection.find_one_and_update(
        {"owner_id": owner},
        {"$set": {"items": regs, "updated_at": datetime.utcnow()}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )

    # подчистить дубликаты (если остались со старых версий)
    regulations_collection.delete_many({
        "owner_id": owner,
        "_id": {"$ne": doc["_id"]}
    })

    return jsonify({"success": True})

# -------------------------------------------------------------------------
# 20.  Вопрос-ответ
# -------------------------------------------------------------------------


@app.route('/question_answer')
@login_required
def question_answer():
    return render_template('question_answer.html')

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal Server Error: {error}")
    return "Internal server error", 500

@app.errorhandler(404)
def not_found(error):
    return "Page not found", 404

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f"Unhandled exception: {e}")
    return "Internal server error", 500
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
