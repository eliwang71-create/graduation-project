const API_BASE_URL = 'http://127.0.0.1:8080/api';
const SCHOOL_CENTER = [108.9514, 34.1579];

const state = {
    mapStation: null,
    mapRoute: null,
    mapSimulation: null,
    placeSearch: null,
    infoWindow: null,
    tempMarker: null,
    stationMarkers: [],
    realRoutePolylines: [],
    realRouteMarkers: [],
    stations: [],
    vehicles: [],
    routes: [],
    planningOverlayTimer: null,
    planningMode: 'real',
    simulationCreateMode: null,
    simulationStations: [],
    simulationVehicles: [],
    simulationMarkers: [],
    simulationRouteOverlays: [],
    simulationResult: null,
    simulationPlaybackTimer: null,
    simulationPlaybackIndex: 0,
    simulationDetailDrawerOpen: false,
    simulationDetailDrawerType: null
};

function renderAlgorithmMath() {
    document.querySelectorAll('.formula-math').forEach((element) => {
        const formula = element.dataset.formula || element.textContent || '';
        if (window.katex?.render) {
            try {
                window.katex.render(formula, element, {
                    throwOnError: false,
                    displayMode: true,
                    strict: 'ignore'
                });
                return;
            } catch (_) {
                // Fallback to plain text below.
            }
        }
        element.textContent = formula;
    });

    document.querySelectorAll('.formula-inline').forEach((element) => {
        const formula = element.dataset.formula || element.textContent || '';
        if (window.katex?.render) {
            try {
                window.katex.render(formula, element, {
                    throwOnError: false,
                    displayMode: false,
                    strict: 'ignore'
                });
                return;
            } catch (_) {
                // Fallback to plain text below.
            }
        }
        element.textContent = formula;
    });
}

function getSimulationDetailDrawerContent(type) {
    if (type === 'algorithm') {
        return {
            kicker: '算法说明',
            title: '蚁群算法介绍',
            body: `
                <section class="detail-section">
                    <div class="detail-section-title">算法思想</div>
                    <p>蚁群算法通过模拟蚂蚁觅食过程完成路径搜索。每一轮中，多只蚂蚁会根据当前信息素浓度和启发函数构造候选路径；路径越优秀，在后续轮次中被强化的概率越大，算法也就会逐步向更优解收敛。</p>
                </section>
                <section class="detail-section">
                    <div class="detail-section-title">在本项目中的问题映射</div>
                    <ul>
                        <li><strong>节点</strong>：校园通勤车需要服务的上车站点与教学区终点站。</li>
                        <li><strong>路径</strong>：某辆车访问各站点的顺序，也就是车辆调度路线。</li>
                        <li><strong>目标</strong>：在满足约束的前提下，尽量减小总调度距离与总运行成本。</li>
                    </ul>
                </section>
                <section class="detail-section">
                    <div class="detail-section-title">本系统约束</div>
                    <div class="detail-tag-row">
                        <span class="detail-tag">容量约束</span>
                        <span class="detail-tag">硬时间窗约束</span>
                        <span class="detail-tag">最早发车时间</span>
                        <span class="detail-tag">终点站约束</span>
                    </div>
                    <p style="margin-top:12px;">也就是说，算法不仅要找到更短的路径，还必须保证车辆不超载、站点服务时刻满足时间窗、车辆不会过早发车，并最终在终点站时间要求内完成调度。</p>
                </section>
                <section class="detail-section">
                    <div class="detail-section-title">本项目中的实现逻辑</div>
                    <ul>
                        <li>首先根据站点、车辆和距离矩阵构建 <code>VRPTWInstance</code>。</li>
                        <li>每一轮中多只蚂蚁分别构造候选解，并生成若干车辆路径。</li>
                        <li>系统对候选路径逐条检查容量、时间窗、最早发车和终点站约束。</li>
                        <li>从可行解中保留当轮最优，再与历史全局最优比较并更新。</li>
                        <li>最后根据优秀路径更新信息素，进入下一轮搜索。</li>
                    </ul>
                    <p style="margin-top:10px;">因此，当前模拟页面里展示的路径、收敛曲线和最优值都来自项目真实的蚁群算法求解过程，而不是伪造动画或静态示意图。</p>
                </section>
            `
        };
    }

    if (type === 'formula') {
        return {
            kicker: '参数与公式',
            title: '蚁群算法核心数学公式',
            body: `
                <section class="detail-section detail-formula-block">
                    <div class="detail-formula-name">状态转移概率</div>
                    <div class="formula-text formula-math" data-formula="P_{ij}^{k} = \\frac{(\\tau_{ij})^{\\alpha}(\\eta_{ij})^{\\beta}}{\\sum_{s \\in \\mathrm{allowed}_k} (\\tau_{is})^{\\alpha}(\\eta_{is})^{\\beta}}">P_{ij}^{k} = \\frac{(\\tau_{ij})^{\\alpha}(\\eta_{ij})^{\\beta}}{\\sum_{s \\in \\mathrm{allowed}_k} (\\tau_{is})^{\\alpha}(\\eta_{is})^{\\beta}}</div>
                    <p class="formula-desc">表示第 k 只蚂蚁从节点 i 选择下一个节点 j 的概率。信息素越强、启发值越高，该节点越容易被选中。</p>
                    <div class="detail-formula-meta">
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\tau_{ij}">\\tau_{ij}</span><span>边 \\((i,j)\\) 上的信息素强度，反映历史经验。</span></div>
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\eta_{ij}">\\eta_{ij}</span><span>启发函数，反映局部吸引力。</span></div>
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\alpha">\\alpha</span><span>信息素权重，越大越依赖历史优路径。</span></div>
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\beta">\\beta</span><span>启发函数权重，越大越偏向局部最近邻。</span></div>
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\mathrm{allowed}_k">\\mathrm{allowed}_k</span><span>第 k 只蚂蚁当前仍允许访问的节点集合。</span></div>
                    </div>
                </section>
                <section class="detail-section detail-formula-block">
                    <div class="detail-formula-name">启发函数</div>
                    <div class="formula-text formula-math" data-formula="\\eta_{ij} = \\frac{1}{d_{ij}}">\\eta_{ij} = \\frac{1}{d_{ij}}</div>
                    <p class="formula-desc">距离越短，启发值越高，因此蚂蚁更倾向优先访问更近的站点。</p>
                    <div class="detail-formula-meta">
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="d_{ij}">d_{ij}</span><span>节点 i 到节点 j 的距离或代价，在本项目中可对应距离矩阵或模拟矩阵。</span></div>
                    </div>
                </section>
                <section class="detail-section detail-formula-block">
                    <div class="detail-formula-name">信息素更新</div>
                    <div class="formula-text formula-math" data-formula="\\tau_{ij} \\leftarrow (1-\\rho)\\tau_{ij} + \\Delta \\tau_{ij}">\\tau_{ij} \\leftarrow (1-\\rho)\\tau_{ij} + \\Delta \\tau_{ij}</div>
                    <p class="formula-desc">旧信息素会随着轮次挥发，优秀路径则会补充新的信息素，从而强化后续搜索对优路径的偏好。</p>
                    <div class="detail-formula-meta">
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\rho">\\rho</span><span>挥发系数，决定旧信息素衰减速度。</span></div>
                        <div class="detail-formula-meta-row"><span class="detail-formula-symbol formula-inline" data-formula="\\Delta\\tau_{ij}">\\Delta\\tau_{ij}</span><span>优秀路径对边 \\((i,j)\\) 的新增信息素量。</span></div>
                    </div>
                </section>
                <section class="detail-section">
                    <div class="detail-section-title">这些参数在本项目中的作用</div>
                    <p>在校园通勤车调度场景中，参数决定了算法更偏向“沿着历史优路径继续强化”，还是“探索新的节点组合”。而约束检查会进一步过滤掉超容量、时间窗冲突、发车过早或终点不满足要求的候选解，因此最终保留下来的路线既要优，又必须可行。</p>
                </section>
            `
        };
    }

    return {
        kicker: '图表说明',
        title: '收敛曲线解读',
        body: `
            <section class="detail-section">
                <div class="detail-section-title">图表含义</div>
                <p>收敛曲线用于观察蚁群算法在迭代过程中的搜索变化。横轴表示迭代轮次，纵轴表示目标值，也就是当前调度方案的总距离。曲线不是装饰图，而是由项目真实 ACO 迭代记录直接生成。</p>
            </section>
            <section class="detail-section">
                <div class="detail-section-title">两条曲线分别表示什么</div>
                <ul>
                    <li><strong>蓝线（当轮最优）</strong>：表示每一轮中所有蚂蚁解里最好的那个结果，用来观察当前轮的搜索波动。</li>
                    <li><strong>绿线（全局最优）</strong>：表示从第 1 轮到当前轮为止出现过的最好结果，用来观察整体收敛趋势。</li>
                </ul>
            </section>
            <section class="detail-section">
                <div class="detail-section-title">为什么有时曲线较平</div>
                <p>如果样例较简单、约束较宽松，或者算法在较早轮次就找到了稳定优解，那么后续全局最优曲线会较早趋于平稳。这说明当前样例已经较快收敛，并不意味着页面在伪造数据。</p>
            </section>
            <section class="detail-section">
                <div class="detail-section-title">当前播放轮次高亮点</div>
                <p>图中的高亮点和垂直参考线表示当前播放到哪一轮，和右侧“算法迭代状态”中的轮次是同步的，方便你一边观察路径变化，一边对照曲线位置。</p>
            </section>
        `
    };
}

