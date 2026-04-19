let semesterCount = 8;
let gpaChartInstance = null;
let currentDrawTool = null;
let isDrawing = false;
let startDrawPoint = null;
let userAnnotations = [];
let hideYAxis = false;

// Dragging States
let hoveredEndpoint = null;
let isDraggingEndpoint = false;
let dragIndex = -1;
let dragPointType = null;

const createSemesterLabels = (count) => {
    const labels = [];
    for (let i = 0; i < count; i++) {
        const year = Math.floor(i / 2) + 1;
        const sem = (i % 2) + 1;
        labels.push(`${year}학년 ${sem}학기`);
    }
    return labels;
};

const renderInputFields = () => {
    const container = document.getElementById('semester-list');
    container.innerHTML = '';
    const labels = createSemesterLabels(semesterCount);
    
    for (let i = 0; i < semesterCount; i++) {
        const div = document.createElement('div');
        div.className = 'semester-item';
        div.innerHTML = `
            <label for="sem-${i}">${labels[i]}</label>
            <input type="number" id="sem-${i}" step="0.01" min="0" max="4.3" placeholder="--">
        `;
        container.appendChild(div);
    }
};

document.getElementById('add-semester-btn').addEventListener('click', () => {
    semesterCount++;
    const container = document.getElementById('semester-list');
    const labels = createSemesterLabels(semesterCount);
    const index = semesterCount - 1;
    
    const div = document.createElement('div');
    div.className = 'semester-item';
    div.innerHTML = `
        <label for="sem-${index}">${labels[index]}</label>
        <input type="number" id="sem-${index}" step="0.01" min="0" max="4.3" placeholder="--">
    `;
    container.appendChild(div);
});

const calculatePrediction = (anno, N) => {
    const dx = anno.end.x - anno.start.x;
    const dy = anno.end.y - anno.start.y;
    const slope = dx !== 0 ? dy / dx : 0;
    return slope * N + (anno.start.y - slope * anno.start.x);
};

const getSlope = (anno) => {
    const dx = anno.end.x - anno.start.x;
    return dx !== 0 ? (anno.end.y - anno.start.y) / dx : 0;
};

