// ข้อมูลสินค้าเกมมิ่งเกียร์ แยกตามหมวดหมู่และแบรนด์

let products = [];

// ฟังก์ชันดึงข้อมูลสินค้าจากคอลเลกชัน "products" ใน Firebase
async function fetchProductsFromFirebase() {
    try {
        const snapshot = await db.collection("products").get();

        // แปลงข้อมูลจาก Firebase มาใส่ในตัวแปร products
        products = snapshot.docs.map(doc => ({
            firestoreId: doc.id, // รหัสเอกสารอ้างอิงของ Firebase
            ...doc.data()
        }));

        // Render หน้าเว็บตามฟังก์ชันเดิมของคุณ
        if (typeof renderProducts === 'function') {
            renderProducts(products, 'allProductsGrid');
        }
        if (typeof renderAllTypedSections === 'function') {
            renderAllTypedSections();
        }
        if (typeof renderGamingGearGrid === 'function') {
            if (typeof initSidebarFilters === 'function') {
                initSidebarFilters(); // ตั้งค่าช่วงราคา + สร้างรายชื่อ Brand ให้ Sidebar Filter (ทำครั้งเดียว)
            }
            renderGamingGearGrid();
        }
        if (typeof renderProductDetailPage === 'function') {
            renderProductDetailPage(); // ทำงานเฉพาะหน้า product.html เท่านั้น
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Firebase:", error);
    }
}

// ==========================================
// i18n TRANSLATION SYSTEM (ระบบสลับภาษา 4 ภาษา)
// ==========================================
let currentLang = 'th';

// รายการลำดับการสลับภาษา
const langOrder = ['th', 'en', 'zh', 'ru'];

const translations = {
    th: {
        topTagline: "COMPUNG - ถ้าคุณชอบคอมพิวเตอร์ เราคือเพื่อนกัน",
        findStore: "ค้นหาร้านใกล้คุณ",
        searchPlaceholder: "ค้นหาสินค้า เกมมิ่งเกียร์ สเปกคอม...",
        loginRegister: "เข้าสู่ระบบ / สมัครสมาชิก",
        logout: "ออกจากระบบ",
        allProducts: "สินค้าทั้งหมด",
        catMouse: "เมาส์",
        catKeyboard: "คีย์บอร์ด",
        catHeadset: "หูฟัง",
        catNotebook: "โน้ตบุ๊ก",
        catMonitor: "จอภาพ",
        adminManage: "จัดการสินค้า (Admin)",
        recommendedProducts: "รายการสินค้าแนะนำ",
        hotProducts: "รายการสินค้ายอดฮิต",
        normalProducts: "สินค้าทั่วไป",
        flashSaleProducts: "สินค้า Flash Sale",
        allProductsSection: "สินค้าทั้งหมด",
        allProductsSubtitle: "เลือกชมสินค้าทุกรายการในร้านของเรา",
        gamingGearSection: "อุปกรณ์เกมมิ่งเกียร์ทุกชนิด",
        gamingGearSubtitle: "รวมเกมมิ่งเกียร์ครบทุกหมวด คีย์บอร์ด เมาส์ หูฟัง เก้าอี้ และอีกมากมาย",
        cartTitle: "ตะกร้าสินค้า",
        totalPrice: "ราคารวมทั้งหมด:",
        checkoutBtn: "สั่งซื้อสินค้า",
        cartTabLabel: "ตะกร้าสินค้า",
        historyTabLabel: "ประวัติการสั่งซื้อ",
        orderHistoryEmpty: "ยังไม่มีประวัติการสั่งซื้อ",
        orderStatusCompleted: "สำเร็จ",

        // Auth Modal
        loginTitle: "เข้าสู่ระบบ",
        registerTitle: "สมัครสมาชิก",
        forgotTitle: "ลืมรหัสผ่าน",
        userOrEmailLabel: "อีเมล / ชื่อผู้ใช้",
        emailLabel: "อีเมล (Email)",
        passwordLabel: "รหัสผ่าน",
        forgotPassword: "ลืมรหัสผ่าน?",
        submitBtn: "ตกลง",
        sendPinBtn: "ส่งรหัส PIN 6 หลัก",
        noAccountText: "ยังไม่มีบัญชีใช่ไหม?",
        hasAccountText: "มีบัญชีอยู่แล้วใช่ไหม?",
        registerToggleBtn: "สมัครสมาชิก",
        loginToggleBtn: "เข้าสู่ระบบ",
        enterPinLabel: "กรอกรหัส PIN 6 หลักที่ส่งไปยังอีเมล",
        newPasswordLabel: "ตั้งรหัสผ่านใหม่",
        confirmResetBtn: "ยืนยันการเปลี่ยนรหัสผ่าน",

        // Admin Modal
        createProductTitle: "เพิ่มสินค้าใหม่ (Create Product)",
        editProductTitle: "แก้ไขข้อมูลสินค้า (Edit Product)",
        pNameLabel: "ชื่อสินค้า",
        pCatLabel: "หมวดหมู่",
        pSubCatLabel: "ชนิดสินค้า",
        pSubNormal: "สินค้าทั่วไป",
        pSubRecommended: "สินค้าแนะนำ",
        pSubHot: "สินค้ายอดฮิต",
        pSubFlashsale: "สินค้า Flash Sale",
        pBrandLabel: "แบรนด์/ค่าย",
        pOldPriceLabel: "ราคาปกติ (บาท)",
        pPriceLabel: "ราคาขายจริง (บาท)",
        pSpecsLabel: "รายละเอียด/สเปกย่อ",
        pImgLabel: "URL รูปภาพสินค้า",
        pWarrantyLabel: "ประกัน",
        catSpeaker: "ลำโพง (Speaker)",
        catMicrophone: "ไมโครโฟน (Microphone)",
        catChair: "เก้าอี้ (Chair)",
        catDesk: "โต๊ะ (Desk)",
        catMousepad: "แผ่นรองเมาส์ (Mouse pad)",
        catCooling: "ระบบระบายความร้อน (Cooling)",
        catStreaming: "อุปกรณ์สตรีมมิ่ง (Streaming)",
        catVr: "อุปกรณ์ VR (VR)",
        catRacing: "อุปกรณ์แข่งรถ (Racing Setup)",
        saveBtn: "บันทึกข้อมูลสินค้า",
        cancelBtn: "ยกเลิก",

        // Product Cards
        addToCart: "ใส่ตะกร้า",
        buyNow: "ซื้อเลย",
        noProductFound: "ไม่พบสินค้าที่คุณกำลังค้นหา",
        cartEmpty: "ตะกร้าสินค้ายังว่างอยู่"
    },
    en: {
        topTagline: "COMPUNG - If you love computers, we are friends.",
        findStore: "Find nearby stores",
        searchPlaceholder: "Search products, gaming gear, PC specs...",
        loginRegister: "Login / Register",
        logout: "Logout",
        allProducts: "All Products",
        catMouse: "Mouse",
        catKeyboard: "Keyboard",
        catHeadset: "Headset",
        catNotebook: "Laptop",
        catMonitor: "Monitor",
        adminManage: "Manage Products (Admin)",
        recommendedProducts: "Recommended Products",
        hotProducts: "Best-Selling Products",
        normalProducts: "General Products",
        flashSaleProducts: "Flash Sale",
        allProductsSection: "All Products",
        allProductsSubtitle: "Browse every item available in our store",
        gamingGearSection: "All Types of Gaming Gear",
        gamingGearSubtitle: "Keyboards, mice, headsets, chairs, and everything a gamer needs",
        cartTitle: "Shopping Cart",
        totalPrice: "Total Price:",
        checkoutBtn: "Checkout",
        cartTabLabel: "Cart",
        historyTabLabel: "Order History",
        orderHistoryEmpty: "No order history yet",
        orderStatusCompleted: "Completed",

        // Auth Modal
        loginTitle: "Login",
        registerTitle: "Register",
        forgotTitle: "Forgot Password",
        userOrEmailLabel: "Email / Username",
        emailLabel: "Email Address",
        passwordLabel: "Password",
        forgotPassword: "Forgot Password?",
        submitBtn: "Submit",
        sendPinBtn: "Send 6-Digit PIN",
        noAccountText: "Don't have an account?",
        hasAccountText: "Already have an account?",
        registerToggleBtn: "Register",
        loginToggleBtn: "Login",
        enterPinLabel: "Enter 6-digit PIN sent to email",
        newPasswordLabel: "New Password",
        confirmResetBtn: "Confirm Password Reset",

        // Admin Modal
        createProductTitle: "Create Product",
        editProductTitle: "Edit Product",
        pNameLabel: "Product Name",
        pCatLabel: "Category",
        pSubCatLabel: "Product Type",
        pSubNormal: "General Product",
        pSubRecommended: "Recommended",
        pSubHot: "Best Seller",
        pSubFlashsale: "Flash Sale",
        pBrandLabel: "Brand",
        pOldPriceLabel: "Regular Price (THB)",
        pPriceLabel: "Sale Price (THB)",
        pSpecsLabel: "Specifications",
        pImgLabel: "Product Image URL",
        pWarrantyLabel: "Warranty",
        catSpeaker: "Speaker",
        catMicrophone: "Microphone",
        catChair: "Chair",
        catDesk: "Desk",
        catMousepad: "Mouse Pad",
        catCooling: "Cooling",
        catStreaming: "Streaming Gear",
        catVr: "VR Equipment",
        catRacing: "Racing Setup",
        saveBtn: "Save Product",
        cancelBtn: "Cancel",

        // Product Cards
        addToCart: "Add to Cart",
        buyNow: "Buy Now",
        noProductFound: "No products found",
        cartEmpty: "Your cart is empty"
    },
    zh: {
        topTagline: "COMPUNG - 如果你喜欢电脑，我们就是朋友",
        findStore: "查找附近门店",
        searchPlaceholder: "搜索商品、电竞外设、电脑配置...",
        loginRegister: "登录 / 注册",
        logout: "退出登录",
        allProducts: "所有商品",
        catMouse: "鼠标",
        catKeyboard: "键盘",
        catHeadset: "耳机",
        catNotebook: "笔记本电脑",
        catMonitor: "显示器",
        adminManage: "商品管理 (管理员)",
        recommendedProducts: "推荐商品",
        hotProducts: "热销商品",
        normalProducts: "全部商品",
        flashSaleProducts: "限时抢购",
        allProductsSection: "所有商品",
        allProductsSubtitle: "浏览我们商店中的所有商品",
        gamingGearSection: "各类电竞外设",
        gamingGearSubtitle: "涵盖键盘、鼠标、耳机、电竞椅等全套游戏设备",
        cartTitle: "购物车",
        totalPrice: "总计金额:",
        checkoutBtn: "结算",
        cartTabLabel: "购物车",
        historyTabLabel: "购买记录",
        orderHistoryEmpty: "暂无购买记录",
        orderStatusCompleted: "已完成",

        // Auth Modal
        loginTitle: "登录",
        registerTitle: "注册账户",
        forgotTitle: "忘记密码",
        userOrEmailLabel: "邮箱 / 用户名",
        emailLabel: "电子邮箱",
        passwordLabel: "密码",
        forgotPassword: "忘记密码？",
        submitBtn: "提交",
        sendPinBtn: "发送 6 位 PIN 码",
        noAccountText: "还没有账户？",
        hasAccountText: "已有账户？",
        registerToggleBtn: "注册",
        loginToggleBtn: "登录",
        enterPinLabel: "输入发送至邮箱的 6 位 PIN 码",
        newPasswordLabel: "设置新密码",
        confirmResetBtn: "确认重置密码",

        // Admin Modal
        createProductTitle: "添加新商品",
        editProductTitle: "编辑商品信息",
        pNameLabel: "商品名称",
        pCatLabel: "商品分类",
        pSubCatLabel: "商品类型",
        pSubNormal: "普通商品",
        pSubRecommended: "推荐商品",
        pSubHot: "热销商品",
        pSubFlashsale: "限时抢购",
        pBrandLabel: "品牌",
        pOldPriceLabel: "原价 (泰铢)",
        pPriceLabel: "现价 (泰铢)",
        pSpecsLabel: "规格 / 简述",
        pImgLabel: "商品图片 URL",
        pWarrantyLabel: "保修",
        catSpeaker: "音箱",
        catMicrophone: "麦克风",
        catChair: "电竞椅",
        catDesk: "电竞桌",
        catMousepad: "鼠标垫",
        catCooling: "散热系统",
        catStreaming: "直播设备",
        catVr: "VR 设备",
        catRacing: "赛车模拟设备",
        saveBtn: "保存商品",
        cancelBtn: "取消",

        // Product Cards
        addToCart: "加入购物车",
        buyNow: "立即购买",
        noProductFound: "未找到您搜索的商品",
        cartEmpty: "购物车是空的"
    },
    ru: {
        topTagline: "COMPUNG — Если вы любите компьютеры, мы друзья.",
        findStore: "Найти магазин поблизости",
        searchPlaceholder: "Поиск товаров, игровых устройств, ПК...",
        loginRegister: "Вход / Регистрация",
        logout: "Выйти",
        allProducts: "Все товары",
        catMouse: "Мыши",
        catKeyboard: "Клавиатуры",
        catHeadset: "Наушники",
        catNotebook: "Ноутбуки",
        catMonitor: "Мониторы",
        adminManage: "Управление (Админ)",
        recommendedProducts: "Рекомендуемые товары",
        hotProducts: "Хиты продаж",
        normalProducts: "Обычные товары",
        flashSaleProducts: "Флэш-распродажа",
        allProductsSection: "Все товары",
        allProductsSubtitle: "Просмотрите все товары в нашем магазине",
        gamingGearSection: "Все виды игрового оборудования",
        gamingGearSubtitle: "Клавиатуры, мыши, гарнитуры, кресла и всё для геймеров",
        cartTitle: "Корзина",
        totalPrice: "Итоговая сумма:",
        checkoutBtn: "Оформить заказ",
        cartTabLabel: "Корзина",
        historyTabLabel: "История заказов",
        orderHistoryEmpty: "История заказов пуста",
        orderStatusCompleted: "Выполнен",

        // Auth Modal
        loginTitle: "Вход",
        registerTitle: "Регистрация",
        forgotTitle: "Забыли пароль",
        userOrEmailLabel: "Email / Имя пользователя",
        emailLabel: "Электронная почта",
        passwordLabel: "Пароль",
        forgotPassword: "Забыли пароль?",
        submitBtn: "Отправить",
        sendPinBtn: "Отправить 6-значный PIN",
        noAccountText: "Нет аккаунта?",
        hasAccountText: "Уже есть аккаунт?",
        registerToggleBtn: "Регистрация",
        loginToggleBtn: "Вход",
        enterPinLabel: "Введите 6-значный PIN из email",
        newPasswordLabel: "Новый пароль",
        confirmResetBtn: "Подтвердить сброс пароля",

        // Admin Modal
        createProductTitle: "Добавить товар",
        editProductTitle: "Редактировать товар",
        pNameLabel: "Название товара",
        pCatLabel: "Категория",
        pSubCatLabel: "Тип товара",
        pSubNormal: "Обычный товар",
        pSubRecommended: "Рекомендуемый",
        pSubHot: "Хит продаж",
        pSubFlashsale: "Флэш-распродажа",
        pBrandLabel: "Бренд",
        pOldPriceLabel: "Обычная цена (THB)",
        pPriceLabel: "Цена со скидкой (THB)",
        pSpecsLabel: "Характеристики",
        pImgLabel: "URL изображения товара",
        pWarrantyLabel: "Гарантия",
        catSpeaker: "Колонки",
        catMicrophone: "Микрофон",
        catChair: "Кресло",
        catDesk: "Стол",
        catMousepad: "Коврик для мыши",
        catCooling: "Охлаждение",
        catStreaming: "Оборудование для стрима",
        catVr: "VR-оборудование",
        catRacing: "Гоночный симулятор",
        saveBtn: "Сохранить товар",
        cancelBtn: "Отмена",

        // Product Cards
        addToCart: "В корзину",
        buyNow: "Купить",
        noProductFound: "Товары не найдены",
        cartEmpty: "Ваша корзина пуста"
    }
};

// ==========================================
// DROPDOWN "เพิ่มเติม" (หมวดหมู่เพิ่มเติมในเมนู)
// เดิมเปิดด้วย CSS hover (:hover) อย่างเดียว ซึ่งใช้งานยากบนมือถือ/แท็บเล็ต
// เพราะอุปกรณ์สัมผัสไม่มี hover จริง ๆ ต้องแตะ 2 ครั้งถึงจะเปิดเมนูได้
// ตอนนี้เพิ่มการคลิก/แตะเพื่อเปิด-ปิดเมนูโดยตรงผ่าน JS แทน
// (ยังคง hover ไว้เป็นโบนัสสำหรับผู้ใช้เมาส์บนเดสก์ท็อป)
// ==========================================
function closeAllMoreDropdowns() {
    document.querySelectorAll('.more-dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    document.querySelectorAll('.more-dropdown-chevron').forEach(chevron => chevron.classList.remove('rotate-180'));
}

function toggleMoreDropdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const wrapper = event.currentTarget.closest('.more-dropdown');
    if (!wrapper) return;

    const menu = wrapper.querySelector('.more-dropdown-menu');
    const chevron = wrapper.querySelector('.more-dropdown-chevron');
    if (!menu) return;

    const willOpen = menu.classList.contains('hidden');

    // ปิดดร็อปดาวน์อื่น ๆ ที่อาจเปิดค้างอยู่ก่อนเสมอ
    closeAllMoreDropdowns();

    if (willOpen) {
        menu.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    }
}

// คลิก/แตะนอกเมนู หรือกด Esc เพื่อปิดดร็อปดาวน์
document.addEventListener('click', (e) => {
    if (!e.target.closest('.more-dropdown')) {
        closeAllMoreDropdowns();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllMoreDropdowns();
    }
});

function toggleLanguage() {
    const nextIndex = (langOrder.indexOf(currentLang) + 1) % langOrder.length;
    currentLang = langOrder[nextIndex];

    const langLabel = document.getElementById('langLabel');
    if (langLabel) {
        langLabel.innerText = currentLang.toUpperCase();
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.innerText = translations[currentLang][key];
        }
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.placeholder = translations[currentLang][key];
        }
    });

    if (typeof products !== 'undefined') {
        renderProducts(products, 'allProductsGrid');
    }
    if (typeof renderAllTypedSections === 'function') {
        renderAllTypedSections();
    }
    if (typeof renderGamingGearGrid === 'function') {
        renderGamingGearGrid();
    }
    if (typeof renderCartItems === 'function') {
        renderCartItems();
    }
    if (typeof renderOrderHistory === 'function') {
        renderOrderHistory();
    }
}

