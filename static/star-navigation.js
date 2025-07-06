// static/star-navigation.js

document.addEventListener('DOMContentLoaded', function () {
    fetch('/static/star-navigation.svg')
        .then(function (res) { return res.text(); })
        .then(function (svg) {
            document.getElementById('star-container').innerHTML = svg;
            const svgElem = document.querySelector('#star-container svg');
            // === Добавляем неоновый linearGradient с анимацией вращения ===
            let defs = svgElem.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                svgElem.insertBefore(defs, svgElem.firstChild);
            }
            // Градиент по центру canvas
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.setAttribute('id', 'run-gradient');
            grad.setAttribute('x1', '0%');
            grad.setAttribute('y1', '0%');
            grad.setAttribute('x2', '100%');
            grad.setAttribute('y2', '0%');
            grad.innerHTML = `
                <stop offset="0%" stop-color="#00f6ff"/>
                <stop offset="25%" stop-color="#008cff"/>
                <stop offset="50%" stop-color="#ffffff"/>
                <stop offset="75%" stop-color="#0050b3"/>
                <stop offset="100%" stop-color="#00f6ff"/>
            `;
            defs.appendChild(grad);

            // Анимация вращения градиента (имитирует неоновую "бегущую" волну)
            let angle = 0;
            setInterval(() => {
                angle = (angle + 2) % 360;
                // Вращаем относительно центра canvas: (0.5, 0.5) — для процентов
                grad.setAttribute('gradientTransform', `rotate(${angle} 0.5 0.5)`);
            }, 30);

            initStar();
        })
        .catch(function (err) {
            console.error('Не удалось загрузить SVG:', err);
        });
});

function initStar() {
    var wrapper = document.querySelector('.star-nav-wrapper');
    var groups = wrapper.querySelectorAll('.star-ray-group, .star-center-group');

    groups.forEach(function (group) {
        var section = group.dataset.section;
        var menu = document.getElementById('menu-' + section);

        group.addEventListener('click', function () {
            group.classList.toggle('active');
            if (menu) {
                menu.classList.toggle('open');
                positionMenu(group, menu);
            }
        });

        group.addEventListener('mousedown', function () {
            group.classList.add('pressed');
        });
        ['mouseup', 'mouseleave'].forEach(function (evt) {
            group.addEventListener(evt, function () {
                group.classList.remove('pressed');
            });
        });
    });
}

function positionMenu(group, menu) {
    var wrapperRect = document.querySelector('.star-nav-wrapper').getBoundingClientRect();
    var gw = group.getBoundingClientRect();

    var top, left;
    switch (group.dataset.section) {
        case 'structure':
            top = gw.top - wrapperRect.top + 4;
            left = gw.right - wrapperRect.left + 30;
            break;
        case 'strategy':
            top = gw.top - wrapperRect.top - menu.offsetHeight + 80;
            left = gw.left - wrapperRect.left + gw.width / 2 + 80;
            break;
        case 'people':
            top = gw.top - wrapperRect.top - 4;
            left = gw.left - wrapperRect.left - menu.offsetWidth - 30;
            break;
        case 'processes':
            top = gw.bottom - wrapperRect.top - menu.offsetHeight;
            left = gw.right - wrapperRect.left + gw.width - menu.offsetWidth;
            break;
        case 'incentive-system':
            top = gw.bottom - wrapperRect.top - menu.offsetHeight;
            left = gw.left - wrapperRect.left - gw.width - 20;
            break;
        case 'diagnostics':
            top = gw.bottom - wrapperRect.top + 175;
            left = gw.left - wrapperRect.left + gw.width / 2 - menu.offsetWidth / 2;
            break;
        default:
            top = gw.top - wrapperRect.top;
            left = gw.left - wrapperRect.left;
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
}