function renderSimulationDetailDrawer() {
    const drawer = document.getElementById('simulation-detail-drawer');
    const kicker = document.getElementById('simulation-detail-kicker');
    const title = document.getElementById('simulation-detail-title');
    const body = document.getElementById('simulation-detail-body');
    if (!drawer || !kicker || !title || !body) return;

    if (!state.simulationDetailDrawerOpen || !state.simulationDetailDrawerType) {
        drawer.classList.add('hidden-view');
        drawer.setAttribute('aria-hidden', 'true');
        body.innerHTML = '';
        return;
    }

    const content = getSimulationDetailDrawerContent(state.simulationDetailDrawerType);
    kicker.textContent = content.kicker;
    title.textContent = content.title;
    body.innerHTML = content.body;
    drawer.classList.remove('hidden-view');
    drawer.setAttribute('aria-hidden', 'false');
    renderAlgorithmMath();
}

function openSimulationDetailDrawer(type) {
    state.simulationDetailDrawerOpen = true;
    state.simulationDetailDrawerType = type;
    renderSimulationDetailDrawer();
}

function closeSimulationDetailDrawer() {
    state.simulationDetailDrawerOpen = false;
    state.simulationDetailDrawerType = null;
    renderSimulationDetailDrawer();
}

function checkAMap() {
    if (typeof AMap === 'undefined') {
        alert('高德地图 API 未加载，请检查网络或密钥配置。');
        return false;
    }
    return true;
}

function buildRouteColor(index) {
    const palette = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    return palette[index % palette.length];
}

function timeToMinutes(value, fallback = '07:00') {
    const source = value || fallback;
    const [hour, minute] = source.split(':').map((item) => parseInt(item, 10));
    return hour * 60 + minute;
}

function minutesToClock(minutes) {
    const safe = Math.max(0, minutes);
    const hour = Math.floor(safe / 60).toString().padStart(2, '0');
    const minute = (safe % 60).toString().padStart(2, '0');
    return `${hour}:${minute}`;
}

function estimateDistanceKm(a, b) {
    const avgLatRad = ((a.lat + b.lat) / 2) * Math.PI / 180;
    const dx = (b.lng - a.lng) * 111.320 * Math.cos(avgLatRad);
    const dy = (b.lat - a.lat) * 110.540;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateDashboard() {
    const stationCount = state.stations.length;
    const vehicleCount = state.vehicles.length;
    const demandCount = state.stations.reduce((sum, station) => sum + Number(station.demand || 0), 0);
    const dashStation = document.getElementById('dash-station-count');
    const dashVehicle = document.getElementById('dash-vehicle-count');
    const dashDemand = document.getElementById('dash-demand-count');
    const dashMode = document.getElementById('dash-mode-text');
    if (dashStation) dashStation.innerText = String(stationCount);
    if (dashVehicle) dashVehicle.innerText = String(vehicleCount);
    if (dashDemand) dashDemand.innerText = String(demandCount);
    if (dashMode) dashMode.innerText = state.planningMode === 'real' ? '真实高德模式' : '模拟节点模式';
}

async function parseApiResponse(response) {
    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }
    if (!response.ok) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
    }
    return payload;
}

function normalizeStationFromApi(station) {
    return {
        id: Number(station.id),
        name: station.station_name,
        address: station.address || '',
        lng: Number(station.lng),
        lat: Number(station.lat),
        demand: Number(station.demand || 0),
        service_time: Number(station.service_time || 0),
        tw_start: station.time_window_start,
        tw_end: station.time_window_end,
        is_depot: Boolean(station.is_depot)
    };
}

function normalizeVehicleFromApi(vehicle) {
    return {
        id: Number(vehicle.id),
        vehicle_code: vehicle.vehicle_code,
        plate_number: vehicle.plate_number,
        capacity: Number(vehicle.capacity || 0),
        driver_name: vehicle.driver_name || '',
        driver_phone: vehicle.driver_phone || '',
        status: vehicle.status || 'idle',
        start_depot: vehicle.start_depot || '',
        end_depot: vehicle.end_depot || '',
        max_run_minutes: Number(vehicle.max_run_minutes || 120),
        earliest_departure_time: vehicle.earliest_departure_time || '06:40'
    };
}

async function loadStationsFromApi(silent = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/stations`);
        const payload = await parseApiResponse(response);
        state.stations = Array.isArray(payload.stations) ? payload.stations.map(normalizeStationFromApi) : [];
        updateDashboard();
    } catch (error) {
        if (!silent) {
            alert(`站点数据读取失败。\n${error.message}`);
        }
    }
}

async function loadVehiclesFromApi(silent = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles`);
        const payload = await parseApiResponse(response);
        state.vehicles = Array.isArray(payload.vehicles) ? payload.vehicles.map(normalizeVehicleFromApi) : [];
        updateDashboard();
    } catch (error) {
        if (!silent) {
            alert(`车辆数据读取失败。\n${error.message}`);
        }
    }
}