// ==========================================
// PRODUCT RENDER & FILTER SYSTEM
// ==========================================
let cart = [];

// ระบบประวัติการซื้อสินค้า (Order History)
// หมายเหตุ: ตอนนี้ยังไม่มีระบบฐานข้อมูลผูกกับบัญชีผู้ใช้ จึงเก็บไว้ใน localStorage
// ของเบราว์เซอร์ไปก่อนเป็นการชั่วคราว เมื่อทำระบบฐานข้อมูลบัญชีผู้ใช้เสร็จแล้ว
// ค่อยเปลี่ยนมาบันทึก/ดึงข้อมูลจากฐานข้อมูลจริงแทนจุดนี้
let orderHistory = loadOrderHistory();
let currentCartTab = 'cart';
let currentCategory = 'all';
let currentBrand = 'all';

document.addEventListener('DOMContentLoaded', () => {
    fetchProductsFromFirebase();

    if (typeof updateCartCount === 'function') {
        updateCartCount();
    }
});

function renderProducts(items, gridId = 'productGrid') {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = `<div class="w-full text-center py-12 text-gray-400">${translations[currentLang].noProductFound}</div>`;
        return;
    }

    grid.innerHTML = items.map(p => {
        const hasDiscount = p.oldPrice > p.price;
        const discountAmount = hasDiscount ? (p.oldPrice - p.price) : 0;
        const warranty = p.warranty || '1Y';
        const sold = p.sold || 0;
        const soldLabel = sold >= 1000 ? (sold / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : sold;

        return `
        <div onclick="goToProduct('${p.id}')" class="product-card cursor-pointer w-64 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col hover:border-cyan-500/60 hover:-translate-y-1 transition-all duration-300 group shadow-lg relative">

            <div class="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition duration-200">
                <button onclick="event.stopPropagation(); editProduct(${p.id})" title="แก้ไข" class="bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="event.stopPropagation(); deleteProduct(${p.id})" title="ลบสินค้า" class="bg-slate-950/80 hover:bg-red-500 hover:text-white text-red-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>

            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold text-cyan-500 uppercase tracking-wide">${p.brand}</span>
            </div>

            <div class="relative overflow-hidden rounded-xl mb-3 bg-gradient-to-br from-slate-100 via-white to-slate-200 h-36 w-full flex items-center justify-center shrink-0 shadow-inner">
                <img src="${p.img}" alt="${p.name}" class="object-contain w-full h-full p-4 mix-blend-multiply group-hover:scale-105 transition duration-500">
            </div>

            <h3 class="font-bold text-sm text-white line-clamp-2 h-10 mb-1 leading-tight group-hover:text-cyan-400 transition" title="${p.name}">
                ${p.name}
            </h3>

            <p class="text-xs text-gray-400 line-clamp-2 h-8 mb-2 leading-normal" title="${p.specs}">
                ${p.specs}
            </p>

            <div class="mt-1">
                <div class="flex justify-between items-center h-4 mb-0.5">
                    ${hasDiscount ? `<span class="text-xs text-gray-500 line-through">฿${p.oldPrice.toLocaleString()}</span>` : `<span></span>`}
                    <span class="warranty-badge flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <i class="fa-solid fa-shield-halved text-cyan-400"></i> ประกัน ${warranty}
                    </span>
                </div>
                <div class="flex justify-between items-end mb-2">
                    <span class="text-xl font-black text-cyan-400">฿${p.price.toLocaleString()}</span>
                    <span class="text-[10px] text-emerald-500 font-semibold">จัดส่งฟรี</span>
                </div>
            </div>

            <div class="flex items-center justify-between mb-2.5">
                ${hasDiscount ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">-฿${discountAmount.toLocaleString()}</span>` : `<span class="text-[10px] text-gray-500">*ราคาเฉพาะออนไลน์</span>`}
                <div class="flex gap-2 text-gray-400">
                    <button onclick="event.stopPropagation()" title="เพิ่มในรายการโปรด" class="hover:text-red-400 transition text-sm"><i class="fa-regular fa-heart"></i></button>
                    <button onclick="event.stopPropagation()" title="เปรียบเทียบ" class="hover:text-cyan-400 transition text-sm"><i class="fa-solid fa-arrows-rotate"></i></button>
                </div>
            </div>

            <button onclick="event.stopPropagation(); addToCart(${p.id})" class="buy-btn w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition duration-200">
                <i class="fa-solid fa-cart-shopping"></i> ${translations[currentLang].buyNow}
            </button>

            <div class="text-center text-[10px] text-gray-500 mt-2 flex items-center justify-center gap-1">
                <i class="fa-regular fa-eye"></i> ${soldLabel}
            </div>
        </div>
    `;
    }).join('');
}

// ==========================================
// PRODUCT TYPE SECTIONS
// ==========================================
function getProductsByType(type) {
    if (typeof products === 'undefined' || !Array.isArray(products)) return [];
    return products.filter(p => (p.productType || 'normal') === type);
}

const MAX_CAROUSEL_ITEMS = 10;

function renderCarouselProducts(items, gridId) {
    const limited = items.slice(0, MAX_CAROUSEL_ITEMS);
    renderProducts(limited, gridId);
}

function renderNormalProducts() {
    renderCarouselProducts(getProductsByType('normal'), 'normalProductGrid');
}

function renderRecommendedProducts() {
    renderCarouselProducts(getProductsByType('recommended'), 'productGrid');
}

function renderHotProducts() {
    const hotList = getProductsByType('hot')
        .sort((a, b) => (b.sold || 0) - (a.sold || 0));
    renderCarouselProducts(hotList, 'hotProductGrid');
}

function renderFlashSaleProducts() {
    renderCarouselProducts(getProductsByType('flashsale'), 'flashSaleProductGrid');
}

function renderAllTypedSections() {
    renderNormalProducts();
    renderRecommendedProducts();
    renderHotProducts();
    renderFlashSaleProducts();
}

// ==========================================
// GAMING GEAR SECTION (+ Sidebar Filter: ชนิดสินค้า / ช่วงราคา / แบรนด์)
// ==========================================
function renderGamingGearGrid() {
    const grid = document.getElementById('gamingGearGrid');
    if (!grid) return;

    const pageCategory = document.body.getAttribute('data-category');
    let items = products;

    if (pageCategory && pageCategory !== 'all') {
        items = products.filter(p => p.category === pageCategory);
    }

    // --- ตัวกรอง Sidebar (จะมีผลเฉพาะหน้าที่มี Sidebar Filter เท่านั้น) ---

    // 0) กรองตามคำค้นหา (ช่องค้นหาด้านบนสุดของหน้า)
    const searchInputEl = document.getElementById('searchInput');
    if (searchInputEl && searchInputEl.value.trim() !== '') {
        const searchTerm = searchInputEl.value.toLowerCase();
        items = items.filter(p =>
            (p.name || '').toLowerCase().includes(searchTerm) ||
            (p.specs || '').toLowerCase().includes(searchTerm)
        );
    }

    // 1) กรองตามชนิดสินค้า (สินค้าทั่วไป / ยอดฮิต / Flash Sale) — ไม่ติ๊กเลย = แสดงทุกชนิด
    const typeChecked = document.querySelectorAll('.filter-type-checkbox:checked');
    if (typeChecked.length > 0) {
        const selectedTypes = Array.from(typeChecked).map(cb => cb.value);
        items = items.filter(p => selectedTypes.includes(p.productType || 'normal'));
    }

    // 2) กรองตามช่วงราคา
    const minPriceInput = document.getElementById('filterMinPrice');
    const maxPriceInput = document.getElementById('filterMaxPrice');
    if (minPriceInput && minPriceInput.value !== '') {
        const minVal = parseFloat(minPriceInput.value);
        if (!isNaN(minVal)) items = items.filter(p => p.price >= minVal);
    }
    if (maxPriceInput && maxPriceInput.value !== '') {
        const maxVal = parseFloat(maxPriceInput.value);
        if (!isNaN(maxVal)) items = items.filter(p => p.price <= maxVal);
    }

    // 3) กรองตามแบรนด์ — ไม่ติ๊กเลย = แสดงทุกแบรนด์
    const brandChecked = document.querySelectorAll('.filter-brand-checkbox:checked');
    if (brandChecked.length > 0) {
        const selectedBrands = Array.from(brandChecked).map(cb => cb.value.toLowerCase());
        items = items.filter(p => selectedBrands.includes((p.brand || '').toLowerCase()));
    }

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-400">ไม่พบสินค้าตามตัวกรองที่เลือก</div>`;
        return;
    }

    grid.innerHTML = items.map(p => {
        const hasDiscount = p.oldPrice > p.price;
        const discountAmount = hasDiscount ? (p.oldPrice - p.price) : 0;
        const warranty = p.warranty || '1Y';
        const sold = p.sold || 0;
        const soldLabel = sold >= 1000 ? (sold / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : sold;

        return `
        <div onclick="goToProduct('${p.id}')" class="product-card cursor-pointer w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col hover:border-cyan-500/60 hover:-translate-y-1 transition-all duration-300 group shadow-lg relative">

            <div class="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition duration-200">
            <button onclick="event.stopPropagation(); editProduct('${p.id}')" title="แก้ไข" class="bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>
                <button onclick="event.stopPropagation(); deleteProduct('${p.id}')" title="ลบสินค้า" class="bg-slate-950/80 hover:bg-red-500 hover:text-white text-red-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>

            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold text-cyan-500 uppercase tracking-wide">${p.brand}</span>
                <span class="text-[9px] font-mono text-slate-500">${p.id}</span>
            </div>

            <div class="relative overflow-hidden rounded-xl mb-3 bg-gradient-to-br from-slate-100 via-white to-slate-200 h-36 w-full flex items-center justify-center shrink-0 shadow-inner">
                <img src="${p.img}" alt="${p.name}" class="object-contain w-full h-full p-4 mix-blend-multiply group-hover:scale-105 transition duration-500">
            </div>

            <h3 class="font-bold text-sm text-white line-clamp-2 h-10 mb-1 leading-tight group-hover:text-cyan-400 transition" title="${p.name}">
                ${p.name}
            </h3>

            <p class="text-xs text-gray-400 line-clamp-2 h-8 mb-2 leading-normal" title="${p.specs}">
                ${p.specs}
            </p>

            <div class="mt-1">
                <div class="flex justify-between items-center h-4 mb-0.5">
                    ${hasDiscount ? `<span class="text-xs text-gray-500 line-through">฿${p.oldPrice.toLocaleString()}</span>` : `<span></span>`}
                    <span class="warranty-badge flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <i class="fa-solid fa-shield-halved text-cyan-400"></i> ประกัน ${warranty}
                    </span>
                </div>
                <div class="flex justify-between items-end mb-2">
                    <span class="text-xl font-black text-cyan-400">฿${p.price.toLocaleString()}</span>
                    <span class="text-[10px] text-emerald-500 font-semibold">จัดส่งฟรี</span>
                </div>
            </div>

            <div class="flex items-center justify-between mb-2.5">
                ${hasDiscount ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">-฿${discountAmount.toLocaleString()}</span>` : `<span class="text-[10px] text-gray-500">*ราคาเฉพาะออนไลน์</span>`}
            </div>

            <button onclick="event.stopPropagation(); addToCart('${p.id}')" class="buy-btn w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition duration-200">
                <i class="fa-solid fa-cart-shopping"></i> ${translations[currentLang].buyNow}
            </button>

            <div class="text-center text-[10px] text-gray-500 mt-2 flex items-center justify-center gap-1">
                <i class="fa-regular fa-eye"></i> ${soldLabel}
            </div>
        </div>
    `;
    }).join('');
}

// สร้างรายชื่อ Brand แบบไดนามิกจากสินค้าจริงในหมวดหมู่นี้ และตั้งค่าช่วงราคาต่ำสุด-สูงสุดให้ตรงกับสินค้าจริง
// เรียกครั้งเดียวหลังโหลดสินค้าจาก Firebase เสร็จ (ไม่ตั้งค่าทับซ้ำเมื่อผู้ใช้กำลังกรองอยู่)
function initSidebarFilters() {
    const grid = document.getElementById('gamingGearGrid');
    if (!grid) return; // หน้านี้ไม่มี Sidebar Filter

    const pageCategory = document.body.getAttribute('data-category');
    let items = products;
    if (pageCategory && pageCategory !== 'all') {
        items = products.filter(p => p.category === pageCategory);
    }
    if (items.length === 0) return;

    // ตั้งค่าช่วงราคาต่ำสุด-สูงสุดจากสินค้าจริงในหมวดหมู่นี้ (ตั้งครั้งเดียวตอนโหลดหน้า)
    const rangeSlider = document.getElementById('filterPriceRange');
    const minInput = document.getElementById('filterMinPrice');
    const maxInput = document.getElementById('filterMaxPrice');

    if (rangeSlider && minInput && maxInput && !rangeSlider.dataset.initialized) {
        const prices = items.map(p => p.price).filter(v => !isNaN(v));
        const minPrice = Math.floor(Math.min(...prices));
        const maxPrice = Math.ceil(Math.max(...prices));

        minInput.value = minPrice;
        maxInput.value = maxPrice;
        rangeSlider.min = minPrice;
        rangeSlider.max = maxPrice;
        rangeSlider.value = maxPrice;
        rangeSlider.dataset.initialized = 'true';
    }

    // สร้างรายชื่อ Brand แบบไดนามิกจากสินค้าจริงในหมวดหมู่นี้ (ตั้งครั้งเดียวตอนโหลดหน้า)
    const brandListEl = document.getElementById('brandFilterList');
    if (brandListEl && !brandListEl.dataset.initialized) {
        const brands = [...new Set(items.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));

        if (brands.length === 0) {
            brandListEl.innerHTML = `<p class="text-[11px] text-gray-500">ไม่พบแบรนด์ในหมวดหมู่นี้</p>`;
        } else {
            brandListEl.innerHTML = brands.map(b => `
                <label class="flex items-center gap-2 text-xs text-gray-300 hover:text-cyan-400 cursor-pointer py-1">
                    <input type="checkbox" value="${b}" class="filter-brand-checkbox w-3.5 h-3.5 accent-cyan-500" onchange="renderGamingGearGrid()">
                    ${b}
                </label>
            `).join('');
        }
        brandListEl.dataset.initialized = 'true';
    }
}

// ซิงค์ค่าจากแถบเลื่อนราคา (Range Slider) กลับไปที่ช่องราคาสูงสุด แล้วกรองสินค้าใหม่ทันที
function syncPriceRangeFromSlider() {
    const rangeSlider = document.getElementById('filterPriceRange');
    const maxInput = document.getElementById('filterMaxPrice');
    if (rangeSlider && maxInput) maxInput.value = rangeSlider.value;
    renderGamingGearGrid();
}

// ล้างตัวกรอง Sidebar ทั้งหมดกลับสู่ค่าเริ่มต้น แล้วแสดงสินค้าทั้งหมดในหมวดหมู่อีกครั้ง
function resetSidebarFilters() {
    document.querySelectorAll('.filter-type-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.filter-brand-checkbox').forEach(cb => cb.checked = false);

    const rangeSlider = document.getElementById('filterPriceRange');
    const minInput = document.getElementById('filterMinPrice');
    const maxInput = document.getElementById('filterMaxPrice');
    if (rangeSlider && minInput && maxInput) {
        minInput.value = rangeSlider.min;
        maxInput.value = rangeSlider.max;
        rangeSlider.value = rangeSlider.max;
    }

    renderGamingGearGrid();
}

// ==========================================
// PRODUCT DETAIL PAGE (product.html?id=...)
// ==========================================

// พาไปหน้ารายละเอียดสินค้า — เรียกจากการคลิกที่การ์ดสินค้าทุกจุดในเว็บ
function goToProduct(productId) {
    window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
}

// Render หน้ารายละเอียดสินค้าเดี่ยว (ทำงานเฉพาะเมื่อหน้านั้นมี #productDetailContainer เท่านั้น)
function renderProductDetailPage() {
    const container = document.getElementById('productDetailContainer');
    if (!container) return; // ไม่ใช่หน้ารายละเอียดสินค้า ข้ามไป

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    const product = products.find(p => String(p.id) === String(productId));

    if (!product) {
        container.innerHTML = `
            <div class="col-span-2 text-center py-20 text-gray-400">
                <i class="fa-solid fa-box-open text-4xl mb-3"></i>
                <p class="text-sm">ไม่พบสินค้าที่คุณต้องการ</p>
                <a href="index.html" class="text-cyan-400 hover:underline text-xs mt-2 inline-block">&larr; กลับสู่หน้าแรก</a>
            </div>`;
        const relatedGrid = document.getElementById('relatedProductsGrid');
        if (relatedGrid) relatedGrid.innerHTML = '';
        return;
    }

    document.title = `COM PANG - ${product.name}`;

    const breadcrumb = document.getElementById('productBreadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = `
            <a href="index.html" class="hover:text-cyan-400 transition">หน้าหลัก</a>
            <i class="fa-solid fa-chevron-right text-[8px]"></i>
            <span class="text-cyan-400 truncate max-w-[220px] sm:max-w-none">${product.name}</span>
        `;
    }

    const hasDiscount = product.oldPrice > product.price;
    const discountPercent = hasDiscount ? Math.round((product.oldPrice - product.price) / product.oldPrice * 100) : 0;
    const warranty = product.warranty || '1Y';

    container.innerHTML = `
        <div class="lg:sticky lg:top-24 h-fit bg-gradient-to-br from-slate-100 via-white to-slate-200 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center p-6 sm:p-10 shadow-inner aspect-square">
            <img src="${product.img}" alt="${product.name}" class="max-h-[420px] w-full h-full object-contain mix-blend-multiply">
        </div>

        <div class="flex flex-col">
            <span class="inline-flex w-fit items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-3">
                <i class="fa-solid fa-circle-check"></i> มีสินค้า
            </span>

            <h1 class="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">${product.name}</h1>

            <div class="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span>แบรนด์: <span class="text-cyan-400 font-semibold">${product.brand}</span></span>
                <span class="text-slate-700">|</span>
                <span>รหัสสินค้า: <span class="font-mono">${product.id}</span></span>
            </div>

            <div class="flex items-center gap-3 mb-1">
                <button onclick="event.stopPropagation()" title="เพิ่มในรายการโปรด"
                    class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 hover:text-red-400 flex items-center justify-center transition">
                    <i class="fa-regular fa-heart"></i>
                </button>
                <button onclick="event.stopPropagation()" title="แชร์ Facebook"
                    class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 hover:text-cyan-400 flex items-center justify-center transition">
                    <i class="fa-brands fa-facebook-f"></i>
                </button>
            </div>

            <div class="flex items-end gap-3 border-t border-slate-800 pt-4 mt-4">
                <span class="text-3xl font-black text-cyan-400">฿${product.price.toLocaleString()}</span>
                ${hasDiscount ? `
                <span class="text-base text-gray-500 line-through mb-1">฿${product.oldPrice.toLocaleString()}</span>
                <span class="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md mb-1">-${discountPercent}%</span>
                ` : ''}
            </div>

            <div class="flex items-center gap-3 mt-3 text-[11px] text-gray-400 flex-wrap">
                <span class="warranty-badge flex items-center gap-1 px-2 py-1 rounded-full">
                    <i class="fa-solid fa-shield-halved text-cyan-400"></i> ประกัน ${warranty}
                </span>
                <span class="flex items-center gap-1 text-emerald-500 font-semibold">
                    <i class="fa-solid fa-truck-fast"></i> จัดส่งฟรี
                </span>
            </div>

            <div class="flex items-center gap-3 mt-6">
                <span class="text-xs font-semibold text-gray-400">จำนวน</span>
                <div class="flex items-center border border-slate-700 rounded-lg overflow-hidden">
                    <button onclick="changeDetailQty(-1)" class="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white transition">&minus;</button>
                    <input type="number" id="detailQty" value="1" min="1"
                        class="w-12 h-8 bg-slate-900 text-center text-white text-sm border-x border-slate-700 focus:outline-none">
                    <button onclick="changeDetailQty(1)" class="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white transition">+</button>
                </div>
            </div>

            <div class="flex gap-3 mt-5">
                <button onclick="addToCartFromDetail('${product.id}')"
                    class="flex-1 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-bag-shopping"></i> เพิ่มในตะกร้า
                </button>
                <button onclick="buyNowFromDetail('${product.id}')"
                    class="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition">
                    <i class="fa-solid fa-bolt"></i> ซื้อเลย
                </button>
            </div>

            <div class="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-800">
                <span class="bg-slate-800 text-gray-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">#${product.brand}</span>
                <span class="bg-slate-800 text-gray-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">#${product.category}</span>
            </div>

            <div class="mt-6 pt-5 border-t border-slate-800">
                <h3 class="text-sm font-bold text-white mb-2">รายละเอียดสินค้า</h3>
                <p class="text-xs text-gray-400 leading-relaxed whitespace-pre-line">${product.specs || '-'}</p>
            </div>
        </div>
    `;

    renderRelatedProducts(product);
}

// ปรับจำนวนสินค้าในหน้ารายละเอียด (กัน 0 หรือติดลบ)
function changeDetailQty(delta) {
    const qtyInput = document.getElementById('detailQty');
    if (!qtyInput) return;
    const current = parseInt(qtyInput.value) || 1;
    qtyInput.value = Math.max(1, current + delta);
}

// เพิ่มสินค้าจากหน้ารายละเอียดลงตะกร้าตามจำนวนที่เลือก
function addToCartFromDetail(productId) {
    const qtyInput = document.getElementById('detailQty');
    const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value) || 1) : 1;
    const product = products.find(p => String(p.id) === String(productId));
    if (!product) return;

    const existingItem = cart.find(item => String(item.id) === String(productId));
    if (existingItem) {
        existingItem.quantity += qty;
    } else {
        cart.push({ ...product, quantity: qty });
    }

    updateCartCount();
    renderCartItems();
    if (typeof toggleCartModal === 'function') toggleCartModal();
}

// ซื้อเลย = เพิ่มลงตะกร้าตามจำนวนที่เลือกแล้วเปิดตะกร้าทันที (ใช้ตะกร้าเดิมของระบบ ยังไม่มีหน้าชำระเงินแยก)
function buyNowFromDetail(productId) {
    addToCartFromDetail(productId);
}

// สินค้าที่เกี่ยวข้อง: ต้องเป็น "แบรนด์เดียวกัน" และอยู่ใน "เรทราคาเดียวกัน" (±30% ของราคาสินค้าปัจจุบัน)
// ถ้ากรองแล้วไม่พบเลย จะผ่อนเกณฑ์ลงเหลือแค่แบรนด์เดียวกัน เพื่อให้ยังมีสินค้าแนะนำแสดงอยู่เสมอ
function renderRelatedProducts(currentProduct) {
    const grid = document.getElementById('relatedProductsGrid');
    if (!grid) return;

    const PRICE_RANGE_PERCENT = 0.3;
    const minPrice = currentProduct.price * (1 - PRICE_RANGE_PERCENT);
    const maxPrice = currentProduct.price * (1 + PRICE_RANGE_PERCENT);
    const sameBrand = p => (p.brand || '').toLowerCase() === (currentProduct.brand || '').toLowerCase();

    let related = products.filter(p =>
        String(p.id) !== String(currentProduct.id) &&
        sameBrand(p) &&
        p.price >= minPrice && p.price <= maxPrice
    );

    if (related.length === 0) {
        related = products.filter(p => String(p.id) !== String(currentProduct.id) && sameBrand(p));
    }

    related = related.slice(0, 10);

    if (related.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400 text-sm">ไม่พบสินค้าที่เกี่ยวข้อง</div>`;
        return;
    }

    renderProducts(related, 'relatedProductsGrid');
}

// เลื่อนแถวสินค้าที่เกี่ยวข้องด้วยปุ่มซ้าย/ขวา (dir: -1 = ซ้าย, 1 = ขวา)
function scrollRelatedProducts(dir) {
    const grid = document.getElementById('relatedProductsGrid');
    if (!grid) return;
    const firstCard = grid.querySelector('.product-card');
    const step = firstCard ? firstCard.offsetWidth + 20 : 280;
    grid.scrollBy({ left: step * dir, behavior: 'smooth' });
}

function filterProducts() {
    // หน้าหมวดหมู่สินค้า (เช่น camera.html, chair.html ฯลฯ) ใช้กริด gamingGearGrid
    // ไม่ใช่ productGrid — ให้ส่งต่อไปที่ renderGamingGearGrid() ซึ่งจะอ่านค่าจากช่องค้นหาเอง
    if (document.getElementById('gamingGearGrid')) {
        renderGamingGearGrid();
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = products.filter(p => {
        const matchesCategory = currentCategory === 'all' || p.category === currentCategory;
        const matchesBrand = currentBrand === 'all' || p.brand.toLowerCase() === currentBrand.toLowerCase();
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) || p.specs.toLowerCase().includes(searchTerm);

        return matchesCategory && matchesBrand && matchesSearch;
    });

    renderProducts(filtered);
}

function filterCategory(category) {
    currentCategory = category;
    currentBrand = 'all';
    filterProducts();
}

function filterBrand(brand) {
    currentBrand = brand;
    filterProducts();
}

// ==========================================
// CART SYSTEM
// ==========================================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartCount();
    renderCartItems();
}

