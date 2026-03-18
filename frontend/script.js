/**
 * 核心数据状态 (Mock 数据基于真实需求)
 */
const state = {
    currentUserRole: null, // 'admin' 或 'user'
    mapStation: null,      // 管理员站点地图实例
    mapRoute: null,        // 管理员路线地图实例
    mapUser: null,         // 用户端地图实例
    placeSearch: null,

    stations: [],

    // 模拟 VRPTW 算法调度结果
    routes: [],
    vehicles: [],

    markers: [],
    infoWindow: null,
    tempMarker: null,
    stationsLoadedFromApi: false,
    planningOverlayTimer: null
};

const API_BASE_URL = 'http://127.0.0.1:8080/api';
const SCHOOL_CENTER = [108.9514, 34.1579];
const SCHOOL_DEPOT_TEMPLATE = {
    name: '西安财经大学长安校区东大门',
    address: '西安财经大学长安校区东大门',
    lng: SCHOOL_CENTER[0],
    lat: SCHOOL_CENTER[1],
    demand: 0,
    service_time: 1,
    tw_start: '06:00',
    tw_end: '08:00',
    is_depot: true
};

/* ==========================================
 * 视图与导航控制
 * ========================================== */
async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    state.currentUserRole = role;

    await loadStationsFromApi(true);
    await loadRoutesFromApi(true);
    await loadVehiclesFromApi(true);

    document.getElementById('login-view').classList.add('hidden-view');

    if (role === 'admin') {
        document.getElementById('admin-view').classList.remove('hidden-view');
        switchAdminTab('admin-dashboard');
    } else {
        document.getElementById('user-view').classList.remove('hidden-view');
        initUserMap();
        renderUserRouteList();
    }
}

function logout() {
    state.currentUserRole = null;
    document.getElementById('admin-view').classList.add('hidden-view');
    document.getElementById('user-view').classList.add('hidden-view');
    document.getElementById('login-view').classList.remove('hidden-view');

    if (state.mapStation) state.mapStation.destroy();
    if (state.mapRoute) state.mapRoute.destroy();
    if (state.mapUser) state.mapUser.destroy();
    state.mapStation = state.mapRoute = state.mapUser = null;
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach((el) => el.classList.add('hidden-view'));
    document.getElementById(tabId).classList.remove('hidden-view');

    document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    } else {
        const tabMap = {
            'admin-dashboard': 0,
            'admin-stations': 1,
            'admin-vehicles': 2,
            'admin-routes': 3,
            'admin-users': 4
        };
        const navItems = document.querySelectorAll('.nav-item');
        const activeIndex = tabMap[tabId];
        if (navItems[activeIndex]) {
            navItems[activeIndex].classList.add('active');
        }
    }

    const titles = {
        'admin-dashboard': '系统概览',
        'admin-stations': '地图站点管理',
        'admin-vehicles': '车辆管理',
        'admin-routes': '调度结果展示',
        'admin-users': '教职工管理'
    };
    document.getElementById('admin-header-title').innerText = titles[tabId];

    if (tabId === 'admin-stations') {
        setTimeout(initAdminStationMap, 100);
    } else if (tabId === 'admin-routes') {
        setTimeout(initAdminRouteMap, 100);
    }

    if (tabId === 'admin-dashboard') {
        document.getElementById('dash-station-count').innerText = state.stations.length;
        const totalDemand = state.stations.reduce((sum, s) => sum + parseInt(s.demand || 0, 10), 0);
        document.getElementById('dash-demand-count').innerText = totalDemand;
    } else if (tabId === 'admin-vehicles') {
        renderVehicleTable();
    }
}

/* ==========================================
 * 核心辅助函数
 * ========================================== */
function getStationById(id) {
    return state.stations.find((s) => s.id === id);
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

async function parseApiResponse(response) {
    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }

    if (!response.ok) {
        const message = payload && payload.message ? payload.message : `HTTP ${response.status}`;
        throw new Error(message);
    }

    return payload;
}

function normalizeStationFromApi(station) {
    return {
        id: station.id,
        code: station.station_code || '',
        name: station.station_name,
        address: station.address || '',
        lng: Number(station.lng),
        lat: Number(station.lat),
        demand: Number(station.demand),
        service_time: Number(station.service_time),
        tw_start: station.time_window_start,
        tw_end: station.time_window_end,
        is_depot: Boolean(station.is_depot)
    };
}

