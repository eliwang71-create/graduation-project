/**
 * 核心数据状态 (Mock 数据基于真实需求)
 */
const state = {
    currentUserRole: null, // 'admin' 或 'user'
    mapStation: null,      // 管理员站点地图实例
    mapRoute: null,        // 管理员路线地图实例
    mapUser: null,         // 用户端地图实例
    placeSearch: null,

    // 初始站点数据 (包含 Depot 和请求节点)
    stations: [
        { id: 1, name: '西安财经大学长安校区东大门', lng: 108.938837, lat: 34.116631, demand: 0, service_time: 0, tw_start: '06:00', tw_end: '20:00', is_depot: true },
        { id: 2, name: '金地常宁府', lng: 108.940523, lat: 34.120512, demand: 5, service_time: 2, tw_start: '07:10', tw_end: '07:20', is_depot: false },
        { id: 3, name: '任家寨', lng: 108.935511, lat: 34.125533, demand: 3, service_time: 2, tw_start: '07:15', tw_end: '07:25', is_depot: false },
        { id: 4, name: '杜永村', lng: 108.945522, lat: 34.135544, demand: 4, service_time: 2, tw_start: '07:20', tw_end: '07:30', is_depot: false },
        { id: 5, name: '南长安街壹号', lng: 108.942533, lat: 34.145555, demand: 6, service_time: 2, tw_start: '07:30', tw_end: '07:40', is_depot: false },
        { id: 6, name: '智慧新城', lng: 108.925544, lat: 34.155566, demand: 2, service_time: 2, tw_start: '07:40', tw_end: '07:50', is_depot: false },
    ],

    // 模拟 VRPTW 算法调度结果
    routes: [
        {
            id: 'V1', name: '1号线', color: '#3B82F6',
            path: [1, 2, 3, 6, 1],
            schedule: [
                { stationId: 1, arr: '-', dep: '07:08', type: 'depot_start' },
                { stationId: 2, arr: '07:12', dep: '07:14', type: 'pickup' },
                { stationId: 3, arr: '07:20', dep: '07:22', type: 'pickup' },
                { stationId: 6, arr: '07:42', dep: '07:44', type: 'pickup' },
                { stationId: 1, arr: '07:55', dep: '-', type: 'depot_end' },
            ]
        },
        {
            id: 'V2', name: '2号线', color: '#10B981',
            path: [1, 4, 5, 1],
            schedule: [
                { stationId: 1, arr: '-', dep: '07:10', type: 'depot_start' },
                { stationId: 4, arr: '07:22', dep: '07:24', type: 'pickup' },
                { stationId: 5, arr: '07:33', dep: '07:35', type: 'pickup' },
                { stationId: 1, arr: '07:50', dep: '-', type: 'depot_end' },
            ]
        }
    ],

    markers: [],
    infoWindow: null,
    tempMarker: null,
    stationsLoadedFromApi: false
};

const API_BASE_URL = 'http://127.0.0.1:8080/api';

/* ==========================================
 * 视图与导航控制
 * ========================================== */
async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    state.currentUserRole = role;

    await loadStationsFromApi(true);

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

async function loadStationsFromApi(silent = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/stations`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (Array.isArray(payload.stations) && payload.stations.length > 0) {
            state.stations = payload.stations.map(normalizeStationFromApi);
            state.stationsLoadedFromApi = true;
        }
    } catch (error) {
        if (!silent) {
            alert(`站点数据读取失败，将继续使用前端内置数据。\n${error.message}`);
        }
    }
}

function getMapCenter() {
    const depot = state.stations.find((station) => station.is_depot);
    if (depot) {
        return [depot.lng, depot.lat];
    }
    return [108.938837, 34.136631];
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
        </div>
        `;
    });
    container.innerHTML = html;
}

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
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        await loadStationsFromApi(true);
    } catch (error) {
        alert(`站点保存失败，请确认后端 API 已启动。\n${error.message}`);
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
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        await loadStationsFromApi(true);
    } catch (error) {
        alert(`删除失败，请确认后端 API 已启动。\n${error.message}`);
        return;
    }
    state.infoWindow.close();
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
        return;
    }

    state.mapRoute = new AMap.Map('route-map-container', {
        zoom: 13,
        center: getMapCenter(),
        viewMode: '2D'
    });

    renderStationMarkers(state.mapRoute, false);
    drawRoutesOnMap(state.mapRoute);
    renderRouteDetails();
}

function drawRoutesOnMap(mapInstance) {
    state.routes.forEach((route) => {
        const pathCoords = route.path.map((id) => {
            const st = getStationById(id);
            return [st.lng, st.lat];
        });

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
    });

    if (mapInstance && state.markers.length > 0) {
        mapInstance.setFitView();
    }
}

function renderRouteDetails() {
    const container = document.getElementById('route-details-container');
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
            const st = getStationById(point.stationId);
            const isDepot = st.is_depot;
            const isFeasible = point.arr !== '-' && point.arr <= st.tw_end && point.arr >= st.tw_start;
            const statusDot = isDepot ? 'bg-gray-400' : (isFeasible ? 'bg-green-500' : 'bg-red-500');

            html += `
                <div class="relative pl-6">
                    <div class="absolute w-3 h-3 rounded-full ${statusDot} -left-[7px] top-1.5 border-2 border-white shadow-sm"></div>
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-gray-800 text-sm">${index + 1}. ${st.name}</p>
                            <p class="text-xs text-gray-500">到达: ${point.arr} | 离开: ${point.dep}</p>
                        </div>
                        ${!isDepot ? `<div class="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">上 ${st.demand}人</div>` : ''}
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

    userRoute.path.forEach((id) => {
        const st = getStationById(id);
        const isTarget = st.id === 2;

        const marker = new AMap.Marker({
            position: [st.lng, st.lat],
            content: `<div style="background-color: ${isTarget ? '#EF4444' : '#3B82F6'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
            offset: new AMap.Pixel(-8, -8)
        });

        marker.setLabel({
            direction: 'right',
            offset: new AMap.Pixel(10, 0),
            content: `<div class='bg-white px-2 py-1 rounded shadow text-xs'>${st.name}</div>`
        });

        marker.setMap(state.mapUser);
    });

    const pathCoords = userRoute.path.map((id) => [getStationById(id).lng, getStationById(id).lat]);
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
    let html = '';

    userRoute.schedule.forEach((point) => {
        const st = getStationById(point.stationId);
        const isUserStop = st.id === 2;
        const isEndStop = st.id === 1 && point.type === 'depot_end';

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
                    <span class="${textClass}">${st.name}</span>
                    <span class="text-sm font-mono ${textClass}">${point.arr !== '-' ? point.arr : point.dep}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