function updateCartCount() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.innerText = totalCount;
}

function renderCartItems() {
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalPrice');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 text-sm py-8">${translations[currentLang].cartEmpty}</p>`;
        if (totalEl) totalEl.innerText = '฿0';
        return;
    }

    let total = 0;
    container.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <img src="${item.img}" class="w-12 h-12 object-contain rounded-lg bg-gradient-to-br from-slate-100 to-white p-1 mix-blend-multiply">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                    <p class="text-xs text-cyan-400 font-bold">฿${item.price.toLocaleString()}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <button onclick="changeQuantity(${item.id}, -1)" class="w-5 h-5 bg-slate-800 text-gray-300 rounded hover:bg-slate-700 flex items-center justify-center text-xs">-</button>
                        <span class="text-xs font-bold">${item.quantity}</span>
                        <button onclick="changeQuantity(${item.id}, 1)" class="w-5 h-5 bg-slate-800 text-gray-300 rounded hover:bg-slate-700 flex items-center justify-center text-xs">+</button>
                    </div>
                </div>
                <button onclick="removeFromCart(${item.id})" class="text-red-400 hover:text-red-300 text-xs p-1">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    if (totalEl) totalEl.innerText = `฿${total.toLocaleString()}`;
}

function changeQuantity(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(id);
    } else {
        updateCartCount();
        renderCartItems();
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    updateCartCount();
    renderCartItems();
}

function toggleCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.classList.toggle('hidden');
        switchCartTab('cart');
    }
}

function checkout() {
    if (cart.length === 0) {
        alert(currentLang === 'th' ? 'กรุณาเลือกสินค้าก่อนทำการสั่งซื้อ' : 'Please select products before checkout.');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // บันทึกคำสั่งซื้อลงในประวัติการซื้อสินค้า (ระบบชั่วคราว ยังไม่ผูกกับฐานข้อมูลบัญชีผู้ใช้)
    const order = {
        orderId: 'ORD' + Date.now(),
        date: new Date().toISOString(),
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            img: item.img,
            price: item.price,
            quantity: item.quantity
        })),
        total: total,
        status: 'completed'
    };
    orderHistory.unshift(order);
    saveOrderHistory();

    alert(currentLang === 'th' ? 'สั่งซื้อสินค้าเรียบร้อยแล้ว! ขอบคุณที่ใช้บริการ COMPUNG' : 'Order placed successfully! Thank you for using COMPUNG.');
    cart = [];
    updateCartCount();
    renderCartItems();
    renderOrderHistory();
    toggleCartModal();
}

// ==========================================
// ORDER HISTORY SYSTEM (ประวัติการซื้อสินค้า)
// ==========================================
// เก็บข้อมูลไว้ใน localStorage ของเบราว์เซอร์เป็นการชั่วคราวก่อน
// รอจนกว่าจะมีระบบฐานข้อมูลผูกกับบัญชีผู้ใช้จริง ค่อยย้ายไปเก็บที่ฐานข้อมูลแทน
function loadOrderHistory() {
    try {
        const saved = localStorage.getItem('compang_orderHistory');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('ไม่สามารถโหลดประวัติการสั่งซื้อได้', e);
        return [];
    }
}

