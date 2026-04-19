let semesterCount = 8;
let gpaChartInstance = null;
let hideYAxis = false;
let maxGpaBase = 4.3;

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
            <input type="number" id="sem-${i}" step="0.01" min="0" max="${maxGpaBase}" placeholder="--">
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
        <input type="number" id="sem-${index}" step="0.01" min="0" max="${maxGpaBase}" placeholder="--">
    `;
    container.appendChild(div);
});

// Exact Bezier estimation matching Chart.js logic
const getCurveData = (data) => {
    let curve = [];
    const tension = 0.4;
    const n = data.length;
    let cps = [];
    for(let i=0; i<n; i++) {
        let prev = Math.max(0, i-1);
        let next = Math.min(n-1, i+1);
        let vX = next - prev; 
        let vY = data[next] - data[prev];
        cps.push({
            p1x: i + vX * tension / 3,
            p1y: data[i] + vY * tension / 3,
            p2x: i - vX * tension / 3,
            p2y: data[i] - vY * tension / 3
        });
    }
    
    for(let i=0; i<n-1; i++) {
        let p0x = i; let p0y = data[i];
        let p1x = i+1; let p1y = data[i+1];
        
        let cp1x = cps[i].p1x; let cp1y = cps[i].p1y;
        let cp2x = cps[i+1].p2x; let cp2y = cps[i+1].p2y;
        
        for(let t=0; t<1; t+= 0.02) {
            let mt = 1-t; let mt2 = mt*mt; let mt3 = mt2*mt;
            let t2 = t*t; let t3 = t2*t;
            
            let x = mt3*p0x + 3*mt2*t*cp1x + 3*mt*t2*cp2x + t3*p1x;
            let y = mt3*p0y + 3*mt2*t*cp1y + 3*mt*t2*cp2y + t3*p1y;
            curve.push({x, y});
        }
    }
    curve.push({x: n-1, y: data[n-1]});
    return curve;
};

// Algorithm to automatically find best bounding lines perfectly touching the physical curve up to a limit
const findBoundingLines = (data, limitIndex) => {
    const curveData = getCurveData(data);
    const validCurveData = curveData.filter(pt => pt.x <= limitIndex);
    
    let bestResistance = null;
    let minResArea = Infinity;

    // Resistance: No point on the valid curve is > line y
    for (let i = 0; i < validCurveData.length - 10; i += 2) {
        for (let j = i + 10; j < validCurveData.length; j += 2) {
            const pA = validCurveData[i];
            const pB = validCurveData[j];
            const dx = pB.x - pA.x;
            if (dx === 0) continue;
            
            const m = (pB.y - pA.y) / dx;
            const b = pA.y - m * pA.x;
            
            let isValid = true;
            let area = 0;
            
            for (let k = 0; k < validCurveData.length; k++) {
                const pt = validCurveData[k];
                const predictedY = m * pt.x + b;
                if (pt.y > predictedY + 0.005) {
                    isValid = false;
                    break;
                }
                area += (predictedY - pt.y);
            }
            if (isValid && area < minResArea) {
                minResArea = area;
                bestResistance = { m, b, start: {x: 0, y: b}, end: {x: data.length, y: m * data.length + b} };
            }
        }
    }

    let bestSupport = null;
    let minSupArea = Infinity;

    // Support: No point on the valid curve is < line y
    for (let i = 0; i < validCurveData.length - 10; i += 2) {
        for (let j = i + 10; j < validCurveData.length; j += 2) {
            const pA = validCurveData[i];
            const pB = validCurveData[j];
            const dx = pB.x - pA.x;
            if (dx === 0) continue;
            
            const m = (pB.y - pA.y) / dx;
            const b = pA.y - m * pA.x;
            
            let isValid = true;
            let area = 0;
            
            for (let k = 0; k < validCurveData.length; k++) {
                const pt = validCurveData[k];
                const predictedY = m * pt.x + b;
                if (pt.y < predictedY - 0.005) {
                    isValid = false;
                    break;
                }
                area += (pt.y - predictedY);
            }
            if (isValid && area < minSupArea) {
                minSupArea = area;
                bestSupport = { m, b, start: {x: 0, y: b}, end: {x: data.length, y: m * data.length + b} };
            }
        }
    }

    return { support: bestSupport, resistance: bestResistance };
};

const analyzeChartAndPredict = () => {
    const inputs = [];
    document.querySelectorAll('.semester-item input').forEach((inp, idx) => {
        if (inp.value) {
            inputs.push(parseFloat(inp.value));
        }
    });

    if (inputs.length < 3) {
        alert("정확한 자동 분석을 위해 최소 3개 학기 이상의 성적을 연속으로 입력해주세요.");
        return;
    }

    const N = inputs.length;
    
    // First, calculate historical trend EXCLUDING the most recent point (N-1)
    const pastTrend = findBoundingLines(inputs, N - 2.05); // slightly above index N-2 to include full bezier there
    
    let isHistoricalBreakoutUp = false;
    let isHistoricalBreakdown = false;
    
    let support = null;
    let resistance = null;
    let predictedFinal = null;
    let detailText = "";

    // First generate the comprehensive current trend
    const currentTrend = findBoundingLines(inputs, N);
    let didParallelOverride = false;

    // Check if the current point (N-1) completely shattered the historical trend
    if (pastTrend.support && pastTrend.resistance && currentTrend.support && currentTrend.resistance && N >= 3) {
        const pastResAtLatest = pastTrend.resistance.m * (N - 1) + pastTrend.resistance.b;
        const pastSupAtLatest = pastTrend.support.m * (N - 1) + pastTrend.support.b;
        
        const pastParallelism = Math.abs(pastTrend.support.m - pastTrend.resistance.m);
        const currentParallelism = Math.abs(currentTrend.support.m - currentTrend.resistance.m);

        if (currentParallelism < pastParallelism || currentParallelism < 0.08) {
            // The complete chart is MORE geometrically parallel than the old past trend.
            // This geometrically overrides any historical break judgments (past lines were drawn based on incomplete spikes).
            support = currentTrend.support;
            resistance = currentTrend.resistance;
            if (currentParallelism < 0.15) didParallelOverride = true;
        } else if (inputs[N-1] > pastResAtLatest + 0.05 && inputs[N-1] > inputs[N-2]) {    
            isHistoricalBreakoutUp = true;
            support = pastTrend.support;
            resistance = pastTrend.resistance;
        } else if (inputs[N-1] < pastSupAtLatest - 0.05 && inputs[N-1] < inputs[N-2]) {
            isHistoricalBreakdown = true;
            support = pastTrend.support;
            resistance = pastTrend.resistance;
        } else {
            // Trend is mathematically intact, use refined lines
            support = currentTrend.support;
            resistance = currentTrend.resistance;
        }
    } else {
        support = currentTrend.support;
        resistance = currentTrend.resistance;
    }

    if (isHistoricalBreakoutUp) {
        let upperTarget = inputs[N-1] + resistance.m + 0.15;
        upperTarget = Math.max(upperTarget, inputs[N-1] + 0.15); // Ensure score actually goes UP
        predictedFinal = Math.max(0, Math.min(maxGpaBase, upperTarget));
        detailText = "🔥 저항선 돌파(Breakout) 대성공! 억눌려있던 최근 추세를 깨부수고 상방 모멘텀으로 저항선을 완벽하게 뚫어냈습니다. 다음 학기도 강한 상승장이 기대됩니다!";
    } else if (isHistoricalBreakdown) {
        let lowerTarget = inputs[N-1] + support.m - 0.15;
        lowerTarget = Math.min(lowerTarget, inputs[N-1] - 0.15); // Ensure score actually goes DOWN
        predictedFinal = Math.max(0, Math.min(maxGpaBase, Math.max(0, lowerTarget)));
        detailText = "💀 지지선 붕괴(Breakdown) 발생! 그동안 버텨주던 마지노선이 뚫리며 추세가 하방으로 완전히 꺾였습니다. 끝없는 하락을 막으려면 당장 책을 펴십시오!";
    } else if (support && resistance) {
        // Evaluate slopes
        const slopeS = support.m;
        const slopeR = resistance.m;
        const predSupp = support.m * N + support.b;
        const predRes = resistance.m * N + resistance.b;

        let raw = (predSupp + predRes) / 2;

        // Case Definitions based on boundary proximity
        const lastVal = inputs[N-1];
        const currentRes = resistance.m * (N-1) + resistance.b;
        const currentSupp = support.m * (N-1) + support.b;
        
        // Ensure distance calculations don't break on division
        const trueWidth = currentRes - currentSupp;
        const widthForCalcs = Math.max(trueWidth, 0.001);
        const distRes = Math.abs(currentRes - lastVal);
        const distSupp = Math.abs(lastVal - currentSupp);

        let isParallel = Math.abs(slopeS - slopeR) < 0.08 || didParallelOverride;
        let widthAtStart = resistance.b - support.b;
        let isConverging = trueWidth < widthAtStart;
        
        let isTouchingUpper = distRes <= widthForCalcs * 0.25 || distRes < 0.05;
        let isTouchingLower = distSupp <= widthForCalcs * 0.25 || distSupp < 0.05;
        let isApex = isConverging && (trueWidth <= 0.15);

        if (isApex) {
            // In an Apex: NEVER mean revert. It's a bomb waiting to explode.
            const isRecentUp = inputs[N-1] >= inputs[N-2];
            if (isRecentUp) {
                let upperTarget = Math.max(predRes, predSupp) + 0.25;
                upperTarget = Math.max(upperTarget, inputs[N-1] + 0.15);
                predictedFinal = Math.max(0, Math.min(maxGpaBase, upperTarget));
                detailText = "🚀 삼각수렴 (Triangle Convergence) 완료! 응축된 에너지가 최근의 상승 모멘텀을 타고 두 선의 꼭짓점을 넘어 상방으로 강하게 폭발(Breakout)합니다!";
            } else {
                let lowerTarget = Math.min(predRes, predSupp) - 0.25;
                lowerTarget = Math.min(lowerTarget, inputs[N-1] - 0.15);
                predictedFinal = Math.max(0, Math.min(maxGpaBase, Math.max(0, lowerTarget)));
                detailText = "🔻 삼각수렴 (Triangle Convergence) 완료! 최근의 하락 추세를 이기지 못하고 두 선을 모두 뚫으며 밑으로 쏟아내리는(Breakdown) 치명적인 폭포수가 시작될 수 있습니다.";
            }
        } else if (isParallel) {
            predictedFinal = Math.max(0, Math.min(maxGpaBase, raw));
            const avgSlope = (slopeS + slopeR) / 2;
            
            if (isTouchingUpper) {
                if (avgSlope > 0.05) {
                    detailText = "▶ 상승 채널(Bullish Trend) 상단 터치. 폭발적인 상승 추세 속에서 일시적인 숨고르기(건강한 조정)가 예상됩니다.";
                } else if (avgSlope < -0.05) {
                    detailText = "▶ 하락 채널(Bearish Trend) 상단 터치. 구조적 하락장 속에서 저항선에 부딪혔습니다. 추세 전환으로 착각하지 마십시오.";
                } else {
                    detailText = "▶ 횡보 박스권 상단 터치. 저항선 돌파에 막혀 수확 체감이 오며 다음 학기는 채널 중앙으로의 회귀가 예상됩니다.";
                }
            } else if (isTouchingLower) {
                if (avgSlope > 0.05) {
                    detailText = "▶ 상승 채널(Bullish Trend) 하단 터치. 굳건한 바닥 지지선을 딛고 거대한 상승 반등(Rebound)이 다시 시작될 타이밍입니다.";
                } else if (avgSlope < -0.05) {
                    detailText = "▶ 하락 채널(Bearish Trend) 하단 터치. 과매도(Oversold) 구간에 진입해 일시적 반등은 가능하나 우하향 채널은 여전합니다.";
                } else {
                    detailText = "▶ 횡보 박스권 하단 터치. 지지선을 딛고 다시 채널 중앙을 향해 무난한 기술적 반등이 시작될 구간입니다.";
                }
            } else {
                if (avgSlope > 0.05) detailText = "▶ 뚜렷한 상승 채널(Bullish Channel) 내 순항 중. 이대로만 하면 최상위권 돌파가 무난하게 예측됩니다.";
                else if (avgSlope < -0.05) detailText = "▶ 뚜렷한 하락 채널(Bearish Channel) 내 갇힘. 무기력하게 채널 중앙을 따라 서서히 하방으로 침몰하고 있습니다.";
                else detailText = "▶ 안정적인 평행 박스권 횡보 중. 튀는 곳 없이 채널 중앙을 따라 무난하고 지루하게 수렴할 것으로 예측됩니다.";
            }
        } else if (isConverging) {
            predictedFinal = Math.max(0, Math.min(maxGpaBase, raw));
            if (isTouchingUpper) {
                detailText = "▶ 삼각수렴(Triangle) 상단 폭 저항. 선을 완전히 뚫기에 응축 에너지가 부족하여 다시 안쪽으로 꺾여 내려올 확률이 높습니다.";
            } else if (isTouchingLower) {
                detailText = "▶ 삼각수렴(Triangle) 하단 터치. 바닥 지지에 성공하여, 상단 저항선을 향해 반등하며 더욱 뾰족하게 에너지를 모아가는 구간입니다.";
            } else {
                detailText = "▶ 삼각수렴(Triangle) 패턴 진행 중. 점차 성적 변동폭이 줄어들며 꼭짓점(Apex)을 향해 팽팽하게 에너지를 응축하고 있습니다.";
            }
        } else {
            // Broadening Formation (Megaphone)
            predictedFinal = Math.max(0, Math.min(maxGpaBase, raw));
            if (isTouchingUpper) {
                detailText = "▶ 확장형(Broadening) 채널 상단 터치. 변동성이 극대화된 상태라 채널 중앙으로 거칠게 회귀(Mean Reversion)할 확률이 높습니다.";
            } else if (isTouchingLower) {
                detailText = "▶ 확장형(Broadening) 채널 하단 터치. 변동성이 커지는 '확성기' 패턴 끝자락에서 중앙을 향해 과격하게 튀어 오를 수 있습니다.";
            } else {
                detailText = "📢 확장형 채널(Megaphone) 형성 중. 위아래로 성적 변동폭이 갈수록 심해지고 있어 멘탈 관리가 필수적입니다.";
            }
        }
    } else {
        // Fallback for mathematical collinear lines
        predictedFinal = inputs[N-1];
        detailText = "추세선 도출 불가. 기본 방향성을 유지할 것으로 전망됨.";
    }



    if (predictedFinal !== null) {
        document.getElementById('predicted-score').innerText = predictedFinal.toFixed(2);
    } else {
        document.getElementById('predicted-score').innerText = "--";
    }
    
    document.getElementById('prediction-detail').innerHTML = detailText;
    document.getElementById('analysis-results').style.display = 'block';

    drawChart(inputs, N, predictedFinal, support, resistance);
};

const drawChart = (dataPoints, nextIndex, prediction, supportLine, resistanceLine) => {
    const ctx = document.getElementById('gpaChart').getContext('2d');
    
    if (gpaChartInstance) gpaChartInstance.destroy();
    
    const labels = createSemesterLabels(nextIndex + 1);
    labels[nextIndex] = '다음 학기 (예측)';

    // Using segment rules to color the curve to the prediction yellow
    const userGpaData = [...dataPoints, prediction !== null ? prediction : null];
    const annotations = {};

    if (supportLine) {
        annotations.support = {
            type: 'line',
            yMin: supportLine.b,
            yMax: supportLine.m * nextIndex + supportLine.b,
            xMin: 0,
            xMax: nextIndex,
            borderColor: 'rgba(34, 197, 94, 0.7)',
            borderWidth: 3,
            borderDash: [10, 5],
            label: { display: false }
        };
    }
    
    if (resistanceLine) {
        annotations.resistance = {
            type: 'line',
            yMin: resistanceLine.b,
            yMax: resistanceLine.m * nextIndex + resistanceLine.b,
            xMin: 0,
            xMax: nextIndex,
            borderColor: 'rgba(239, 68, 68, 0.7)',
            borderWidth: 3,
            borderDash: [10, 5],
            label: { display: false }
        };
    }

    // Scale calculation
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
            layout: { padding: { top: 20, bottom: 20 } },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    suggestedMin: Math.max(0, Math.min(...valuesForScale) - 0.2),
                    suggestedMax: Math.min(maxGpaBase, Math.max(...valuesForScale) + 0.2),
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { display: !hideYAxis }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                annotation: { annotations: annotations },
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
};

document.getElementById('analyze-btn').addEventListener('click', analyzeChartAndPredict);

document.getElementById('toggle-yaxis-btn').addEventListener('click', (e) => {
    hideYAxis = !hideYAxis;
    e.target.innerText = hideYAxis ? "🙉 축 숫자 보이기" : "🙈 축 숫자 숨기기";
    if (gpaChartInstance) {
        gpaChartInstance.options.scales.y.ticks.display = !hideYAxis;
        gpaChartInstance.update();
    }
});

document.getElementById('max-gpa-select').addEventListener('change', (e) => {
    maxGpaBase = parseFloat(e.target.value);
    document.querySelectorAll('.semester-item input').forEach(inp => {
        inp.max = maxGpaBase;
        if(inp.value && parseFloat(inp.value) > maxGpaBase) {
            inp.value = maxGpaBase; // auto clamp existing inputs
        }
    });
    if(gpaChartInstance) analyzeChartAndPredict();
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
