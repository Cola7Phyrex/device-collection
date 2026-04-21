const STORAGE_KEYS = {
    devices: "device_manager_devices",
    accessories: "device_manager_accessories",
    subscriptions: "device_manager_subscriptions",
    wishlist: "device_manager_wishlist"
};

const PAGE_META = {
    devices: { title: "设备", subtitle: "记录你的设备生态与使用状态" },
    accessories: { title: "配件", subtitle: "集中维护你的常用配件与摆放位置" },
    subscriptions: { title: "订阅", subtitle: "追踪周期付款和年度成本" },
    wishlist: { title: "欲购", subtitle: "整理待升级设备与购买动机" },
    data: { title: "数据", subtitle: "管理本地备份与全局支出统计" }
};

const CYCLE_DAYS = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    halfyear: 180,
    yearly: 365
};

let currentPage = "devices";
let currentFilter = "all";
let editingId = null;
let subscriptionViewMode = "monthly";

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initSubTabs();
    initSubscriptionToggle();
    initGlobalActions();
    renderAll();
    updateHeader();
});

function initTabs() {
    document.querySelectorAll(".tab-item").forEach((tab) => {
        tab.addEventListener("click", () => {
            switchPage(tab.dataset.page);
        });
    });
}

function initSubTabs() {
    document.querySelectorAll(".sub-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".sub-tab").forEach((item) => item.classList.remove("active"));
            tab.classList.add("active");
            currentFilter = tab.dataset.filter;
            renderDevices();
        });
    });
}

function initSubscriptionToggle() {
    document.getElementById("subscriptionToggle").addEventListener("click", () => {
        subscriptionViewMode = subscriptionViewMode === "monthly" ? "yearly" : "monthly";
        document.getElementById("subscriptionToggleText").textContent = subscriptionViewMode === "monthly" ? "每月平均" : "每年平均";
        updateSubscriptionSummary();
    });
}

function initGlobalActions() {
    document.getElementById("fabBtn").addEventListener("click", openModal);
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", (event) => {
        if (event.target.id === "modal") {
            closeModal();
        }
    });
    document.getElementById("importBtn").addEventListener("click", importData);
    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("deleteAllBtn").addEventListener("click", confirmDeleteAll);
    document.getElementById("importFile").addEventListener("change", handleImport);
}

function switchPage(page) {
    currentPage = page;
    editingId = null;

    document.querySelectorAll(".tab-item").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.page === page);
    });

    document.querySelectorAll(".page").forEach((pageNode) => {
        pageNode.classList.toggle("active", pageNode.id === `page-${page}`);
    });

    updateHeader();

    if (page === "data") {
        updateDataStats();
    }
    if (page === "subscriptions") {
        updateSubscriptionSummary();
    }
}

function updateHeader() {
    const meta = PAGE_META[currentPage];
    document.getElementById("pageTitle").textContent = meta.title;
    document.getElementById("pageSubtitle").textContent = meta.subtitle;
    document.getElementById("fabBtn").classList.toggle("hidden", currentPage === "data");
}

