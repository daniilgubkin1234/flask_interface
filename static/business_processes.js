document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#bpTable tbody');
  const addRowBtn = document.getElementById('addRow');
  const diagramBtn = document.getElementById('buildDiagram');
  const exportBtn = document.getElementById('exportBPMN');
  const toggleBtn = document.getElementById('toggleMode');
  let bpmnModeler = null;
  let isEditMode = true;      // true = редактирование, false = только просмотр
  let currentXML = '';        // последний построенный XML

  // Добавить строку
  const addRow = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="stepNameField"></td>
      <td>
        <select class="stepTypeField">
            <option value="start">Старт</option>
            <option value="task" selected>Задача</option>
            <option value="gateway">Развилка</option>
            <option value="end">Завершение</option>
        </select>
      </td>
      <td><input type="text" class="roleField"></td>
      <td><input type="text" class="nextField" placeholder="N2,N3..."></td>
      <td><input type="text" class="conditionField" placeholder="да:N2,нет:N3"></td>
      <td><input type="text" class="commentsField"></td>
      <td><button class="deleteRow">Удалить</button></td>
    `;
    tableBody.appendChild(tr);
  };

  addRowBtn.addEventListener('click', addRow);

  tableBody.addEventListener('click', e => {
    if (e.target.classList.contains('deleteRow')) {
      e.target.closest('tr').remove();
    }
  });

  function getTableData() {
    const rows = Array.from(document.querySelectorAll('#bpTable tbody tr'));
    return rows.map((tr, i) => {
      const tds = tr.querySelectorAll('td');
      const type = tds[1].querySelector('select').value;
      return {
        id: "N" + (i + 1),
        name: tds[0].querySelector('input').value || ("Шаг " + (i + 1)),
        type: type,
        role: tds[2].querySelector('input').value.trim() || 'Без роли',
        next: tds[3].querySelector('input').value,
        conditions: tds[4].querySelector('input').value,
        comment: tds[5].querySelector('input').value
      };
    });
  }

  function buildBPMNxml(steps) {
    const roles = Array.from(new Set(steps.map(s => s.role))).filter(Boolean);
    const stepsByRole = {};
    roles.forEach(role => stepsByRole[role] = []);
    steps.forEach(s => stepsByRole[s.role].push(s));

    let nodes = '';
    let flows = '';
    let laneSet = '<laneSet id="LaneSet_1">';
    let shapes = '';    // для BPMNShape
    let edges = '';     // для BPMNEdge

    // Координаты для авто-выравнивания
    let yStart = 80, yStep = 140, xStart = 200, laneXStep = 220;
    let nodeCoords = {}; // id -> {x, y}

    // 1. Lanes (laneSet, и собираем координаты для laneShapes)
    roles.forEach((role, roleIdx) => {
      let laneId = 'Lane_' + (roleIdx + 1);
      laneSet += `<lane id="${laneId}" name="${role}">`;
      stepsByRole[role].forEach((step, stepIdx) => {
        laneSet += `<flowNodeRef>${step.id}</flowNodeRef>`;
        // Определяем координаты
        let x = xStart + laneXStep * roleIdx;
        let y = yStart + yStep * stepIdx;
        nodeCoords[step.id] = { x, y };
        // Генерация BPMNShape (разные размеры для разных типов)
        let w = 80, h = 60;
        if (step.type === 'start' || step.type === 'end') { w = h = 36; }
        else if (step.type === 'gateway') { w = h = 50; }
        shapes += `<bpmndi:BPMNShape id="Shape_${step.id}" bpmnElement="${step.id}">
            <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}"/>
          </bpmndi:BPMNShape>`;
        // Элементы процесса
        if (step.type === 'start') nodes += `<startEvent id="${step.id}" name="${step.name}"/>`;
        else if (step.type === 'end') nodes += `<endEvent id="${step.id}" name="${step.name}"/>`;
        else if (step.type === 'gateway') nodes += `<exclusiveGateway id="${step.id}" name="${step.name}"/>`;
        else nodes += `<task id="${step.id}" name="${step.name}"/>`;
      });
      laneSet += `</lane>`;
    });
    laneSet += '</laneSet>';

    // 2. Shapes for lanes (backgrounds!)
    let laneShapes = '';
    roles.forEach((role, roleIdx) => {
      let laneId = 'Lane_' + (roleIdx + 1);
      const stepsInLane = stepsByRole[role];
      if (!stepsInLane.length) return;
      const yVals = stepsInLane.map(st => nodeCoords[st.id].y);
      const minY = Math.min(...yVals) - 40;
      const maxY = Math.max(...yVals) + 100;
      let x = xStart + laneXStep * roleIdx - 40;
      let y = minY;
      let width = 180;
      let height = maxY - minY;
      laneShapes += `<bpmndi:BPMNShape id="Shape_${laneId}" bpmnElement="${laneId}" isHorizontal="true">
        <dc:Bounds x="${x}" y="${y}" width="${width}" height="${height}"/>
      </bpmndi:BPMNShape>`;
    });

    // 3. Генерация flows и BPMNEdge
    steps.forEach(step => {
      if (step.type === 'gateway' && step.conditions && /:/.test(step.conditions)) {
        step.conditions.split(',').map(x => x.trim()).forEach(pair => {
          const [cond, target] = pair.split(':').map(z => z.trim());
          if (cond && target) {
            const flowId = `Flow_${step.id}_${target}`;
            const flow = `<sequenceFlow id="${flowId}" sourceRef="${step.id}" targetRef="${target}">
                            <conditionExpression xsi:type="tFormalExpression"><![CDATA[${cond}]]></conditionExpression>
                          </sequenceFlow>`;
            flows += flow;
            // BPMNEdge
            if (nodeCoords[step.id] && nodeCoords[target]) {
              edges += `<bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
                <di:waypoint x="${nodeCoords[step.id].x+40}" y="${nodeCoords[step.id].y+30}"/>
                <di:waypoint x="${nodeCoords[target].x+40}" y="${nodeCoords[target].y+30}"/>
              </bpmndi:BPMNEdge>`;
            }
          }
        });
      }
      else if (step.next) {
        step.next.split(',').map(x => x.trim()).filter(Boolean).forEach(nxt => {
          const flowId = `Flow_${step.id}_${nxt}`;
          const flow = `<sequenceFlow id="${flowId}" sourceRef="${step.id}" targetRef="${nxt}"/>`;
          flows += flow;
          // BPMNEdge
          if (nodeCoords[step.id] && nodeCoords[nxt]) {
            edges += `<bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
              <di:waypoint x="${nodeCoords[step.id].x+40}" y="${nodeCoords[step.id].y+30}"/>
              <di:waypoint x="${nodeCoords[nxt].x+40}" y="${nodeCoords[nxt].y+30}"/>
            </bpmndi:BPMNEdge>`;
          }
        });
      }
    });

    // collaboration и participant
    const collaboration = `<collaboration id="Collaboration_1">
      <participant id="Participant_1" processRef="Process_1"/>
    </collaboration>`;

    // Plane с lanes, shapes, edges
    let bpmnPlane = `<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      ${laneShapes}
      ${shapes}
      ${edges}
    </bpmndi:BPMNPlane>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
 xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
 xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
 id="Definitions_1"
 targetNamespace="http://bpmn.io/schema/bpmn">
 <process id="Process_1" isExecutable="false">
   ${laneSet}
   ${nodes}
   ${flows}
 </process>
 ${collaboration}
 <bpmndi:BPMNDiagram id="BPMNDiagram_1">
   ${bpmnPlane}
 </bpmndi:BPMNDiagram>
