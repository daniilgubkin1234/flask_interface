document.addEventListener('DOMContentLoaded', function () {
    const recommendations = document.getElementById('recommendations');
    const recommendationsList = document.getElementById('recommendation-list');
    const block1Result = document.getElementById('block1-result');
    const block2Result = document.getElementById('block2-result');
    const block3Result = document.getElementById('block3-result');
    const block4Result = document.getElementById('block4-result');
    const block5Result = document.getElementById('block5-result');
    const form = document.getElementById('survey-form');

    // --- 1. АВТОЗАГРУЗКА ОТВЕТОВ ---
    fetch('/get_user_survey')
        .then(res => res.json())
        .then(surveyData => {
            if (!surveyData || Object.keys(surveyData).length === 0) return;
            // Восстанавливаем все поля
            document.querySelectorAll("textarea, input[type='text'], input[type='date'], input[type='number']").forEach(el => {
                if (surveyData[el.name] !== undefined) el.value = surveyData[el.name];
            });
            document.querySelectorAll("input[type='radio']").forEach(el => {
                if (surveyData[el.name] === el.value) el.checked = true;
            });
            document.querySelectorAll('.custom-select').forEach(sel => {
                const id = sel.dataset.id;
                if (surveyData[id]) {
                    const trigger = sel.querySelector('.custom-select-trigger');
                    const option = [...sel.querySelectorAll('.custom-option')].find(opt => opt.dataset.value === surveyData[id]);
                    if (option) {
                        trigger.textContent = option.textContent;
                        trigger.dataset.value = surveyData[id];
                        option.classList.add('selected');
                    }
                }
            });
        });

    // --- 2. АВТОСОХРАНЕНИЕ ---
    function autoSaveSurvey() {
        let surveyData = {};
        document.querySelectorAll("textarea, input, .custom-select-trigger").forEach(element => {
            if (element.tagName === "TEXTAREA" || element.type === "text" || element.type === "date" || element.type === "number") {
                surveyData[element.name] = element.value.trim();
            } else if (element.type === "radio" && element.checked) {
                surveyData[element.name] = element.value;
            } else if (element.classList.contains("custom-select-trigger")) {
                surveyData[element.parentElement.dataset.id] = element.dataset.value;
            }
        });
        fetch("/submit_survey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(surveyData)
        });
    }

    // --- ВЕШАЕМ автосохранение на всё ---
    form.addEventListener("input", autoSaveSurvey);
    form.addEventListener("change", autoSaveSurvey);

    // --- 3. Вся твоя логика для рекомендаций, графиков и submit ---
    function closeAllSelects() {
        document.querySelectorAll('.custom-select.open').forEach(select => select.classList.remove('open'));
    }

    document.querySelectorAll('.custom-select').forEach(select => {
        const trigger = select.querySelector('.custom-select-trigger');
        const options = select.querySelectorAll('.custom-option');
        trigger.addEventListener('click', function () {
            closeAllSelects();
            select.classList.toggle('open');
        });
        options.forEach(option => {
            option.addEventListener('click', function () {
                trigger.textContent = this.textContent;
                trigger.dataset.value = this.dataset.value;
                options.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                select.classList.remove('open');
                autoSaveSurvey(); // автосохраняем на кастомных селектах тоже!
            });
        });
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.custom-select')) closeAllSelects();
    });

    // Описание вопросов для блоков
    const block1Questions = [
        {
            id: 'strategy',
            validAnswers: ['да', 'нет'],
            recommendation: `Сразу же сформировать стратегию компании бывает непросто. Рекомендуем начать с формирования бизнес-цели на ближайший финансовый год. Шаблон доступен по <a href="/business" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'task_setting',
            validAnswers: ['звоню', 'ставлю на совещании/личной встрече', 'пишу в мессенджере', 'есть специальное ПО', 'никак'],
            recommendation: `Уверены, что вы формируете для ваших сотрудников задания и поручения, но, возможно, делаете это не системно и с использованием нескольких информационных каналов. Необходимо определиться с каналом информирования сотрудников и помимо формулировки самого задания, использовать еще несколько критериев, в т.ч. сроки, ответственного, результат. Подробнее см. по <a href="/tasks" target="_blank">ссылке</a>. Использование специальных информационных продуктов позволяет не только быстро доносить новую задачу до подчиненных, но и контролировать ее исполнение.`,
            scoreMap: { 'звоню': 0, 'ставлю на совещании/личной встрече': 0, 'пишу в мессенджере': 0, 'есть специальное ПО': 0, 'никак': 0 }
        },
        {
            id: 'overdue',
            validAnswers: ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
            recommendation: `Работа с просроченными заданиями и поручениями занимает очень значительную часть операционной деятельности любого руководителя. Чтобы снизить это время необходимо не только четко сформулировать задание, но и указывать его сроки и результат, который вы хотите достичь, а также регулярно проводить контрольные мероприятия. Легче всего это осуществлять в программном продукте. Инструмент доступен по <a href="/tasks" target="_blank">ссылке</a>.`,

            scoreMap: { '10': 1, '20': 1, '30': 1, '40': 1, '50': 0, '60': 0, '70': 0, '80': 0, '90': 0, '100': 0 }
        },
        {
            id: 'meeting_protocol',
            validAnswers: ['да', 'нет'],
            recommendation: `Проведение совещания без протокола снижает эффективность данного мероприятия в несколько раз. Вести протокол совсем несложно. Для этого есть специальные шаблоны и несколько простых правил. Попробуйте заполнить протокол по <a href="/meeting_protocol" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'protocol_to_task',
            validAnswers: ['секретарь рассылает в протокол', 'сразу на совещании заносим в автоматизированный задачник', 'рассылаем по электронной почте', 'сотрудники сами записывают на совещании', 'никак'],
            recommendation: `Пункты протокола совещания должны превращаться в задания и поручения для ваших подчиненных оперативно и по возможности без вашего активного участия. Сделать это можно несколькими путями: 1) назначьте секретаря совещания, и он (а) распределит работы после совещания в ручном режиме; 2) работайте в информационном продукте и сразу же на совещании фиксируйте задания и поручения. Начать вести протоколы совещаний с одновременной постановкой заданий и поручений можно, перейдя по <a href="/meeting_protocol" target="_blank">ссылке</a>.`,
            scoreMap: { 'секретарь рассылает в протокол': 1, 'сразу на совещании заносим в автоматизированный задачник': 1, 'рассылаем по электронной почте': 1, 'сотрудники сами записывают на совещании': 1, 'никак': 0 }
        }
    ];

    const block2Questions = [
        {
            id: 'job_portrait',
            validAnswers: ['да', 'нет'],
            recommendation: `Портрет должности помогает более эффективно и оперативно осуществлять поиск сотрудников в случае открытия новых вакансий или их увольнения. Рекомендуем составить портреты ключевых должностей с использованием шаблона по <a href="/employee_profile" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'instructions',
            validAnswers: ['да', 'нет'],
            recommendation: `"Лучший" способ составить должностную инструкцию - это скачать ее из Сети. Настоятельно не рекомендуем так поступать. Должностная инструкция должна быть подготовлена под конкретную должность на конкретном предприятии на конкретном этапе. Рекомендуем применять принцип "3+20" и использовать предлагаемый шаблон доступный по <a href="/three_plus_twenty" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'full_efficiency',
            validAnswers: ['менее 1 месяца', 'через месяц', 'через 2 месяца', 'более трех месяцев'],
            recommendation: `Очень часто вновь нанятый сотрудник не сразу начинает приносить прибыль компании, т.е. выполнять свои должностные обязанности на 100%. Рекомендуем сократить период адаптации сотрудника до 1 месяца. Один из лучших способов сокращения периода адаптации - это система наставничества, которая подразумевает составление адаптационного плана для каждого вновь принятого сотрудника и его сопровождение наставником. Заполните, пожалуйста, шаблон адаптационного плана, перейдя по <a href="/adaptation_plan" target="_blank">ссылке.</a>`,
            scoreMap: { 'менее 1 месяца': 1, 'через месяц': 1, 'через 2 месяца': 1, 'более трех месяцев': 0 }
        },
        {
            id: 'mentorship',
            validAnswers: ['да', 'нет'],
            recommendation: `Система наставничества - важнейший элемент адаптации нового сотрудника. Помимо адаптационного плана (см. <a href="/adaptation_plan" target="_blank">шаблоны</a>) она подразумевает наставника из числа опытных сотрудников. Наставник, используя адаптационный план, сопровождает новичка в течение 1-2 месяцев. Как и всякая работа, труд наставника должен быть оплачен. Рекомендуем учесть данный факт в вашей <a href="/stimulation_system" target="_blank">системе стимулирования</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'training',
            validAnswers: ['да', 'нет'],
            recommendation: `Система обучения сотрудников - важнейший элемент не только адаптации нового сотрудника, но и стимулирования действующих работников предприятия, а также важный инструмент повышения производительности труда. Рекомендуем составить концепцию и план обучения сотрудников и учесть ее в вашей <a href="/stimulation_system" target="_blank">системе стимулирования</a>. Пример вы можете изучить в нашей информационной базе <a href="/regulations_list" target="_blank">корпоративных стандартов</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        }
    ];

    const block3Questions = [
        {
            id: 'payment',
            validAnswers: ['да', 'нет'],
            recommendation: `Рекомендуем составить положение об оплате труда. Данный документ не только основа системы стимулирования вашего сотрудника, но и требование трудового законодательства многих стран мира, в т.ч. Российской Федерации. Пример вы можете изучить в нашей информационной базе <a href="/regulations_list" target="_blank">корпоративных стандартов</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'stimulation_methods',
            validAnswers: ['да', 'нет'],
            recommendation: `Оплата труда - это далеко не единственный способ стимулирования ваших сотрудников. Помимо материальных стимулов существует множество нематериальных. Сочетание материальных и нематериальных стимулов зависит от конкретного этапа развития определенной компании, а также от той или иной должности. Основа составления любой системы стимулирования - это поиск соответствия внутренних мотивов сотрудника и внешних стимулов, формируемых компанией. Рекомендуем составить проект системы стимулирования вашей компании, используя инструмент по <a href="/stimulation_system" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'visual_stimulation',
            validAnswers: ['да', 'нет'],
            recommendation: `<a href="/stimulation_system" target="_blank">Система стимулирования</a>, в т.ч. Положение об оплате труда, действующие на предприятии, должны быть доступны каждому сотруднику компании. Это также является важным элементом стимулирования. Рекомендуем визуализировать их в виде конкретных документов, обсудить проекты данных документов с коллективом, собрать обратную связь, при необходимости внести корректировки. Также рекомендуем разместить данные документы на корпоративном портале и проинформировать сотрудников об этом.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'corporate_culture',
            validAnswers: ['да', 'нет'],
            recommendation: `Корпоративная культура компании может стать полноценным активом любого предприятия, наряду с оборудованием и даже финансовыми активами. Именно она поможет предотвратить конфликтные ситуации, сплотить и удержать коллектив в сложной ситуации, повысить мотивированность и даже производительность труда сотрудника. Рекомендуем визуализировать основные элементы вашей корпоративной культуры. Пример вы можете изучить в нашей информационной базе <a href="/regulations_list" target="_blank">корпоративных стандартов</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'roles',
            validAnswers: ['да', 'нет'],
            recommendation: `Четкое представление сотрудником своих <a href="/three_plus_twenty" target="_blank">должностных обязанностей</a> - это важнейшая часть системы стимулирования, действующей в компании. Также эффективными элементами любой системы стимулирования могут стать понимание сотрудником <a href="/business" target="_blank">бизнес-цели</a> и <a href="/tasks" target="_blank">задач</a>, стоящих перед компанией в определенной временной перспективе. Четко обрисованные и достижимые ступени карьерного роста - еще один элемент повышения мотивированности сотрудника. Рекомендуем визуализировать данные элементы по <a href="/stimulation_system" target="_blank">ссылке</a> и ознакомить с ними ваших сотрудников.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        }
    ];

    const block4Questions = [
        {
            id: 'business_processes',
            validAnswers: ['да', 'нет'],
            recommendation: `Описание бизнес-процессов необходимо, особенно если над одним заданием трудятся несколько человек. Также бизнес-процессы являются основой для формирования стандартов, действующих на предприятии и очень помогают при обучении новых сотрудников. Рекомендуем начать работать с этим блоком. Для того, чтобы описывать бизнес-процессы необязательно применять сложные программы и механизмы. Можно начать с простых текстов, описывающих деятельность ваших сотрудников. Хорошим подспорьем будет сформированный <a href="/tasks" target="_blank">план работ</a> и раздел <a href="/three_plus_twenty" target="_blank">"Должностные обязанности"</a>. Также вы можете воспользоваться нашим шаблоном по <a href="/business_processes" target="_blank">ссылке</a> как для описания, так и изменения (реорганизации) ваших бизнес-процессов.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'responsible_employee',
            validAnswers: ['да', 'нет'],
            recommendation: `Если вы не можете позволить себе содержать отдельного сотрудника, отвечающего за описание и реорганизацию бизнес-процессов, рекомендуем распределить функционал среди руководителей и ключевых сотрудников компании и начать реализовывать эту работу.  Также вы можете воспользоваться инструментом по описанию и реорганизации бизнес-процессов, перейдя по <a href="/business_processes" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'software_use',
            validAnswers: ['да', 'нет'],
            recommendation: `Описать бизнес-процессы можно текстом, таблицей, но лучше использовать схемы и  специальный язык. BPMN (Business Process Model and Notation) — это графический язык, в котором каждой фигуре, символу, стрелке или их сочетаниям присвоены конкретные значения. Он позволяет визуализировать явление или процесс так, чтобы схема была понятна всем, кто знаком с BPMN. Можно сказать, что BPMN — это набор правил, по которым нужно рисовать схемы. Зная его, можно быстро создавать универсальные графические представления сложных процессов и структур. Именно поэтому управленческие специалисты часто используют BPMN для проектирования бизнес-процессов. Рекомендуем начать описывать бизнес-процессы вашей компании с применением данной технологии. Начать можно, перейдя по <a href="/business_processes" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'regulations',
            validAnswers: ['да', 'нет'],
            recommendation: `Описанные бизнес-процессы формируют систему стандартов, действующую в вашей организации. Система стандартов описывает всю вашу деятельность целиком и способна повышать эффективность работы как начинающих, так и уже опытных сотрудников. Рекомендуем начать с составления перечня стандартов, необходимых вашей организации, перейдя по <a href="/regulations_list" target="_blank">ссылке</a>. Также рекомендуем начать работу по описанию основных бизнес-процессов, действующих в компании, перейдя по <a href="/business_processes" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'quality_control',
            validAnswers: ['да', 'нет'],
            recommendation: `На основе сформированных стандартов и содержащихся в них бизнес-процессов возможно формирование системы контроля качества работы вашего предприятия. Данная процедура способна оказывать положительное влияние на такие аспекты вашей деятельности как взаимоотношения с клиентами, производственные процессы, процессы найма и адаптации персонала и многие другие. Рекомендуем начать процедуру контроля качества исполнения бизнес-процессов с контроля точек перехода бизнес-процесса от одного сотрудника к другому. Инструмент доступен по <a href="/business_processes" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        }
    ];

    const block5Questions = [
        {
            id: 'org_structure',
            validAnswers: ['линейно-функциональная', 'дивизиональная', 'матричная', 'проектная', 'другая', 'затрудняюсь ответить'],
            recommendation: `Применение того или иного типа организационной структуры подразумевает определенные особенности в системе управления.  Главное, что должно присутствовать в каждой организационной структуре, это вертикальные связи между сотрудниками и подразделениями. Рекомендуем определится с типом организационной структуры, которая вам наиболее подходит и визуализировать ее. Визуализировать или составить заново организационную структуру вашей компании вы можете, перейдя по <a href="/organizational_structure" target="_blank">ссылке</a>. `,
            scoreMap: { 'линейно-функциональная': 1, 'дивизиональная': 1, 'матричная': 1, 'проектная': 1, 'другая': 1, 'затрудняюсь ответить': 0 }
        },
        {
            id: 'structure_visual',
            validAnswers: ['да', 'нет'],
            recommendation: `Организационная структура необходима не только для понимания вертикальных и горизонтальных связей между сотрудниками и руководителями, но и является одним из стимулов для рядового сотрудника: человеку важно осознавать свое место в организации, важно понимать, кто имеет право давать ему поручения, а кто нет. Рекомендуем визуализировать вашу организационную структуру и проинформировать сотрудников о том, где с ней можно ознакомиться. Шаблон доступен по <a href="/organizational_structure" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'hierarchy',
            validAnswers: ['да', 'нет'],
            recommendation: `Важно не только визуализировать организационную структуру, но и проинформировать ваших сотрудников о том, где с ней можно ознакомиться. Понимание своего места в компании, системы подчиненности является важной составляющей системы стимулирования вашей компании. Рекомендуем организовать не только информирование, но и ответить на возникающие вопросы ваших сотрудников. Шаблон доступен по <a href="/organizational_structure" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'roles_knowledge',
            validAnswers: ['да', 'нет'],
            recommendation: `Организационная структура, а именно понимание сотрудником своего места в ней является частью системы стимулирования в любой организации. Также сотруднику чрезвычайно важно понимать систему подчиненности, действующей в вашей компании: кто имеет право ставить задачи ему и кому он имеет право давать указания. Рекомендуем отразить данные взаимодействия в вашей схеме и ознакомить коллектив с данной информацией. Шаблон доступен по <a href="/organizational_structure" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        },
        {
            id: 'cross_tasks',
            validAnswers: ['да', 'нет'],
            recommendation: `Иногда для координации деятельности коллектива необходимо информировать сотрудника о том, какой функционал исполняется его коллегами. Рекомендуем перенести информацию из раздела "Должностные обязанности" должностных инструкций ваших сотрудников в организационную структуру компании и проинформировать ваших сотрудников о существовании такой опции. Шаблон доступен по <a href="/organizational_structure" target="_blank">ссылке</a>.`,
            scoreMap: { 'да': 1, 'нет': 0 }
        }
    ];

    // Обработка отправки формы
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        recommendationsList.innerHTML = '';
        block1Result.textContent = '';
        block2Result.textContent = '';
        block3Result.textContent = '';
        block4Result.textContent = '';
        block5Result.textContent = '';
        const chartContainer = document.getElementById('chart-container');
        chartContainer.innerHTML = '<canvas id="radarChart"></canvas>';
        try {
            const allRecommendations = [];
            const block1Sum = calculateBlockScore(block1Questions, allRecommendations);
            const block2Sum = calculateBlockScore(block2Questions, allRecommendations);
            const block3Sum = calculateBlockScore(block3Questions, allRecommendations);
            const block4Sum = calculateBlockScore(block4Questions, allRecommendations);
            const block5Sum = calculateBlockScore(block5Questions, allRecommendations);
            const generalRecommendation = `После того, как вы спланировали какие-либо изменения в вашей системе управления компанией, необходимо подумать о том, как вы будете реализовывать эти изменения на практике. Это не всегда простая задача, и вы можете столкнуться с сопротивлением коллектива и даже с саботажем. Рекомендуем подготовить план действий, чтобы минимизировать этот риск.`;
            allRecommendations.push(generalRecommendation);
            block1Result.textContent = `Задачи: ${block1Sum}`;
            block2Result.textContent = `Люди: ${block2Sum}`;
            block3Result.textContent = `Система стимулирования: ${block3Sum}`;
            block4Result.textContent = `Бизнес-процессы: ${block4Sum}`;
            block5Result.textContent = `Организационная структура: ${block5Sum}`;
            const results = document.getElementById('results');
            results.style.display = 'block';
            recommendations.style.display = 'block';
            chartContainer.style.display = 'block';
            allRecommendations.forEach(rec => {
                const li = document.createElement('li');
                li.innerHTML = rec;
                recommendationsList.appendChild(li);
            });
            drawRadarChart([block1Sum, block2Sum, block3Sum, block4Sum, block5Sum]);
            // плавная прокрутка к результатам
            function smoothScrollTo(targetY, duration) {
                const startY = window.scrollY;
                const distance = targetY - startY;
                let startTime = null;
                function animationStep(timestamp) {
                    if (!startTime) startTime = timestamp;
                    const elapsedTime = timestamp - startTime;
                    const progress = Math.min(elapsedTime / duration, 1);
                    const ease = easeInOutQuad(progress);
                    window.scrollTo(0, startY + distance * ease);
                    if (progress < 1) requestAnimationFrame(animationStep);
                }
                requestAnimationFrame(animationStep);
            }
            function easeInOutQuad(t) {
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            }
            const resultsPosition = results.getBoundingClientRect().top + window.scrollY;
            smoothScrollTo(resultsPosition, 1500);
        } catch (error) {
            console.error('Ошибка обработки формы:', error.message);
            alert(error.message);
        }
    });

    // === Функции для диаграммы и подсчёта ===
    function drawRadarChart(data) {
        const ctx = document.getElementById('radarChart').getContext('2d');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Задачи', 'Персонал', 'Система стимулирования', 'Бизнес-процессы', 'Организационная структура'],
                datasets: [{
                    label: 'Оценка',
                    data,
                    backgroundColor: 'rgba(136, 190, 255, 0.2)',
                    borderColor: 'rgb(0, 115, 255)'
                }]
            },
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    function calculateBlockScore(questions, recommendations) {
        return questions.reduce((sum, { id, validAnswers, scoreMap, recommendation }) => {
            const trigger = document.querySelector(`.custom-select[data-id="${id}"] .custom-select-trigger`);
            const value = trigger.dataset.value || '';
            if (!validAnswers.includes(value)) {
                throw new Error(`Некорректный ответ для вопроса с ID: ${id}`);
            }
            if (scoreMap[value] === 0 && recommendation) recommendations.push(recommendation);
            return sum + (scoreMap[value] || 0);
        }, 0);
    }
});