function normalizeVehicleFromApi(vehicle) {
    return {
        id: vehicle.id,
        vehicle_code: vehicle.vehicle_code,
        plate_number: vehicle.plate_number,
        capacity: Number(vehicle.capacity),
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
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        state.stations = Array.isArray(payload.stations) ? payload.stations.map(normalizeStationFromApi) : [];
        state.stationsLoadedFromApi = true;
    } catch (error) {
        if (!silent) {
            alert(`站点数据读取失败。\n${error.message}`);
        }
    }
}

async function loadVehiclesFromApi(silent = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        state.vehicles = Array.isArray(payload.vehicles) ? payload.vehicles.map(normalizeVehicleFromApi) : [];
    } catch (error) {
        if (!silent) {
            alert(`车辆数据读取失败。\n${error.message}`);
        }
    }
}

function buildRouteColor(index) {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    return palette[index % palette.length];
}

function setPlanningOverlayVisible(visible) {
    const overlay = document.getElementById('planning-overlay');
    if (!overlay) return;
    overlay.classList.toggle('hidden-view', !visible);
}

function updatePlanningStep(stepIndex, text) {
    document.querySelectorAll('.planning-step').forEach((element, index) => {
        element.classList.toggle('active-step', index === stepIndex);
        element.classList.toggle('done-step', index < stepIndex);
    });
    const status = document.getElementById('planning-status-text');
    if (status && text) {
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
        '正在请求真实道路距离与行驶时间...',
        '正在执行蚁群算法迭代搜索...',
        '正在写回调度结果并刷新页面...'
    ];
    let currentStep = 0;
    updatePlanningStep(currentStep, steps[currentStep]);
    state.planningOverlayTimer = setInterval(() => {
        currentStep = Math.min(currentStep + 1, steps.length - 1);
        updatePlanningStep(currentStep, steps[currentStep]);
    }, 1200);
}

function stopPlanningOverlay() {
    if (state.planningOverlayTimer) {
        clearInterval(state.planningOverlayTimer);
        state.planningOverlayTimer = null;
    }
    setPlanningOverlayVisible(false);
}

