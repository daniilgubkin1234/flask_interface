// static/star-navigation.js

document.addEventListener('DOMContentLoaded', function () {
    fetch('/static/star-navigation.svg')
        .then(function (res) { return res.text(); })
        .then(function (svg) {
            document.getElementById('star-container').innerHTML = svg;
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

        // при клике: только toggle активного состояния и меню
        group.addEventListener('click', function () {
            group.classList.toggle('active');
            if (menu) {
                menu.classList.toggle('open');
                positionMenu(group, menu);
            }
        });

        // при нажатии мышью — добавляем класс pressed
        group.addEventListener('mousedown', function () {
            group.classList.add('pressed');
        });

        // при отпускании и при уходе мыши — снимаем pressed
        ['mouseup', 'mouseleave'].forEach(function (evt) {
            group.addEventListener(evt, function () {
                group.classList.remove('pressed');
            });
        });
    });
}

function positionMenu(group, menu) {
    var wrapperRect = document.querySelector('.star-nav-wrapper')
        .getBoundingClientRect();
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
