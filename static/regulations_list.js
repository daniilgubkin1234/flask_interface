document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#regsTable tbody');
    const addBtn = document.getElementById('addRow');
    const saveBtn = document.getElementById('saveRegs');

    function syncNumbers() {
        [...tbody.rows].forEach((tr, i) => {
            tr.querySelector('.row-number').textContent = i + 1;
        });
    }

    addBtn.addEventListener('click', () => {
        const tpl = document.createElement('tr');
        tpl.innerHTML = `
            <td class="row-number"></td>
            <td><input type="text" class="doc-name" placeholder="Название"></td>
            <td><input type="text" class="doc-id" placeholder="ИД"></td>
            <td><button class="deleteRow">Удалить</button></td>
        `;
        tbody.appendChild(tpl);
        syncNumbers();
    });

    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('deleteRow') && tbody.rows.length > 1) {
            e.target.closest('tr').remove();
            syncNumbers();
        }
    });

    saveBtn.addEventListener('click', () => {
        const regs = [...tbody.rows].map(tr => ({
            name: tr.querySelector('.doc-name').value.trim(),
            identifier: tr.querySelector('.doc-id').value.trim()
        })).filter(r => r.name || r.identifier);

        fetch('/save_regulations_list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regulations: regs })
        })

            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert('Перечень сохранён');
                } else {
                    alert('Ошибка при сохранении');
                }
            })
            .catch(err => {
                console.error(err);
                alert('Сетевая ошибка');
            });
    });

    // начальная синхронизация
    syncNumbers();
});
