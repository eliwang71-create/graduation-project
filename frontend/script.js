const state = {
    vehicles: [
        { id: 1, code: "BUS-01", plate: "陕A10001", capacity: 18, driver: "张师傅", maxRunMinutes: 120 },
        { id: 2, code: "BUS-02", plate: "陕A10002", capacity: 20, driver: "李师傅", maxRunMinutes: 120 }
    ],
    stations: [
        { id: 1, name: "金地常宁府", demand: 7, service: 3, windowStart: "06:50", windowEnd: "07:10", type: "上车点" },
        { id: 2, name: "任家寨", demand: 5, service: 2, windowStart: "06:55", windowEnd: "07:15", type: "上车点" },
        { id: 3, name: "杜永村", demand: 6, service: 2, windowStart: "07:00", windowEnd: "07:20", type: "上车点" },
        { id: 4, name: "南长安街壹号", demand: 8, service: 3, windowStart: "07:05", windowEnd: "07:25", type: "上车点" },
        { id: 5, name: "智慧新城", demand: 7, service: 3, windowStart: "07:10", windowEnd: "07:30", type: "上车点" },
        { id: 6, name: "西安财经大学长安校区东大门", demand: 0, service: 1, windowStart: "07:30", windowEnd: "07:50", type: "终点站" }
    ],
    schedule: [
        { scheduleCode: "ACO20260317V1O1", vehicleId: 1, stationId: 4, visitOrder: 1, arrivalTime: "2026-03-17 07:05:00", departureTime: "2026-03-17 07:08:00", feasibleFlag: 1 },
        { scheduleCode: "ACO20260317V1O2", vehicleId: 1, stationId: 5, visitOrder: 2, arrivalTime: "2026-03-17 07:13:00", departureTime: "2026-03-17 07:16:00", feasibleFlag: 1 },
        { scheduleCode: "ACO20260317V1O3", vehicleId: 1, stationId: 6, visitOrder: 3, arrivalTime: "2026-03-17 07:30:00", departureTime: "2026-03-17 07:31:00", feasibleFlag: 1 },
        { scheduleCode: "ACO20260317V2O1", vehicleId: 2, stationId: 1, visitOrder: 1, arrivalTime: "2026-03-17 06:50:00", departureTime: "2026-03-17 06:53:00", feasibleFlag: 1 },
        { scheduleCode: "ACO20260317V2O2", vehicleId: 2, stationId: 2, visitOrder: 2, arrivalTime: "2026-03-17 06:59:00", departureTime: "2026-03-17 07:01:00", feasibleFlag: 1 },
        { scheduleCode: "ACO20260317V2O3", vehicleId: 2, stationId: 3, visitOrder: 3, arrivalTime: "2026-03-17 07:07:00", departureTime: "2026-03-17 07:09:00", feasibleFlag: 1 },
        { scheduleCode: "ACO20260317V2O4", vehicleId: 2, stationId: 6, visitOrder: 4, arrivalTime: "2026-03-17 07:30:00", departureTime: "2026-03-17 07:31:00", feasibleFlag: 1 }
    ],
    filters: {
        vehicles: "",
        stations: "",
        schedule: ""
    },
    crudContext: {
        type: null,
        mode: "create",
        id: null
    }
};

const views = {
    login: document.getElementById("login-view"),
    admin: document.getElementById("admin-view"),
    user: document.getElementById("user-view")
};

const elements = {
    modalBackdrop: document.getElementById("modal-backdrop"),
    crudModalBackdrop: document.getElementById("crud-modal-backdrop"),
    loginForm: document.getElementById("login-form"),
    vehicleTableBody: document.getElementById("vehicle-table-body"),
    stationTableBody: document.getElementById("station-table-body"),
    scheduleTableBody: document.getElementById("schedule-table-body"),
    userRouteTimeline: document.getElementById("user-route-timeline"),
    userDetailPanel: document.getElementById("user-detail-panel"),
    crudForm: document.getElementById("crud-form"),
    crudModalTitle: document.getElementById("crud-modal-title"),
    crudModalBadge: document.getElementById("crud-modal-badge"),
    vehicleSearch: document.getElementById("vehicle-search"),
    stationSearch: document.getElementById("station-search"),
    scheduleSearch: document.getElementById("schedule-search")
};