async function loadRoutesFromApi(silent = false) {
    try {
        const [scheduleResponse, polylineResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/schedule-results`),
            fetch(`${API_BASE_URL}/route-polylines`)
        ]);
        if (!scheduleResponse.ok) {
            throw new Error(`schedule HTTP ${scheduleResponse.status}`);
        }
        if (!polylineResponse.ok) {
            throw new Error(`route polyline HTTP ${polylineResponse.status}`);
        }
        const payload = await scheduleResponse.json();
        const polylinePayload = await polylineResponse.json();
        const scheduleStops = Array.isArray(payload.schedule_stops) ? payload.schedule_stops : [];
        const polylineRoutes = Array.isArray(polylinePayload.routes) ? polylinePayload.routes : [];
        const grouped = new Map();

        scheduleStops.forEach((stop) => {
            if (!grouped.has(stop.vehicle_id)) {
                grouped.set(stop.vehicle_id, {
                    id: `V${stop.vehicle_id}`,
                    name: stop.plate_number
                        ? `${stop.vehicle_code || `车辆${stop.vehicle_id}`} / ${stop.plate_number}`
                        : (stop.vehicle_code || `车辆${stop.vehicle_id}`),
                    color: '#3B82F6',
                    path: [],
                    stopDetails: [],
                    schedule: [],
                    roadPolyline: []
                });
            }

            const route = grouped.get(stop.vehicle_id);
            route.path.push(stop.station_id);
            route.stopDetails.push({
                stationId: stop.station_id,
                stationName: stop.station_name,
                lng: Number(stop.lng),
                lat: Number(stop.lat),
                isDepot: Boolean(stop.is_depot)
            });
            route.schedule.push({
                stationId: stop.station_id,
                stationName: stop.station_name,
                lng: Number(stop.lng),
                lat: Number(stop.lat),
                isDepot: Boolean(stop.is_depot),
                arr: stop.arrival_time || '-',
                dep: stop.departure_time || '-',
                feasible_flag: stop.feasible_flag
            });
        });

        state.routes = Array.from(grouped.values()).map((route, index) => ({
            ...route,
            color: buildRouteColor(index)
        }));

        polylineRoutes.forEach((polylineRoute) => {
            const target = state.routes.find((route) => route.id === `V${polylineRoute.vehicle_id}`);
            if (target) {
                target.roadPolyline = Array.isArray(polylineRoute.polyline) ? polylineRoute.polyline : [];
            }
        });
    } catch (error) {
        if (!silent) {
            alert(`调度结果读取失败。\n${error.message}`);
        }
    }
}

function getMapCenter() {
    const depot = state.stations.find((station) => station.is_depot);
    if (depot) {
        return [depot.lng, depot.lat];
    }
    return SCHOOL_CENTER;
}

function checkAMap() {
    if (typeof AMap === 'undefined') {
        alert('高德地图 API 未加载。请检查网络或确认代码中的 KEY 设置正确。');
        return false;
    }
    return true;
}

/* ==========================================
 * 模块 1: 管理员 - 站点管理地图
 * ========================================== */
function initAdminStationMap() {
    if (!checkAMap()) return;
    if (state.mapStation) {
        state.mapStation.resize();
        state.mapStation.setCenter(getMapCenter());
        renderStationMarkers(state.mapStation, true);
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
        const autoOptions = { input: 'poi-search-input' };
        const auto = new AMap.AutoComplete(autoOptions);
        const placeSearch = new AMap.PlaceSearch({ map: state.mapStation });

        auto.on('select', (e) => {
            placeSearch.setCity(e.poi.adcode);
            placeSearch.search(e.poi.name, (status, result) => {
                if (status === 'complete' && result.info === 'OK') {
                    const poi = result.poiList.pois[0];
                    openStationFormWindow(null, poi.location.lng, poi.location.lat, poi.name);
                }
            });
        });
    });

    renderStationMarkers(state.mapStation, true);
    renderStationList();
}

function renderStationMarkers(mapInstance, isEditable) {
    if (state.markers && state.markers.length > 0) {
        mapInstance.remove(state.markers);
        state.markers = [];
    }

    state.stations.forEach((station) => {
        const isDepot = station.is_depot;
        const markerContent = `<div style="background-color: ${isDepot ? '#EF4444' : '#3B82F6'}; width: 24px; height: 24px; border-radius: 50%; color: white; text-align: center; line-height: 24px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fa-solid ${isDepot ? 'fa-building' : 'fa-bus-simple'} text-xs"></i></div>`;

        const marker = new AMap.Marker({
            position: [station.lng, station.lat],
            content: markerContent,
            offset: new AMap.Pixel(-12, -12),
            extData: station
        });

        if (isEditable) {
            marker.on('click', (e) => {
                const sData = e.target.getExtData();
                openStationFormWindow(sData);
            });
        } else {
            marker.on('mouseover', (e) => {
                const sData = e.target.getExtData();
                const info = new AMap.InfoWindow({
                    content: `<div class="p-2 text-sm"><b>${sData.name}</b><br>需求: ${sData.demand}人</div>`,
                    offset: new AMap.Pixel(0, -20)
                });
                info.open(mapInstance, marker.getPosition());
            });
            marker.on('mouseout', () => {
                mapInstance.clearInfoWindow();
            });
        }

        marker.setMap(mapInstance);
        state.markers.push(marker);
    });
}

function renderStationList() {
    const container = document.getElementById('station-list-container');
    if (!Array.isArray(state.stations) || state.stations.length === 0) {
        container.innerHTML = '<div class="p-4 text-sm text-gray-500">当前没有站点，请通过地图点击或搜索真实地点新增站点。</div>';
        return;
    }
    let html = '';
    state.stations.forEach((s) => {
        html += `
        <div class="mb-2 p-3 bg-white border rounded shadow-sm hover:border-blue-400 cursor-pointer transition" onclick="focusStation(${s.lng}, ${s.lat})">
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-gray-800 text-sm truncate w-40" title="${s.name}">${s.name} ${s.is_depot ? '<span class="text-xs bg-red-100 text-red-600 px-1 rounded">车场</span>' : ''}</span>
                <span class="text-xs text-gray-500">${s.demand} 人</span>
            </div>
            <div class="text-xs text-gray-400">
                时间窗: ${s.tw_start} - ${s.tw_end} | 服务: ${s.service_time}m
            </div>
            <div class="mt-2 flex gap-2">
                <button onclick="event.stopPropagation(); openStationEditor(${s.id})" class="text-xs text-blue-600 hover:text-blue-800">编辑</button>
                <button onclick="event.stopPropagation(); deleteStation(${s.id})" class="text-xs text-red-600 hover:text-red-800">删除</button>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
}

function renderVehicleTable() {
    const tbody = document.getElementById('vehicle-table-body');
    if (!tbody) {
        return;
    }

    if (!Array.isArray(state.vehicles) || state.vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-6 text-sm text-gray-500 text-center">当前没有车辆，请先新增车辆。</td></tr>';
        return;
    }

    let html = '';
    state.vehicles.forEach((vehicle) => {
        const statusLabel = vehicle.status === 'idle' ? '可用' : vehicle.status;
        html += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.vehicle_code}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${vehicle.plate_number}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.capacity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.start_depot || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${vehicle.earliest_departure_time || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">${statusLabel}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button onclick="openVehicleForm(${vehicle.id})" class="text-blue-600 mr-3">编辑</button>
                    <button onclick="deleteVehicle(${vehicle.id})" class="text-red-600">删除</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

window.openVehicleForm = function openVehicleForm(id = null) {
    const vehicle = id ? state.vehicles.find((item) => item.id === id) : null;
    const plateNumber = prompt('请输入车牌号', vehicle ? vehicle.plate_number : '');
    if (plateNumber === null || !plateNumber.trim()) return;
    const capacityValue = prompt('请输入车辆容量(人)', vehicle ? String(vehicle.capacity) : '20');
    if (capacityValue === null || !capacityValue.trim()) return;
    const startDepot = prompt('请输入起始车场/起点', vehicle ? vehicle.start_depot : '西安财经大学长安校区东大门');
    if (startDepot === null) return;
    const endDepot = prompt('请输入终点', vehicle ? vehicle.end_depot : '西安财经大学长安校区东大门');
    if (endDepot === null) return;
    const driverName = prompt('请输入司机姓名', vehicle ? vehicle.driver_name : '');
    if (driverName === null) return;
    const driverPhone = prompt('请输入司机电话', vehicle ? vehicle.driver_phone : '');
    if (driverPhone === null) return;
    const maxRunMinutesValue = prompt('请输入最大运行时长(分钟)', vehicle ? String(vehicle.max_run_minutes) : '120');
    if (maxRunMinutesValue === null || !maxRunMinutesValue.trim()) return;
    const earliestDepartureTime = prompt('请输入最早发车时间(HH:MM)', vehicle ? vehicle.earliest_departure_time : '06:40');
    if (earliestDepartureTime === null || !earliestDepartureTime.trim()) return;

    saveVehicle(id, {
        plate_number: plateNumber.trim(),
        capacity: Number(capacityValue),
        start_depot: startDepot.trim(),
        end_depot: endDepot.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        status: vehicle ? vehicle.status : 'idle',
        max_run_minutes: Number(maxRunMinutesValue),
        earliest_departure_time: earliestDepartureTime.trim()
    });
};

async function saveVehicle(id, payload) {
    try {
        const response = await fetch(
            id ? `${API_BASE_URL}/vehicles/${id}` : `${API_BASE_URL}/vehicles`,
            {
                method: id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );
        await parseApiResponse(response);
        await loadVehiclesFromApi(true);
        renderVehicleTable();
        alert('车辆保存成功。');
    } catch (error) {
        alert(`车辆保存失败。\n${error.message}`);
    }
}

window.deleteVehicle = async function deleteVehicle(id) {
    if (!confirm('确定要删除这辆车吗？')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/vehicles/${id}`, { method: 'DELETE' });
        await parseApiResponse(response);
        await loadVehiclesFromApi(true);
        renderVehicleTable();
    } catch (error) {
        alert(`车辆删除失败。\n${error.message}`);
    }
};

window.runPlanning = async function runPlanning() {
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
        if (state.mapRoute) {
            state.mapRoute.destroy();
            state.mapRoute = null;
            initAdminRouteMap();
        }
        if (state.mapStation) {
            renderStationMarkers(state.mapStation, true);
            renderStationList();
        }
        alert(`调度完成。生成 ${result.schedule_rows} 条结果，目标距离 ${result.objective_value} km。`);
    } catch (error) {
        alert(`重新规划失败。\n${error.message}`);
    } finally {
        stopPlanningOverlay();
    }
};

function focusStation(lng, lat) {
    if (state.mapStation) {
        state.mapStation.setCenter([lng, lat]);
        state.mapStation.setZoom(16);
    }
}

function openStationFormWindow(station, lng, lat, defaultName = '') {
    const isEdit = !!station;
    const pos = isEdit ? [station.lng, station.lat] : [lng, lat];

    const html = `
        <div class="custom-info-window relative">
            <button class="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onclick="state.infoWindow.close()">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h3 class="font-bold text-gray-800 mb-3 border-b pb-2">${isEdit ? '编辑站点配置 (VRPTW)' : '新增站点'}</h3>
            <div class="space-y-2">
                <div>
                    <label class="text-xs text-gray-500 block">站点名称 (station_name)</label>
                    <input type="text" id="fm-name" class="form-input-sm" value="${isEdit ? station.name : defaultName}">
                </div>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <label class="text-xs text-gray-500 block">经度 (lng)</label>
                        <input type="text" id="fm-lng" class="form-input-sm bg-gray-50" readonly value="${pos[0]}">
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-gray-500 block">纬度 (lat)</label>
                        <input type="text" id="fm-lat" class="form-input-sm bg-gray-50" readonly value="${pos[1]}">
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <label class="text-xs text-gray-500 block">需求人数 (demand)</label>
                        <input type="number" id="fm-demand" class="form-input-sm" value="${isEdit ? station.demand : '0'}">
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-gray-500 block">服务时间 (m)</label>
                        <input type="number" id="fm-serv" class="form-input-sm" value="${isEdit ? station.service_time : '2'}">
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <label class="text-xs text-gray-500 block">时间窗始 (tw_start)</label>
                        <input type="time" id="fm-tws" class="form-input-sm" value="${isEdit ? station.tw_start : '07:00'}">
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-gray-500 block">时间窗终 (tw_end)</label>
                        <input type="time" id="fm-twe" class="form-input-sm" value="${isEdit ? station.tw_end : '08:00'}">
                    </div>
                </div>
                <div class="flex items-center mt-2">
                    <input type="checkbox" id="fm-depot" class="mr-2" ${isEdit && station.is_depot ? 'checked' : ''}>
                    <label class="text-sm font-semibold text-gray-700">设为调度起点/终点 (is_depot)</label>
                </div>
            </div>
            <div class="mt-4 flex gap-2">
                <button onclick="saveStation(${isEdit ? station.id : 'null'})" class="flex-1 bg-blue-600 text-white py-1.5 rounded text-sm hover:bg-blue-700 transition">保存</button>
                ${isEdit ? `<button onclick="deleteStation(${station.id})" class="flex-1 bg-red-100 text-red-600 py-1.5 rounded text-sm hover:bg-red-200 transition">删除</button>` : ''}
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

window.openStationEditor = function openStationEditor(id) {
    const station = state.stations.find((item) => item.id === id);
    if (!station) {
        alert('未找到要编辑的站点。');
        return;
    }
    openStationFormWindow(station);
};

window.addSchoolDepot = async function addSchoolDepot() {
    const existingDepot = state.stations.find((station) => station.is_depot);
    if (existingDepot) {
        alert('当前已经存在学校终点站，请直接编辑现有终点站。');
        return;
    }

    try {
        let depotPayload = { ...SCHOOL_DEPOT_TEMPLATE };
        if (typeof AMap !== 'undefined') {
            await new Promise((resolve) => {
                AMap.plugin(['AMap.PlaceSearch'], () => {
                    const placeSearch = new AMap.PlaceSearch({ city: '西安' });
                    placeSearch.search('西安财经大学长安校区东大门', (status, result) => {
                        if (status === 'complete' && result.info === 'OK' && result.poiList?.pois?.length) {
                            const poi = result.poiList.pois[0];
                            depotPayload = {
                                ...depotPayload,
                                name: poi.name || depotPayload.name,
                                address: poi.name || depotPayload.address,
                                lng: poi.location.lng,
                                lat: poi.location.lat
                            };
                        }
                        resolve();
                    });
                });
            });
        }

        const response = await fetch(`${API_BASE_URL}/stations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stationToApiPayload(depotPayload))
        });
        await parseApiResponse(response);
        await loadStationsFromApi(true);
        renderStationMarkers(state.mapStation, true);
        renderStationList();
        alert('学校终点站已添加。');
    } catch (error) {
        alert(`添加学校终点站失败。\n${error.message}`);
    }
};

window.saveStation = async function saveStation(id) {
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

    if (!data.name) return alert('站点名称不能为空');

    try {
        const request = {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stationToApiPayload(data))
        };
        const endpoint = id ? `${API_BASE_URL}/stations/${id}` : `${API_BASE_URL}/stations`;
        const response = await fetch(endpoint, request);
        await parseApiResponse(response);
        await loadStationsFromApi(true);
    } catch (error) {
        alert(`站点保存失败。\n${error.message}`);
        return;
    }

    state.infoWindow.close();
    if (state.tempMarker) {
        state.mapStation.remove(state.tempMarker);
        state.tempMarker = null;
    }
    renderStationMarkers(state.mapStation, true);
    renderStationList();
    alert('保存成功！数据已写入数据库。');
};

window.deleteStation = async function deleteStation(id) {
    if (!confirm('确定要删除此站点吗？')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/stations/${id}`, { method: 'DELETE' });
        await parseApiResponse(response);
        await loadStationsFromApi(true);
    } catch (error) {
        alert(`删除失败。\n${error.message}`);
        return;
    }
    if (state.infoWindow) {
        state.infoWindow.close();
    }
    renderStationMarkers(state.mapStation, true);
    renderStationList();
};

/* ==========================================
 * 模块 2: 管理员 - 调度结果地图
 * ========================================== */
function initAdminRouteMap() {
    if (!checkAMap()) return;
    if (state.mapRoute) {
        state.mapRoute.resize();
        state.mapRoute.clearMap();
        drawRoutesOnMap(state.mapRoute);
        renderRouteDetails();
        return;
    }

    state.mapRoute = new AMap.Map('route-map-container', {
        zoom: 13,
        center: getMapCenter(),
        viewMode: '2D'
    });

    drawRoutesOnMap(state.mapRoute);
    renderRouteDetails();
}

function drawRoutesOnMap(mapInstance) {
    if (!Array.isArray(state.routes) || state.routes.length === 0) {
        return;
    }

    state.routes.forEach((route) => {
        const pathCoords = Array.isArray(route.roadPolyline) && route.roadPolyline.length > 1
            ? route.roadPolyline.map((point) => [point.lng, point.lat])
            : route.stopDetails.map((stop) => [stop.lng, stop.lat]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));

        if (pathCoords.length < 2) {
            return;
        }

        const polyline = new AMap.Polyline({
            path: pathCoords,
            isOutline: true,
            outlineColor: '#ffeeff',
            borderWeight: 2,
            strokeColor: route.color,
            strokeOpacity: 0.8,
            strokeWeight: 5,
            strokeStyle: 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            showDir: true
        });
        polyline.setMap(mapInstance);

        route.stopDetails.forEach((stop, index) => {
            if (!Number.isFinite(stop.lng) || !Number.isFinite(stop.lat)) {
                return;
            }

            const orderMarker = new AMap.Marker({
                position: [stop.lng, stop.lat],
                content: `<div style="width:24px;height:24px;border-radius:9999px;background:${route.color};color:#fff;font-size:12px;line-height:24px;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${index + 1}</div>`,
                offset: new AMap.Pixel(-12, -12)
            });
            orderMarker.setMap(mapInstance);

            orderMarker.on('click', () => {
                const info = new AMap.InfoWindow({
                    content: `<div class="p-2 text-sm"><b>${stop.stationName}</b><br>到达: ${route.schedule[index]?.arr || '-'}<br>离开: ${route.schedule[index]?.dep || '-'}<\/div>`,
                    offset: new AMap.Pixel(0, -18)
                });
                info.open(mapInstance, [stop.lng, stop.lat]);
            });
        });
    });

    if (mapInstance && state.markers.length > 0) {
        mapInstance.setFitView();
    }
}

function renderRouteDetails() {
    const container = document.getElementById('route-details-container');
    if (!Array.isArray(state.routes) || state.routes.length === 0) {
        container.innerHTML = '<div class="text-sm text-gray-500">暂无可展示的调度结果，请先运行调度算法并写回数据库。</div>';
        return;
    }

    let html = '';

    state.routes.forEach((route) => {
        html += `
        <div class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2 flex justify-between items-center text-white" style="background-color: ${route.color}">
                <span class="font-bold"><i class="fa-solid fa-car-side mr-2"></i>${route.name}</span>
                <span class="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">可行</span>
            </div>
            <div class="p-3 bg-white">
                <div class="relative border-l-2 ml-3 border-gray-200 space-y-4">
        `;

        route.schedule.forEach((point, index) => {
            const isDepot = point.isDepot;
            const isFeasible = point.feasible_flag === 1 ||
                point.arr !== '-';
            const statusDot = isDepot ? 'bg-gray-400' : (isFeasible ? 'bg-green-500' : 'bg-red-500');

            html += `
                <div class="relative pl-6">
                    <div class="absolute w-3 h-3 rounded-full ${statusDot} -left-[7px] top-1.5 border-2 border-white shadow-sm"></div>
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-gray-800 text-sm">${index + 1}. ${point.stationName}</p>
                            <p class="text-xs text-gray-500">到达: ${point.arr} | 离开: ${point.dep}</p>
                        </div>
                        ${!isDepot ? `<div class="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">站点</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
}

/* ==========================================
 * 模块 3: 普通用户 - 个人行程视图
 * ========================================== */
function initUserMap() {
    if (!checkAMap()) return;
    if (state.mapUser) {
        state.mapUser.resize();
        return;
    }

    state.mapUser = new AMap.Map('user-map-container', {
        zoom: 13,
        center: getMapCenter(),
        viewMode: '2D'
    });

    const userRoute = state.routes[0];
    if (!userRoute) {
        return;
    }

    userRoute.path.forEach((id) => {
        const stop = userRoute.stopDetails.find((item) => item.stationId === id);
        if (!stop) return;
        const isTarget = !stop.isDepot;

        const marker = new AMap.Marker({
            position: [stop.lng, stop.lat],
            content: `<div style="background-color: ${isTarget ? '#EF4444' : '#3B82F6'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
            offset: new AMap.Pixel(-8, -8)
        });

        marker.setLabel({
            direction: 'right',
            offset: new AMap.Pixel(10, 0),
            content: `<div class='bg-white px-2 py-1 rounded shadow text-xs'>${stop.stationName}</div>`
        });

        marker.setMap(state.mapUser);
    });

    const pathCoords = Array.isArray(userRoute.roadPolyline) && userRoute.roadPolyline.length > 1
        ? userRoute.roadPolyline.map((point) => [point.lng, point.lat])
        : userRoute.stopDetails.map((stop) => [stop.lng, stop.lat]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const polyline = new AMap.Polyline({
        path: pathCoords,
        isOutline: true,
        outlineColor: '#fff',
        borderWeight: 2,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.9,
        strokeWeight: 6,
        strokeStyle: 'solid',
        showDir: true
    });
    polyline.setMap(state.mapUser);

    state.mapUser.setFitView();
}

function renderUserRouteList() {
    const container = document.getElementById('user-route-stops');
    const userRoute = state.routes[0];
    if (!userRoute) {
        container.innerHTML = '<div class="text-sm text-gray-500">暂无个人通勤路线，请等待管理员生成调度结果。</div>';
        return;
    }
    let html = '';

    userRoute.schedule.forEach((point) => {
        const isUserStop = !point.isDepot;
        const isEndStop = point.isDepot;

        let textClass = 'text-gray-500';
        let dotClass = 'bg-gray-300';
        if (isUserStop || isEndStop) {
            textClass = 'text-gray-900 font-bold';
            dotClass = isUserStop ? 'bg-red-500' : 'bg-blue-600';
        }

        html += `
            <div class="relative pb-4">
                <div class="absolute w-3 h-3 rounded-full ${dotClass} -left-[23px] top-1 border-2 border-white"></div>
                <div class="flex justify-between items-center">
                    <span class="${textClass}">${point.stationName}</span>
                    <span class="text-sm font-mono ${textClass}">${point.arr !== '-' ? point.arr : point.dep}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