const analyzeChartAndPredict = () => {
    const inputs = [];
    document.querySelectorAll('.semester-item input').forEach((inp, idx) => {
        if (inp.value) {
            inputs.push({ index: idx, value: parseFloat(inp.value) });
        }
    });

    if (inputs.length < 2) {
        alert("분석을 위해 최소 2개 학기 이상의 성적을 입력해주세요.");
        return;
    }

    const dataPoints = inputs.map(i => i.value);
    const N = dataPoints.length;
    
    let predictedFinal = null;
    let detailText = "";

    if (userAnnotations.length === 0) {
        detailText = "☝️ 작도 전 상태입니다. 지지선 혹은 저항선을 긋거나 끝점을 드래그하여 학점을 예측해보세요!";
    } else {
        let suppAnno = null;
        let resAnno = null;

        for (let i = userAnnotations.length - 1; i >= 0; i--) {
            if (!suppAnno && userAnnotations[i].type === 'support') suppAnno = userAnnotations[i];
            if (!resAnno && userAnnotations[i].type === 'resistance') resAnno = userAnnotations[i];
        }

        let predSupp = suppAnno ? calculatePrediction(suppAnno, N) : null;
        let predRes = resAnno ? calculatePrediction(resAnno, N) : null;

        if (predSupp !== null && predRes !== null) {
            let raw = (predSupp + predRes) / 2;
            predictedFinal = Math.max(0, Math.min(4.5, raw));
            
            const slopeS = getSlope(suppAnno);
            const slopeR = getSlope(resAnno);

            if (Math.abs(slopeS - slopeR) < 0.1) {
                detailText = "▶ 평행 채널 기반 횡보 추세. 학점이 지지선과 저항선 밴드 내에 수렴할 것으로 예측됨.";
            } else if ((slopeS > 0 && slopeR < 0) || (predRes - predSupp < 0.5)) {
                detailText = "🔻 강력한 매수/매도 압력이 충돌하는 삼각수렴 패턴. 조만간 급격한 학점 변동성(위 또는 아래)이 터질 확률이 높음.";
            } else {
                detailText = "🔮 지지선과 저항선 간의 이격 존재. 두 채널의 중심을 기준으로 추세선을 재설정함.";
            }
        } else if (predSupp !== null) {
            predictedFinal = Math.max(0, Math.min(4.5, predSupp));
            const slope = getSlope(suppAnno);
            if (slope > 0.2) detailText = "📈 강력한 우상향 지지선 확인. 학점 급등 국면에 진입함.";
            else if (slope < -0.2) detailText = "📉 우하향 지지선 형성. 하락 추세를 막지 못하면 바닥이 무너질 위험이 큼.";
            else detailText = "➖ 평단가 유지를 위한 수평 지지선 구축. 횡보 추세 전환.";
        } else if (predRes !== null) {
            predictedFinal = Math.max(0, Math.min(4.5, predRes));
            const slope = getSlope(resAnno);
            if (slope > 0.2) detailText = "↗️ 상승형 저항선 형성. 저항 돌파 시 목표 학점 상향 가능.";
            else if (slope < -0.2) detailText = "↘️ 급격한 하락형 저항선. 하방 압력이 매우 강함. 포기 물량(공매도) 세력이 우세함.";
            else detailText = "벽 두터운 수평 저항선 존재. 학점 벽을 뚫기 위해 단기적인 벼락치기 모멘텀이 필수적임.";
        }
        
        if (predictedFinal !== null) {
            if (predictedFinal >= 4.0) detailText += " 신고가 갱신 임박. 장학금을 노려볼 만함. 현재 루틴 유지 요망.";
            else if (predictedFinal >= 3.5) detailText += " 안정적인 방어력 유지 중. 공부량 추가 투입 시 상방 돌파 가능.";
            else if (predictedFinal >= 3.0) detailText += " 저항선 돌파 모멘텀이 부족함. 즉시 책을 펴고 열람실 입조 요망.";
            else detailText += " 데드크로스(학사경고) 임박. 당장 핸드폰을 끄고 도서관으로 달려가십시오.";
        }
    }

    if (predictedFinal !== null) {
        document.getElementById('predicted-score').innerText = predictedFinal.toFixed(2);
    } else {
        document.getElementById('predicted-score').innerText = "--";
    }
    
    document.getElementById('prediction-detail').innerText = detailText;
    
    document.getElementById('analysis-results').style.display = 'block';

    drawChart(dataPoints, N, predictedFinal);
};

const drawChart = (dataPoints, nextIndex, prediction) => {
    const ctx = document.getElementById('gpaChart').getContext('2d');
    
    if (gpaChartInstance) {
        gpaChartInstance.destroy();
    }
    
    const labels = createSemesterLabels(nextIndex + 1);
    labels[nextIndex] = '다음 학기 (예측)';

    // Build curve data including the final prediction
    const userGpaData = [...dataPoints, prediction !== null ? prediction : null];
    const annotations = {};

    userAnnotations.forEach((anno, i) => {
        // Enforce left-to-right drawing logic
        const startX = Math.min(anno.start.x, anno.end.x);
        const endX = Math.max(anno.start.x, anno.end.x);
        const startY = anno.start.x < anno.end.x ? anno.start.y : anno.end.y;
        const endY = anno.start.x > anno.end.x ? anno.start.y : anno.end.y;

        annotations[`user_${i}`] = {
            type: 'line',
            yMin: startY,
            yMax: endY,
            xMin: startX,
            xMax: endX,
            borderColor: anno.type === 'support' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            borderWidth: 3,
            borderDash: [5, 5]
        };
    });

    let valuesForScale = [...dataPoints];
    if(prediction !== null) valuesForScale.push(prediction);

    gpaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '내 학점',
                    data: userGpaData,
                    segment: {
                        borderColor: ctx => ctx.p0DataIndex < nextIndex - 1 ? '#2563eb' : '#f59e0b',
                        borderDash: ctx => ctx.p0DataIndex < nextIndex - 1 ? undefined : [5, 5],
                    },
                    pointBackgroundColor: ctx => ctx.dataIndex === nextIndex ? '#f59e0b' : '#fff',
                    pointBorderColor: ctx => ctx.dataIndex === nextIndex ? '#b45309' : '#2563eb',
                    pointBorderWidth: 2,
                    pointRadius: ctx => ctx.dataIndex === nextIndex ? 8 : 5,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            layout: {
                padding: { top: 20, bottom: 20 }
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    suggestedMin: Math.max(0, Math.min(...valuesForScale) - 0.2),
                    suggestedMax: Math.min(4.5, Math.max(...valuesForScale) + 0.2),
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        display: !hideYAxis
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                annotation: {
                    annotations: annotations
                },
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            }
        }
    });
};