function getData(key) {
    const raw = localStorage.getItem(STORAGE_KEYS[key]);
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveData(key, data) {
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function calculateServiceDays(purchaseDate) {
    if (!purchaseDate) {
        return 0;
    }

    const start = new Date(purchaseDate);
    if (Number.isNaN(start.getTime())) {
        return 0;
    }

    const now = new Date();
    return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

function formatDuration(days) {
    if (days < 30) {
        return `${days}天`;
    }
    if (days < 365) {
        return `${Math.floor(days / 30)}个月`;
    }

    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}年${months}个月` : `${years}年`;
}

function renderAll() {
    renderDevices();
    renderAccessories();
    renderSubscriptions();
    renderWishlist();
}

function renderDevices() {
    const devices = getData("devices");
    const container = document.getElementById("devicesList");
    const filtered = currentFilter === "all" ? devices : devices.filter((device) => device.type === currentFilter);

    if (filtered.length === 0) {
        container.innerHTML = createEmptyState("📱", "暂无设备");
        bindListActions(container, "devices");
        return;
    }

    container.innerHTML = filtered.map((device) => {
        const serviceDays = calculateServiceDays(device.purchaseDate);
        const lifespan = { phone: 4, tablet: 6, computer: 8 }[device.type] || 4;
        const warrantyPercent = Math.min(100, Math.round((serviceDays / (lifespan * 365)) * 100));
        const typeLabels = { phone: "手机", tablet: "平板", computer: "电脑" };
        const frequency = Array.isArray(device.frequency) ? device.frequency : [false, false, false, false, false, false, false];

        return `
            <article class="card" data-type="devices" data-id="${escapeHtml(device.id)}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(device.name)}</div>
                        <div class="card-subtitle">${escapeHtml(device.brand || typeLabels[device.type] || "设备")}${device.releaseYear ? ` · ${escapeHtml(device.releaseYear)}` : ""}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" type="button" data-action="edit">✏️</button>
                        <button class="btn-icon delete" type="button" data-action="delete">🗑️</button>
                    </div>
                </div>
                <div class="card-stats">
                    <div class="stat">
                        <div class="stat-label">服役时长</div>
                        <div class="stat-value">${formatDuration(serviceDays)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">保质期</div>
                        <div class="stat-value">${warrantyPercent}%</div>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${warrantyPercent}%"></div></div>
                    </div>
                </div>
                ${renderFrequencyBar(frequency)}
                ${renderTags(device.tags)}
            </article>
        `;
    }).join("");

    bindListActions(container, "devices");
}

function renderAccessories() {
    const accessories = getData("accessories");
    const container = document.getElementById("accessoriesList");

    if (accessories.length === 0) {
        container.innerHTML = createEmptyState("🎧", "暂无配件");
        bindListActions(container, "accessories");
        return;
    }

    container.innerHTML = accessories.map((item) => {
        const serviceDays = calculateServiceDays(item.purchaseDate);
        const frequency = Array.isArray(item.frequency) ? item.frequency : [false, false, false, false, false, false, false];

        return `
            <article class="card" data-type="accessories" data-id="${escapeHtml(item.id)}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(item.name)}</div>
                        <div class="card-subtitle">${escapeHtml(item.brand || "配件")}${item.location ? ` · ${escapeHtml(item.location)}` : ""}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" type="button" data-action="edit">✏️</button>
                        <button class="btn-icon delete" type="button" data-action="delete">🗑️</button>
                    </div>
                </div>
                <div class="card-stats">
                    <div class="stat">
                        <div class="stat-label">服役时长</div>
                        <div class="stat-value">${formatDuration(serviceDays)}</div>
                    </div>
                </div>
                ${renderFrequencyBar(frequency)}
                ${renderTags(item.tags)}
            </article>
        `;
    }).join("");

    bindListActions(container, "accessories");
}

function renderSubscriptions() {
    const subscriptions = getData("subscriptions");
    const container = document.getElementById("subscriptionsList");

    if (subscriptions.length === 0) {
        container.innerHTML = createEmptyState("📅", "暂无订阅");
        updateSubscriptionSummary();
        bindListActions(container, "subscriptions");
        return;
    }

    container.innerHTML = subscriptions.map((sub) => {
        const nextPayment = calculateNextPayment(sub.startDate, sub.cycle);
        const isOverdue = nextPayment !== "未设置" && new Date(nextPayment) < new Date();
        const frequency = Array.isArray(sub.frequency) ? sub.frequency : [false, false, false, false, false, false, false];

        return `
            <article class="card" data-type="subscriptions" data-id="${escapeHtml(sub.id)}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(sub.name)}</div>
                        <div class="card-subtitle">${escapeHtml(sub.brand || "订阅服务")}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" type="button" data-action="edit">✏️</button>
                        <button class="btn-icon delete" type="button" data-action="delete">🗑️</button>
                    </div>
                </div>
                <div class="card-stats">
                    <div class="stat">
                        <div class="stat-label">价格</div>
                        <div class="stat-value">¥${escapeHtml(sub.price || 0)}</div>
                    </div>
                </div>
                <div class="next-payment ${isOverdue ? "overdue" : ""}">
                    <span>${isOverdue ? "⚠️" : "💳"}</span>
                    <span>下次扣款: ${escapeHtml(nextPayment)}</span>
                </div>
                ${renderFrequencyBar(frequency)}
                ${renderTags(sub.tags)}
            </article>
        `;
    }).join("");

    updateSubscriptionSummary();
    bindListActions(container, "subscriptions");
}

function renderWishlist() {
    const wishlist = getData("wishlist");
    const container = document.getElementById("wishlistList");

    if (wishlist.length === 0) {
        container.innerHTML = createEmptyState("🛒", "暂无欲购项目");
        bindListActions(container, "wishlist");
        return;
    }

    container.innerHTML = wishlist.map((item) => `
        <article class="card" data-type="wishlist" data-id="${escapeHtml(item.id)}">
            <div class="card-header">
                <div>
                    <div class="card-title">${escapeHtml(item.name)}</div>
                    <div class="card-subtitle">${escapeHtml(item.brand || "待购")}${item.releaseDate ? ` · 发布: ${escapeHtml(item.releaseDate)}` : ""}</div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon" type="button" data-action="edit">✏️</button>
                    <button class="btn-icon delete" type="button" data-action="delete">🗑️</button>
                </div>
            </div>
            ${item.price ? `<div class="card-stats"><div class="stat"><div class="stat-label">价格</div><div class="stat-value">¥${escapeHtml(item.price)}</div></div></div>` : ""}
            ${item.reason ? `<p class="wish-reason">${escapeHtml(item.reason)}</p>` : ""}
            ${renderTags(item.tags)}
        </article>
    `).join("");

    bindListActions(container, "wishlist");
}

function createEmptyState(icon, title) {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <p>${title}</p>
            <p class="inline-note">点击右下角按钮添加</p>
        </div>
    `;
}

function renderFrequencyBar(frequency) {
    return `
        <div class="frequency-bar">
            ${[0, 1, 2, 3, 4, 5, 6].map((index) => `
                <button
                    class="freq-day ${frequency[index] ? "active" : ""}"
                    type="button"
                    data-action="toggle-frequency"
                    data-day-index="${index}"
                ></button>
            `).join("")}
        </div>
    `;
}

function renderTags(tags) {
    if (!tags) {
        return "";
    }

    const items = String(tags)
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");

    return items ? `<div class="tag-list">${items}</div>` : "";
}

function bindListActions(container, type) {
    container.querySelectorAll("[data-action]").forEach((node) => {
        node.addEventListener("click", (event) => {
            const card = event.currentTarget.closest("[data-id]");
            if (!card) {
                return;
            }

            const id = card.dataset.id;
            const action = event.currentTarget.dataset.action;

            if (action === "edit") {
                openEditByType(type, id);
            } else if (action === "delete") {
                deleteByType(type, id);
            } else if (action === "toggle-frequency") {
                toggleFrequency(type, id, Number(event.currentTarget.dataset.dayIndex));
            }
        });
    });
}

function openEditByType(type, id) {
    if (type === "devices") {
        editDevice(id);
    } else if (type === "accessories") {
        editAccessory(id);
    } else if (type === "subscriptions") {
        editSubscription(id);
    } else if (type === "wishlist") {
        editWishlist(id);
    }
}

function deleteByType(type, id) {
    if (type === "devices") {
        deleteDevice(id);
    } else if (type === "accessories") {
        deleteAccessory(id);
    } else if (type === "subscriptions") {
        deleteSubscription(id);
    } else if (type === "wishlist") {
        deleteWishlist(id);
    }
}

function toggleFrequency(type, id, dayIndex) {
    const data = getData(type);
    const item = data.find((entry) => entry.id === id);
    if (!item) {
        return;
    }

    item.frequency = Array.isArray(item.frequency) ? item.frequency : [false, false, false, false, false, false, false];
    item.frequency[dayIndex] = !item.frequency[dayIndex];

    saveData(type, data);

    if (type === "devices") {
        renderDevices();
    } else if (type === "accessories") {
        renderAccessories();
    } else if (type === "subscriptions") {
        renderSubscriptions();
    }
}

function openModal() {
    editingId = null;
    if (currentPage === "devices") {
        showDeviceForm();
    } else if (currentPage === "accessories") {
        showAccessoryForm();
    } else if (currentPage === "subscriptions") {
        showSubscriptionForm();
    } else if (currentPage === "wishlist") {
        showWishlistForm();
    }
}

function closeModal() {
    document.getElementById("modal").classList.remove("active");
    document.getElementById("modal").setAttribute("aria-hidden", "true");
}

function openModalShell(title, content) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = content;
    document.getElementById("modal").classList.add("active");
    document.getElementById("modal").setAttribute("aria-hidden", "false");
}

function bindFormAction(id, handler) {
    const node = document.getElementById(id);
    if (node) {
        node.addEventListener("click", handler);
    }
}

function showDeviceForm(device = null) {
    editingId = device ? device.id : null;
    openModalShell(device ? "编辑设备" : "新建设备", `
        <button class="btn-match" id="matchDeviceBtn" type="button">🔍 匹配数据</button>
        <div class="form-group">
            <label class="form-label">设备名称 <span class="required">*</span></label>
            <input type="text" class="form-input" id="deviceName" value="${escapeHtml(device?.name || "")}" placeholder="例如: iPhone 15 Pro">
        </div>
        <div class="form-group">
            <label class="form-label">设备类型 <span class="required">*</span></label>
            <select class="form-select" id="deviceType">
                <option value="">请选择</option>
                <option value="phone" ${device?.type === "phone" ? "selected" : ""}>手机</option>
                <option value="tablet" ${device?.type === "tablet" ? "selected" : ""}>平板</option>
                <option value="computer" ${device?.type === "computer" ? "selected" : ""}>电脑</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">品牌</label>
            <input type="text" class="form-input" id="deviceBrand" value="${escapeHtml(device?.brand || "")}" placeholder="例如: Apple">
        </div>
        <div class="form-group">
            <label class="form-label">购买时间</label>
            <input type="date" class="form-input" id="devicePurchaseDate" value="${escapeHtml(device?.purchaseDate || "")}">
        </div>
        <div class="form-group">
            <label class="form-label">购买价格</label>
            <input type="number" class="form-input" id="devicePrice" value="${escapeHtml(device?.price || "")}" placeholder="例如: 8999">
        </div>
        <div class="form-group">
            <label class="form-label">发布年份</label>
            <input type="number" class="form-input" id="deviceReleaseYear" value="${escapeHtml(device?.releaseYear || "")}" placeholder="例如: 2024">
        </div>
        <div class="form-group">
            <label class="form-label">内存</label>
            <input type="text" class="form-input" id="deviceRAM" value="${escapeHtml(device?.ram || "")}" placeholder="例如: 8GB">
        </div>
        <div class="form-group">
            <label class="form-label">硬盘</label>
            <input type="text" class="form-input" id="deviceStorage" value="${escapeHtml(device?.storage || "")}" placeholder="例如: 256GB">
        </div>
        <div class="form-group">
            <label class="form-label">CPU</label>
            <input type="text" class="form-input" id="deviceCPU" value="${escapeHtml(device?.cpu || "")}" placeholder="例如: A17 Pro">
        </div>
        <div class="form-group">
            <label class="form-label">GPU (仅电脑)</label>
            <input type="text" class="form-input" id="deviceGPU" value="${escapeHtml(device?.gpu || "")}" placeholder="例如: M3 Pro GPU">
        </div>
        <div class="form-group">
            <label class="form-label">标签 (用逗号分隔)</label>
            <input type="text" class="form-input" id="deviceTags" value="${escapeHtml(device?.tags || "")}" placeholder="例如: 主力机, 工作用">
        </div>
        <button class="btn-primary" id="saveDeviceBtn" type="button">保存</button>
        ${device ? '<button class="btn-danger" id="deleteDeviceBtn" type="button">删除</button>' : ""}
    `);

    bindFormAction("matchDeviceBtn", matchDeviceData);
    bindFormAction("saveDeviceBtn", saveDevice);
    bindFormAction("deleteDeviceBtn", () => {
        if (deleteDevice(device.id)) {
            closeModal();
        }
    });
}

function matchDeviceData() {
    const name = document.getElementById("deviceName").value;
    const brand = document.getElementById("deviceBrand").value;
    const year = document.getElementById("deviceReleaseYear").value;

    if (!name) {
        alert("请先输入设备名称");
        return;
    }

    const query = `${brand || ""} ${name} ${year || ""} 价格 发布年份 内存 硬盘 CPU GPU`.trim();
    window.open(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, "_blank");
}

function saveDevice() {
    const name = document.getElementById("deviceName").value.trim();
    const type = document.getElementById("deviceType").value;

    if (!name || !type) {
        alert("请填写必填项");
        return;
    }

    const device = {
        id: editingId || generateId(),
        name,
        type,
        brand: document.getElementById("deviceBrand").value.trim(),
        purchaseDate: document.getElementById("devicePurchaseDate").value,
        price: document.getElementById("devicePrice").value,
        releaseYear: document.getElementById("deviceReleaseYear").value,
        ram: document.getElementById("deviceRAM").value.trim(),
        storage: document.getElementById("deviceStorage").value.trim(),
        cpu: document.getElementById("deviceCPU").value.trim(),
        gpu: document.getElementById("deviceGPU").value.trim(),
        tags: document.getElementById("deviceTags").value.trim(),
        frequency: editingId ? (getData("devices").find((item) => item.id === editingId)?.frequency || [false, false, false, false, false, false, false]) : [false, false, false, false, false, false, false]
    };

    const devices = getData("devices");
    if (editingId) {
        const index = devices.findIndex((item) => item.id === editingId);
        if (index >= 0) {
            devices[index] = device;
        }
    } else {
        devices.push(device);
    }

    saveData("devices", devices);
    closeModal();
    renderDevices();
    updateDataStats();
}

function editDevice(id) {
    const device = getData("devices").find((item) => item.id === id);
    if (device) {
        showDeviceForm(device);
    }
}

function deleteDevice(id) {
    if (!confirm("确定要删除这个设备吗?")) {
        return false;
    }

    saveData("devices", getData("devices").filter((item) => item.id !== id));
    renderDevices();
    updateDataStats();
    return true;
}

function showAccessoryForm(item = null) {
    editingId = item ? item.id : null;
    openModalShell(item ? "编辑配件" : "新建配件", `
        <div class="form-group">
            <label class="form-label">配件名称 <span class="required">*</span></label>
            <input type="text" class="form-input" id="accName" value="${escapeHtml(item?.name || "")}" placeholder="例如: AirPods Pro">
        </div>
        <div class="form-group">
            <label class="form-label">品牌</label>
            <input type="text" class="form-input" id="accBrand" value="${escapeHtml(item?.brand || "")}" placeholder="例如: Apple">
        </div>
        <div class="form-group">
            <label class="form-label">购买时间</label>
            <input type="date" class="form-input" id="accPurchaseDate" value="${escapeHtml(item?.purchaseDate || "")}">
        </div>
        <div class="form-group">
            <label class="form-label">购买价格</label>
            <input type="number" class="form-input" id="accPrice" value="${escapeHtml(item?.price || "")}" placeholder="例如: 1999">
        </div>
        <div class="form-group">
            <label class="form-label">发布年份</label>
            <input type="number" class="form-input" id="accReleaseYear" value="${escapeHtml(item?.releaseYear || "")}" placeholder="例如: 2024">
        </div>
        <div class="form-group">
            <label class="form-label">位置</label>
            <input type="text" class="form-input" id="accLocation" value="${escapeHtml(item?.location || "")}" placeholder="例如: 办公室">
        </div>
        <div class="form-group">
            <label class="form-label">标签 (用逗号分隔)</label>
            <input type="text" class="form-input" id="accTags" value="${escapeHtml(item?.tags || "")}" placeholder="例如: 音频, 通勤用">
        </div>
        <button class="btn-primary" id="saveAccessoryBtn" type="button">保存</button>
        ${item ? '<button class="btn-danger" id="deleteAccessoryBtn" type="button">删除</button>' : ""}
    `);

    bindFormAction("saveAccessoryBtn", saveAccessory);
    bindFormAction("deleteAccessoryBtn", () => {
        if (deleteAccessory(item.id)) {
            closeModal();
        }
    });
}

function saveAccessory() {
    const name = document.getElementById("accName").value.trim();
    if (!name) {
        alert("请填写配件名称");
        return;
    }

    const accessory = {
        id: editingId || generateId(),
        name,
        brand: document.getElementById("accBrand").value.trim(),
        purchaseDate: document.getElementById("accPurchaseDate").value,
        price: document.getElementById("accPrice").value,
        releaseYear: document.getElementById("accReleaseYear").value,
        location: document.getElementById("accLocation").value.trim(),
        tags: document.getElementById("accTags").value.trim(),
        frequency: editingId ? (getData("accessories").find((item) => item.id === editingId)?.frequency || [false, false, false, false, false, false, false]) : [false, false, false, false, false, false, false]
    };

    const accessories = getData("accessories");
    if (editingId) {
        const index = accessories.findIndex((item) => item.id === editingId);
        if (index >= 0) {
            accessories[index] = accessory;
        }
    } else {
        accessories.push(accessory);
    }

    saveData("accessories", accessories);
    closeModal();
    renderAccessories();
    updateDataStats();
}

function editAccessory(id) {
    const item = getData("accessories").find((entry) => entry.id === id);
    if (item) {
        showAccessoryForm(item);
    }
}

function deleteAccessory(id) {
    if (!confirm("确定要删除这个配件吗?")) {
        return false;
    }

    saveData("accessories", getData("accessories").filter((item) => item.id !== id));
    renderAccessories();
    updateDataStats();
    return true;
}

function showSubscriptionForm(sub = null) {
    editingId = sub ? sub.id : null;
    const customCycle = sub && sub.cycle && !Object.prototype.hasOwnProperty.call(CYCLE_DAYS, sub.cycle) ? sub.cycle : "";

    openModalShell(sub ? "编辑订阅" : "新建订阅", `
        <div class="form-group">
            <label class="form-label">订阅名称 <span class="required">*</span></label>
            <input type="text" class="form-input" id="subName" value="${escapeHtml(sub?.name || "")}" placeholder="例如: iCloud+">
        </div>
        <div class="form-group">
            <label class="form-label">品牌</label>
            <input type="text" class="form-input" id="subBrand" value="${escapeHtml(sub?.brand || "")}" placeholder="例如: Apple">
        </div>
        <div class="form-group">
            <label class="form-label">订阅价格</label>
            <input type="number" class="form-input" id="subPrice" value="${escapeHtml(sub?.price || "")}" placeholder="例如: 68">
        </div>
        <div class="form-group">
            <label class="form-label">付费周期</label>
            <select class="form-select" id="subCycle">
                <option value="">请选择</option>
                <option value="daily" ${sub?.cycle === "daily" ? "selected" : ""}>每天 (1日)</option>
                <option value="weekly" ${sub?.cycle === "weekly" ? "selected" : ""}>每周 (7日)</option>
                <option value="monthly" ${sub?.cycle === "monthly" ? "selected" : ""}>每月 (30日)</option>
                <option value="quarterly" ${sub?.cycle === "quarterly" ? "selected" : ""}>每季度 (90日)</option>
                <option value="halfyear" ${sub?.cycle === "halfyear" ? "selected" : ""}>每半年 (180日)</option>
                <option value="yearly" ${sub?.cycle === "yearly" ? "selected" : ""}>每年 (365日)</option>
                <option value="custom" ${customCycle ? "selected" : ""}>自定义</option>
            </select>
        </div>
        <div class="form-group" id="customCycleGroup" style="display: ${customCycle ? "block" : "none"}">
            <label class="form-label">自定义周期 (天)</label>
            <input type="number" class="form-input" id="subCustomCycle" value="${escapeHtml(customCycle)}" placeholder="例如: 45">
        </div>
        <div class="form-group">
            <label class="form-label">订阅日期</label>
            <input type="date" class="form-input" id="subStartDate" value="${escapeHtml(sub?.startDate || "")}">
        </div>
        <div class="form-group">
            <label class="form-label">标签 (用逗号分隔)</label>
            <input type="text" class="form-input" id="subTags" value="${escapeHtml(sub?.tags || "")}" placeholder="例如: 云服务, 必备">
        </div>
        <button class="btn-primary" id="saveSubscriptionBtn" type="button">保存</button>
        ${sub ? '<button class="btn-danger" id="deleteSubscriptionBtn" type="button">删除</button>' : ""}
    `);

    document.getElementById("subCycle").addEventListener("change", (event) => {
        handleCycleChange(event.target.value);
    });
    bindFormAction("saveSubscriptionBtn", saveSubscription);
    bindFormAction("deleteSubscriptionBtn", () => {
        if (deleteSubscription(sub.id)) {
            closeModal();
        }
    });
}

function handleCycleChange(value) {
    document.getElementById("customCycleGroup").style.display = value === "custom" ? "block" : "none";
}

function saveSubscription() {
    const name = document.getElementById("subName").value.trim();
    if (!name) {
        alert("请填写订阅名称");
        return;
    }

    let cycle = document.getElementById("subCycle").value;
    if (cycle === "custom") {
        cycle = document.getElementById("subCustomCycle").value || "30";
    }

    const subscription = {
        id: editingId || generateId(),
        name,
        brand: document.getElementById("subBrand").value.trim(),
        price: document.getElementById("subPrice").value,
        cycle,
        startDate: document.getElementById("subStartDate").value,
        tags: document.getElementById("subTags").value.trim(),
        frequency: editingId ? (getData("subscriptions").find((item) => item.id === editingId)?.frequency || [false, false, false, false, false, false, false]) : [false, false, false, false, false, false, false]
    };

    const subscriptions = getData("subscriptions");
    if (editingId) {
        const index = subscriptions.findIndex((item) => item.id === editingId);
        if (index >= 0) {
            subscriptions[index] = subscription;
        }
    } else {
        subscriptions.push(subscription);
    }

    saveData("subscriptions", subscriptions);
    closeModal();
    renderSubscriptions();
    updateDataStats();
}

function editSubscription(id) {
    const sub = getData("subscriptions").find((item) => item.id === id);
    if (sub) {
        showSubscriptionForm(sub);
    }
}

function deleteSubscription(id) {
    if (!confirm("确定要删除这个订阅吗?")) {
        return false;
    }

    saveData("subscriptions", getData("subscriptions").filter((item) => item.id !== id));
    renderSubscriptions();
    updateDataStats();
    return true;
}

function calculateNextPayment(startDate, cycle) {
    if (!startDate || !cycle) {
        return "未设置";
    }

    const cycleDays = CYCLE_DAYS[cycle] || Number.parseInt(cycle, 10) || 30;
    let nextDate = new Date(startDate);
    const now = new Date();

    if (Number.isNaN(nextDate.getTime())) {
        return "未设置";
    }

    if (nextDate > now) {
        return nextDate.toISOString().split("T")[0];
    }

    while (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + cycleDays);
    }

    return nextDate.toISOString().split("T")[0];
}

function updateSubscriptionSummary() {
    const subscriptions = getData("subscriptions");
    let total = 0;

    subscriptions.forEach((sub) => {
        const price = parseFloat(sub.price) || 0;
        const cycleDays = CYCLE_DAYS[sub.cycle] || Number.parseInt(sub.cycle, 10) || 30;
        total += subscriptionViewMode === "monthly" ? (price * 30) / cycleDays : (price * 365) / cycleDays;
    });

    document.getElementById("subscriptionTotal").textContent = `¥${Math.round(total)}`;
}

function showWishlistForm(item = null) {
    editingId = item ? item.id : null;
    openModalShell(item ? "编辑欲购" : "新建欲购", `
        <div class="form-group">
            <label class="form-label">项目名称 <span class="required">*</span></label>
            <input type="text" class="form-input" id="wishName" value="${escapeHtml(item?.name || "")}" placeholder="例如: MacBook Pro">
        </div>
        <div class="form-group">
            <label class="form-label">品牌</label>
            <input type="text" class="form-input" id="wishBrand" value="${escapeHtml(item?.brand || "")}" placeholder="例如: Apple">
        </div>
        <div class="form-group">
            <label class="form-label">发布时间</label>
            <input type="text" class="form-input" id="wishReleaseDate" value="${escapeHtml(item?.releaseDate || "")}" placeholder="例如: 2024年秋季">
        </div>
        <div class="form-group">
            <label class="form-label">价格</label>
            <input type="number" class="form-input" id="wishPrice" value="${escapeHtml(item?.price || "")}" placeholder="例如: 14999">
        </div>
        <div class="form-group">
            <label class="form-label">入手理由</label>
            <textarea class="form-textarea" id="wishReason" placeholder="为什么想要这个?">${escapeHtml(item?.reason || "")}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">标签 (用逗号分隔)</label>
            <input type="text" class="form-input" id="wishTags" value="${escapeHtml(item?.tags || "")}" placeholder="例如: 生产力, 升级">
        </div>
        <button class="btn-primary" id="saveWishlistBtn" type="button">保存</button>
        ${item ? '<button class="btn-danger" id="deleteWishlistBtn" type="button">删除</button>' : ""}
    `);

    bindFormAction("saveWishlistBtn", saveWishlist);
    bindFormAction("deleteWishlistBtn", () => {
        if (deleteWishlist(item.id)) {
            closeModal();
        }
    });
}

function saveWishlist() {
    const name = document.getElementById("wishName").value.trim();
    if (!name) {
        alert("请填写项目名称");
        return;
    }

    const item = {
        id: editingId || generateId(),
        name,
        brand: document.getElementById("wishBrand").value.trim(),
        releaseDate: document.getElementById("wishReleaseDate").value,
        price: document.getElementById("wishPrice").value,
        reason: document.getElementById("wishReason").value.trim(),
        tags: document.getElementById("wishTags").value.trim()
    };

    const wishlist = getData("wishlist");
    if (editingId) {
        const index = wishlist.findIndex((entry) => entry.id === editingId);
        if (index >= 0) {
            wishlist[index] = item;
        }
    } else {
        wishlist.push(item);
    }

    saveData("wishlist", wishlist);
    closeModal();
    renderWishlist();
    updateDataStats();
}

function editWishlist(id) {
    const item = getData("wishlist").find((entry) => entry.id === id);
    if (item) {
        showWishlistForm(item);
    }
}

function deleteWishlist(id) {
    if (!confirm("确定要删除这个欲购项目吗?")) {
        return false;
    }

    saveData("wishlist", getData("wishlist").filter((item) => item.id !== id));
    renderWishlist();
    updateDataStats();
    return true;
}

function updateDataStats() {
    const devices = getData("devices");
    const accessories = getData("accessories");
    const subscriptions = getData("subscriptions");
    const wishlist = getData("wishlist");

    const deviceTotal = devices.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const accessoryTotal = accessories.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const wishlistTotal = wishlist.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    let subscriptionYearly = 0;
    subscriptions.forEach((sub) => {
        const price = parseFloat(sub.price) || 0;
        const cycleDays = CYCLE_DAYS[sub.cycle] || Number.parseInt(sub.cycle, 10) || 30;
        subscriptionYearly += (price * 365) / cycleDays;
    });

    document.getElementById("dataDeviceTotal").textContent = `¥${Math.round(deviceTotal)}`;
    document.getElementById("dataAccessoryTotal").textContent = `¥${Math.round(accessoryTotal)}`;
    document.getElementById("dataSubscriptionTotal").textContent = `¥${Math.round(subscriptionYearly)}`;
    document.getElementById("dataWishlistTotal").textContent = `¥${Math.round(wishlistTotal)}`;
}

function exportData() {
    const data = {
        devices: getData("devices"),
        accessories: getData("accessories"),
        subscriptions: getData("subscriptions"),
        wishlist: getData("wishlist"),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `device_manager_backup_${new Date().toISOString().split("T")[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

function importData() {
    document.getElementById("importFile").click();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const data = JSON.parse(loadEvent.target.result);
            if (Array.isArray(data.devices)) {
                saveData("devices", data.devices);
            }
            if (Array.isArray(data.accessories)) {
                saveData("accessories", data.accessories);
            }
            if (Array.isArray(data.subscriptions)) {
                saveData("subscriptions", data.subscriptions);
            }
            if (Array.isArray(data.wishlist)) {
                saveData("wishlist", data.wishlist);
            }

            renderAll();
            updateDataStats();
            alert("数据导入成功!");
        } catch {
            alert("导入失败: 文件格式错误");
        }
    };

    reader.readAsText(file);
    event.target.value = "";
}

function confirmDeleteAll() {
    if (!confirm("确定要删除所有数据吗? 此操作不可恢复!")) {
        return;
    }
    if (!confirm("再次确认: 所有数据将被清空!")) {
        return;
    }

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    renderAll();
    updateDataStats();
    alert("所有数据已删除");
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
        .catch(() => undefined);
}