async function loadRoutesFromApi(silent = false) {
    try {
        const [scheduleResponse, polylineResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/schedule-results`),
            fetch(`${API_BASE_URL}/route-polylines`)
        ]);
        const schedulePayload = await parseApiResponse(scheduleResponse);
        const polylinePayload = await parseApiResponse(polylineResponse);

        const grouped = new Map();
        (schedulePayload.schedule_stops || []).forEach((stop) => {
            if (!grouped.has(stop.vehicle_id)) {
                grouped.set(stop.vehicle_id, {
                    id: `V${stop.vehicle_id}`,
                    vehicleId: stop.vehicle_id,
                    name: stop.plate_number
                        ? `${stop.vehicle_code || `车辆${stop.vehicle_id}`} / ${stop.plate_number}`
                        : (stop.vehicle_code || `车辆${stop.vehicle_id}`),
                    color: '#2563EB',
                    schedule: [],
                    stopDetails: [],
                    roadPolyline: []
                });
            }
            const route = grouped.get(stop.vehicle_id);
            route.schedule.push({
                stationId: stop.station_id,
                stationName: stop.station_name,
                arr: stop.arrival_time || '-',
                dep: stop.departure_time || '-',
                feasible_flag: stop.feasible_flag,
                isDepot: Boolean(stop.is_depot)
            });
            route.stopDetails.push({
                stationId: stop.station_id,
                stationName: stop.station_name,
                lng: Number(stop.lng),
                lat: Number(stop.lat),
                isDepot: Boolean(stop.is_depot)
            });
        });

        state.routes = Array.from(grouped.values()).map((route, index) => ({
            ...route,
            color: buildRouteColor(index)
        }));

        (polylinePayload.routes || []).forEach((route) => {
            const target = state.routes.find((item) => item.vehicleId === route.vehicle_id);
            if (target) {
                target.roadPolyline = Array.isArray(route.polyline) ? route.polyline : [];
            }
        });
    } catch (error) {
        if (!silent) {
            alert(`调度结果读取失败。\n${error.message}`);
        }
    }
}

function handleLogin(event) {
    event.preventDefault();
    document.getElementById('login-view').classList.add('hidden-view');
    document.getElementById('admin-view').classList.remove('hidden-view');
    Promise.all([
        loadStationsFromApi(true),
        loadVehiclesFromApi(true),
        loadRoutesFromApi(true)
    ]).then(() => {
        updateDashboard();
        renderSimulationDetailDrawer();
        switchAdminTab('admin-dashboard');
    });
}

function logout() {
    pauseSimulationIterations();
    ['mapStation', 'mapRoute', 'mapSimulation'].forEach((key) => {
        if (state[key]) {
            state[key].destroy();
            state[key] = null;
        }
    });
    document.getElementById('admin-view').classList.add('hidden-view');
    document.getElementById('login-view').classList.remove('hidden-view');
    closeSimulationDetailDrawer();
}

function switchAdminTab(tabId) {
    if (tabId !== 'simulation-planning-view') {
        closeSimulationDetailDrawer();
    }
    document.querySelectorAll('.admin-tab-content').forEach((el) => el.classList.add('hidden-view'));
    document.getElementById(tabId).classList.remove('hidden-view');
    document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
    if (window.event?.currentTarget) {
        window.event.currentTarget.classList.add('active');
    } else {
        const tabMap = {
            'admin-dashboard': 0,
            'admin-stations': 1,
            'admin-vehicles': 2,
            'admin-routes': 3
        };
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems[tabMap[tabId]]) {
            navItems[tabMap[tabId]].classList.add('active');
        }
    }

    const titles = {
        'admin-dashboard': '系统概览',
        'admin-stations': '站点管理',
        'admin-vehicles': '车辆管理',
        'admin-routes': '调度展示'
    };
    document.getElementById('admin-header-title').innerText = titles[tabId];

    if (tabId === 'admin-stations') {
        setTimeout(initAdminStationMap, 80);
    }
    if (tabId === 'admin-vehicles') {
        renderVehicleTable();
    }
    if (tabId === 'admin-routes') {
        setTimeout(initPlanningViews, 80);
    }
    updateDashboard();
}

function setPlanningOverlayVisible(visible) {
    const overlay = document.getElementById('planning-overlay');
    overlay.classList.toggle('hidden-view', !visible);
}

function updatePlanningStep(stepIndex, text) {
    document.querySelectorAll('.planning-step').forEach((element, index) => {
        element.classList.toggle('active-step', index === stepIndex);
        element.classList.toggle('done-step', index < stepIndex);
    });
    const status = document.getElementById('planning-status-text');
    if (status) {
        status.innerText = text;
    }
}

function startPlanningOverlay() {
    if (state.planningOverlayTimer) {
        clearInterval(state.planningOverlayTimer);
    }
    setPlanningOverlayVisible(true);
    const steps = [
        '正在读取最新站点与车辆数据...',
        '正在生成真实路网距离与时间矩阵...',
        '正在执行蚁群算法搜索可行解...',
        '正在写回调度结果并刷新地图...'
    ];
    let current = 0;
    updatePlanningStep(current, steps[current]);
    state.planningOverlayTimer = setInterval(() => {
        current = Math.min(current + 1, steps.length - 1);
        updatePlanningStep(current, steps[current]);
    }, 1200);
}

function stopPlanningOverlay() {
    if (state.planningOverlayTimer) {
        clearInterval(state.planningOverlayTimer);
        state.planningOverlayTimer = null;
    }
    setPlanningOverlayVisible(false);
}

function getMapCenter() {
    const depot = state.stations.find((station) => station.is_depot);
    return depot ? [depot.lng, depot.lat] : SCHOOL_CENTER;
}

function stationToApiPayload(station) {
    return {
        station_name: station.name,
        address: station.address || '',
        lng: station.lng,
        lat: station.lat,
        demand: station.demand,
        service_time: station.service_time,
        time_window_start: station.tw_start,
        time_window_end: station.tw_end,
        is_depot: station.is_depot
    };
}

function initAdminStationMap() {
    if (!checkAMap()) return;
    if (state.mapStation) {
        state.mapStation.resize();
        renderStationMarkers();
        renderStationList();
        return;
    }
    state.mapStation = new AMap.Map('station-map-container', {
        zoom: 13,
        center: getMapCenter(),
        viewMode: '2D'
    });
    state.infoWindow = new AMap.InfoWindow({
        isCustom: true,
        offset: new AMap.Pixel(16, -45)
    });
    state.mapStation.on('click', (e) => {
        openStationFormWindow(null, e.lnglat.getLng(), e.lnglat.getLat());
    });

    AMap.plugin(['AMap.PlaceSearch', 'AMap.AutoComplete'], () => {
        const auto = new AMap.AutoComplete({ input: 'poi-search-input' });
        const placeSearch = new AMap.PlaceSearch({ map: state.mapStation });
        auto.on('select', (e) => {
            placeSearch.setCity(e.poi.adcode);
            placeSearch.search(e.poi.name, (status, result) => {
                if (status === 'complete' && result.info === 'OK' && result.poiList?.pois?.length) {
                    const poi = result.poiList.pois[0];
                    openStationFormWindow(null, poi.location.lng, poi.location.lat, poi.name);
                }
            });
        });
    });

    renderStationMarkers();
    renderStationList();
}

function renderStationMarkers() {
    if (!state.mapStation) return;
    if (state.stationMarkers.length > 0) {
        state.mapStation.remove(state.stationMarkers);
        state.stationMarkers = [];
    }

    state.stations.forEach((station) => {
        const marker = new AMap.Marker({
            position: [station.lng, station.lat],
            content: `<div style="background:${station.is_depot ? '#EF4444' : '#2563EB'};width:24px;height:24px;border-radius:9999px;color:#fff;line-height:24px;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)"><i class="fa-solid ${station.is_depot ? 'fa-school' : 'fa-bus-simple'} text-xs"></i></div>`,
            offset: new AMap.Pixel(-12, -12),
            extData: station
        });
        marker.on('click', (event) => openStationFormWindow(event.target.getExtData()));
        marker.setMap(state.mapStation);
        state.stationMarkers.push(marker);
    });
}

function renderStationList() {
    const container = document.getElementById('station-list-container');
    if (!container) return;
    if (state.stations.length === 0) {
        container.innerHTML = '<div class="p-4 text-sm text-gray-500">当前没有真实站点，请通过地图点击或搜索地点新增。</div>';
        return;
    }

    container.innerHTML = state.stations.map((station) => `
        <div class="mb-2 p-3 bg-white border rounded shadow-sm hover:border-blue-400 cursor-pointer" onclick="focusStation(${station.lng}, ${station.lat})">
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-gray-800 text-sm truncate w-40">${station.name}${station.is_depot ? ' <span class="text-xs bg-red-100 text-red-600 px-1 rounded">终点站</span>' : ''}</span>
                <span class="text-xs text-gray-500">${station.demand} 人</span>
            </div>
            <div class="text-xs text-gray-400">时间窗: ${station.tw_start} - ${station.tw_end} | 服务: ${station.service_time}m</div>
            <div class="mt-2 flex gap-2">
                <button onclick="event.stopPropagation(); openStationEditor(${station.id})" class="text-xs text-blue-600">编辑</button>
                <button onclick="event.stopPropagation(); deleteStation(${station.id})" class="text-xs text-red-600">删除</button>
            </div>
        </div>
    `).join('');
}

function focusStation(lng, lat) {
    if (!state.mapStation) return;
    state.mapStation.setCenter([lng, lat]);
    state.mapStation.setZoom(16);
}

function openStationFormWindow(station, lng, lat, defaultName = '') {
    const isEdit = !!station;
    const pos = isEdit ? [station.lng, station.lat] : [lng, lat];
    const html = `
        <div class="custom-info-window relative">
            <button class="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onclick="state.infoWindow.close()">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h3 class="font-bold text-gray-800 mb-3 border-b pb-2">${isEdit ? '编辑站点' : '新增站点'}</h3>
            <div class="space-y-2">
                <div><label class="text-xs text-gray-500 block">站点名称</label><input type="text" id="fm-name" class="form-input-sm" value="${isEdit ? station.name : defaultName}"></div>
                <div class="flex gap-2">
                    <div class="flex-1"><label class="text-xs text-gray-500 block">经度</label><input type="text" id="fm-lng" class="form-input-sm bg-gray-50" readonly value="${pos[0]}"></div>
                    <div class="flex-1"><label class="text-xs text-gray-500 block">纬度</label><input type="text" id="fm-lat" class="form-input-sm bg-gray-50" readonly value="${pos[1]}"></div>
                </div>
                <div class="flex gap-2">
                    <div class="flex-1"><label class="text-xs text-gray-500 block">需求人数</label><input type="number" id="fm-demand" class="form-input-sm" value="${isEdit ? station.demand : '0'}"></div>
                    <div class="flex-1"><label class="text-xs text-gray-500 block">服务时间</label><input type="number" id="fm-serv" class="form-input-sm" value="${isEdit ? station.service_time : '2'}"></div>
                </div>
                <div class="flex gap-2">
                    <div class="flex-1"><label class="text-xs text-gray-500 block">时间窗始</label><input type="time" id="fm-tws" class="form-input-sm" value="${isEdit ? station.tw_start : '07:00'}"></div>
                    <div class="flex-1"><label class="text-xs text-gray-500 block">时间窗终</label><input type="time" id="fm-twe" class="form-input-sm" value="${isEdit ? station.tw_end : '08:00'}"></div>
                </div>
                <div class="flex items-center mt-2">
                    <input type="checkbox" id="fm-depot" class="mr-2" ${isEdit && station.is_depot ? 'checked' : ''}>
                    <label class="text-sm font-semibold text-gray-700">设为终点站</label>
                </div>
            </div>
            <div class="mt-4 flex gap-2">
                <button onclick="saveStation(${isEdit ? station.id : 'null'})" class="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm">保存</button>
                ${isEdit ? `<button onclick="deleteStation(${station.id})" class="flex-1 bg-red-100 text-red-600 py-1.5 rounded text-sm">删除</button>` : ''}
            </div>
        </div>
    `;

    state.infoWindow.setContent(html);
    state.infoWindow.open(state.mapStation, pos);
    if (!isEdit) {
        if (state.tempMarker) state.mapStation.remove(state.tempMarker);
        state.tempMarker = new AMap.Marker({
            position: pos,
            icon: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png'
        });
        state.tempMarker.setMap(state.mapStation);
    }
}

function openStationEditor(id) {
    const station = state.stations.find((item) => item.id === id);
    if (station) {
        openStationFormWindow(station);
    }
}

async function saveStation(id) {
    const data = {
        name: document.getElementById('fm-name').value,
        lng: parseFloat(document.getElementById('fm-lng').value),
        lat: parseFloat(document.getElementById('fm-lat').value),
        demand: parseInt(document.getElementById('fm-demand').value, 10),
        service_time: parseInt(document.getElementById('fm-serv').value, 10),
        tw_start: document.getElementById('fm-tws').value,
        tw_end: document.getElementById('fm-twe').value,
        is_depot: document.getElementById('fm-depot').checked
    };
    if (!data.name) {
        alert('站点名称不能为空');
        return;
    }

    try {
        const response = await fetch(id ? `${API_BASE_URL}/stations/${id}` : `${API_BASE_URL}/stations`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stationToApiPayload(data))
        });
        await parseApiResponse(response);
        await loadStationsFromApi(true);
        renderStationMarkers();
        renderStationList();
        state.infoWindow.close();
        if (state.tempMarker) {
            state.mapStation.remove(state.tempMarker);
            state.tempMarker = null;
        }
        alert('站点保存成功。');
    } catch (error) {
        alert(`站点保存失败。\n${error.message}`);
    }
}

async function deleteStation(id) {
    if (!confirm('确定要删除该站点吗？')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/stations/${id}`, { method: 'DELETE' });
        await parseApiResponse(response);
        await loadStationsFromApi(true);
        renderStationMarkers();
        renderStationList();
        state.infoWindow?.close();
    } catch (error) {
        alert(`删除站点失败。\n${error.message}`);
    }
}

