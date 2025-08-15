document.addEventListener('DOMContentLoaded', () => {
    // =========================
    // БЛОК: загрузка файлов
    // =========================
    const uploadForm = document.getElementById('uploadForm');
    const docFile = document.getElementById('docFile');
    const docTitle = document.getElementById('docTitle');
    const uploadMsg = document.getElementById('uploadMsg');
  
    const uploadedTbody = document.querySelector('#uploadedTable tbody');
    const previewWrap = document.getElementById('preview');
    const previewTitle = document.getElementById('previewTitle');
    const previewFrame = document.getElementById('previewFrame');
  
    function formatBytes(bytes) {
      if (!bytes && bytes !== 0) return '';
      const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
      let i = 0, v = bytes;
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
      const dec = (v >= 10 || i === 0) ? 0 : 1;
      return `${v.toFixed(dec)} ${units[i]}`;
    }
  
    function isPreviewable(ct) {
      const t = (ct || '').toLowerCase();
      return t.includes('pdf') || t.startsWith('image/');
    }
  
    function escapeHtml(s) {
      return (s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function escapeAttr(s) {
      return escapeHtml(s).replace(/"/g, '&quot;');
    }
  
    function renderUploaded(items) {
      uploadedTbody.innerHTML = '';
      items.forEach((doc, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${escapeHtml(doc.title || 'Без названия')}</td>
          <td>${escapeHtml(doc.content_type || '')}</td>
          <td>${formatBytes(doc.size)}</td>
          <td>${new Date(doc.uploaded_at).toLocaleString()}</td>
          <td class="actions">
            <a href="${doc.url}" target="_blank" rel="noopener">Открыть</a>
            ${isPreviewable(doc.content_type)
              ? `<button type="button" class="btn previewBtn" data-url="${doc.url}" data-title="${escapeAttr(doc.title)}">Предпросмотр</button>`
              : ''}
          </td>
          <td>
            <button type="button" class="btn btn-danger deleteFile" data-id="${doc._id}">Удалить</button>
          </td>
        `;
        uploadedTbody.appendChild(tr);
      });
  
      // Предпросмотр
      uploadedTbody.querySelectorAll('.previewBtn').forEach(btn => {
        btn.addEventListener('click', () => {
          previewTitle.textContent = btn.dataset.title || 'Предпросмотр';
          previewFrame.src = btn.dataset.url;
          previewWrap.style.display = 'block';
          previewFrame.focus();
        });
      });
  
      // Удаление
      uploadedTbody.querySelectorAll('.deleteFile').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Удалить документ?')) return;
          try {
            const res = await fetch(`/delete_regulation_file/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              const currentSrc = previewFrame?.src || '';
              await loadUploaded();
              // если удалили документ, который показывался в предпросмотре — спрячем
              if (currentSrc && !uploadedTbody.querySelector(`.previewBtn[data-url="${currentSrc}"]`)) {
                previewWrap.style.display = 'none';
                previewFrame.src = '';
              }
            } else {
              alert(data.error || 'Ошибка удаления');
            }
          } catch (e) {
            console.error(e);
            alert('Сетевая ошибка при удалении');
          }
        });
      });
    }
  
    async function loadUploaded() {
      try {
        const res = await fetch('/get_regulation_files');
        const data = await res.json();
        if (data.success) {
          renderUploaded(data.items || []);
        } else {
          uploadedTbody.innerHTML = '<tr><td colspan="7">Ошибка загрузки списка</td></tr>';
        }
      } catch (e) {
        console.error(e);
        uploadedTbody.innerHTML = '<tr><td colspan="7">Сетевая ошибка</td></tr>';
      }
    }
  
    if (uploadForm) {
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        uploadMsg.textContent = '';
  
        if (!docFile.files.length) {
          uploadMsg.textContent = 'Выберите файл';
          return;
        }
  
        const fd = new FormData();
        const t = docTitle.value.trim();
        if (t) fd.append('title', t);
        fd.append('file', docFile.files[0]);
  
        try {
          const res = await fetch('/upload_regulation', { method: 'POST', body: fd });
          const data = await res.json();
          if (data.success) {
            uploadMsg.textContent = 'Файл загружен';
            uploadForm.reset();
            await loadUploaded();
          } else {
            uploadMsg.textContent = data.error || 'Ошибка загрузки';
          }
        } catch (e) {
          console.error(e);
          uploadMsg.textContent = 'Сетевая ошибка';
        }
      });
    }
  
    // =========================
    // БЛОК: Реестр регламентов
    // =========================
    const regsTbody = document.querySelector('#regsTable tbody');
    const addRowBtn = document.getElementById('addRow');
    const saveRegsBtn = document.getElementById('saveRegs');
  
    // Только верхние строки реестра (игнорируем вложенные таблицы)
    function topRows() {
      return Array.from(regsTbody?.children || []).filter(el => el.tagName === 'TR');
    }
  
    function syncRowNumbers() {
      topRows().forEach((tr, i) => {
        const cell = tr.querySelector('.row-number');
        if (cell) cell.textContent = i + 1;
      });
    }
  
    function bindDeleteBtn(btn) {
      if (!btn) return;
      // привести стили к общим
      btn.classList.add('btn', 'btn-danger');
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        if (tr && tr.parentElement) tr.parentElement.removeChild(tr);
      });
    }
  
    function bindInnerDocs(row) {
      const addBtn = row.querySelector('.addDocRow');
      if (addBtn) addBtn.classList.add('btn');
      addBtn?.addEventListener('click', () => {
        const tbody = row.querySelector('.docs-rows');
        const r = document.createElement('tr');
        r.innerHTML = `
          <td><input type="text" class="doc-name" placeholder="Название"></td>
          <td><input type="text" class="doc-id" placeholder="ID или URL"></td>
          <td><button class="btn btn-danger deleteRow" type="button">Удалить</button></td>
        `;
        tbody.appendChild(r);
        bindDeleteBtn(r.querySelector('.deleteRow'));
      });
  
      row.querySelectorAll('.deleteRow').forEach(bindDeleteBtn);
    }
  
    function createRegRow() {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-number"></td>
        <td><input type="text" class="reg-name" placeholder="Наименование регламента"></td>
        <td>
          <table class="table inner-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>ID/внешняя ссылка</th>
                <th style="width:110px;">Действия</th>
              </tr>
            </thead>
            <tbody class="docs-rows">
              <tr>
                <td><input type="text" class="doc-name" placeholder="Название"></td>
                <td><input type="text" class="doc-id" placeholder="ID или URL"></td>
                <td><button class="btn btn-danger deleteRow" type="button">Удалить</button></td>
              </tr>
            </tbody>
          </table>
          <button class="btn addDocRow" type="button">Добавить документ</button>
        </td>
      `;
      bindInnerDocs(tr);
      return tr;
    }
  
    addRowBtn?.addEventListener('click', () => {
      regsTbody.appendChild(createRegRow());
      syncRowNumbers();
    });
  
    saveRegsBtn?.addEventListener('click', async () => {
      const regs = [];
      topRows().forEach((tr) => {
        const name = tr.querySelector('.reg-name')?.value.trim();
        if (!name) return;
  
        const docs = [];
        tr.querySelectorAll('.docs-rows tr').forEach(dr => {
          const dname = dr.querySelector('.doc-name')?.value.trim();
          const did = dr.querySelector('.doc-id')?.value.trim();
          if (dname || did) docs.push({ title: dname || '', external_id: did || '' });
        });
  
        regs.push({ name, documents: docs });
      });
  
      try {
        const res = await fetch('/save_regulations_list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regulations: regs })
        });
        const data = await res.json();
        if (data.success) {
          alert('Перечень сохранён');
        } else {
          alert(data.error || 'Ошибка при сохранении');
        }
      } catch (e) {
        console.error(e);
        alert('Сетевая ошибка');
      }
    });
  
    // Инициализация: существующие (статические) строки реестра
    if (regsTbody) {
      topRows().forEach(tr => bindInnerDocs(tr));
      syncRowNumbers();
    }
  
    // Загрузка списка файлов
    loadUploaded();
  });
  