function saveOrderHistory() {
    try {
        localStorage.setItem('compang_orderHistory', JSON.stringify(orderHistory));
    } catch (e) {
        console.error('ไม่สามารถบันทึกประวัติการสั่งซื้อได้', e);
    }
}

function switchCartTab(tab) {
    currentCartTab = tab;

    const cartTabBtn = document.getElementById('cartTabBtn');
    const historyTabBtn = document.getElementById('historyTabBtn');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const orderHistoryContainer = document.getElementById('orderHistoryContainer');
    const cartFooter = document.getElementById('cartFooter');

    // หน้าอื่น ๆ ที่ยังไม่มี Markup ของแท็บ (เช่นหน้าหมวดหมู่สินค้าเดิม) ให้แสดงตะกร้าตามปกติไปก่อน
    // เพื่อไม่ให้ตะกร้าสินค้าเดิมพัง จนกว่าจะอัปเดต Markup ของหน้านั้น ๆ ให้รองรับแท็บนี้ด้วย
    if (!cartTabBtn || !historyTabBtn || !orderHistoryContainer) {
        if (cartItemsContainer) renderCartItems();
        return;
    }

    const activeClass = "flex-1 py-2.5 text-xs sm:text-sm font-bold text-cyan-400 border-b-2 border-cyan-400 transition";
    const inactiveClass = "flex-1 py-2.5 text-xs sm:text-sm font-bold text-gray-400 border-b-2 border-transparent hover:text-gray-200 transition";

    if (tab === 'history') {
        cartTabBtn.className = inactiveClass;
        historyTabBtn.className = activeClass;
        cartItemsContainer.classList.add('hidden');
        orderHistoryContainer.classList.remove('hidden');
        if (cartFooter) cartFooter.classList.add('hidden');
        renderOrderHistory();
    } else {
        currentCartTab = 'cart';
        cartTabBtn.className = activeClass;
        historyTabBtn.className = inactiveClass;
        cartItemsContainer.classList.remove('hidden');
        orderHistoryContainer.classList.add('hidden');
        if (cartFooter) cartFooter.classList.remove('hidden');
        renderCartItems();
    }
}