</definitions>`;

    console.log('BPMN XML:', xml);

    return xml;
  }

  function renderBPMN(xml) {
    if (bpmnModeler) bpmnModeler.destroy();
    if (isEditMode) {
      bpmnModeler = new BpmnJS({ container: '#bpmnContainer' }); // Редактируемый (с черными точками)
    } else {
      bpmnModeler = new BpmnJS.Viewer({ container: '#bpmnContainer' }); // Только просмотр (нет жирных точек)
    }
    bpmnModeler.importXML(xml);
    currentXML = xml;
  }

  // Построить BPMN-схему
  diagramBtn.onclick = async function () {
    const steps = getTableData();
    const xml = buildBPMNxml(steps);
    renderBPMN(xml);
  };

  // Кнопка-переключатель
  toggleBtn.onclick = function () {
    isEditMode = !isEditMode;
    this.innerText = isEditMode ? "Режим: Редактирование" : "Режим: Просмотр";
    renderBPMN(currentXML);
  };

  // Экспорт BPMN XML
  exportBtn.onclick = function () {
    if (bpmnModeler) {
      bpmnModeler.saveXML({ format: true }).then(({ xml }) => {
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'diagram.bpmn';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      });
    } else {
      alert("Сначала постройте BPMN схему!");
    }
  };
});