async function addSchoolDepot() {
    if (state.stations.some((station) => station.is_depot)) {
        alert('当前已经存在终点站，请直接编辑现有终点站。');
        return;
    }

    const depotPayload = {
        name: '西安财经大学长安校区东大门',
        address: '西安财经大学长安校区东大门',
        lng: SCHOOL_CENTER[0],
        lat: SCHOOL_CENTER[1],
        demand: 0,
        service_time: 1,
        tw_start: '07:00',
        tw_end: '07:50',
        is_depot: true
    };

    try {
        const response = await fetch(`${API_BASE_URL}/stations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stationToApiPayload(depotPayload))
        });
        await parseApiResponse(response);
        await loadStationsFromApi(true);
        renderStationMarkers();
        renderStationList();
        alert('学校终点站已添加。');
    } catch (error) {
        alert(`添加学校终点站失败。\n${error.message}`);
    }
}

function renderVehicleTable() {
    const tbody = document.getElementById('vehicle-table-body');
    if (!tbody) return;
    if (state.vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-6 text-sm text-gray-500 text-center">当前没有车辆，请先新增车辆。</td></tr>';
        return;
    }

    tbody.innerHTML = state.vehicles.map((vehicle) => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.vehicle_code}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${vehicle.plate_number}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.capacity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.start_depot || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.earliest_departure_time || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <button onclick="openVehicleForm(${vehicle.id})" class="text-blue-600 mr-3">编辑</button>
                <button onclick="deleteVehicle(${vehicle.id})" class="text-red-600">删除</button>
            </td>
        </tr>
    `).join('');
}

function openVehicleForm(id = null) {
    const vehicle = id ? state.vehicles.find((item) => item.id === id) : null;
    const plateNumber = prompt('请输入车牌号', vehicle ? vehicle.plate_number : '');
    if (plateNumber === null || !plateNumber.trim()) return;
    const capacityValue = prompt('请输入容量', vehicle ? String(vehicle.capacity) : '20');
    if (capacityValue === null || !capacityValue.trim()) return;
    const startDepot = prompt('请输入起始车场', vehicle ? vehicle.start_depot : '西安财经大学长安校区东大门');
    if (startDepot === null) return;
    const endDepot = prompt('请输入终点站', vehicle ? vehicle.end_depot : '西安财经大学长安校区东大门');
    if (endDepot === null) return;
    const driverName = prompt('请输入司机姓名', vehicle ? vehicle.driver_name : '');
    if (driverName === null) return;
    const driverPhone = prompt('请输入司机电话', vehicle ? vehicle.driver_phone : '');
    if (driverPhone === null) return;
    const maxRunMinutes = prompt('请输入最大运行时长(分钟)', vehicle ? String(vehicle.max_run_minutes) : '120');
    if (maxRunMinutes === null || !maxRunMinutes.trim()) return;
    const earliestDeparture = prompt('请输入最早发车时间(HH:MM)', vehicle ? vehicle.earliest_departure_time : '06:40');
    if (earliestDeparture === null || !earliestDeparture.trim()) return;

    saveVehicle(id, {
        plate_number: plateNumber.trim(),
        capacity: Number(capacityValue),
        start_depot: startDepot.trim(),
        end_depot: endDepot.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        status: vehicle ? vehicle.status : 'idle',
        max_run_minutes: Number(maxRunMinutes),
        earliest_departure_time: earliestDeparture.trim()
    });
}

async function saveVehicle(id, payload) {
    try {
        const response = await fetch(id ? `${API_BASE_URL}/vehicles/${id}` : `${API_BASE_URL}/vehicles`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await parseApiResponse(response);
        await loadVehiclesFromApi(true);
        renderVehicleTable();
        alert('车辆保存成功。');
    } catch (error) {
        alert(`车辆保存失败。\n${error.message}`);
    }
}

async function deleteVehicle(id) {
    if (!confirm('确定要删除这辆车吗？')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles/${id}`, { method: 'DELETE' });
        await parseApiResponse(response);
        await loadVehiclesFromApi(true);
        renderVehicleTable();
    } catch (error) {
        alert(`车辆删除失败。\n${error.message}`);
    }
}

function switchPlanningMode(mode) {
    state.planningMode = mode;
    document.getElementById('real-mode-btn').classList.toggle('active', mode === 'real');
    document.getElementById('simulation-mode-btn').classList.toggle('active', mode === 'simulation');
    document.getElementById('real-planning-view').classList.toggle('hidden-view', mode !== 'real');
    document.getElementById('simulation-planning-view').classList.toggle('hidden-view', mode !== 'simulation');
    document.getElementById('real-plan-btn').classList.toggle('hidden-view', mode !== 'real');
    updateDashboard();

    if (mode === 'real') {
        setTimeout(initRealRouteMap, 50);
    } else {
        setTimeout(initSimulationMap, 50);
        setTimeout(renderAlgorithmMath, 60);
        renderSimulationStationList();
        renderSimulationVehicleList();
        renderSimulationStatus();
        renderSimulationChart();
        renderSimulationFinalRoutes();
    }
}

function initPlanningViews() {
    switchPlanningMode(state.planningMode);
}

function clearRealRouteMap() {
    if (!state.mapRoute) return;
    if (state.realRoutePolylines.length > 0) {
        state.mapRoute.remove(state.realRoutePolylines);
        state.realRoutePolylines = [];
    }
    if (state.realRouteMarkers.length > 0) {
        state.mapRoute.remove(state.realRouteMarkers);
        state.realRouteMarkers = [];
    }
}

function initRealRouteMap() {
    if (!checkAMap()) return;
    if (!state.mapRoute) {
        state.mapRoute = new AMap.Map('route-map-container', {
            zoom: 13,
            center: getMapCenter(),
            viewMode: '2D'
        });
    } else {
        state.mapRoute.resize();
    }
    clearRealRouteMap();
    drawRealRoutesOnMap();
    renderRealRouteDetails();
}

function drawRealRoutesOnMap() {
    if (!state.mapRoute || state.routes.length === 0) return;

    state.routes.forEach((route, routeIndex) => {
        const path = Array.isArray(route.roadPolyline) && route.roadPolyline.length > 1
            ? route.roadPolyline.map((point) => [point.lng, point.lat])
            : route.stopDetails.map((stop) => [stop.lng, stop.lat]);

        const polyline = new AMap.Polyline({
            path,
            strokeColor: route.color,
            strokeOpacity: 0.92,
            strokeWeight: 6,
            strokeStyle: routeIndex % 2 === 1 ? 'dashed' : 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            isOutline: true,
            outlineColor: '#ffffff',
            borderWeight: 2
        });
        polyline.setMap(state.mapRoute);
        state.realRoutePolylines.push(polyline);

        route.stopDetails.forEach((stop, index) => {
            const marker = new AMap.Marker({
                position: [stop.lng, stop.lat],
                content: `<div style="width:24px;height:24px;border-radius:9999px;background:${route.color};color:#fff;font-size:12px;line-height:24px;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${index + 1}</div>`,
                offset: new AMap.Pixel(-12, -12)
            });
            marker.setMap(state.mapRoute);
            state.realRouteMarkers.push(marker);
        });
    });

    state.mapRoute.setFitView();
}