function renderOrderHistory() {
    const container = document.getElementById('orderHistoryContainer');
    if (!container) return;

    if (orderHistory.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 text-sm py-8">${translations[currentLang].orderHistoryEmpty}</p>`;
        return;
    }

    container.innerHTML = orderHistory.map(order => {
        const dateObj = new Date(order.date);
        const dateLabel = dateObj.toLocaleString(currentLang === 'th' ? 'th-TH' : 'en-US', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const itemsHtml = (order.items || []).map(item => `
            <div class="flex items-center justify-between text-[11px] text-gray-300 py-0.5">
                <span class="truncate pr-2">${item.name} <span class="text-gray-500">x${item.quantity}</span></span>
                <span class="text-cyan-400 font-semibold whitespace-nowrap">฿${(item.price * item.quantity).toLocaleString()}</span>
            </div>
        `).join('');

        return `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 sm:p-3.5">
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-[11px] font-mono text-slate-500">#${order.orderId}</span>
                    <span class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                        ${translations[currentLang].orderStatusCompleted}
                    </span>
                </div>
                <p class="text-[11px] text-gray-500 mb-2">${dateLabel}</p>
                <div class="border-t border-slate-800 pt-2 space-y-0.5">
                    ${itemsHtml}
                </div>
                <div class="flex justify-between items-center border-t border-slate-800 mt-2 pt-2">
                    <span class="text-xs font-bold text-gray-300">${translations[currentLang].totalPrice}</span>
                    <span class="text-sm font-black text-cyan-400">฿${order.total.toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// AUTH & USER DATABASE SYSTEM
// ==========================================
let authMode = 'login';
let users = [
    { username: "admin", email: "admin@example.com", password: "123" }
];

function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.toggle('hidden');
        resetAuthForm();
    }
}

function resetAuthForm() {
    authMode = 'login';
    document.getElementById('authForm').reset();
    document.getElementById('usernameContainer').classList.remove('hidden');
    document.getElementById('passwordContainer').classList.remove('hidden');
    document.getElementById('emailContainer').classList.add('hidden');
    document.getElementById('authToggleFooter').classList.remove('hidden');
    updateAuthUI();
}

function switchAuthMode() {
    authMode = (authMode === 'login') ? 'register' : 'login';
    updateAuthUI();
}

function updateAuthUI() {
    const title = document.getElementById('authTitle');
    const emailContainer = document.getElementById('emailContainer');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const btnToggle = document.getElementById('authBtnToggle');

    if (authMode === 'login') {
        title.innerText = translations[currentLang].loginTitle;
        emailContainer.classList.add('hidden');
        submitBtn.innerText = translations[currentLang].submitBtn;
        toggleText.innerText = translations[currentLang].noAccountText;
        btnToggle.innerText = translations[currentLang].registerToggleBtn;
    } else if (authMode === 'register') {
        title.innerText = translations[currentLang].registerTitle;
        emailContainer.classList.remove('hidden');
        submitBtn.innerText = translations[currentLang].submitBtn;
        toggleText.innerText = translations[currentLang].hasAccountText;
        btnToggle.innerText = translations[currentLang].loginToggleBtn;
    }
}

function handleAuth(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('authUsername').value.trim();
    const passwordInput = document.getElementById('authPassword').value;
    const emailInput = document.getElementById('authEmail').value.trim();

    if (authMode === 'register') {
        const isExist = users.some(u => u.username === usernameInput || u.email === emailInput);
        if (isExist) {
            alert(currentLang === 'th' ? 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว!' : 'Username or Email already exists!');
            return;
        }

        users.push({
            username: usernameInput,
            email: emailInput,
            password: passwordInput
        });

        alert(currentLang === 'th' ? 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ' : 'Registration successful! Please log in.');
        authMode = 'login';
        resetAuthForm();
        return;
    }

    if (authMode === 'login') {
        const userMatch = users.find(u =>
            (u.username === usernameInput || u.email === usernameInput) && u.password === passwordInput
        );

        if (!userMatch) {
            alert(currentLang === 'th' ? 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง!' : 'Invalid username/email or password!');
            return;
        }

        const userText = document.getElementById('userStatusText');
        const logoutBtn = document.getElementById('logoutBtn');

        if (userText) userText.innerText = userMatch.username;
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        alert(currentLang === 'th' ? `ยินดีต้อนรับคุณ ${userMatch.username}` : `Welcome ${userMatch.username}`);
        toggleAuthModal();
    }
}

function handleLogout() {
    const userText = document.getElementById('userStatusText');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userText) userText.innerText = translations[currentLang].loginRegister;
    if (logoutBtn) logoutBtn.classList.add('hidden');
}

// ==========================================
// HERO BANNER SLIDER SYSTEM
// ==========================================
let currentSlideIndex = 0;
let autoSlideTimer = null;

function updateSlider() {
    const slider = document.getElementById("heroSlider");
    const dots = document.querySelectorAll("#sliderDots button");
    const slides = document.querySelectorAll("#heroSlider img");

    if (!slider || slides.length === 0) return;

    slider.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    dots.forEach((dot, index) => {
        dot.className = index === currentSlideIndex
            ? "w-8 h-3 rounded-full bg-cyan-400 transition-all duration-300"
            : "w-3 h-3 rounded-full bg-white/50 hover:bg-white transition-all duration-300";
    });
}

function nextSlide() {
    const slides = document.querySelectorAll("#heroSlider img");
    if (slides.length === 0) return;
    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
    updateSlider();
    resetSlideTimer();
}

function prevSlide() {
    const slides = document.querySelectorAll("#heroSlider img");
    if (slides.length === 0) return;
    currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
    updateSlider();
    resetSlideTimer();
}

function goToSlide(index) {
    currentSlideIndex = index;
    updateSlider();
    resetSlideTimer();
}

function startSlideTimer() {
    autoSlideTimer = setInterval(nextSlide, 3000);
}

function resetSlideTimer() {
    clearInterval(autoSlideTimer);
    startSlideTimer();
}

document.addEventListener("DOMContentLoaded", () => {
    updateSlider();
    startSlideTimer();
});

// ==========================================
// DOUBLE PROMO BANNER SLIDERS
// ==========================================
const promoState = {
    1: { index: 0, timer: null, id: 'promoSlider1', dotsId: 'promoDots1' },
    2: { index: 0, timer: null, id: 'promoSlider2', dotsId: 'promoDots2' }
};

function initPromoSliders() {
    [1, 2].forEach(id => {
        setupPromoDots(id);
        updatePromoSlider(id);
        startPromoTimer(id);
    });
}

function setupPromoDots(id) {
    const dotsContainer = document.getElementById(promoState[id].dotsId);
    const slides = document.querySelectorAll(`#${promoState[id].id} img`);
    if (!dotsContainer || slides.length === 0) return;

    dotsContainer.innerHTML = Array.from(slides).map((_, i) =>
        `<button onclick="goToPromoSlide(${id}, ${i})" class="w-2.5 h-2.5 rounded-full bg-white/40 transition-all duration-300"></button>`
    ).join('');
}

function updatePromoSlider(id) {
    const slider = document.getElementById(promoState[id].id);
    const dots = document.querySelectorAll(`#${promoState[id].dotsId} button`);
    const slides = document.querySelectorAll(`#${promoState[id].id} img`);

    if (!slider || slides.length === 0) return;

    slider.style.transform = `translateX(-${promoState[id].index * 100}%)`;

    dots.forEach((dot, index) => {
        dot.className = index === promoState[id].index
            ? "w-6 h-2.5 rounded-full bg-cyan-400 transition-all duration-300 shadow-md"
            : "w-2.5 h-2.5 rounded-full bg-white/40 hover:bg-white transition-all duration-300";
    });
}

function nextPromoSlide(id) {
    const slides = document.querySelectorAll(`#${promoState[id].id} img`);
    if (slides.length === 0) return;
    promoState[id].index = (promoState[id].index + 1) % slides.length;
    updatePromoSlider(id);
    resetPromoTimer(id);
}

function prevPromoSlide(id) {
    const slides = document.querySelectorAll(`#${promoState[id].id} img`);
    if (slides.length === 0) return;
    promoState[id].index = (promoState[id].index - 1 + slides.length) % slides.length;
    updatePromoSlider(id);
    resetPromoTimer(id);
}

function goToPromoSlide(id, index) {
    promoState[id].index = index;
    updatePromoSlider(id);
    resetPromoTimer(id);
}

function startPromoTimer(id) {
    promoState[id].timer = setInterval(() => nextPromoSlide(id), 3500 + (id * 500));
}

function resetPromoTimer(id) {
    clearInterval(promoState[id].timer);
    startPromoTimer(id);
}

document.addEventListener("DOMContentLoaded", () => {
    initPromoSliders();
});

// ==========================================
// THEME SWITCHER WITH LOCALSTORAGE SUPPORT
// ==========================================
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');

    localStorage.setItem('compang_theme', isLight ? 'light' : 'dark');
    updateThemeIcons(isLight);
}

function updateThemeIcons(isLight) {
    const desktopIcon = document.getElementById('themeIcon');
    const mobileBtn = document.querySelector('button[onclick="toggleTheme()"] i');

    const iconClass = isLight ? 'fa-solid fa-moon text-lg text-indigo-600' : 'fa-solid fa-sun text-lg text-yellow-400';
    const mobileIconClass = isLight ? 'fa-solid fa-moon text-sm text-indigo-600' : 'fa-solid fa-sun text-sm text-yellow-400';

    if (desktopIcon) desktopIcon.className = iconClass;
    if (mobileBtn) mobileBtn.className = mobileIconClass;
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('compang_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcons(true);
    }
});

// ==========================================
// ADMIN MODAL & CRUD FUNCTIONS
// ==========================================
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        resetAdminForm();
        modal.classList.remove('hidden');
    }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.classList.add('hidden');
        resetAdminForm();
    }
}