document.getElementById('analyze-btn').addEventListener('click', analyzeChartAndPredict);

// == Interactive Drawing & Dragging Logic ==

const updateToolUI = (activeBtn) => {
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) {
        activeBtn.classList.add('active');
        document.getElementById('drawingOverlay').style.pointerEvents = 'auto';
        document.getElementById('drawingOverlay').style.cursor = 'crosshair';
    } else {
        document.getElementById('drawingOverlay').style.pointerEvents = 'none';
        currentDrawTool = null;
    }
};

document.getElementById('draw-support-btn').addEventListener('click', (e) => {
    currentDrawTool = currentDrawTool === 'support' ? null : 'support';
    updateToolUI(currentDrawTool ? e.target : null);
});

document.getElementById('draw-resistance-btn').addEventListener('click', (e) => {
    currentDrawTool = currentDrawTool === 'resistance' ? null : 'resistance';
    updateToolUI(currentDrawTool ? e.target : null);
});

document.getElementById('clear-drawings-btn').addEventListener('click', () => {
    userAnnotations = [];
    if(gpaChartInstance) analyzeChartAndPredict();
});

document.getElementById('toggle-yaxis-btn').addEventListener('click', (e) => {
    hideYAxis = !hideYAxis;
    e.target.innerText = hideYAxis ? "🙉 축 숫자 보이기" : "🙈 축 숫자 숨기기";
    if (gpaChartInstance) {
        gpaChartInstance.options.scales.y.ticks.display = !hideYAxis;
        gpaChartInstance.update();
    }
});

const overlay = document.getElementById('drawingOverlay');
const container = document.querySelector('.chart-container');

const syncOverlaySize = () => {
    const chartCanvas = document.getElementById('gpaChart');
    if (chartCanvas && overlay) {
        overlay.width = chartCanvas.clientWidth;
        overlay.height = chartCanvas.clientHeight;
    }
};

window.addEventListener('resize', syncOverlaySize);