function switchView(targetView) {
    Object.values(views).forEach((view) => view.classList.remove("view-active"));
    views[targetView].classList.add("view-active");
}

function stationNameById(stationId) {
    const station = state.stations.find((entry) => entry.id === stationId);
    return station ? station.name : "未知站点";
}

function nextId(items) {
    return items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

function renderVehicles() {
    const keyword = state.filters.vehicles.toLowerCase();
    const rows = state.vehicles
        .filter((vehicle) =>
            vehicle.code.toLowerCase().includes(keyword) || vehicle.plate.toLowerCase().includes(keyword))
        .map((vehicle) => `
            <tr>
                <td>${vehicle.code}</td>
                <td>${vehicle.plate}</td>
                <td>${vehicle.capacity}</td>
                <td>${vehicle.driver}</td>
                <td>${vehicle.maxRunMinutes} 分钟</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action edit" type="button" data-crud-edit="vehicles" data-id="${vehicle.id}">编辑</button>
                        <button class="table-action delete" type="button" data-crud-delete="vehicles" data-id="${vehicle.id}">删除</button>
                    </div>
                </td>
            </tr>
        `)
        .join("");

    elements.vehicleTableBody.innerHTML = rows || `<tr><td colspan="6">暂无匹配车辆</td></tr>`;
}

function renderStations() {
    const keyword = state.filters.stations.toLowerCase();
    const rows = state.stations
        .filter((station) => station.name.toLowerCase().includes(keyword))
        .map((station) => `
            <tr>
                <td>${station.name}</td>
                <td>${station.demand}</td>
                <td>${station.service} 分钟</td>
                <td>${station.windowStart} - ${station.windowEnd}</td>
                <td>${station.type}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action edit" type="button" data-crud-edit="stations" data-id="${station.id}">编辑</button>
                        <button class="table-action delete" type="button" data-crud-delete="stations" data-id="${station.id}">删除</button>
                    </div>
                </td>
            </tr>
        `)
        .join("");

    elements.stationTableBody.innerHTML = rows || `<tr><td colspan="6">暂无匹配站点</td></tr>`;
}

function renderSchedule() {
    const keyword = state.filters.schedule.toLowerCase();
    const rows = state.schedule
        .filter((item) => `${item.vehicleId}`.includes(keyword) || stationNameById(item.stationId).toLowerCase().includes(keyword))
        .map((item) => `
            <tr>
                <td>${item.vehicleId}</td>
                <td>${item.stationId}</td>
                <td>${item.visitOrder}</td>
                <td>${item.arrivalTime}</td>
                <td>${item.departureTime}</td>
                <td>${item.feasibleFlag}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-action edit" type="button" data-crud-edit="schedule" data-id="${item.scheduleCode}">编辑</button>
                        <button class="table-action delete" type="button" data-crud-delete="schedule" data-id="${item.scheduleCode}">删除</button>
                    </div>
                </td>
            </tr>
        `)
        .join("");

    elements.scheduleTableBody.innerHTML = rows || `<tr><td colspan="7">暂无匹配调度记录</td></tr>`;
}

function renderUserRoute() {
    const route = state.schedule
        .filter((item) => item.vehicleId === 1)
        .sort((a, b) => a.visitOrder - b.visitOrder);

    elements.userRouteTimeline.innerHTML = route.map((item) => `
        <li>
            <strong>${item.visitOrder}. ${stationNameById(item.stationId)}</strong>
            <span>预计到达：${item.arrivalTime.slice(11, 16)}</span>
            <span>预计离开：${item.departureTime.slice(11, 16)}</span>
        </li>
    `).join("");

    elements.userDetailPanel.innerHTML = `
        <p><strong>乘车车辆：</strong> BUS-01</p>
        <p><strong>预计总运行时长：</strong> 19 分钟</p>
        <p><strong>是否可行：</strong> 是</p>
        <p><strong>终点站：</strong> 西安财经大学长安校区东大门</p>
    `;
}

function renderAll() {
    renderVehicles();
    renderStations();
    renderSchedule();
    renderUserRoute();
}

function openInfoModal() {
    elements.modalBackdrop.classList.add("modal-open");
    elements.modalBackdrop.setAttribute("aria-hidden", "false");
}

function closeInfoModal() {
    elements.modalBackdrop.classList.remove("modal-open");
    elements.modalBackdrop.setAttribute("aria-hidden", "true");
}

function getCrudItem(type, id) {
    if (type === "vehicles") {
        return state.vehicles.find((item) => item.id === Number(id));
    }
    if (type === "stations") {
        return state.stations.find((item) => item.id === Number(id));
    }
    return state.schedule.find((item) => item.scheduleCode === id);
}

function crudTemplate(type, item = {}) {
    if (type === "vehicles") {
        return `
            <div class="crud-grid">
                <label class="field"><span>车辆编号</span><input name="code" value="${item.code || ""}" required></label>
                <label class="field"><span>车牌号</span><input name="plate" value="${item.plate || ""}" required></label>
                <label class="field"><span>容量</span><input name="capacity" type="number" min="1" value="${item.capacity || ""}" required></label>
                <label class="field"><span>司机</span><input name="driver" value="${item.driver || ""}" required></label>
                <label class="field"><span>最大运行时长</span><input name="maxRunMinutes" type="number" min="1" value="${item.maxRunMinutes || ""}" required></label>
            </div>
            <p class="modal-note">用于管理员端模拟车辆增删查改，后续可替换为真实接口提交。</p>
            <div class="modal-actions">
                <button class="secondary-button" type="button" data-action="close-crud-modal">取消</button>
                <button class="primary-button" type="submit">保存车辆</button>
            </div>
        `;
    }

    if (type === "stations") {
        return `
            <div class="crud-grid">
                <label class="field"><span>站点名称</span><input name="name" value="${item.name || ""}" required></label>
                <label class="field"><span>需求人数</span><input name="demand" type="number" min="0" value="${item.demand ?? ""}" required></label>
                <label class="field"><span>服务时长</span><input name="service" type="number" min="0" value="${item.service ?? ""}" required></label>
                <label class="field"><span>起始时间窗</span><input name="windowStart" type="time" value="${item.windowStart || ""}" required></label>
                <label class="field"><span>结束时间窗</span><input name="windowEnd" type="time" value="${item.windowEnd || ""}" required></label>
                <label class="field"><span>类型</span>
                    <select name="type">
                        <option value="上车点" ${item.type === "上车点" ? "selected" : ""}>上车点</option>
                        <option value="终点站" ${item.type === "终点站" ? "selected" : ""}>终点站</option>
                    </select>
                </label>
            </div>
            <div class="modal-actions">
                <button class="secondary-button" type="button" data-action="close-crud-modal">取消</button>
                <button class="primary-button" type="submit">保存站点</button>
            </div>
        `;
    }

    return `
        <div class="crud-grid">
            <label class="field"><span>车辆 ID</span><input name="vehicleId" type="number" min="1" value="${item.vehicleId ?? ""}" required></label>
            <label class="field"><span>站点 ID</span><input name="stationId" type="number" min="1" value="${item.stationId ?? ""}" required></label>
            <label class="field"><span>访问顺序</span><input name="visitOrder" type="number" min="1" value="${item.visitOrder ?? ""}" required></label>
            <label class="field"><span>到达时间</span><input name="arrivalTime" value="${item.arrivalTime || ""}" placeholder="2026-03-17 07:05:00" required></label>
            <label class="field"><span>离开时间</span><input name="departureTime" value="${item.departureTime || ""}" placeholder="2026-03-17 07:08:00" required></label>
            <label class="field"><span>可行标记</span>
                <select name="feasibleFlag">
                    <option value="1" ${Number(item.feasibleFlag) === 1 ? "selected" : ""}>1</option>
                    <option value="0" ${Number(item.feasibleFlag) === 0 ? "selected" : ""}>0</option>
                </select>
            </label>
        </div>
        <div class="modal-actions">
            <button class="secondary-button" type="button" data-action="close-crud-modal">取消</button>
            <button class="primary-button" type="submit">保存记录</button>
        </div>
    `;
}

function openCrudModal(type, mode, id = null) {
    state.crudContext = { type, mode, id };
    const item = mode === "edit" ? getCrudItem(type, id) : {};

    const labels = {
        vehicles: "车辆管理",
        stations: "站点管理",
        schedule: "调度结果"
    };

    elements.crudModalBadge.textContent = labels[type];
    elements.crudModalTitle.textContent = mode === "create" ? "新增数据" : "编辑数据";
    elements.crudForm.innerHTML = crudTemplate(type, item);
    elements.crudModalBackdrop.classList.add("modal-open");
    elements.crudModalBackdrop.setAttribute("aria-hidden", "false");
}

function closeCrudModal() {
    elements.crudModalBackdrop.classList.remove("modal-open");
    elements.crudModalBackdrop.setAttribute("aria-hidden", "true");
    elements.crudForm.innerHTML = "";
    state.crudContext = { type: null, mode: "create", id: null };
}

function createVehicle(payload) {
    state.vehicles.push({
        id: nextId(state.vehicles),
        code: payload.code,
        plate: payload.plate,
        capacity: Number(payload.capacity),
        driver: payload.driver,
        maxRunMinutes: Number(payload.maxRunMinutes)
    });
}

function updateVehicle(id, payload) {
    const vehicle = getCrudItem("vehicles", id);
    if (!vehicle) return;
    vehicle.code = payload.code;
    vehicle.plate = payload.plate;
    vehicle.capacity = Number(payload.capacity);
    vehicle.driver = payload.driver;
    vehicle.maxRunMinutes = Number(payload.maxRunMinutes);
}

function createStation(payload) {
    state.stations.push({
        id: nextId(state.stations),
        name: payload.name,
        demand: Number(payload.demand),
        service: Number(payload.service),
        windowStart: payload.windowStart,
        windowEnd: payload.windowEnd,
        type: payload.type
    });
}

function updateStation(id, payload) {
    const station = getCrudItem("stations", id);
    if (!station) return;
    station.name = payload.name;
    station.demand = Number(payload.demand);
    station.service = Number(payload.service);
    station.windowStart = payload.windowStart;
    station.windowEnd = payload.windowEnd;
    station.type = payload.type;
}

function createSchedule(payload) {
    const vehicleId = Number(payload.vehicleId);
    const visitOrder = Number(payload.visitOrder);
    state.schedule.push({
        scheduleCode: `MANUALV${vehicleId}O${visitOrder}${Date.now()}`,
        vehicleId,
        stationId: Number(payload.stationId),
        visitOrder,
        arrivalTime: payload.arrivalTime,
        departureTime: payload.departureTime,
        feasibleFlag: Number(payload.feasibleFlag)
    });
}

function updateSchedule(id, payload) {
    const record = getCrudItem("schedule", id);
    if (!record) return;
    record.vehicleId = Number(payload.vehicleId);
    record.stationId = Number(payload.stationId);
    record.visitOrder = Number(payload.visitOrder);
    record.arrivalTime = payload.arrivalTime;
    record.departureTime = payload.departureTime;
    record.feasibleFlag = Number(payload.feasibleFlag);
}

function deleteItem(type, id) {
    if (type === "vehicles") {
        state.vehicles = state.vehicles.filter((item) => item.id !== Number(id));
    } else if (type === "stations") {
        state.stations = state.stations.filter((item) => item.id !== Number(id));
    } else {
        state.schedule = state.schedule.filter((item) => item.scheduleCode !== id);
    }
    renderAll();
}

function handleCrudSubmit(event) {
    event.preventDefault();
    const formData = new FormData(elements.crudForm);
    const payload = Object.fromEntries(formData.entries());
    const { type, mode, id } = state.crudContext;

    if (type === "vehicles") {
        mode === "create" ? createVehicle(payload) : updateVehicle(id, payload);
    } else if (type === "stations") {
        mode === "create" ? createStation(payload) : updateStation(id, payload);
    } else if (type === "schedule") {
        mode === "create" ? createSchedule(payload) : updateSchedule(id, payload);
    }

    renderAll();
    closeCrudModal();
}

function handleAdminTabs() {
    const navItems = document.querySelectorAll("[data-admin-tab]");
    const tabs = document.querySelectorAll(".admin-tab");

    navItems.forEach((item) => {
        item.addEventListener("click", () => {
            navItems.forEach((nav) => nav.classList.remove("nav-item-active"));
            tabs.forEach((tab) => tab.classList.remove("admin-tab-active"));
            item.classList.add("nav-item-active");
            document.getElementById(`admin-${item.dataset.adminTab}`).classList.add("admin-tab-active");
        });
    });
}

function handleModalActions() {
    document.querySelectorAll("[data-action='open-modal']").forEach((button) => {
        button.addEventListener("click", openInfoModal);
    });

    document.querySelectorAll("[data-action='close-modal']").forEach((button) => {
        button.addEventListener("click", closeInfoModal);
    });

    elements.modalBackdrop.addEventListener("click", (event) => {
        if (event.target === elements.modalBackdrop) {
            closeInfoModal();
        }
    });

    elements.crudModalBackdrop.addEventListener("click", (event) => {
        if (event.target === elements.crudModalBackdrop) {
            closeCrudModal();
        }
    });

    document.addEventListener("click", (event) => {
        const createType = event.target.dataset.crudCreate;
        const editType = event.target.dataset.crudEdit;
        const deleteType = event.target.dataset.crudDelete;
        const recordId = event.target.dataset.id;

        if (createType) {
            openCrudModal(createType, "create");
        } else if (editType) {
            openCrudModal(editType, "edit", recordId);
        } else if (deleteType) {
            deleteItem(deleteType, recordId);
        } else if (event.target.dataset.action === "close-crud-modal") {
            closeCrudModal();
        }
    });
}

function handleLogin() {
    elements.loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(elements.loginForm);
        const username = String(formData.get("username") || "").trim();
        const role = String(formData.get("role") || "user");

        if (!username) return;
        if (role === "admin" || username === "admin") {
            switchView("admin");
            return;
        }
        switchView("user");
    });
}

function handleLogout() {
    document.querySelectorAll("[data-action='logout']").forEach((button) => {
        button.addEventListener("click", () => {
            elements.loginForm.reset();
            closeInfoModal();
            closeCrudModal();
            switchView("login");
        });
    });
}

function handleSearch() {
    elements.vehicleSearch.addEventListener("input", (event) => {
        state.filters.vehicles = event.target.value.trim();
        renderVehicles();
    });

    elements.stationSearch.addEventListener("input", (event) => {
        state.filters.stations = event.target.value.trim();
        renderStations();
    });

    elements.scheduleSearch.addEventListener("input", (event) => {
        state.filters.schedule = event.target.value.trim();
        renderSchedule();
    });
}

function handleCrudForm() {
    elements.crudForm.addEventListener("submit", handleCrudSubmit);
}

renderAll();
handleAdminTabs();
handleModalActions();
handleLogin();
handleLogout();
handleSearch();
handleCrudForm();