function resetAdminForm() {
    const form = document.getElementById('productForm');
    const editId = document.getElementById('editProductId');
    const title = document.getElementById('adminFormTitle');

    if (form) form.reset();
    if (editId) editId.value = '';
    if (title) title.innerText = translations[currentLang].createProductTitle;
}

async function saveProduct(e) {
    if (e) e.preventDefault();

    const editId = document.getElementById('editProductId').value;
    let productIdNum;

    if (editId) {
        productIdNum = Number(editId);
    } else {
        const validIds = products
            .map(p => Number(p.id))
            .filter(id => !isNaN(id) && id > 0);

        const maxId = validIds.length > 0 ? Math.max(...validIds) : 0;
        productIdNum = maxId + 1;
    }

    const customDocId = `id-${productIdNum}`;
    const existingProduct = editId ? products.find(p => String(p.id) === String(editId)) : null;
    const soldCount = existingProduct ? (existingProduct.sold || 0) : 0;

    const productData = {
        id: productIdNum,
        name: document.getElementById('pName').value.trim(),
        category: document.getElementById('pCategory').value,
        productType: document.getElementById('pSubCategory').value || 'normal',
        brand: document.getElementById('pBrand').value.trim(),
        oldPrice: parseFloat(document.getElementById('pOldPrice').value) || 0,
        price: parseFloat(document.getElementById('pPrice').value) || 0,
        specs: document.getElementById('pSpecs').value.trim(),
        img: document.getElementById('pImg').value.trim(),
        warranty: document.getElementById('pWarranty').value.trim() || '1Y',
        sold: soldCount
    };

    try {
        await db.collection("products").doc(customDocId).set(productData, { merge: true });

        alert(`บันทึกข้อมูลสำเร็จ! รหัสสินค้า ID: ${productIdNum}`);
        if (typeof closeAdminModal === 'function') closeAdminModal();

        await fetchProductsFromFirebase();
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการบันทึกสินค้า:", error);
        alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }
}