// Hover detection for endpoint grabbing
container.addEventListener('mousemove', (e) => {
    if (currentDrawTool || isDrawing) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!isDraggingEndpoint) {
        let found = null;
        if (gpaChartInstance && userAnnotations.length > 0) {
            userAnnotations.forEach((anno, i) => {
                const startX = gpaChartInstance.scales.x.getPixelForValue(anno.start.x);
                const startY = gpaChartInstance.scales.y.getPixelForValue(anno.start.y);
                const endX = gpaChartInstance.scales.x.getPixelForValue(anno.end.x);
                const endY = gpaChartInstance.scales.y.getPixelForValue(anno.end.y);

                if (Math.hypot(startX - x, startY - y) <= 15) found = { index: i, type: 'start' };
                if (Math.hypot(endX - x, endY - y) <= 15) found = { index: i, type: 'end' };
            });
        }
        
        if (found) {
            hoveredEndpoint = found;
            overlay.style.pointerEvents = 'auto'; 
            overlay.style.cursor = 'grab';
        } else {
            hoveredEndpoint = null;
            overlay.style.pointerEvents = 'none'; 
            overlay.style.cursor = 'default';
        }
    } else {
        // We are currently dragging an endpoint!
        const anno = userAnnotations[dragIndex];
        const newDataX = gpaChartInstance.scales.x.getValueForPixel(x);
        const newDataY = gpaChartInstance.scales.y.getValueForPixel(y);
        
        if (dragPointType === 'start') {
            anno.start.x = newDataX;
            anno.start.y = newDataY;
        } else {
            anno.end.x = newDataX;
            anno.end.y = newDataY;
        }

        // Live update the chart visually (fast update)
        if (gpaChartInstance.options.plugins.annotation.annotations[`user_${dragIndex}`]) {
            const chartAnno = gpaChartInstance.options.plugins.annotation.annotations[`user_${dragIndex}`];
            
            chartAnno.xMin = Math.min(anno.start.x, anno.end.x);
            chartAnno.xMax = Math.max(anno.start.x, anno.end.x);
            chartAnno.yMin = anno.start.x < anno.end.x ? anno.start.y : anno.end.y;
            chartAnno.yMax = anno.start.x > anno.end.x ? anno.start.y : anno.end.y;
            
            gpaChartInstance.update('none'); // Update without animation
        }
    }
});

overlay.addEventListener('mousedown', (e) => {
    if (!currentDrawTool && hoveredEndpoint) {
        // Intercept mousedown for grabbing endpoints
        isDraggingEndpoint = true;
        dragIndex = hoveredEndpoint.index;
        dragPointType = hoveredEndpoint.type;
        overlay.style.cursor = 'grabbing';
        return;
    }

    if (!currentDrawTool || !gpaChartInstance) return;
    
    syncOverlaySize();
    isDrawing = true;
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startDrawPoint = {
        pixelX: x,
        pixelY: y,
        dataX: gpaChartInstance.scales.x.getValueForPixel(x),
        dataY: gpaChartInstance.scales.y.getValueForPixel(y)
    };
});

overlay.addEventListener('mousemove', (e) => {
    if (!isDrawing || !startDrawPoint) return;
    
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctxO = overlay.getContext('2d');
    ctxO.clearRect(0, 0, overlay.width, overlay.height);
    
    ctxO.beginPath();
    ctxO.moveTo(startDrawPoint.pixelX, startDrawPoint.pixelY);
    ctxO.lineTo(x, y);
    ctxO.strokeStyle = currentDrawTool === 'support' ? '#22c55e' : '#ef4444';
    ctxO.lineWidth = 3;
    ctxO.setLineDash([5, 5]);
    ctxO.stroke();
});

overlay.addEventListener('mouseup', (e) => {
    // Note: editing drops are primarily handled inside window.mouseup below
    // to catch dragging even if the mouse leaves the overlay.
    if (isDraggingEndpoint) return; 

    if (!isDrawing || !startDrawPoint) return;
    isDrawing = false;
    
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const endDataX = gpaChartInstance.scales.x.getValueForPixel(x);
    const endDataY = gpaChartInstance.scales.y.getValueForPixel(y);
    
    const ctxO = overlay.getContext('2d');
    ctxO.clearRect(0, 0, overlay.width, overlay.height);
    
    userAnnotations.push({
        type: currentDrawTool,
        start: { x: startDrawPoint.dataX, y: startDrawPoint.dataY },
        end: { x: endDataX, y: endDataY }
    });
    
    updateToolUI(null);
    analyzeChartAndPredict();
});

// Use window level mouseup to drop endpoints seamlessly
window.addEventListener('mouseup', () => {
    if (isDraggingEndpoint) {
        isDraggingEndpoint = false;
        if (overlay) overlay.style.cursor = 'grab';
        // After drag completes, recalculate and re-render everything
        analyzeChartAndPredict();
    }
});

document.getElementById('semester-list').addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        let val = parseFloat(e.target.value);
        if (val > maxGpaBase) {
            e.target.value = maxGpaBase;
        } else if (val < 0) {
            e.target.value = 0;
        }
    }
});

// init
renderInputFields();