function renderRealRouteDetails() {
    const container = document.getElementById('route-details-container');
    if (!container) return;
    if (state.routes.length === 0) {
        container.innerHTML = '<div class="text-sm text-gray-500">暂无可展示的真实调度结果，请先执行调度。</div>';
        return;
    }

    container.innerHTML = state.routes.map((route) => `
        <div class="real-route-card route-card" style="--route-accent:${route.color};">
            <div class="real-route-card-header">
                <div class="real-route-card-title-wrap">
                    <span class="real-route-color-dot"></span>
                    <span class="real-route-card-title"><i class="fa-solid fa-car-side mr-2"></i>${route.name}</span>
                </div>
                <span class="real-route-status">可行</span>
            </div>
            <div class="real-route-card-body">
                <div class="real-route-timeline">
                    ${route.schedule.map((point, index) => `
                        <div class="real-route-stop-row">
                            <div class="real-route-stop-dot ${point.isDepot ? 'depot' : 'customer'}"></div>
                            <div class="real-route-stop-content">
                                <div>
                                    <p class="real-route-stop-name">${index + 1}. ${point.stationName}</p>
                                    <p class="real-route-stop-time">到达: ${point.arr} | 离开: ${point.dep}</p>
                                </div>
                                ${!point.isDepot ? `<div class="real-route-stop-tag">站点</div>` : '<div class="real-route-stop-tag depot">终点</div>'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

async function runPlanning() {
    startPlanningOverlay();
    try {
        const response = await fetch(`${API_BASE_URL}/plan`, { method: 'POST' });
        const result = await parseApiResponse(response);
        if (!result.success || !result.feasible || !result.schedule_rows) {
            throw new Error(result.message || '当前未生成可行调度结果。');
        }
        updatePlanningStep(3, '调度结果已生成，正在刷新地图...');
        await loadStationsFromApi(true);
        await loadVehiclesFromApi(true);
        await loadRoutesFromApi(true);
        initRealRouteMap();
        renderStationMarkers();
        renderStationList();
        alert(`调度完成。生成 ${result.schedule_rows} 条结果，目标距离 ${result.objective_value} km。`);
    } catch (error) {
        alert(`重新规划失败。\n${error.message}`);
    } finally {
        stopPlanningOverlay();
    }
}

function initSimulationMap() {
    if (!checkAMap()) return;
    if (!state.mapSimulation) {
        state.mapSimulation = new AMap.Map('simulation-map-container', {
            zoom: 13,
            center: SCHOOL_CENTER,
            viewMode: '2D'
        });
        state.mapSimulation.on('click', (event) => {
            if (!state.simulationCreateMode) return;
            openSimulationStationPrompt(null, event.lnglat.getLng(), event.lnglat.getLat(), state.simulationCreateMode);
        });
    } else {
        state.mapSimulation.resize();
    }
    renderSimulationScene();
}

function setSimulationCreateMode(mode) {
    state.simulationCreateMode = mode;
    document.getElementById('simulation-create-mode-label').innerText = mode === 'customer'
        ? '新增模拟站点'
        : mode === 'depot'
            ? '设置终点站'
            : '无';
}

function nextSimulationStationId() {
    return state.simulationStations.reduce((max, station) => Math.max(max, station.id), 0) + 1;
}

function nextSimulationVehicleId() {
    return state.simulationVehicles.reduce((max, vehicle) => Math.max(max, vehicle.id), 0) + 1;
}

function openSimulationStationPrompt(existing, lng, lat, createType = 'customer') {
    const stationName = prompt('请输入模拟站点名称', existing ? existing.name : (createType === 'depot' ? '校园终点站' : `模拟站点${nextSimulationStationId()}`));
    if (stationName === null || !stationName.trim()) return;
    const demand = prompt('请输入需求人数', existing ? String(existing.demand) : (createType === 'depot' ? '0' : '6'));
    if (demand === null || !demand.trim()) return;
    const serviceMinutes = prompt('请输入服务时间(分钟)', existing ? String(existing.service_minutes) : '2');
    if (serviceMinutes === null || !serviceMinutes.trim()) return;
    const twStart = prompt('请输入时间窗开始(HH:MM)', existing ? existing.time_window_start : (createType === 'depot' ? '07:00' : '06:40'));
    if (twStart === null || !twStart.trim()) return;
    const twEnd = prompt('请输入时间窗结束(HH:MM)', existing ? existing.time_window_end : (createType === 'depot' ? '07:50' : '07:30'));
    if (twEnd === null || !twEnd.trim()) return;
    const isDepot = existing ? existing.is_depot : createType === 'depot';

    const station = {
        id: existing ? existing.id : nextSimulationStationId(),
        name: stationName.trim(),
        lng,
        lat,
        demand: Number(demand),
        service_minutes: Number(serviceMinutes),
        time_window_start: twStart.trim(),
        time_window_end: twEnd.trim(),
        is_depot: isDepot
    };

    if (!existing && isDepot) {
        state.simulationStations = state.simulationStations.filter((item) => !item.is_depot);
    }
    if (existing) {
        state.simulationStations = state.simulationStations.map((item) => item.id === existing.id ? station : item);
    } else {
        state.simulationStations.push(station);
    }

    renderSimulationScene();
    renderSimulationStationList();
}

function editSimulationStation(id) {
    const station = state.simulationStations.find((item) => item.id === id);
    if (!station) return;
    openSimulationStationPrompt(station, station.lng, station.lat, station.is_depot ? 'depot' : 'customer');
}

function deleteSimulationStation(id) {
    state.simulationStations = state.simulationStations.filter((item) => item.id !== id);
    renderSimulationScene();
    renderSimulationStationList();
}

function openSimulationVehicleForm(id = null) {
    const vehicle = id ? state.simulationVehicles.find((item) => item.id === id) : null;
    const code = prompt('请输入模拟车辆编号', vehicle ? vehicle.code : `SIM-V${nextSimulationVehicleId()}`);
    if (code === null || !code.trim()) return;
    const capacity = prompt('请输入容量', vehicle ? String(vehicle.capacity) : '20');
    if (capacity === null || !capacity.trim()) return;
    const maxRun = prompt('请输入最大运行时长(分钟)', vehicle ? String(vehicle.max_run_minutes) : '120');
    if (maxRun === null || !maxRun.trim()) return;
    const earliest = prompt('请输入最早发车时间(HH:MM)', vehicle ? vehicle.earliest_departure_time : '06:40');
    if (earliest === null || !earliest.trim()) return;

    const next = {
        id: vehicle ? vehicle.id : nextSimulationVehicleId(),
        code: code.trim(),
        capacity: Number(capacity),
        max_run_minutes: Number(maxRun),
        earliest_departure_time: earliest.trim()
    };
    if (vehicle) {
        state.simulationVehicles = state.simulationVehicles.map((item) => item.id === vehicle.id ? next : item);
    } else {
        state.simulationVehicles.push(next);
    }
    renderSimulationVehicleList();
}

function deleteSimulationVehicle(id) {
    state.simulationVehicles = state.simulationVehicles.filter((item) => item.id !== id);
    renderSimulationVehicleList();
}

function renderSimulationScene() {
    if (!state.mapSimulation) return;
    if (state.simulationMarkers.length > 0) {
        state.mapSimulation.remove(state.simulationMarkers);
        state.simulationMarkers = [];
    }

    state.simulationStations.forEach((station, index) => {
        const marker = new AMap.Marker({
            position: [station.lng, station.lat],
            content: `<div style="background:${station.is_depot ? '#EF4444' : '#2563EB'};width:28px;height:28px;border-radius:9999px;color:#fff;line-height:28px;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${station.is_depot ? 'D' : index + 1}</div>`,
            offset: new AMap.Pixel(-14, -14)
        });
        marker.on('click', () => editSimulationStation(station.id));
        marker.setMap(state.mapSimulation);
        state.simulationMarkers.push(marker);
    });

    renderSimulationIteration(state.simulationPlaybackIndex);
    if (state.simulationStations.length > 0) {
        state.mapSimulation.setFitView();
    }
}

function clearSimulationRouteOverlays() {
    if (!state.mapSimulation) return;
    if (state.simulationRouteOverlays.length > 0) {
        state.mapSimulation.remove(state.simulationRouteOverlays);
        state.simulationRouteOverlays = [];
    }
}

function renderSimulationStationList() {
    const container = document.getElementById('simulation-station-list');
    if (!container) return;
    if (state.simulationStations.length === 0) {
        container.innerHTML = '<div class="text-sm text-gray-400">当前没有模拟站点。</div>';
        return;
    }
    container.innerHTML = state.simulationStations.map((station) => `
        <div class="simulation-card">
            <div class="flex justify-between items-center">
                <div class="simulation-card-title">${station.name}${station.is_depot ? ' <span class="text-red-600">[终点]</span>' : ''}</div>
                <div class="flex gap-2 text-xs">
                    <button onclick="editSimulationStation(${station.id})" class="text-blue-600">编辑</button>
                    <button onclick="deleteSimulationStation(${station.id})" class="text-red-600">删除</button>
                </div>
            </div>
            <div class="simulation-card-meta">需求 ${station.demand} 人 | 服务 ${station.service_minutes}m | 时间窗 ${station.time_window_start}-${station.time_window_end}</div>
        </div>
    `).join('');
}

function renderSimulationVehicleList() {
    const container = document.getElementById('simulation-vehicle-list');
    if (!container) return;
    if (state.simulationVehicles.length === 0) {
        container.innerHTML = '<div class="text-sm text-gray-400">当前没有模拟车辆。</div>';
        return;
    }
    container.innerHTML = state.simulationVehicles.map((vehicle) => `
        <div class="simulation-card">
            <div class="flex justify-between items-center">
                <div class="simulation-card-title">${vehicle.code}</div>
                <div class="flex gap-2 text-xs">
                    <button onclick="openSimulationVehicleForm(${vehicle.id})" class="text-blue-600">编辑</button>
                    <button onclick="deleteSimulationVehicle(${vehicle.id})" class="text-red-600">删除</button>
                </div>
            </div>
            <div class="simulation-card-meta">容量 ${vehicle.capacity} | 最早发车 ${vehicle.earliest_departure_time} | 最大运行 ${vehicle.max_run_minutes}m</div>
        </div>
    `).join('');
}

function loadSimulationSample(type) {
    const baseStations = {
        small: [
            { id: 1, name: '教学区终点站', lng: 108.9514, lat: 34.1579, demand: 0, service_minutes: 1, time_window_start: '07:00', time_window_end: '07:50', is_depot: true },
            { id: 2, name: '模拟站点A', lng: 108.9372, lat: 34.1691, demand: 7, service_minutes: 2, time_window_start: '06:40', time_window_end: '07:10', is_depot: false },
            { id: 3, name: '模拟站点B', lng: 108.9475, lat: 34.1725, demand: 5, service_minutes: 2, time_window_start: '06:50', time_window_end: '07:18', is_depot: false },
            { id: 4, name: '模拟站点C', lng: 108.9605, lat: 34.1673, demand: 6, service_minutes: 2, time_window_start: '06:55', time_window_end: '07:25', is_depot: false },
            { id: 5, name: '模拟站点D', lng: 108.9436, lat: 34.1533, demand: 4, service_minutes: 2, time_window_start: '06:45', time_window_end: '07:20', is_depot: false }
        ],
        medium: [
            { id: 1, name: '教学区终点站', lng: 108.9514, lat: 34.1579, demand: 0, service_minutes: 1, time_window_start: '07:00', time_window_end: '07:50', is_depot: true },
            { id: 2, name: '模拟站点A', lng: 108.9348, lat: 34.1706, demand: 6, service_minutes: 2, time_window_start: '06:38', time_window_end: '07:08', is_depot: false },
            { id: 3, name: '模拟站点B', lng: 108.9429, lat: 34.1741, demand: 5, service_minutes: 2, time_window_start: '06:41', time_window_end: '07:12', is_depot: false },
            { id: 4, name: '模拟站点C', lng: 108.9598, lat: 34.1704, demand: 6, service_minutes: 2, time_window_start: '06:48', time_window_end: '07:18', is_depot: false },
            { id: 5, name: '模拟站点D', lng: 108.9684, lat: 34.1618, demand: 5, service_minutes: 2, time_window_start: '06:52', time_window_end: '07:22', is_depot: false },
            { id: 6, name: '模拟站点E', lng: 108.9642, lat: 34.1497, demand: 7, service_minutes: 2, time_window_start: '06:49', time_window_end: '07:19', is_depot: false },
            { id: 7, name: '模拟站点F', lng: 108.9441, lat: 34.1459, demand: 4, service_minutes: 2, time_window_start: '06:42', time_window_end: '07:12', is_depot: false },
            { id: 8, name: '模拟站点G', lng: 108.9361, lat: 34.1538, demand: 5, service_minutes: 2, time_window_start: '06:40', time_window_end: '07:14', is_depot: false },
            { id: 9, name: '模拟站点H', lng: 108.9527, lat: 34.1662, demand: 6, service_minutes: 2, time_window_start: '06:46', time_window_end: '07:20', is_depot: false },
            { id: 10, name: '模拟站点I', lng: 108.9715, lat: 34.1543, demand: 4, service_minutes: 2, time_window_start: '06:54', time_window_end: '07:24', is_depot: false }
        ],
        large: [
            { id: 1, name: '教学区终点站', lng: 108.9514, lat: 34.1579, demand: 0, service_minutes: 1, time_window_start: '07:05', time_window_end: '07:55', is_depot: true },
            { id: 2, name: '模拟站点A', lng: 108.9298, lat: 34.1718, demand: 5, service_minutes: 2, time_window_start: '06:28', time_window_end: '06:56', is_depot: false },
            { id: 3, name: '模拟站点B', lng: 108.9367, lat: 34.1744, demand: 4, service_minutes: 2, time_window_start: '06:31', time_window_end: '07:00', is_depot: false },
            { id: 4, name: '模拟站点C', lng: 108.9449, lat: 34.1712, demand: 5, service_minutes: 2, time_window_start: '06:36', time_window_end: '07:05', is_depot: false },
            { id: 5, name: '模拟站点D', lng: 108.9624, lat: 34.1737, demand: 4, service_minutes: 2, time_window_start: '06:42', time_window_end: '07:12', is_depot: false },
            { id: 6, name: '模拟站点E', lng: 108.9728, lat: 34.1659, demand: 5, service_minutes: 2, time_window_start: '06:47', time_window_end: '07:16', is_depot: false },
            { id: 7, name: '模拟站点F', lng: 108.9686, lat: 34.1511, demand: 6, service_minutes: 2, time_window_start: '06:45', time_window_end: '07:18', is_depot: false },
            { id: 8, name: '模拟站点G', lng: 108.9617, lat: 34.1445, demand: 4, service_minutes: 2, time_window_start: '06:43', time_window_end: '07:14', is_depot: false },
            { id: 9, name: '模拟站点H', lng: 108.9502, lat: 34.1417, demand: 5, service_minutes: 2, time_window_start: '06:41', time_window_end: '07:12', is_depot: false },
            { id: 10, name: '模拟站点I', lng: 108.9391, lat: 34.1452, demand: 4, service_minutes: 2, time_window_start: '06:38', time_window_end: '07:08', is_depot: false },
            { id: 11, name: '模拟站点J', lng: 108.9327, lat: 34.1536, demand: 4, service_minutes: 2, time_window_start: '06:34', time_window_end: '07:04', is_depot: false },
            { id: 12, name: '模拟站点K', lng: 108.9404, lat: 34.1635, demand: 3, service_minutes: 2, time_window_start: '06:33', time_window_end: '07:02', is_depot: false },
            { id: 13, name: '模拟站点L', lng: 108.9586, lat: 34.1666, demand: 4, service_minutes: 2, time_window_start: '06:44', time_window_end: '07:15', is_depot: false },
            { id: 14, name: '模拟站点M', lng: 108.9473, lat: 34.1519, demand: 5, service_minutes: 2, time_window_start: '06:39', time_window_end: '07:10', is_depot: false },
            { id: 15, name: '模拟站点N', lng: 108.9734, lat: 34.1584, demand: 4, service_minutes: 2, time_window_start: '06:50', time_window_end: '07:20', is_depot: false }
        ]
    };

    const baseVehicles = {
        small: [
            { id: 1, code: 'SIM-V1', capacity: 15, max_run_minutes: 120, earliest_departure_time: '06:40' },
            { id: 2, code: 'SIM-V2', capacity: 15, max_run_minutes: 120, earliest_departure_time: '06:40' }
        ],
        medium: [
            { id: 1, code: 'SIM-V1', capacity: 18, max_run_minutes: 120, earliest_departure_time: '06:40' },
            { id: 2, code: 'SIM-V2', capacity: 18, max_run_minutes: 125, earliest_departure_time: '06:38' },
            { id: 3, code: 'SIM-V3', capacity: 14, max_run_minutes: 125, earliest_departure_time: '06:44' }
        ],
        large: [
            { id: 1, code: 'SIM-V1', capacity: 18, max_run_minutes: 145, earliest_departure_time: '06:28' },
            { id: 2, code: 'SIM-V2', capacity: 18, max_run_minutes: 145, earliest_departure_time: '06:30' },
            { id: 3, code: 'SIM-V3', capacity: 16, max_run_minutes: 145, earliest_departure_time: '06:32' },
            { id: 4, code: 'SIM-V4', capacity: 14, max_run_minutes: 140, earliest_departure_time: '06:34' },
            { id: 5, code: 'SIM-V5', capacity: 12, max_run_minutes: 140, earliest_departure_time: '06:36' }
        ]
    };

    state.simulationStations = baseStations[type].map((item) => ({ ...item }));
    state.simulationVehicles = baseVehicles[type].map((item) => ({ ...item }));
    state.simulationResult = null;
    state.simulationPlaybackIndex = 0;
    pauseSimulationIterations();
    renderSimulationScene();
    renderSimulationStationList();
    renderSimulationVehicleList();
    renderSimulationStatus();
    renderSimulationChart();
    renderSimulationFinalRoutes();
}

function clearSimulationScene() {
    pauseSimulationIterations();
    closeSimulationDetailDrawer();
    state.simulationStations = [];
    state.simulationVehicles = [];
    state.simulationResult = null;
    state.simulationPlaybackIndex = 0;
    renderSimulationScene();
    renderSimulationStationList();
    renderSimulationVehicleList();
    renderSimulationStatus();
    renderSimulationChart();
    renderSimulationFinalRoutes();
}

function summarizeSimulationScene() {
    const demand = state.simulationStations
        .filter((station) => !station.is_depot)
        .reduce((sum, station) => sum + Number(station.demand || 0), 0);
    const capacity = state.simulationVehicles.reduce((sum, vehicle) => sum + Number(vehicle.capacity || 0), 0);
    return { demand, capacity };
}

function renderSimulationStatus() {
    const container = document.getElementById('simulation-iteration-status');
    if (!container) return;
    if (!state.simulationResult || !Array.isArray(state.simulationResult.iterations) || state.simulationResult.iterations.length === 0) {
        container.innerHTML = '<div class="simulation-empty">当前未运行模拟调度。<br/>运行一次模拟后，这里会显示迭代过程中的关键指标。</div>';
        return;
    }

    const iterations = state.simulationResult.iterations;
    const current = iterations[Math.min(state.simulationPlaybackIndex, iterations.length - 1)];
    const progressPercent = Math.round((current.iteration / Math.max(1, iterations.length)) * 100);
    container.innerHTML = `
        <div class="simulation-status-hero">
            <div class="simulation-status-caption">当前播放到蚁群算法第 ${current.iteration} 轮 <span class="info-tip" tabindex="0" data-tooltip="迭代轮次表示蚁群算法当前执行到第几轮搜索。每一轮中，多只蚂蚁都会各自构造一组候选路径，并据此更新信息素。">?</span></div>
            <div class="simulation-status-row">
                <div>
                    <div class="simulation-status-value">${current.iteration}</div>
                    <div class="simulation-status-caption">当前轮次</div>
                </div>
                <div class="simulation-status-side">
                    <div class="simulation-status-side-label">当前最优值 <span class="info-tip" tabindex="0" data-tooltip="当前最优值表示在这一轮迭代结束后，所有蚂蚁中找到的最短总路径距离。数值越小，说明当前路径方案越优。">?</span></div>
                    <div class="simulation-status-side-value">${current.best_objective.toFixed(2)} km</div>
                </div>
            </div>
            <div class="simulation-progress-track">
                <div class="simulation-progress-fill" style="width: ${progressPercent}%;"></div>
            </div>
            <div class="simulation-progress-meta">
                <span>迭代进度 ${progressPercent}%</span>
                <span>共 ${iterations.length} 轮</span>
            </div>
        </div>
        <div class="simulation-status-grid">
            <div class="simulation-metric-card">
                <div class="simulation-metric-label">可行蚂蚁数 <span class="info-tip" tabindex="0" data-tooltip="可行蚂蚁数表示在当前轮次中，成功构造出满足容量约束、时间窗约束等条件的蚂蚁解数量。数量越多，说明当前搜索空间中可行方案越丰富。">?</span></div>
                <div class="simulation-metric-value">${current.feasible_ant_count}</div>
            </div>
            <div class="simulation-metric-card">
                <div class="simulation-metric-label">总运行时长 <span class="info-tip" tabindex="0" data-tooltip="总运行时长表示当前最优解下，所有车辆累计行驶与服务的总时间，用于衡量调度方案的整体执行成本。">?</span></div>
                <div class="simulation-metric-value">${current.total_runtime_minutes}<span class="simulation-metric-unit">min</span></div>
            </div>
            <div class="simulation-metric-card">
                <div class="simulation-metric-label">当前可行性 <span class="info-tip" tabindex="0" data-tooltip="当前可行性表示当前轮次找到的最优解是否满足系统中的约束条件，包括容量约束、硬时间窗、最早发车时间和终点站约束。">?</span></div>
                <div class="simulation-feasible-tag ${current.feasible ? 'ok' : 'bad'}">${current.feasible ? '可行' : '不可行'}</div>
            </div>
            <div class="simulation-metric-card">
                <div class="simulation-metric-label">当前最优解状态</div>
                <div class="simulation-metric-value">${current.best_routes?.length || 0}<span class="simulation-metric-unit">条路径</span></div>
            </div>
        </div>
    `;
}

function renderSimulationChart() {
    const container = document.getElementById('simulation-chart-container');
    if (!container) return;
    const iterations = state.simulationResult?.iterations || [];
    if (iterations.length === 0) {
        container.innerHTML = '<div class="simulation-empty">运行模拟调度后，这里会展示算法收敛趋势和当前播放位置。</div>';
        return;
    }

    const hasIterationSeries = iterations.some((item) => item.iteration_best_objective != null);
    const iterationValues = iterations.map((item) => {
        if (item.iteration_best_objective != null) return Number(item.iteration_best_objective);
        if (item.best_objective != null) return Number(item.best_objective);
        return null;
    });
    const globalValues = iterations.map((item) => {
        if (item.global_best_objective != null) return Number(item.global_best_objective);
        if (item.best_objective != null) return Number(item.best_objective);
        return null;
    });
    const allValues = [...iterationValues, ...globalValues].filter((value) => Number.isFinite(value));
    if (allValues.length === 0) {
        container.innerHTML = '<div class="simulation-empty">当前模拟结果中没有可绘制的目标值数据。请确认后端已返回可行解，或重新运行一次模拟调度。</div>';
        return;
    }

    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    const startValue = globalValues.find((value) => Number.isFinite(value)) ?? allValues[0];
    const currentIndex = Math.min(state.simulationPlaybackIndex, iterations.length - 1);
    const currentIterationValue = iterationValues[currentIndex] ?? globalValues[currentIndex] ?? allValues[allValues.length - 1];
    const currentGlobalValue = globalValues[currentIndex] ?? currentIterationValue;
    const improvement = startValue - currentGlobalValue;
    const recentGlobalValues = globalValues.filter((value) => Number.isFinite(value)).slice(-5);
    const stabilized =
        recentGlobalValues.length >= 3 &&
        recentGlobalValues.every((value) => Math.abs(value - recentGlobalValues[recentGlobalValues.length - 1]) < 1e-6);
    const width = 360;
    const height = 220;
    const chartLeft = 44;
    const chartRight = width - 18;
    const chartTop = 20;
    const chartBottom = height - 36;
    const chartHeight = chartBottom - chartTop;
    const chartWidth = chartRight - chartLeft;

    const getPoint = (value, index) => {
        const x = chartLeft + (index / Math.max(1, iterations.length - 1)) * chartWidth;
        const y = chartTop + ((maxValue - value) / Math.max(1e-6, maxValue - minValue || 1)) * chartHeight;
        return { x, y };
    };

    const buildSeriesPoints = (series) => series
        .map((value, index) => {
            if (!Number.isFinite(value)) return null;
            const point = getPoint(value, index);
            return `${point.x},${point.y}`;
        })
        .filter(Boolean)
        .join(' ');

    const iterationPoints = buildSeriesPoints(iterationValues);
    const globalPoints = buildSeriesPoints(globalValues);
    const areaPoints = `${chartLeft},${chartBottom} ${iterationPoints} ${chartRight},${chartBottom}`;
    const currentPoint = getPoint(currentGlobalValue, currentIndex);
    const guideValues = [
        maxValue,
        maxValue - (maxValue - minValue) / 2,
        minValue
    ];
    const guideLines = guideValues.map((value) => {
        const y = getPoint(value, 0).y;
        return `
            <line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"></line>
            <text x="${chartLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#94a3b8">${value.toFixed(2)}</text>
        `;
    }).join('');

    const markers = globalValues.map((value, index) => {
        if (!Number.isFinite(value)) {
            return '';
        }
        const point = getPoint(value, index);
        const active = index === currentIndex;
        return `
            <circle cx="${point.x}" cy="${point.y}" r="${active ? 5 : 3}" fill="${active ? '#0f766e' : '#99f6e4'}" stroke="#ffffff" stroke-width="2"></circle>
        `;
    }).join('');

    container.innerHTML = `
        <div class="simulation-chart-header">
            <div class="simulation-chart-stat">
                <div class="simulation-chart-stat-label">初始目标值</div>
                <div class="simulation-chart-stat-value">${startValue.toFixed(2)} km</div>
            </div>
            <div class="simulation-chart-stat">
                <div class="simulation-chart-stat-label">当前全局最优</div>
                <div class="simulation-chart-stat-value">${currentGlobalValue.toFixed(2)} km</div>
            </div>
            <div class="simulation-chart-stat">
                <div class="simulation-chart-stat-label">累计改善</div>
                <div class="simulation-chart-stat-value">${improvement >= 0 ? '↓' : '↑'} ${Math.abs(improvement).toFixed(2)} km</div>
            </div>
        </div>
        <svg viewBox="0 0 ${width} ${height}" class="simulation-chart-svg" preserveAspectRatio="none">
            <defs>
                <linearGradient id="simulationAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.35"></stop>
                    <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.04"></stop>
                </linearGradient>
            </defs>
            ${guideLines}
            <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#cbd5e1" stroke-width="1.5"></line>
            <line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" stroke="#cbd5e1" stroke-width="1.5"></line>
            <polygon points="${areaPoints}" fill="url(#simulationAreaGradient)"></polygon>
            <polyline fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${iterationPoints}"></polyline>
            <polyline fill="none" stroke="#0f766e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${globalPoints}"></polyline>
            <line x1="${currentPoint.x}" y1="${chartTop}" x2="${currentPoint.x}" y2="${chartBottom}" stroke="#10b981" stroke-width="2" stroke-dasharray="6 4"></line>
            ${markers}
            <text x="${currentPoint.x}" y="${Math.max(chartTop + 12, currentPoint.y - 12)}" text-anchor="middle" font-size="11" font-weight="700" fill="#10b981">第 ${iterations[currentIndex].iteration} 轮</text>
        </svg>
        <div class="simulation-chart-legend">
            <span class="simulation-chart-legend-item"><span class="simulation-chart-legend-line iteration"></span>${hasIterationSeries ? '当轮最优' : '兼容曲线（旧数据）'}</span>
            <span class="simulation-chart-legend-item"><span class="simulation-chart-legend-line global"></span>全局最优</span>
        </div>
        <div class="simulation-chart-footer">
            <span>迭代 1</span>
            <span>当前播放：第 ${iterations[currentIndex].iteration} 轮</span>
            <span>迭代 ${iterations.length}</span>
        </div>
        <div class="simulation-chart-note">
            <strong>说明：</strong>横轴表示迭代轮次，纵轴表示目标值（总距离）。蓝色曲线表示每一轮搜索得到的当轮最优值，用于观察搜索波动；绿色曲线表示截止当前迭代的全局最优值，用于观察算法整体收敛趋势。${!hasIterationSeries ? '当前接口未返回独立的“当轮最优值”，页面已暂时用兼容方式展示旧数据。' : ''}${stabilized ? '当前样例中全局最优值从较早轮次起已趋于稳定。' : '当前样例中全局最优值仍在继续改进。'}
        </div>
    `;
}

function renderSimulationFinalRoutes() {
    const container = document.getElementById('simulation-final-routes');
    if (!container) return;
    if (!state.simulationResult || !Array.isArray(state.simulationResult.final_routes) || state.simulationResult.final_routes.length === 0) {
        container.innerHTML = '<div class="simulation-empty">运行模拟调度后，这里会展示最终最优路径与各车辆负载情况。</div>';
        return;
    }

    const totalDistance = state.simulationResult.final_runtime_metrics?.total_distance_km || state.simulationResult.final_routes.reduce((sum, route) => sum + (route.total_distance_km || 0), 0);
    const totalRuntime = state.simulationResult.final_runtime_metrics?.total_runtime_minutes || state.simulationResult.final_routes.reduce((sum, route) => sum + (route.total_runtime_minutes || 0), 0);
    const totalLoad = state.simulationResult.final_runtime_metrics?.total_load || state.simulationResult.final_routes.reduce((sum, route) => sum + (route.total_load || 0), 0);

    container.innerHTML = `
        <div class="simulation-final-summary">
            <div class="simulation-summary-card">
                <div class="simulation-summary-label">最优总距离</div>
                <div class="simulation-summary-value">${totalDistance.toFixed(2)} km</div>
            </div>
            <div class="simulation-summary-card">
                <div class="simulation-summary-label">总运行时长</div>
                <div class="simulation-summary-value">${totalRuntime} min</div>
            </div>
            <div class="simulation-summary-card">
                <div class="simulation-summary-label">总载客量</div>
                <div class="simulation-summary-value">${totalLoad} 人</div>
            </div>
        </div>
        ${state.simulationResult.final_routes.map((route, index) => {
            const stationNames = route.station_ids.map((stationId) => {
            const station = state.simulationStations.find((item) => item.id === stationId);
            return station ? station.name : `站点${stationId}`;
            });
            const stopHtml = stationNames.map((name, stopIndex) => `
                <span class="simulation-route-stop">${name}</span>
                ${stopIndex < stationNames.length - 1 ? '<span class="simulation-route-arrow">→</span>' : ''}
            `).join('');
            return `
            <div class="simulation-card route-card">
                <div class="simulation-route-header">
                    <div class="simulation-card-title">车辆 ${route.vehicle_id}</div>
                    <span class="simulation-route-badge" style="background:${buildRouteColor(index)}20;color:${buildRouteColor(index)};">路径 ${index + 1}</span>
                </div>
                <div class="simulation-route-badges">
                    <span class="simulation-route-badge">距离 ${route.total_distance_km.toFixed(2)} km</span>
                    <span class="simulation-route-badge">载客 ${route.total_load} 人</span>
                    <span class="simulation-route-badge">运行 ${route.total_runtime_minutes} min</span>
                </div>
                <div class="simulation-route-stops">${stopHtml}</div>
            </div>
        `;
        }).join('')}
    `;
}

function drawSimulationRoutes(routes) {
    clearSimulationRouteOverlays();
    if (!state.mapSimulation || !Array.isArray(routes)) return;

    routes.forEach((route, index) => {
        const path = route.station_ids
            .map((stationId) => state.simulationStations.find((station) => station.id === stationId))
            .filter(Boolean)
            .map((station) => [station.lng, station.lat]);

        if (path.length < 2) return;

        const polyline = new AMap.Polyline({
            path,
            strokeColor: buildRouteColor(index),
            strokeWeight: 6,
            strokeOpacity: 0.92,
            strokeStyle: index % 2 === 1 ? 'dashed' : 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            isOutline: true,
            outlineColor: '#ffffff',
            borderWeight: 2
        });
        polyline.setMap(state.mapSimulation);
        state.simulationRouteOverlays.push(polyline);
    });
}

function renderSimulationIteration(index) {
    if (!state.simulationResult || !Array.isArray(state.simulationResult.iterations) || state.simulationResult.iterations.length === 0) {
        clearSimulationRouteOverlays();
        return;
    }

    const safeIndex = Math.max(0, Math.min(index, state.simulationResult.iterations.length - 1));
    state.simulationPlaybackIndex = safeIndex;
    const iteration = state.simulationResult.iterations[safeIndex];
    drawSimulationRoutes(iteration.best_routes || []);
    renderSimulationStatus();
    renderSimulationChart();
}

async function runSimulationPlan() {
    if (state.simulationStations.length === 0) {
        alert('请先添加模拟站点。');
        return;
    }
    if (state.simulationVehicles.length === 0) {
        alert('请先添加模拟车辆。');
        return;
    }
    if (state.simulationStations.filter((station) => station.is_depot).length !== 1) {
        alert('模拟模式下必须且只能有 1 个终点站。');
        return;
    }

    const sceneSummary = summarizeSimulationScene();
    if (sceneSummary.demand > sceneSummary.capacity) {
        alert(`当前模拟场景总需求为 ${sceneSummary.demand}，但车辆总容量只有 ${sceneSummary.capacity}。\n这会导致样例天然不可行，请先增加车辆容量或减少站点需求。`);
        return;
    }

    pauseSimulationIterations();
    try {
        const stationCount = state.simulationStations.length;
        const config =
            stationCount >= 14
                ? { ant_count: 48, max_iterations: 90, alpha: 1.0, beta: 2.7, evaporation_rate: 0.34 }
                : stationCount >= 10
                    ? { ant_count: 34, max_iterations: 60, alpha: 1.0, beta: 2.9, evaporation_rate: 0.4 }
                    : { ant_count: 20, max_iterations: 36, alpha: 1.0, beta: 3.0, evaporation_rate: 0.48 };

        const response = await fetch(`${API_BASE_URL}/simulation-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stations: state.simulationStations,
                vehicles: state.simulationVehicles,
                aco_config: config
            })
        });
        const payload = await parseApiResponse(response);
        state.simulationResult = payload;
        state.simulationPlaybackIndex = 0;
        renderSimulationIteration(0);
        renderSimulationFinalRoutes();
        playSimulationIterations();
    } catch (error) {
        alert(`模拟调度失败。\n${error.message}`);
    }
}

function playSimulationIterations() {
    pauseSimulationIterations();
    if (!state.simulationResult?.iterations?.length) return;
    state.simulationPlaybackTimer = setInterval(() => {
        if (state.simulationPlaybackIndex >= state.simulationResult.iterations.length - 1) {
            pauseSimulationIterations();
            return;
        }
        renderSimulationIteration(state.simulationPlaybackIndex + 1);
    }, 900);
}

function pauseSimulationIterations() {
    if (state.simulationPlaybackTimer) {
        clearInterval(state.simulationPlaybackTimer);
        state.simulationPlaybackTimer = null;
    }
}

function stepSimulationIteration() {
    if (!state.simulationResult?.iterations?.length) return;
    pauseSimulationIterations();
    renderSimulationIteration(Math.min(state.simulationPlaybackIndex + 1, state.simulationResult.iterations.length - 1));
}

function restartSimulationPlayback() {
    if (!state.simulationResult?.iterations?.length) return;
    renderSimulationIteration(0);
    playSimulationIterations();
}

renderAlgorithmMath();
renderSimulationDetailDrawer();