function editProduct(id) {
    const p = products.find(prod => String(prod.id) === String(id));
    if (!p) {
        console.error("ไม่พบข้อมูลสินค้า ID:", id);
        return;
    }

    document.getElementById('editProductId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pCategory').value = p.category;
    document.getElementById('pSubCategory').value = p.productType || 'normal';
    document.getElementById('pBrand').value = p.brand;
    document.getElementById('pOldPrice').value = p.oldPrice;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pSpecs').value = p.specs;
    document.getElementById('pImg').value = p.img;
    document.getElementById('pWarranty').value = p.warranty || '1Y';

    const title = document.getElementById('adminFormTitle');
    if (title) title.innerText = translations[currentLang].editProductTitle;

    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.remove('hidden');
}

async function deleteProduct(id) {
    const confirmMsg = (typeof currentLang !== 'undefined' && currentLang === 'th')
        ? 'คุณต้องการลบสินค้านี้ใช่หรือไม่?'
        : 'Are you sure you want to delete this product?';

    if (confirm(confirmMsg)) {
        try {
            const item = products.find(p => String(p.id) === String(id));
            const docIdToDelete = (item && item.firestoreId) ? item.firestoreId : `id-${id}`;

            await db.collection("products").doc(docIdToDelete).delete();
            alert("ลบสินค้าเรียบร้อยแล้ว!");

            await fetchProductsFromFirebase();
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการลบสินค้า:", error);
            alert("ไม่สามารถลบสินค้าได้ กรุณาลองใหม่อีกครั้ง");
        }
    }
}

// ==========================================
// FULL-SCREEN ANTI-COPY & RANDOM INSULT SYSTEM
// ==========================================
const insultList = [
    "พวกขี้ก็อป สวะ กันคนก็อปเว็บ",
    "ไม่มีปัญญาเขียนเองหรือไง ขี้ก็อป!",
    "สมองมีไว้กั้นหูหรือไง ถึงได้ชอบก็อปงานคนอื่น!",
    "หน้าด้านก็อป โค้ดนี้ใช้เหงื่อและแรงสร้างนะ!",
    "ก็อปไปก็ไม่เจริญหรอก สภาพ!",
    "อย่าหาทำ! คิดเองเขียนเองไม่เป็นหรือไง?",
    "แจ้งเตือน: ตรวจพบพฤติกรรมขี้ก็อปเกรดต่ำ!"
];

let currentInsult = insultList[0];

function randomizeWarningText() {
    const randomIndex = Math.floor(Math.random() * insultList.length);
    currentInsult = insultList[randomIndex];
    
    const displayEl = document.getElementById('warningTextDisplay');
    if (displayEl) {
        displayEl.innerText = currentInsult;
    }
}

function showCopyWarning() {
    randomizeWarningText();
    const modal = document.getElementById('copyWarningModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeCopyWarning() {
    const modal = document.getElementById('copyWarningModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');x
    }
}

// ==========================================
// SMOOTH AUTO SCROLL SYSTEM (60FPS PING-PONG LOOP)
// ==========================================
const autoScrollState = {};

function startProductAutoScroll(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (!autoScrollState[gridId]) {
        autoScrollState[gridId] = {
            dir: 1,         // 1 = เลื่อนขวา, -1 = เลื่อนซ้าย
            speed: 1.2,     // ความเร็วพิกเซลต่อเฟรม
            paused: false,
            rafId: null
        };
    }

    const state = autoScrollState[gridId];
    state.paused = false;

    // ยกเลิก Loop เก่าก่อนเปิดใหม่
    if (state.rafId) cancelAnimationFrame(state.rafId);

    function step() {
        if (state.paused) return;

        const maxScroll = grid.scrollWidth - grid.clientWidth;

        if (maxScroll > 0) {
            // ปรับทิศทางเมื่อชนขอบอย่างนุ่มนวล
            if (grid.scrollLeft >= maxScroll - 1) {
                state.dir = -1;
            } else if (grid.scrollLeft <= 0) {
                state.dir = 1;
            }

            grid.scrollLeft += state.speed * state.dir;
        }

        state.rafId = requestAnimationFrame(step);
    }

    state.rafId = requestAnimationFrame(step);
}

function stopProductAutoScroll(gridId) {
    const state = autoScrollState[gridId];
    if (state) {
        state.paused = true;
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
    }
}

function initAutoScrollEvents(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    startProductAutoScroll(gridId);

    // 1. หยุดเลื่อนเมื่อ Hover / ทำงานต่อเมื่อ Leave
    grid.addEventListener('mouseenter', () => stopProductAutoScroll(gridId));
    grid.addEventListener('mouseleave', () => startProductAutoScroll(gridId));

    // 2. หยุดเลื่อนเมื่อ Touch บนมือถือ / ทำงานต่อเมื่อปล่อย
    grid.addEventListener('touchstart', () => stopProductAutoScroll(gridId), { passive: true });
    grid.addEventListener('touchend', () => startProductAutoScroll(gridId));

    // 3. หยุดเลื่อนเมื่อ Drag ด้วยเมาส์ / ทำงานต่อเมื่อปล่อยคลิก
    grid.addEventListener('mousedown', () => stopProductAutoScroll(gridId));
    grid.addEventListener('mouseup', () => startProductAutoScroll(gridId));
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initAutoScrollEvents('normalProductGrid');
        initAutoScrollEvents('productGrid');
        initAutoScrollEvents('hotProductGrid');
        initAutoScrollEvents('flashSaleProductGrid');
    }, 600);
});

// ==========================================
// WELCOME AD POPUP (โฆษณาตอนเปิดเว็บ)
// ==========================================
function closeWelcomeAd() {
    const overlay = document.getElementById('welcomeAdOverlay');
    if (!overlay) return;
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);
    document.body.style.overflow = '';
}

function continueWelcomeAd() {
    // ปิดโฆษณา แล้วพาไปยังหน้าสินค้า/หมวดเกมมิ่งเกียร์
    closeWelcomeAd();
    if (typeof filterCategory === 'function') {
        filterCategory('all');
    }
    const productSection = document.getElementById('product-section');
    if (productSection) {
        setTimeout(() => {
            productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('welcomeAdOverlay');
    if (overlay) {
        document.body.style.overflow = 'hidden';
    }
});

// ==========================================
// FULL-SCREEN SNOWFALL SYSTEM (ระบบหิมะตกเต็มจอ)
// ==========================================
function initSnowfall() {
    // 1. ตรวจสอบและสร้าง Container สำหรับหิมะให้อยู่ชั้นบนสุดของ body
    let snowContainer = document.getElementById('globalSnowContainer');
    if (!snowContainer) {
        snowContainer = document.createElement('div');
        snowContainer.id = 'globalSnowContainer';
        
        // กำหนด Style ให้ครอบคลุมทั้งหน้าจอแบบ Fixed ไม่บังการคลิก
        Object.assign(snowContainer.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: '-9999',
            overflow: 'hidden'
        });
        
        document.body.appendChild(snowContainer);
    }

    // 2. แทรก Animation CSS เข้าไปใน <head>
    if (!document.getElementById('snowStyle')) {
        const style = document.createElement('style');
        style.id = 'snowStyle';
        style.innerHTML = `
            @keyframes fall {
                0% {
                    transform: translateY(-10vh) translateX(0);
                    opacity: 1;
                }
                100% {
                    transform: translateY(105vh) translateX(50px);
                    opacity: 0.2;
                }
            }
            .snowflake {
                position: absolute;
                color: #ffffff;
                user-select: none;
                pointer-events: none;
                animation: fall linear infinite;
            }
        `;
        document.head.appendChild(style);
    }

    // 3. สร้างเกล็ดหิมะแบบสุ่มตำแหน่งความกว้างและความเร็ว
    const snowflakeCount = 40; // ปรับจำนวนเกล็ดหิมะได้ตามต้องการ
    const snowIcons = ['❄', '❅', '❆', '•'];

    for (let i = 0; i < snowflakeCount; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.innerText = snowIcons[Math.floor(Math.random() * snowIcons.length)];
        
        const size = Math.random() * 12 + 8; // ขนาด 8px - 20px
        const left = Math.random() * 100; // ตำแหน่งแนวนอน 0% - 100%
        const duration = Math.random() * 5 + 5; // ระยะเวลาตก 5s - 10s
        const delay = Math.random() * 5; // หน่วงเวลาเริ่มต้น

        Object.assign(flake.style, {
            fontSize: `${size}px`,
            left: `${left}vw`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
            opacity: Math.random() * 0.7 + 0.3
        });

        snowContainer.appendChild(flake);
    }
}

// เรียกใช้งานระบบหิมะหลังจาก DOM โหลดเสร็จสิ้น
document.addEventListener('DOMContentLoaded', () => {
    initSnowfall();
});