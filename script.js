// ข้อมูลสินค้าเกมมิ่งเกียร์ แยกตามหมวดหมู่และแบรนด์

let products = [];

// ==========================================
// PRODUCT CACHE (ลด Firestore Reads)
// เก็บผลลัพธ์สินค้าไว้ใน localStorage เพื่อไม่ต้องยิง Firestore ใหม่
// ทุกครั้งที่เปลี่ยนหน้า/เปิดแท็บใหม่ (index -> หมวดหมู่ -> รายละเอียดสินค้า -> ฯลฯ)
// ใช้ localStorage แทน sessionStorage เพื่อให้แคชใช้ร่วมกันได้ทุกแท็บ/ทุกครั้งที่เปิดเว็บ
//
// ระบบเช็คเวอร์ชัน (meta/products): แทนที่จะดึงสินค้าทั้ง collection ใหม่ทุกครั้งที่แคชหมดอายุ
// จะเช็คเอกสารเล็ก ๆ 1 ใบก่อน (เสีย 1 read) ว่าตรงกับเวอร์ชันที่แคชไว้ไหม
// ถ้าตรง = สินค้ายังไม่เปลี่ยน ใช้แคชเดิมต่อได้เลย ไม่ต้องดึงทั้ง collection
// จะดึงทั้ง collection จริง (ตามจำนวนสินค้า) ก็ต่อเมื่อแอดมินบันทึก/ลบสินค้าจริง ๆ เท่านั้น
// ==========================================
const PRODUCTS_CACHE_KEY = 'compung_products_cache_v1';
const PRODUCTS_CACHE_TTL_MS = 2 * 60 * 1000; // ช่วงผ่อนผัน 2 นาที: ในช่วงนี้ใช้แคชเดิมได้เลยโดยไม่เช็คอะไรเลย
// พ้นช่วงนี้แล้วค่อยเช็คเวอร์ชัน (1 read) ก่อนตัดสินใจว่าต้องดึงทั้ง collection ใหม่หรือไม่
// หมายเหตุ: fetchProductsFromFirebase(true) ยังมีไว้ใช้เผื่อจำเป็น (เช่น debug/บังคับ sync)
// แต่ตอนแอดมินเพิ่ม/แก้ไข/ลบสินค้าปกติ ไม่เรียกฟังก์ชันนี้แล้ว เพราะเสีย read เท่าจำนวนสินค้าทั้งร้านทุกครั้ง
// เปลี่ยนไปอัปเดต products array ในเครื่อง + เขียนแคชทับตรง ๆ แทน (ดูฟังก์ชัน saveProduct / deleteProduct)

// อ่านแคชสินค้าจาก localStorage — คืนค่า null ถ้าไม่มีแคชหรือข้อมูลเสีย (ไม่เช็ค TTL ในนี้แล้ว)
function readProductsCache() {
    try {
        const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!Array.isArray(cached.products)) return null;

        return cached; // { timestamp, version, products }
    } catch (error) {
        // ข้อมูลแคชเสีย/parse ไม่ได้ ไม่ต้อง throw ต่อ แค่ให้ไปดึงใหม่จาก Firestore แทน
        console.warn('อ่านแคชสินค้าไม่สำเร็จ จะดึงข้อมูลใหม่จาก Firebase แทน:', error);
        return null;
    }
}

// บันทึกสินค้าล่าสุดลง localStorage พร้อม timestamp และเวอร์ชันล่าสุดที่รู้
function writeProductsCache(productList, version) {
    try {
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            version: version || null,
            products: productList
        }));
    } catch (error) {
        // เช่น localStorage เต็ม หรือถูกปิดใช้งาน (บาง Private/Incognito mode) — ข้ามได้ ไม่กระทบการทำงานหลัก
        console.warn('บันทึกแคชสินค้าไม่สำเร็จ:', error);
    }
}

// ล้างแคชสินค้าทิ้ง (เผื่อในอนาคตอยากบังคับเคลียร์แคชจากจุดอื่น)
function clearProductsCache() {
    try {
        localStorage.removeItem(PRODUCTS_CACHE_KEY);
    } catch (error) {
        // เพิกเฉยได้
    }
}

// ==========================================
// USER DATA CACHE (ลด Firestore Reads จาก users/{uid})
// เดิม: auth.onAuthStateChanged ยิง db.collection('users').doc(uid).get() ใหม่ทุกครั้งที่โหลดหน้า
// (เว็บนี้เป็น multi-page ไม่ใช่ SPA จึง onAuthStateChanged ทำงานทุก page load)
// ทำให้ user ที่ login อยู่เสีย 1 read ต่อหน้าที่เปิด แม้ข้อมูล (role/ชื่อ/cart) จะไม่ได้เปลี่ยนเลยก็ตาม
// แก้โดยแคชไว้ใน localStorage แบบเดียวกับ products (TTL สั้น ๆ) — พ้น TTL ค่อยดึงใหม่จริง
// ==========================================
const USER_CACHE_KEY = 'compung_user_cache_v1';
const USER_CACHE_TTL_MS = 2 * 60 * 1000; // 2 นาที เหมือนกับ products cache

// อ่านแคชข้อมูล user จาก localStorage — คืนค่า null ถ้าไม่มี/ข้อมูลเสีย/คนละ uid
function readUserCache(uid) {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!cached || cached.uid !== uid || !cached.data) return null;

        return cached; // { uid, timestamp, data }
    } catch (error) {
        console.warn('อ่านแคชข้อมูลผู้ใช้ไม่สำเร็จ:', error);
        return null;
    }
}

// บันทึกข้อมูล user ล่าสุดลง localStorage พร้อม timestamp
function writeUserCache(uid, data) {
    try {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
            uid: uid,
            timestamp: Date.now(),
            data: data
        }));
    } catch (error) {
        console.warn('บันทึกแคชข้อมูลผู้ใช้ไม่สำเร็จ:', error);
    }
}

// อัปเดตเฉพาะบาง field ของแคช user ที่มีอยู่ (เช่น cart) โดยไม่ต้อง fetch ใหม่
// ใช้หลังจากเขียนค่าลง Firestore สำเร็จแล้ว เพื่อไม่ให้แคชค้างข้อมูลเก่าจนกว่าจะหมด TTL
function patchUserCache(uid, partialData) {
    try {
        const cached = readUserCache(uid);
        const merged = Object.assign({}, cached && cached.data, partialData);
        writeUserCache(uid, merged);
    } catch (error) {
        console.warn('อัปเดตแคชข้อมูลผู้ใช้ไม่สำเร็จ:', error);
    }
}

// ล้างแคชข้อมูล user ทิ้ง (เรียกตอน logout เพื่อไม่ให้บัญชีถัดไปที่ login เห็นข้อมูลค้าง)
function clearUserCache() {
    try {
        localStorage.removeItem(USER_CACHE_KEY);
    } catch (error) {
        // เพิกเฉยได้
    }
}

// ดึงเวอร์ชันล่าสุดของสินค้าจากเอกสาร meta/products (1 read เท่านั้น ไม่ว่าสินค้าจะมีกี่ชิ้น)
// เอกสารนี้ถูกอัปเดตทุกครั้งที่แอดมินบันทึก/ลบสินค้า (ดูฟังก์ชัน saveProduct / deleteProduct)
async function fetchProductsVersion() {
    try {
        const metaDoc = await db.collection('meta').doc('products').get();
        if (!metaDoc.exists) return null;
        const updatedAt = metaDoc.data().updatedAt;
        return updatedAt ? String(updatedAt.toMillis()) : null;
    } catch (error) {
        console.warn('เช็คเวอร์ชันสินค้าไม่สำเร็จ:', error);
        return null; // เช็คไม่ได้ ให้ถือว่าต้องดึงทั้งหมดใหม่เพื่อความชัวร์
    }
}

// รวมการ Render หน้าเว็บทุกจุดที่ต้องอัปเดตเมื่อ products เปลี่ยน
// (ใช้ร่วมกันทั้งตอนโหลดสดจาก Firestore และตอนใช้ข้อมูลจากแคช)
function renderAllProductViews() {
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

    // อัปเดตตัวเลข badge จำนวนสินค้าทั้งหมดบนแท็บ Admin ทันทีที่ข้อมูลสินค้าเปลี่ยน
    // (ไม่ต้องรอให้แอดมินเปิด modal ตั้งค่าก่อน ตัวเลขจะพร้อมอยู่แล้วตั้งแต่หน้าเว็บโหลดเสร็จ)
    const countBadge = document.getElementById('adminProductsCountBadge');
    if (countBadge) countBadge.innerText = String(products.length);
}

// ฟังก์ชันดึงข้อมูลสินค้าจากคอลเลกชัน "products" ใน Firebase
// forceRefresh = true: ข้ามแคชและการเช็คเวอร์ชันทั้งหมด ดึงข้อมูลสดจาก Firestore ทันที
// (ใช้หลังแอดมิน เพิ่ม/แก้ไข/ลบ สินค้า เพื่อให้เห็นผลทันที)
async function fetchProductsFromFirebase(forceRefresh = false) {
    try {
        const cached = forceRefresh ? null : readProductsCache();

        if (cached) {
            // ช่วงผ่อนผัน: ถ้าเพิ่งเช็ค/ดึงข้อมูลมาไม่เกิน TTL ที่ตั้งไว้ ใช้แคชเดิมต่อได้เลย
            // ไม่ต้องเช็คเวอร์ชันซ้ำด้วย (ลด read กรณีลูกค้าเปิดหลายหน้าในเวลาสั้น ๆ)
            const withinGracePeriod = cached.timestamp && (Date.now() - cached.timestamp < PRODUCTS_CACHE_TTL_MS);
            if (withinGracePeriod) {
                products = cached.products;
                renderAllProductViews();
                return; // ไม่เสีย read เลยแม้แต่ครั้งเดียว
            }

            // พ้นช่วงผ่อนผันแล้ว → เช็คเวอร์ชันก่อน (เสีย 1 read) แทนที่จะดึงทั้ง collection ทันที
            const latestVersion = await fetchProductsVersion();

            // ถ้าเช็คเวอร์ชันได้ และตรงกับที่แคชไว้ = สินค้ายังไม่เปลี่ยน ใช้แคชเดิมต่อได้เลย
            if (latestVersion !== null && latestVersion === cached.version) {
                products = cached.products;
                writeProductsCache(products, latestVersion); // รีเฟรช timestamp ให้เข้าช่วงผ่อนผันใหม่อีกรอบ
                renderAllProductViews();
                return; // จบตรงนี้ เสียแค่ 1 read (เช็คเวอร์ชัน) ไม่แตะ collection สินค้าเลย
            }
            // ถ้าเวอร์ชันไม่ตรง (หรือเช็คเวอร์ชันไม่สำเร็จ) จะไหลต่อไปดึงทั้ง collection ใหม่ด้านล่าง
        }

        const [snapshot, latestVersion] = await Promise.all([
            db.collection("products").get(),
            fetchProductsVersion()
        ]);

        // แปลงข้อมูลจาก Firebase มาใส่ในตัวแปร products
        // สำคัญ: ให้ "id" ของสินค้า = Document ID จริงของ Firestore เสมอ (สุ่มโดย Firestore ตอนสร้าง)
        // เพื่อการันตีว่าจะไม่มีทางซ้ำกัน แม้แอดมินหลายคนจะเพิ่มสินค้าพร้อมกัน
        // (spread doc.data() ก่อน แล้วค่อย override ด้วย doc.id ทีหลัง เผื่อเอกสารเก่ามี field "id" แบบตัวเลขค้างอยู่)
        products = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            firestoreId: doc.id // เก็บไว้เผื่อโค้ดส่วนอื่นยังอ้างอิง firestoreId อยู่
        }));

        writeProductsCache(products, latestVersion); // เก็บแคช + เวอร์ชันล่าสุดไว้ใช้ในหน้าอื่น/รอบถัดไป

        renderAllProductViews();
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Firebase:", error);
    } finally {
        hidePageLoader();
    }
}

// ==========================================
// PAGE LOADER (Animation ตอนกำลังโหลดหน้าเว็บ)
// ==========================================
let pageLoaderHidden = false;
const pageLoaderStartTime = Date.now();
const PAGE_LOADER_MIN_DURATION = 600; // แสดงแอนิเมชันอย่างน้อย 0.6 วิ กันกระพริบเร็วเกินไป
function hidePageLoader() {
    if (pageLoaderHidden) return;
    pageLoaderHidden = true;

    const elapsed = Date.now() - pageLoaderStartTime;
    const remaining = Math.max(PAGE_LOADER_MIN_DURATION - elapsed, 0);

    setTimeout(() => {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('loader-hidden');
            setTimeout(() => loader.remove(), 600);
        }
    }, remaining);
}
// กันเหนียว: ถ้าโหลดข้อมูลนานผิดปกติหรือเกิดปัญหาอื่น ให้ปิด loader อัตโนมัติหลังผ่านไป 5 วินาที
setTimeout(hidePageLoader, 5000);

// ==========================================
// i18n TRANSLATION SYSTEM (ระบบสลับภาษา 4 ภาษา)
// ==========================================
let currentLang = localStorage.getItem('compang_lang') || 'th';

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
        adminSettings: "ตั้งค่า (Admin)",
        adminSettingsTitle: "ตั้งค่า (Admin)",
        adminTabProducts: "รายการสินค้าทั้งหมด",
        adminTabTheme: "ธีมสี",
        adminTabOnline: "ผู้ใช้ออนไลน์",
        adminProductSearchPlaceholder: "ค้นหาสินค้าตามชื่อ/แบรนด์...",
        adminColProduct: "สินค้า",
        adminColCategory: "หมวดหมู่",
        adminColPrice: "ราคา",
        adminColAction: "จัดการ",
        adminProductsListEmpty: "ไม่พบสินค้า",
        adminThemeModeLabel: "โหมดสี",
        adminThemeModeToggle: "สลับโหมดสว่าง / มืด",
        adminThemeColorLabel: "โทนสีเว็บ (เปลี่ยนทั้งเว็บ รวมโลโก้)",
        adminOnlineHint: "บัญชีที่ใช้งานเว็บอยู่ในตอนนี้ (อัปเดตแบบเรียลไทม์)",
        adminOnlineEmpty: "ยังไม่มีใครออนไลน์",
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
        adminSettings: "Settings (Admin)",
        adminSettingsTitle: "Settings (Admin)",
        adminTabProducts: "All Products",
        adminTabTheme: "Theme Color",
        adminTabOnline: "Online Users",
        adminProductSearchPlaceholder: "Search by name/brand...",
        adminColProduct: "Product",
        adminColCategory: "Category",
        adminColPrice: "Price",
        adminColAction: "Actions",
        adminProductsListEmpty: "No products found",
        adminThemeModeLabel: "Color Mode",
        adminThemeModeToggle: "Toggle Light / Dark",
        adminThemeColorLabel: "Site Theme Color (changes site-wide, incl. logo)",
        adminOnlineHint: "Accounts currently active on the site (real-time)",
        adminOnlineEmpty: "No one online right now",
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
        adminSettings: "设置（管理员）",
        adminSettingsTitle: "设置（管理员）",
        adminTabProducts: "所有商品",
        adminTabTheme: "主题颜色",
        adminTabOnline: "在线用户",
        adminProductSearchPlaceholder: "按名称/品牌搜索...",
        adminColProduct: "商品",
        adminColCategory: "分类",
        adminColPrice: "价格",
        adminColAction: "操作",
        adminProductsListEmpty: "未找到商品",
        adminThemeModeLabel: "颜色模式",
        adminThemeModeToggle: "切换浅色 / 深色",
        adminThemeColorLabel: "网站主题色（全站生效，含Logo）",
        adminOnlineHint: "当前在线账号（实时更新）",
        adminOnlineEmpty: "目前没有人在线",
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
        adminSettings: "Настройки (Админ)",
        adminSettingsTitle: "Настройки (Админ)",
        adminTabProducts: "Все товары",
        adminTabTheme: "Цвет темы",
        adminTabOnline: "Пользователи онлайн",
        adminProductSearchPlaceholder: "Поиск по названию/бренду...",
        adminColProduct: "Товар",
        adminColCategory: "Категория",
        adminColPrice: "Цена",
        adminColAction: "Действия",
        adminProductsListEmpty: "Товары не найдены",
        adminThemeModeLabel: "Цветовой режим",
        adminThemeModeToggle: "Переключить светлый / тёмный",
        adminThemeColorLabel: "Цвет темы сайта (меняет весь сайт, включая логотип)",
        adminOnlineHint: "Аккаунты, активные на сайте сейчас (в реальном времени)",
        adminOnlineEmpty: "Сейчас никого нет онлайн",
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

// อัปเดตข้อความบนหน้าเว็บทั้งหมดให้ตรงกับ currentLang (ใช้ทั้งตอนเปลี่ยนภาษาและตอนโหลดหน้าใหม่)
function applyLanguageToDOM() {
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

function toggleLanguage() {
    const nextIndex = (langOrder.indexOf(currentLang) + 1) % langOrder.length;
    currentLang = langOrder[nextIndex];

    // จำภาษาที่เลือกไว้ใน localStorage เพื่อให้ใช้ภาษาเดิมต่อเนื่องทุกหน้า ไม่ต้องกดเปลี่ยนใหม่
    localStorage.setItem('compang_lang', currentLang);

    applyLanguageToDOM();
}

// ตอนโหลดหน้าเว็บ (ทุกหน้า) ให้ดึงภาษาที่เคยเลือกไว้จาก localStorage มาใช้ทันที
document.addEventListener('DOMContentLoaded', () => {
    applyLanguageToDOM();
});

// ==========================================
// PRODUCT RENDER & FILTER SYSTEM
// ==========================================
let cart = [];                // ตะกร้าสินค้าปัจจุบัน (sync กับ field "cart" ใน users/{uid} บน Firestore)

// ระบบประวัติการซื้อสินค้า (Order History)
// เก็บจริงใน Firestore ที่ users/{uid}/orders — โหลดผ่าน loadOrderHistoryFromFirestore()
let orderHistory = [];
// เดิม onAuthStateChanged ดึงประวัติออเดอร์ "ทั้งหมด" ของ user ทุกครั้งที่โหลดหน้า แม้หน้านั้นไม่ได้แสดงประวัติเลย
// (ยิ่ง user มีออเดอร์สะสมเยอะ ยิ่งเสีย read เยอะ และเสียซ้ำทุกหน้าที่เปิด)
// ใช้ flag นี้ให้โหลดแบบ lazy: ดึงจริงก็ต่อเมื่อ user เปิดแท็บ "ประวัติการสั่งซื้อ" ครั้งแรกในเซสชันนี้เท่านั้น
let orderHistoryLoaded = false;
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
        <div onclick="goToProduct('${p.id}')" class="product-card cursor-pointer w-64 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col hover:border-[var(--theme-500)]/60 hover:-translate-y-1 transition-all duration-300 group shadow-lg relative">

            ${isCurrentUserAdmin() ? `
            <div class="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition duration-200">
                <button onclick="event.stopPropagation(); editProduct('${p.id}')" title="แก้ไข" class="bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="event.stopPropagation(); deleteProduct('${p.id}')" title="ลบสินค้า" class="bg-slate-950/80 hover:bg-red-500 hover:text-white text-red-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>` : ''}

            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold text-[var(--theme-500)] uppercase tracking-wide">${p.brand}</span>
            </div>

            <div class="relative overflow-hidden rounded-xl mb-3 bg-gradient-to-br from-slate-100 via-white to-slate-200 h-36 w-full flex items-center justify-center shrink-0 shadow-inner">
                <img src="${p.img}" alt="${p.name}" class="object-contain w-full h-full p-4 mix-blend-multiply group-hover:scale-105 transition duration-500">
            </div>

            <h3 class="font-bold text-sm text-white line-clamp-2 h-10 mb-1 leading-tight group-hover:text-[var(--theme-400)] transition" title="${p.name}">
                ${p.name}
            </h3>

            <p class="text-xs text-gray-400 line-clamp-2 h-8 mb-2 leading-normal" title="${p.specs}">
                ${p.specs}
            </p>

            <div class="mt-1">
                <div class="flex justify-between items-center h-4 mb-0.5">
                    ${hasDiscount ? `<span class="text-xs text-gray-500 line-through">฿${p.oldPrice.toLocaleString()}</span>` : `<span></span>`}
                    <span class="warranty-badge flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <i class="fa-solid fa-shield-halved text-[var(--theme-400)]"></i> ประกัน ${warranty}
                    </span>
                </div>
                <div class="flex justify-between items-end mb-2">
                    <span class="text-xl font-black text-[var(--theme-400)]">฿${p.price.toLocaleString()}</span>
                    <span class="text-[10px] text-emerald-500 font-semibold">จัดส่งฟรี</span>
                </div>
            </div>

            <div class="flex items-center justify-between mb-2.5">
                ${hasDiscount ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">-฿${discountAmount.toLocaleString()}</span>` : `<span class="text-[10px] text-gray-500">*ราคาเฉพาะออนไลน์</span>`}
            </div>

            <button onclick="event.stopPropagation(); addToCart('${p.id}')" class="buy-btn w-full bg-gradient-to-r from-[var(--theme-500)] to-blue-600 hover:from-[var(--theme-400)] hover:to-blue-500 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-[var(--theme-500)]/20 transition duration-200">
                <i class="fa-solid fa-cart-shopping"></i> ${translations[currentLang].buyNow}
            </button>
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

// จำนวนสินค้าสูงสุดต่อหน้า และหน้าปัจจุบันที่กำลังแสดงอยู่ (รีเซ็ตเป็นหน้า 1 ทุกครั้งที่ค้นหา/กรอง/โหลดใหม่)
const GAMING_GEAR_PAGE_SIZE = 20;
let gamingGearCurrentPage = 1;

// ==========================================
// GLOBAL SEARCH HELPERS (ค้นหาทั้งร้าน ไม่จำกัดหมวดหมู่ของหน้าปัจจุบัน)
// แก้ปัญหา: เดิมพิมพ์ค้นหาในหน้าหมวดหมู่ (เช่น m.html = หน้าเมาส์) จะกรองเจอแค่ในหมวดเมาส์เท่านั้น
// ทั้งที่ควรค้นทั้งร้าน เช่น พิมพ์ "เมาส์ razer" ควรเจอทั้งเมาส์และคีย์บอร์ดแบรนด์ Razer แสดงรวมกันทันที
// ==========================================

// ชื่อหมวดหมู่ภาษาไทย (ใช้เป็น fallback เสมอ ไม่ว่าเว็บจะตั้งภาษาอะไรอยู่ก็ตาม เพื่อให้พิมพ์ค้นหาชื่อหมวดหมู่ไทยเจอ)
const CATEGORY_LABELS_TH = {
    mouse: 'เมาส์', keyboard: 'คีย์บอร์ด', headset: 'หูฟัง', speaker: 'ลำโพง',
    microphone: 'ไมโครโฟน', notebook: 'โน้ตบุ๊ก', chair: 'เก้าอี้', desk: 'โต๊ะ',
    mousepad: 'แผ่นรองเมาส์', monitor: 'จอภาพ', cooling: 'ระบบระบายความร้อน',
    streaming: 'อุปกรณ์สตรีมมิ่ง', vr: 'อุปกรณ์ VR', racing: 'อุปกรณ์แข่งรถ',
    controller: 'จอยเกม', camera: 'กล้อง', flashdrive: 'แฟลชไดรฟ์'
};

// แปลง category key (เช่น "mouse") เป็นชื่อหมวดหมู่ตามภาษาที่เว็บกำลังแสดงอยู่ (ถ้ามี) — ใช้ตอนแสดงผลและตอนค้นหา
function getCategoryLabel(categoryKey) {
    if (!categoryKey) return '';
    try {
        const i18nKey = 'cat' + categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
        const t = typeof translations !== 'undefined' && translations[currentLang];
        if (t && t[i18nKey]) return t[i18nKey];
    } catch (e) { /* เพิกเฉยได้ ใช้ fallback ด้านล่างแทน */ }
    return CATEGORY_LABELS_TH[categoryKey] || categoryKey;
}

// เช็คว่าสินค้าชิ้นนี้ตรงกับคำค้นหาหรือไม่ — ค้นจากชื่อ/แบรนด์/สเปก/หมวดหมู่(key)/ชื่อหมวดหมู่ที่แปลแล้ว/ชื่อหมวดหมู่ไทย
// รองรับพิมพ์หลายคำพร้อมกัน (คั่นด้วยเว้นวรรค) เช่น "เมาส์ razer" -> ต้องเจอ "ครบทุกคำ" ในสินค้าชิ้นเดียวกัน (AND)
function matchesGlobalSearch(product, searchWords) {
    const haystack = [
        product.name, product.brand, product.specs, product.category,
        getCategoryLabel(product.category), CATEGORY_LABELS_TH[product.category]
    ].join(' ').toLowerCase();
    return searchWords.every(w => haystack.includes(w));
}

// page = ระบุเมื่อกดปุ่มเลขหน้าเท่านั้น ถ้าไม่ระบุ (เช่น ตอนค้นหา/กรอง/โหลดสินค้าใหม่) จะรีเซ็ตกลับไปหน้า 1 เสมอ
function renderGamingGearGrid(page) {
    const grid = document.getElementById('gamingGearGrid');
    if (!grid) return;

    gamingGearCurrentPage = (typeof page === 'number') ? page : 1;

    const pageCategory = document.body.getAttribute('data-category');

    // --- ตัวกรอง Sidebar (จะมีผลเฉพาะหน้าที่มี Sidebar Filter เท่านั้น) ---

    // 0) กรองตามคำค้นหา (ช่องค้นหาด้านบนสุดของหน้า)
    // ถ้ามีการพิมพ์ค้นหา -> ค้นหา "ทั้งร้าน" ทันที ไม่จำกัดอยู่แค่หมวดหมู่ของหน้าปัจจุบัน (pageCategory)
    // เพื่อให้พิมพ์ "เมาส์ razer" ในหน้าไหนก็ตาม เจอทั้งเมาส์และคีย์บอร์ด (หรือสินค้าอื่น) แบรนด์ Razer แสดงรวมกันมาทันที
    const searchInputEl = document.getElementById('searchInput');
    const searchTerm = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

    let items;
    if (searchTerm) {
        const searchWords = searchTerm.split(/\s+/).filter(Boolean);
        items = products.filter(p => matchesGlobalSearch(p, searchWords));
    } else {
        // ไม่มีคำค้นหา -> พฤติกรรมเดิม จำกัดเฉพาะหมวดหมู่ของหน้าปัจจุบัน (ถ้าหน้านี้ผูกหมวดหมู่ไว้)
        items = (pageCategory && pageCategory !== 'all')
            ? products.filter(p => p.category === pageCategory)
            : products;
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
        renderGamingGearPagination(0, 1);
        return;
    }

    // เรียงสินค้าจากราคาถูกสุดไปแพงสุดเสมอ
    items = items.slice().sort((a, b) => (a.price || 0) - (b.price || 0));

    // แบ่งหน้า: หน้าละ GAMING_GEAR_PAGE_SIZE ชิ้น
    const totalPages = Math.max(1, Math.ceil(items.length / GAMING_GEAR_PAGE_SIZE));
    if (gamingGearCurrentPage > totalPages) gamingGearCurrentPage = totalPages;
    if (gamingGearCurrentPage < 1) gamingGearCurrentPage = 1;

    const startIdx = (gamingGearCurrentPage - 1) * GAMING_GEAR_PAGE_SIZE;
    const pageItems = items.slice(startIdx, startIdx + GAMING_GEAR_PAGE_SIZE);

    grid.innerHTML = pageItems.map(p => {
        const hasDiscount = p.oldPrice > p.price;
        const discountAmount = hasDiscount ? (p.oldPrice - p.price) : 0;
        const warranty = p.warranty || '1Y';
        const sold = p.sold || 0;
        const soldLabel = sold >= 1000 ? (sold / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : sold;

        return `
        <div onclick="goToProduct('${p.id}')" class="product-card cursor-pointer w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col hover:border-[var(--theme-500)]/60 hover:-translate-y-1 transition-all duration-300 group shadow-lg relative">

            ${isCurrentUserAdmin() ? `
            <div class="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition duration-200">
            <button onclick="event.stopPropagation(); editProduct('${p.id}')" title="แก้ไข" class="bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                <i class="fa-solid fa-pen-to-square"></i>
            </button>
                <button onclick="event.stopPropagation(); deleteProduct('${p.id}')" title="ลบสินค้า" class="bg-slate-950/80 hover:bg-red-500 hover:text-white text-red-400 backdrop-blur-md w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-md transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>` : ''}

            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold text-[var(--theme-500)] uppercase tracking-wide">${p.brand}</span>
            </div>

            <div class="relative overflow-hidden rounded-xl mb-3 bg-gradient-to-br from-slate-100 via-white to-slate-200 h-36 w-full flex items-center justify-center shrink-0 shadow-inner">
                <img src="${p.img}" alt="${p.name}" class="object-contain w-full h-full p-4 mix-blend-multiply group-hover:scale-105 transition duration-500">
            </div>

            <h3 class="font-bold text-sm text-white line-clamp-2 h-10 mb-1 leading-tight group-hover:text-[var(--theme-400)] transition" title="${p.name}">
                ${p.name}
            </h3>

            <p class="text-xs text-gray-400 line-clamp-2 h-8 mb-2 leading-normal" title="${p.specs}">
                ${p.specs}
            </p>

            <div class="mt-1">
                <div class="flex justify-between items-center h-4 mb-0.5">
                    ${hasDiscount ? `<span class="text-xs text-gray-500 line-through">฿${p.oldPrice.toLocaleString()}</span>` : `<span></span>`}
                    <span class="warranty-badge flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <i class="fa-solid fa-shield-halved text-[var(--theme-400)]"></i> ประกัน ${warranty}
                    </span>
                </div>
                <div class="flex justify-between items-end mb-2">
                    <span class="text-xl font-black text-[var(--theme-400)]">฿${p.price.toLocaleString()}</span>
                    <span class="text-[10px] text-emerald-500 font-semibold">จัดส่งฟรี</span>
                </div>
            </div>

            <div class="flex items-center justify-between mb-2.5">
                ${hasDiscount ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">-฿${discountAmount.toLocaleString()}</span>` : `<span class="text-[10px] text-gray-500">*ราคาเฉพาะออนไลน์</span>`}
            </div>

            <button onclick="event.stopPropagation(); addToCart('${p.id}')" class="buy-btn w-full bg-gradient-to-r from-[var(--theme-500)] to-blue-600 hover:from-[var(--theme-400)] hover:to-blue-500 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-[var(--theme-500)]/20 transition duration-200">
                <i class="fa-solid fa-cart-shopping"></i> ${translations[currentLang].buyNow}
            </button>
        </div>
    `;
    }).join('');

    renderGamingGearPagination(items.length, totalPages);
}

// สร้างปุ่มเลขหน้า (แสดงเฉพาะตอนสินค้าเกิน GAMING_GEAR_PAGE_SIZE ชิ้นเท่านั้น)
function renderGamingGearPagination(totalItems, totalPages) {
    const container = document.getElementById('gamingGearPagination');
    if (!container) return;

    if (totalItems <= GAMING_GEAR_PAGE_SIZE || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let buttonsHtml = '';

    // ปุ่มย้อนกลับ
    buttonsHtml += `
        <button onclick="goToGamingGearPage(${gamingGearCurrentPage - 1})" ${gamingGearCurrentPage === 1 ? 'disabled' : ''}
            class="w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center transition ${gamingGearCurrentPage === 1 ? 'bg-slate-900 text-gray-600 cursor-not-allowed' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}">
            <i class="fa-solid fa-chevron-left"></i>
        </button>`;

    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === gamingGearCurrentPage;
        buttonsHtml += `
        <button onclick="goToGamingGearPage(${i})"
            class="w-9 h-9 rounded-lg text-sm font-bold transition ${isActive ? 'bg-[var(--theme-500)] text-slate-950 shadow-md shadow-[var(--theme-500)]/30' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}">
            ${i}
        </button>`;
    }

    // ปุ่มถัดไป
    buttonsHtml += `
        <button onclick="goToGamingGearPage(${gamingGearCurrentPage + 1})" ${gamingGearCurrentPage === totalPages ? 'disabled' : ''}
            class="w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center transition ${gamingGearCurrentPage === totalPages ? 'bg-slate-900 text-gray-600 cursor-not-allowed' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}">
            <i class="fa-solid fa-chevron-right"></i>
        </button>`;

    container.innerHTML = buttonsHtml;
}

// ไปยังหน้าที่ต้องการ แล้วเลื่อนขึ้นไปด้านบนของกริดสินค้าให้เห็นสินค้าใหม่ทันที
function goToGamingGearPage(page) {
    renderGamingGearGrid(page);
    const grid = document.getElementById('gamingGearGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const brandMap = new Map();
        items.forEach(p => {
            const rawBrand = (p.brand || '').trim();
            if (!rawBrand) return;
            const key = rawBrand.toLowerCase();
            // เก็บชื่อรูปแบบแรกที่เจอไว้ใช้แสดงผล (กันไม่ให้ Logitech / LOGITECH ขึ้นซ้ำกัน)
            if (!brandMap.has(key)) {
                brandMap.set(key, rawBrand);
            }
        });
        const brands = [...brandMap.values()].sort((a, b) => a.localeCompare(b));

        if (brands.length === 0) {
            brandListEl.innerHTML = `<p class="text-[11px] text-gray-500">ไม่พบแบรนด์ในหมวดหมู่นี้</p>`;
        } else {
            brandListEl.innerHTML = brands.map(b => `
                <label class="flex items-center gap-2 text-xs text-gray-300 hover:text-[var(--theme-400)] cursor-pointer py-1">
                    <input type="checkbox" value="${b}" class="filter-brand-checkbox w-3.5 h-3.5 accent-[var(--theme-500)]" onchange="renderGamingGearGrid()">
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
    window.location.href = `Product.html?id=${encodeURIComponent(productId)}`;
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
                <a href="index.html" class="text-[var(--theme-400)] hover:underline text-xs mt-2 inline-block">&larr; กลับสู่หน้าแรก</a>
            </div>`;
        const relatedGrid = document.getElementById('relatedProductsGrid');
        if (relatedGrid) relatedGrid.innerHTML = '';
        return;
    }

    document.title = `COM PANG - ${product.name}`;

    const breadcrumb = document.getElementById('productBreadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = `
            <a href="index.html" class="hover:text-[var(--theme-400)] transition">หน้าหลัก</a>
            <i class="fa-solid fa-chevron-right text-[8px]"></i>
            <span class="text-[var(--theme-400)] truncate max-w-[220px] sm:max-w-none">${product.name}</span>
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
                <span>แบรนด์: <span class="text-[var(--theme-400)] font-semibold">${product.brand}</span></span>
            </div>

            <div class="flex items-center gap-3 mb-1">
                <button onclick="event.stopPropagation()" title="เพิ่มในรายการโปรด"
                    class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 hover:text-red-400 flex items-center justify-center transition">
                    <i class="fa-regular fa-heart"></i>
                </button>
                <button onclick="event.stopPropagation()" title="แชร์ Facebook"
                    class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 hover:text-[var(--theme-400)] flex items-center justify-center transition">
                    <i class="fa-brands fa-facebook-f"></i>
                </button>
            </div>

            <div class="flex items-end gap-3 border-t border-slate-800 pt-4 mt-4">
                <span class="text-3xl font-black text-[var(--theme-400)]">฿${product.price.toLocaleString()}</span>
                ${hasDiscount ? `
                <span class="text-base text-gray-500 line-through mb-1">฿${product.oldPrice.toLocaleString()}</span>
                <span class="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md mb-1">-${discountPercent}%</span>
                ` : ''}
            </div>

            <div class="flex items-center gap-3 mt-3 text-[11px] text-gray-400 flex-wrap">
                <span class="warranty-badge flex items-center gap-1 px-2 py-1 rounded-full">
                    <i class="fa-solid fa-shield-halved text-[var(--theme-400)]"></i> ประกัน ${warranty}
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
                    class="flex-1 border border-[var(--theme-500)] text-[var(--theme-400)] hover:bg-[var(--theme-500)]/10 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-bag-shopping"></i> เพิ่มในตะกร้า
                </button>
                <button onclick="buyNowFromDetail('${product.id}')"
                    class="flex-1 bg-gradient-to-r from-[var(--theme-500)] to-blue-600 hover:from-[var(--theme-400)] hover:to-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[var(--theme-500)]/20 transition">
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
    if (!requireLoginForCart()) return;

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
    syncCartToFirestore();
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

// จำนวนสินค้าสูงสุดต่อหน้าตอนค้นหาจากหน้าแรก (index.html) และหน้าปัจจุบันที่กำลังแสดงอยู่
const PRODUCT_SEARCH_PAGE_SIZE = 20;
let productSearchCurrentPage = 1;

function filterProducts() {
    // หน้าหมวดหมู่สินค้า (เช่น camera.html, chair.html ฯลฯ) ใช้กริด gamingGearGrid
    // ไม่ใช่ productGrid — ให้ส่งต่อไปที่ renderGamingGearGrid() ซึ่งจะอ่านค่าจากช่องค้นหาเอง
    if (document.getElementById('gamingGearGrid')) {
        renderGamingGearGrid();
        return;
    }

    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return; // หน้านี้ไม่มีส่วนแสดงผลสินค้าแบบนี้ (เช่น หน้ารายละเอียดสินค้า) ไม่ต้องทำอะไรต่อ

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (searchTerm) {
        // มีคำค้นหา -> แสดงผลแบบแบ่งหน้า หน้าละ PRODUCT_SEARCH_PAGE_SIZE ชิ้น (เริ่มที่หน้า 1 ทุกครั้งที่พิมพ์ค้นหาใหม่)
        renderProductSearchResults(1);
        return;
    }

    // เลิกค้นหาแล้ว -> คืนสไตล์แถบเลื่อนแนวนอนและหัวข้อ "รายการสินค้าแนะนำ" กลับมาเหมือนเดิม พร้อมซ่อนปุ่มแบ่งหน้า
    const filtered = products.filter(p => {
        const matchesCategory = currentCategory === 'all' || p.category === currentCategory;
        const matchesBrand = currentBrand === 'all' || p.brand.toLowerCase() === currentBrand.toLowerCase();
        return matchesCategory && matchesBrand;
    });

    productGrid.classList.remove('grid', 'grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'lg:grid-cols-5');
    productGrid.classList.add('flex', 'overflow-x-auto', 'snap-x', 'no-scrollbar');

    const sectionTitleEl = document.getElementById('productSectionTitle');
    if (sectionTitleEl) {
        const t = typeof translations !== 'undefined' && translations[currentLang];
        sectionTitleEl.textContent = (t && t.recommendedProducts) ? t.recommendedProducts : 'รายการสินค้าแนะนำ';
    }

    productSearchCurrentPage = 1;
    renderProductSearchPagination(0, 1);

    renderProducts(filtered);
}

// ค้นหาทั้งร้านจากช่องค้นหาบนหน้าแรก (index.html) แล้วแบ่งหน้าแสดงผล หน้าละ PRODUCT_SEARCH_PAGE_SIZE ชิ้น
// page = ระบุเมื่อกดปุ่มเลขหน้าเท่านั้น ถ้าไม่ระบุจะรีเซ็ตกลับไปหน้า 1 เสมอ
function renderProductSearchResults(page) {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;

    productSearchCurrentPage = (typeof page === 'number') ? page : 1;

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const searchWords = searchTerm.split(/\s+/).filter(Boolean);

    // ค้นทั้งร้านทันที ไม่จำกัดหมวดหมู่/แบรนด์ที่เลือกไว้อยู่ก่อน (ให้ผลลัพธ์ตรงคำค้นหารวมกันมาทั้งหมด)
    const filtered = products.filter(p => matchesGlobalSearch(p, searchWords));

    // สลับจากแถบเลื่อนแนวนอน (สินค้าแนะนำ) เป็น grid เต็มพื้นที่ เพื่อให้เห็นผลลัพธ์ค้นหาชัดเจน ไม่ต้องเลื่อนซ้าย-ขวาเอง
    productGrid.classList.remove('flex', 'overflow-x-auto', 'snap-x', 'no-scrollbar');
    productGrid.classList.add('grid', 'grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'lg:grid-cols-5', 'gap-3', 'sm:gap-5');

    // เปลี่ยนหัวข้อให้รู้ชัดว่านี่คือผลการค้นหา ไม่ใช่ "รายการสินค้าแนะนำ" เหมือนเดิม
    const sectionTitleEl = document.getElementById('productSectionTitle');
    if (sectionTitleEl) {
        sectionTitleEl.textContent = `ผลการค้นหา "${searchInput.value.trim()}" (${filtered.length} รายการ)`;
    }

    // เลื่อนหน้าไปยังส่วนผลการค้นหาให้อัตโนมัติ ผู้ใช้จะได้เห็นว่าเปลี่ยนแล้วจริง ๆ โดยไม่ต้องเลื่อนหาเอง
    const productSection = document.getElementById('product-section');
    if (productSection) {
        productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (filtered.length === 0) {
        renderProducts(filtered); // จะแสดงข้อความ "ไม่พบสินค้าที่คุณกำลังค้นหา"
        renderProductSearchPagination(0, 1);
        return;
    }

    // แบ่งหน้า: หน้าละ PRODUCT_SEARCH_PAGE_SIZE ชิ้น
    const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCT_SEARCH_PAGE_SIZE));
    if (productSearchCurrentPage > totalPages) productSearchCurrentPage = totalPages;
    if (productSearchCurrentPage < 1) productSearchCurrentPage = 1;

    const startIdx = (productSearchCurrentPage - 1) * PRODUCT_SEARCH_PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PRODUCT_SEARCH_PAGE_SIZE);

    renderProducts(pageItems);
    renderProductSearchPagination(filtered.length, totalPages);
}

// สร้างปุ่มเลขหน้าสำหรับผลการค้นหาบนหน้าแรก (แสดงเฉพาะตอนสินค้าเกิน PRODUCT_SEARCH_PAGE_SIZE ชิ้นเท่านั้น)
function renderProductSearchPagination(totalItems, totalPages) {
    const container = document.getElementById('productSectionPagination');
    if (!container) return;

    if (totalItems <= PRODUCT_SEARCH_PAGE_SIZE || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let buttonsHtml = '';

    // ปุ่มย้อนกลับ
    buttonsHtml += `
        <button onclick="goToProductSearchPage(${productSearchCurrentPage - 1})" ${productSearchCurrentPage === 1 ? 'disabled' : ''}
            class="w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center transition ${productSearchCurrentPage === 1 ? 'bg-slate-900 text-gray-600 cursor-not-allowed' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}">
            <i class="fa-solid fa-chevron-left"></i>
        </button>`;

    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === productSearchCurrentPage;
        buttonsHtml += `
        <button onclick="goToProductSearchPage(${i})"
            class="w-9 h-9 rounded-lg text-sm font-bold transition ${isActive ? 'bg-[var(--theme-500)] text-slate-950 shadow-md shadow-[var(--theme-500)]/30' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}">
            ${i}
        </button>`;
    }

    // ปุ่มถัดไป
    buttonsHtml += `
        <button onclick="goToProductSearchPage(${productSearchCurrentPage + 1})" ${productSearchCurrentPage === totalPages ? 'disabled' : ''}
            class="w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center transition ${productSearchCurrentPage === totalPages ? 'bg-slate-900 text-gray-600 cursor-not-allowed' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}">
            <i class="fa-solid fa-chevron-right"></i>
        </button>`;

    container.innerHTML = buttonsHtml;
}

// ไปยังหน้าที่ต้องการ แล้วเลื่อนขึ้นไปด้านบนของส่วนผลการค้นหาให้เห็นสินค้าใหม่ทันที
function goToProductSearchPage(page) {
    renderProductSearchResults(page);
    const productSection = document.getElementById('product-section');
    if (productSection) productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
// CART SYSTEM (ผูกกับบัญชีผู้ใช้จริงใน Firestore)
// ==========================================

// เช็คว่า login อยู่ไหมก่อนใส่ตะกร้า/สั่งซื้อ ถ้ายังไม่ login จะเปิด modal ให้เข้าสู่ระบบ/สมัครสมาชิกก่อน
function requireLoginForCart() {
    if (currentUser) return true;
    alert(currentLang === 'th'
        ? 'กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนทำการสั่งซื้อ'
        : 'Please log in or register before adding items to your cart.');
    toggleAuthModal();
    return false;
}

// บันทึกตะกร้าปัจจุบันกลับไปที่ Firestore (users/{uid}.cart) ทุกครั้งที่ตะกร้าเปลี่ยนแปลง
async function syncCartToFirestore() {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).update({ cart: cart });
        // อัปเดตแคช user ในเครื่องด้วย ไม่งั้นถ้ารีเฟรชหน้าในช่วง TTL cache จะเห็นตะกร้าเก่าค้างอยู่
        patchUserCache(currentUser.uid, { cart: cart });
    } catch (error) {
        console.error('บันทึกตะกร้าสินค้าไปยัง Firestore ไม่สำเร็จ:', error);
    }
}

function addToCart(productId) {
    if (!requireLoginForCart()) return;

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
    syncCartToFirestore();
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
                    <p class="text-xs text-[var(--theme-400)] font-bold">฿${item.price.toLocaleString()}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <button onclick="changeQuantity('${item.id}', -1)" class="w-5 h-5 bg-slate-800 text-gray-300 rounded hover:bg-slate-700 flex items-center justify-center text-xs">-</button>
                        <span class="text-xs font-bold">${item.quantity}</span>
                        <button onclick="changeQuantity('${item.id}', 1)" class="w-5 h-5 bg-slate-800 text-gray-300 rounded hover:bg-slate-700 flex items-center justify-center text-xs">+</button>
                    </div>
                </div>
                <button onclick="removeFromCart('${item.id}')" class="text-red-400 hover:text-red-300 text-xs p-1">
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
        syncCartToFirestore();
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    updateCartCount();
    renderCartItems();
    syncCartToFirestore();
}

function toggleCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.classList.toggle('hidden');
        switchCartTab('cart');
    }
}

async function checkout() {
    if (!requireLoginForCart()) return;

    if (cart.length === 0) {
        alert(currentLang === 'th' ? 'กรุณาเลือกสินค้าก่อนทำการสั่งซื้อ' : 'Please select products before checkout.');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderRef = 'ORD' + Date.now().toString().slice(-8);

    // เด้งไปหน้าจ่ายเงิน (QR Code) แทนการบันทึกคำสั่งซื้อทันที
    openPaymentModal(total, orderRef);
}

// ==========================================
// PAYMENT MODAL SYSTEM (หน้าจ่ายเงินจำลองด้วย QR Code + นับถอยหลัง 80 วิ)
// ==========================================
const PAYMENT_TIMEOUT_SECONDS = 80;
let paymentCountdownInterval = null;
let paymentAutoConfirmTimeout = null;
let pendingCheckoutTotal = 0;
let pendingOrderRef = '';

// สร้าง Markup ของหน้าจ่ายเงินแบบไดนามิก (ไม่ต้องแก้ index.html)
function ensurePaymentModalMarkup() {
    if (document.getElementById('paymentModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'paymentModalOverlay';
    overlay.className = 'hidden';
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '9999',
        background: 'rgba(2, 6, 23, 0.85)',
        display: 'none', alignItems: 'center', justifyContent: 'center',
        padding: '16px'
    });

    overlay.innerHTML = `
        <div id="paymentModalBox" style="
            background:#0f172a; border:1px solid #1e293b; border-radius:20px;
            max-width:380px; width:100%; padding:28px 24px; text-align:center;
            box-shadow:0 20px 60px rgba(0,0,0,0.5); position:relative;">

            <button onclick="closePaymentModal(true)" style="
                position:absolute; top:14px; right:14px; color:#94a3b8; background:none;
                border:none; font-size:18px; cursor:pointer;">✕</button>

            <h3 style="color:#fff; font-weight:800; font-size:18px; margin-bottom:4px;">สแกนจ่ายเงิน</h3>
            <p style="color:#94a3b8; font-size:12px; margin-bottom:16px;">สแกน QR Code ด้วยแอปธนาคารของคุณ</p>

            <div style="background:#fff; padding:12px; border-radius:16px; display:inline-block; margin-bottom:14px;">
                <img id="paymentQrImage" src="" alt="QR Code ชำระเงิน" style="width:220px;height:220px;display:block;">
            </div>

            <p style="color:var(--theme-400); font-weight:800; font-size:22px; margin-bottom:4px;" id="paymentModalAmount">฿0</p>
            <p style="color:#64748b; font-size:11px; margin-bottom:16px;">รหัสอ้างอิง: <span id="paymentModalRef"></span></p>

            <div style="background:#020617; border:1px solid #1e293b; border-radius:12px; padding:10px 14px; margin-bottom:16px;">
                <p style="color:#94a3b8; font-size:11px; margin-bottom:2px;">กรุณาชำระเงินภายใน</p>
                <p id="paymentCountdownText" style="color:#f87171; font-weight:800; font-size:26px; letter-spacing:1px;">01:20</p>
            </div>

            <div id="paymentStatusRow" style="display:flex; align-items:center; justify-content:center; gap:8px; color:#94a3b8; font-size:12px; margin-bottom:14px;">
                <span style="width:8px;height:8px;border-radius:999px;background:#facc15; display:inline-block; animation:pmPulse 1s infinite;"></span>
                <span>กำลังรอการชำระเงิน...</span>
            </div>

            <div id="paymentSlipSection" style="text-align:left;">
                <label style="color:#94a3b8; font-size:11px; display:block; margin-bottom:6px;">แนบสลิปการโอนเงิน (รูปภาพ) เพื่อยืนยันการชำระเงิน</label>
                <input type="file" id="paymentSlipInput" accept="image/*" style="display:none;" onchange="handleSlipSelected(event)">
                <div id="paymentSlipDropzone" onclick="document.getElementById('paymentSlipInput').click()" style="
                    border:2px dashed #334155; border-radius:12px; padding:16px; text-align:center;
                    cursor:pointer; color:#64748b; font-size:12px;">
                    <i class="fa-solid fa-cloud-arrow-up" style="font-size:20px; display:block; margin-bottom:6px;"></i>
                    กดเพื่อแนบรูปสลิปการโอนเงิน
                </div>
                <img id="paymentSlipPreview" src="" style="display:none; width:100%; max-height:160px; object-fit:contain; border-radius:10px; margin-top:8px; border:1px solid #1e293b;">
            </div>

            <button id="paymentConfirmBtn" onclick="submitPaymentSlip()" disabled style="
                width:100%; margin-top:14px; padding:12px; border-radius:12px; border:none;
                background:#334155; color:#94a3b8; font-weight:800; font-size:14px; cursor:not-allowed;">
                ยืนยันการชำระเงิน
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    if (!document.getElementById('paymentModalStyle')) {
        const style = document.createElement('style');
        style.id = 'paymentModalStyle';
        style.innerHTML = `
            @keyframes pmPulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
            @keyframes pmSlideIn { from { transform: translateY(-16px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        `;
        document.head.appendChild(style);
    }
}

// แสดง Toast แจ้งเตือนสีเขียว (สำเร็จ) หรือสีแดง (ผิดพลาด/ยกเลิก)
function showPaymentToast(message, type = 'success') {
    let toastContainer = document.getElementById('paymentToastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'paymentToastContainer';
        Object.assign(toastContainer.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            zIndex: '10000', display: 'flex', flexDirection: 'column', gap: '8px',
            alignItems: 'center', width: '100%', padding: '0 16px'
        });
        document.body.appendChild(toastContainer);
    }

    const colors = {
        success: { bg: '#052e1f', border: '#16a34a', text: '#4ade80', icon: 'fa-circle-check' },
        error:   { bg: '#450a0a', border: '#dc2626', text: '#f87171', icon: 'fa-circle-xmark' }
    };
    const c = colors[type] || colors.success;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
        padding:14px 20px; border-radius:12px; font-size:13px; font-weight:700;
        display:flex; align-items:center; gap:10px; max-width:360px;
        box-shadow:0 10px 30px rgba(0,0,0,0.4); animation: pmSlideIn 0.25s ease;
    `;
    toast.innerHTML = `<i class="fa-solid ${c.icon}" style="font-size:16px;"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function clearPaymentTimers() {
    if (paymentCountdownInterval) clearInterval(paymentCountdownInterval);
    if (paymentAutoConfirmTimeout) clearTimeout(paymentAutoConfirmTimeout);
    paymentCountdownInterval = null;
    paymentAutoConfirmTimeout = null;
}

function closePaymentModal(showCancelToast) {
    clearPaymentTimers();
    const overlay = document.getElementById('paymentModalOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
    }
    if (showCancelToast) {
        showPaymentToast(currentLang === 'th' ? 'ยกเลิกการชำระเงินแล้ว' : 'Payment cancelled.', 'error');
    }
}

// เปิดหน้าจ่ายเงินแบบจำลอง พร้อม QR Code และนับถอยหลัง 80 วินาที
function openPaymentModal(total, orderRef) {
    ensurePaymentModalMarkup();

    pendingCheckoutTotal = total;
    pendingOrderRef = orderRef;

    const overlay = document.getElementById('paymentModalOverlay');
    const qrImg = document.getElementById('paymentQrImage');
    const amountEl = document.getElementById('paymentModalAmount');
    const refEl = document.getElementById('paymentModalRef');
    const statusRow = document.getElementById('paymentStatusRow');
    const countdownText = document.getElementById('paymentCountdownText');

    qrImg.src = "photo/QR.jpg";
    amountEl.innerText = `฿${total.toLocaleString()}`;
    refEl.innerText = orderRef;
    statusRow.innerHTML = `
        <span style="width:8px;height:8px;border-radius:999px;background:#facc15; display:inline-block; animation:pmPulse 1s infinite;"></span>
        <span>${currentLang === 'th' ? 'กรุณาโอนเงินแล้วแนบสลิปด้านล่าง' : 'Please transfer, then attach your slip below.'}</span>
    `;

    // รีเซ็ตส่วนแนบสลิปทุกครั้งที่เปิดหน้าจ่ายเงินใหม่
    resetPaymentSlipUI();

    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');

    let remaining = PAYMENT_TIMEOUT_SECONDS;
    updatePaymentCountdownDisplay(countdownText, remaining);

    clearPaymentTimers();

    paymentCountdownInterval = setInterval(() => {
        remaining -= 1;
        updatePaymentCountdownDisplay(countdownText, remaining);
        if (remaining <= 0) {
            clearPaymentTimers();
            statusRow.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-circle-exclamation"></i> ${currentLang === 'th' ? 'QR Code หมดอายุ กรุณาลองใหม่' : 'QR Code expired. Please try again.'}</span>`;
            const confirmBtn = document.getElementById('paymentConfirmBtn');
            if (confirmBtn) confirmBtn.disabled = true;
            setTimeout(() => closePaymentModal(false), 1800);
        }
    }, 1000);

    // หมายเหตุ: ไม่มีการยืนยันจ่ายเงินอัตโนมัติแล้ว ผู้ใช้ต้องแนบรูปสลิปการโอนแล้วกด "ยืนยันการชำระเงิน" เอง
}

// ล้างค่าไฟล์สลิปที่เคยแนบไว้ และรีเซ็ต UI ของส่วนแนบสลิปกลับเป็นค่าเริ่มต้น
let selectedSlipDataUrl = null;
function resetPaymentSlipUI() {
    selectedSlipDataUrl = null;

    const slipInput = document.getElementById('paymentSlipInput');
    const dropzone = document.getElementById('paymentSlipDropzone');
    const preview = document.getElementById('paymentSlipPreview');
    const confirmBtn = document.getElementById('paymentConfirmBtn');

    if (slipInput) slipInput.value = '';
    if (dropzone) dropzone.style.display = 'block';
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'ยืนยันการชำระเงิน';
        confirmBtn.style.background = '#334155';
        confirmBtn.style.color = '#94a3b8';
        confirmBtn.style.cursor = 'not-allowed';
    }
}

// เมื่อผู้ใช้เลือกไฟล์รูปสลิป: แสดงตัวอย่างรูป และเปิดใช้งานปุ่มยืนยัน
function handleSlipSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showPaymentToast(currentLang === 'th' ? 'กรุณาแนบไฟล์รูปภาพเท่านั้น' : 'Please attach an image file.', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        selectedSlipDataUrl = reader.result;

        const preview = document.getElementById('paymentSlipPreview');
        const dropzone = document.getElementById('paymentSlipDropzone');
        const confirmBtn = document.getElementById('paymentConfirmBtn');

        if (preview) {
            preview.src = selectedSlipDataUrl;
            preview.style.display = 'block';
        }
        if (dropzone) dropzone.style.display = 'none';
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.background = 'linear-gradient(90deg,#06b6d4,#2563eb)';
            confirmBtn.style.color = '#fff';
            confirmBtn.style.cursor = 'pointer';
        }
    };
    reader.readAsDataURL(file);
}

// ผู้ใช้กด "ยืนยันการชำระเงิน" หลังแนบสลิปแล้ว: ส่งสลิปไปตรวจสอบจริงกับ Cloud Function (SlipOK)
// ตรวจสอบ 3 อย่าง: ยอดเงินตรงกับราคาสินค้า, บัญชีปลายทางตรงกับบัญชีร้าน, วันเวลาที่โอนต้องไม่เก่าเกินไป
async function submitPaymentSlip() {
    if (!selectedSlipDataUrl) {
        showPaymentToast(currentLang === 'th' ? 'กรุณาแนบรูปสลิปการโอนก่อนยืนยัน' : 'Please attach your transfer slip first.', 'error');
        return;
    }

    const confirmBtn = document.getElementById('paymentConfirmBtn');
    const statusRow = document.getElementById('paymentStatusRow');

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.cursor = 'not-allowed';
        confirmBtn.innerText = currentLang === 'th' ? 'กำลังตรวจสอบสลิป...' : 'Verifying slip...';
    }
    if (statusRow) {
        statusRow.innerHTML = `<span style="color:#facc15;"><i class="fa-solid fa-spinner fa-spin"></i> ${currentLang === 'th' ? 'กำลังตรวจสอบสลิปกับธนาคาร...' : 'Verifying slip with the bank...'}</span>`;
    }

    try {
        // เรียก Cloud Function ฝั่งเซิร์ฟเวอร์ (verifyPaymentSlip) ให้ตรวจสลิปจริงผ่าน SlipOK
        // ต้องตั้งค่า Cloud Function นี้ไว้ล่วงหน้า ดูไฟล์ functions/verifyPaymentSlip.js ที่แนบให้
        const verifySlipFn = firebase.functions().httpsCallable('verifyPaymentSlip');
        const result = await verifySlipFn({
            imageBase64: selectedSlipDataUrl,
            orderRef: pendingOrderRef,
            expectedAmount: pendingCheckoutTotal
        });

        const { valid, reason } = result.data;

        if (!valid) {
            // สลิปไม่ผ่านการตรวจสอบ (ยอดไม่ตรง / บัญชีไม่ตรง / วันเวลาไม่ตรง / สลิปถูกใช้ไปแล้ว)
            if (statusRow) {
                statusRow.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-circle-xmark"></i> ${reason || (currentLang === 'th' ? 'สลิปไม่ถูกต้อง' : 'Invalid slip')}</span>`;
            }
            showPaymentToast(reason || (currentLang === 'th' ? 'ตรวจสอบสลิปไม่ผ่าน กรุณาตรวจสอบและแนบสลิปใหม่' : 'Slip verification failed. Please check and re-attach.'), 'error');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.innerText = currentLang === 'th' ? 'ยืนยันการชำระเงิน' : 'Confirm Payment';
            }
            return;
        }

        // สลิปตรวจสอบผ่านทุกจุด (ยอดเงิน / บัญชีปลายทาง / วันเวลา) -> ยืนยันว่าชำระเงินสำเร็จ
        confirmPaymentSuccess();
    } catch (error) {
        console.error('ตรวจสอบสลิปไม่สำเร็จ:', error);
        if (statusRow) {
            statusRow.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-circle-exclamation"></i> ${currentLang === 'th' ? 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' : 'Error verifying slip'}</span>`;
        }
        showPaymentToast(currentLang === 'th' ? 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง' : 'Something went wrong verifying your slip. Please try again.', 'error');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.innerText = currentLang === 'th' ? 'ยืนยันการชำระเงิน' : 'Confirm Payment';
        }
    }
}

function updatePaymentCountdownDisplay(el, seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    el.innerText = `${m}:${s}`;
    el.style.color = seconds <= 10 ? '#f87171' : '#facc15';
}

// เมื่อตรวจพบว่าชำระเงินสำเร็จ: ปิดหน้า QR, แจ้งเตือนสีเขียว แล้วค่อยบันทึกคำสั่งซื้อจริง
async function confirmPaymentSuccess() {
    clearPaymentTimers();
    const statusRow = document.getElementById('paymentStatusRow');
    if (statusRow) {
        statusRow.innerHTML = `<span style="color:#4ade80;"><i class="fa-solid fa-circle-check"></i> ${currentLang === 'th' ? 'ตรวจพบการชำระเงินแล้ว' : 'Payment detected'}</span>`;
    }

    setTimeout(async () => {
        closePaymentModal(false);
        showPaymentToast(
            currentLang === 'th' ? 'ชำระเงินสำเร็จ! ขอบคุณที่ใช้บริการ COMPUNG' : 'Payment successful! Thank you for shopping with COMPUNG.',
            'success'
        );
        await finalizeCheckoutOrder();
    }, 900);
}

// บันทึกคำสั่งซื้อจริงลง Firestore หลังจากการชำระเงินสำเร็จเรียบร้อยแล้ว (ย้ายมาจาก checkout() เดิม)
async function finalizeCheckoutOrder() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.disabled = true;

    const total = pendingCheckoutTotal;

    try {
        // บันทึกคำสั่งซื้อจริงลงใน Firestore ที่ users/{uid}/orders
        await db.collection('users').doc(currentUser.uid).collection('orders').add({
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                img: item.img,
                price: item.price,
                quantity: item.quantity
            })),
            total: total,
            status: 'completed',
            slipConfirmed: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        cart = [];
        await syncCartToFirestore();
        // เพิ่งสร้างออเดอร์ใหม่จริง ๆ จึงดึงประวัติสดจาก Firestore ตรงนี้ (คุ้มที่จะเสีย read เพื่อความถูกต้อง)
        await loadOrderHistoryFromFirestore();
        orderHistoryLoaded = true;

        updateCartCount();
        renderCartItems();
        renderOrderHistory();
        toggleCartModal();
    } catch (error) {
        console.error('บันทึกคำสั่งซื้อไม่สำเร็จ:', error);
        showPaymentToast(
            currentLang === 'th' ? 'ชำระเงินสำเร็จ แต่บันทึกคำสั่งซื้อไม่สำเร็จ กรุณาติดต่อแอดมิน' : 'Payment succeeded but saving the order failed. Please contact support.',
            'error'
        );
    } finally {
        if (checkoutBtn) checkoutBtn.disabled = false;
    }
}

// ==========================================
// ORDER HISTORY SYSTEM (ประวัติการซื้อสินค้า)
// ==========================================
// โหลดประวัติการสั่งซื้อจริงจาก Firestore ที่ users/{uid}/orders (เรียงล่าสุดก่อน)
async function loadOrderHistoryFromFirestore() {
    if (!currentUser) {
        orderHistory = [];
        return;
    }
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('orders').orderBy('createdAt', 'desc').get();

        orderHistory = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                orderId: doc.id,
                date: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                items: data.items || [],
                total: data.total || 0,
                status: data.status || 'completed'
            };
        });
    } catch (error) {
        console.error('โหลดประวัติการสั่งซื้อจาก Firestore ไม่สำเร็จ:', error);
        orderHistory = [];
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

    const activeClass = "flex-1 py-2.5 text-xs sm:text-sm font-bold text-[var(--theme-400)] border-b-2 border-[var(--theme-400)] transition";
    const inactiveClass = "flex-1 py-2.5 text-xs sm:text-sm font-bold text-gray-400 border-b-2 border-transparent hover:text-gray-200 transition";

    if (tab === 'history') {
        cartTabBtn.className = inactiveClass;
        historyTabBtn.className = activeClass;
        cartItemsContainer.classList.add('hidden');
        orderHistoryContainer.classList.remove('hidden');
        if (cartFooter) cartFooter.classList.add('hidden');

        // ดึงประวัติออเดอร์จาก Firestore เฉพาะครั้งแรกที่เปิดแท็บนี้ในเซสชันนี้เท่านั้น (lazy load)
        // ครั้งถัดไปที่สลับกลับมาแท็บนี้ ใช้ orderHistory ที่โหลดไว้แล้วในหน่วยความจำ ไม่ยิง Firestore ซ้ำ
        if (!orderHistoryLoaded) {
            orderHistoryContainer.innerHTML = `<p class="text-center text-gray-400 text-sm py-8"><i class="fa-solid fa-spinner fa-spin"></i></p>`;
            loadOrderHistoryFromFirestore().then(() => {
                orderHistoryLoaded = true;
                renderOrderHistory();
            });
        } else {
            renderOrderHistory();
        }
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
                <span class="text-[var(--theme-400)] font-semibold whitespace-nowrap">฿${(item.price * item.quantity).toLocaleString()}</span>
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
                    <span class="text-sm font-black text-[var(--theme-400)]">฿${order.total.toLocaleString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// AUTH & USER DATABASE SYSTEM
// ==========================================
let authMode = 'login';

// สถานะผู้ใช้ปัจจุบัน (มาจาก Firebase Auth + Firestore)
let currentUser = null;       // Firebase Auth user object (uid, email)
let currentUserData = null;   // ข้อมูลโปรไฟล์จาก Firestore (users/{uid})

// ตรวจสอบว่าผู้ใช้ปัจจุบัน "ล็อกอินแล้ว" และมี role เป็น admin จริงๆ หรือไม่
// ใช้ตรวจก่อนแสดงปุ่มแก้ไข/ลบ และก่อนอนุญาตให้เรียกฟังก์ชันแก้ไข/ลบสินค้า
// หมายเหตุ: นี่คือการป้องกันฝั่ง UI เท่านั้น การป้องกันจริงต้องทำที่ Firestore Security Rules ด้วย
function isCurrentUserAdmin() {
    return !!(currentUser && currentUserData && currentUserData.role === 'admin');
}

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
    const registerFields = document.getElementById('registerFieldsContainer');
    if (registerFields) registerFields.classList.add('hidden');
    document.getElementById('passwordContainer').classList.remove('hidden');
    document.getElementById('authToggleFooter').classList.remove('hidden');
    updateAuthUI();
}

function switchAuthMode() {
    authMode = (authMode === 'login') ? 'register' : 'login';
    updateAuthUI();
}

function updateAuthUI() {
    const title = document.getElementById('authTitle');
    const registerFields = document.getElementById('registerFieldsContainer');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const btnToggle = document.getElementById('authBtnToggle');

    if (authMode === 'login') {
        title.innerText = translations[currentLang].loginTitle;
        if (registerFields) registerFields.classList.add('hidden');
        submitBtn.innerText = translations[currentLang].submitBtn;
        toggleText.innerText = translations[currentLang].noAccountText;
        btnToggle.innerText = translations[currentLang].registerToggleBtn;
    } else if (authMode === 'register') {
        title.innerText = translations[currentLang].registerTitle;
        if (registerFields) registerFields.classList.remove('hidden');
        submitBtn.innerText = translations[currentLang].submitBtn;
        toggleText.innerText = translations[currentLang].hasAccountText;
        btnToggle.innerText = translations[currentLang].loginToggleBtn;
    }
}

// แปล error code ของ Firebase Auth ให้เป็นข้อความที่คนอ่านเข้าใจ
function getAuthErrorMessage(error) {
    const isTh = currentLang === 'th';
    switch (error.code) {
        case 'auth/email-already-in-use':
            return isTh ? 'อีเมลนี้มีผู้ใช้งานในระบบแล้ว' : 'This email is already registered.';
        case 'auth/invalid-email':
            return isTh ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'Invalid email format.';
        case 'auth/weak-password':
            return isTh ? 'รหัสผ่านสั้นเกินไป (ต้องมีอย่างน้อย 6 ตัวอักษร)' : 'Password is too weak (minimum 6 characters).';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return isTh ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : 'Invalid email or password.';
        default:
            return (isTh ? 'เกิดข้อผิดพลาด: ' : 'Error: ') + error.message;
    }
}

async function handleAuth(e) {
    e.preventDefault();

    const emailInput = document.getElementById('authEmail').value.trim();
    const passwordInput = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('authSubmitBtn');

    // ---------- สมัครสมาชิก ----------
    if (authMode === 'register') {
        const firstNameInput = document.getElementById('authFirstName').value.trim();
        const lastNameInput = document.getElementById('authLastName').value.trim();
        const phoneInput = document.getElementById('authPhone').value.trim();
        const addressInput = document.getElementById('authAddress').value.trim();

        if (submitBtn) submitBtn.disabled = true;
        try {
            // 1. สร้างบัญชีจริงใน Firebase Authentication
            const cred = await auth.createUserWithEmailAndPassword(emailInput, passwordInput);
            const uid = cred.user.uid;

            // 2. สร้างเอกสารโปรไฟล์ผู้ใช้ใน Firestore (role เริ่มต้นเป็น "user" เสมอ)
            await db.collection('users').doc(uid).set({
                firstName: firstNameInput,
                lastName: lastNameInput,
                email: emailInput,
                phone: phoneInput,
                address: addressInput,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(currentLang === 'th'
                ? 'สมัครสมาชิกสำเร็จ! เข้าสู่ระบบให้อัตโนมัติแล้ว'
                : 'Registration successful! You are now logged in.');
            toggleAuthModal();
        } catch (error) {
            alert(getAuthErrorMessage(error));
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
        return;
    }

    // ---------- เข้าสู่ระบบ ----------
    if (authMode === 'login') {
        if (submitBtn) submitBtn.disabled = true;
        try {
            await auth.signInWithEmailAndPassword(emailInput, passwordInput);
            toggleAuthModal();
        } catch (error) {
            alert(getAuthErrorMessage(error));
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }
}

function handleLogout() {
    const confirmMsg = currentLang === 'th'
        ? 'ยืนยันออกจากระบบใช่ไหม?'
        : 'Are you sure you want to log out?';

    if (!confirm(confirmMsg)) return;

    auth.signOut();
}

// ==========================================
// PROFILE SYSTEM (ดู/แก้ไขข้อมูลส่วนตัว)
// ==========================================

// กดที่ชื่อ/ไอคอนบัญชี: login อยู่แล้ว -> เปิดหน้าข้อมูลส่วนตัว, ยังไม่ login -> เปิด modal เข้าสู่ระบบ
function handleAccountClick() {
    if (currentUser) {
        openProfileModal();
    } else {
        toggleAuthModal();
    }
}

function openProfileModal() {
    if (!currentUser || !currentUserData) return;

    document.getElementById('profileFirstName').value = currentUserData.firstName || '';
    document.getElementById('profileLastName').value = currentUserData.lastName || '';
    document.getElementById('profileEmail').value = currentUserData.email || currentUser.email || '';
    document.getElementById('profilePhone').value = currentUserData.phone || '';
    document.getElementById('profileAddress').value = currentUserData.address || '';

    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('hidden');
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('hidden');
}

async function saveProfile(e) {
    e.preventDefault();
    if (!currentUser) return;

    const saveBtn = document.getElementById('profileSaveBtn');
    const updatedData = {
        firstName: document.getElementById('profileFirstName').value.trim(),
        lastName: document.getElementById('profileLastName').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        address: document.getElementById('profileAddress').value.trim()
    };

    if (saveBtn) saveBtn.disabled = true;
    try {
        await db.collection('users').doc(currentUser.uid).update(updatedData);

        // อัปเดตข้อมูลในเครื่องให้ตรงกับที่บันทึกไป โดยไม่กระทบ field อื่น เช่น role และ cart
        currentUserData = { ...currentUserData, ...updatedData };
        updateUserUI(currentUser, currentUserData);
        // อัปเดตแคชในเครื่องด้วย ไม่งั้นรีเฟรชหน้าในช่วง TTL cache จะเห็นชื่อ/ที่อยู่เก่าค้างอยู่
        patchUserCache(currentUser.uid, updatedData);

        alert(currentLang === 'th' ? 'บันทึกข้อมูลเรียบร้อยแล้ว' : 'Profile updated successfully.');
        closeProfileModal();
    } catch (error) {
        console.error('บันทึกข้อมูลส่วนตัวไม่สำเร็จ:', error);
        alert(currentLang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง' : 'Something went wrong saving your profile. Please try again.');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// อัปเดตหน้าเว็บตามสถานะล็อกอิน (ชื่อที่แสดง, ปุ่ม logout, ปุ่มจัดการสินค้าเฉพาะ admin)
function updateUserUI(user, userData) {
    const userText = document.getElementById('userStatusText');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminBtns = document.querySelectorAll('.admin-only-btn');

    if (user && userData) {
        if (userText) userText.innerText = userData.firstName || userData.email;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        const isAdmin = userData.role === 'admin';
        adminBtns.forEach(btn => btn.classList.toggle('hidden', !isAdmin));
    } else {
        if (userText) userText.innerText = translations[currentLang].loginRegister;
        if (logoutBtn) logoutBtn.classList.add('hidden');
        adminBtns.forEach(btn => btn.classList.add('hidden'));
    }
}

// ตรวจสอบสถานะการล็อกอินทุกครั้งที่โหลดหน้า (คงสถานะไว้แม้รีเฟรชหน้าหรือสลับไปหน้าอื่น)
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        // เดิม: get() ใหม่ทุกครั้งที่โหลดหน้า (เว็บนี้เป็น multi-page ไม่ใช่ SPA)
        // ตอนนี้: เช็คแคชในเครื่องก่อน ถ้ายังอยู่ในช่วง TTL และเป็น uid เดียวกัน ใช้แคชได้เลย ไม่เสีย read
        const cachedUser = readUserCache(user.uid);
        const withinGracePeriod = cachedUser && cachedUser.timestamp && (Date.now() - cachedUser.timestamp < USER_CACHE_TTL_MS);

        if (withinGracePeriod) {
            currentUserData = cachedUser.data;
        } else {
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                currentUserData = doc.exists ? doc.data() : null;
                writeUserCache(user.uid, currentUserData);
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้:', error);
                currentUserData = null;
            }
        }

        // ตรวจสอบว่าบัญชีนี้ถูกแอดมินระงับไว้หรือไม่ ถ้าใช่ให้บังคับออกจากระบบทันที
        if (currentUserData && currentUserData.suspended === true) {
            const suspendedUid = user.uid;
            currentUser = null;
            currentUserData = null;
            cart = [];
            orderHistory = [];
            orderHistoryLoaded = false;
            clearUserCache();
            if (typeof stopPresenceHeartbeat === 'function') stopPresenceHeartbeat();
            if (typeof stopAdminUsersListener === 'function') stopAdminUsersListener();
            auth.signOut(); // ไม่ต้อง await เพราะ state ในเครื่องถูกเคลียร์เรียบร้อยแล้วด้านบน
            alert(currentLang === 'th'
                ? 'บัญชีนี้ถูกระงับการใช้งานโดยผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเป็นความผิดพลาด'
                : 'This account has been suspended by an administrator. Please contact the site admin if you believe this is a mistake.');
            updateUserUI(null, null);
            return;
        }

        // โหลดตะกร้าสินค้าที่เคยบันทึกไว้ของบัญชีนี้กลับมา
        cart = (currentUserData && Array.isArray(currentUserData.cart)) ? currentUserData.cart : [];

        // ไม่ดึงประวัติการสั่งซื้อตรงนี้แล้ว (ดู loadOrderHistoryFromFirestore แบบ lazy ใน switchCartTab)
        // เพราะเดิมดึงประวัติทั้งหมดทุกหน้าที่เปิด ทั้งที่หลายหน้าไม่ได้แสดงประวัติเลย
        orderHistory = [];
        orderHistoryLoaded = false;

        // เริ่มส่งสถานะ "ออนไลน์อยู่" ให้แอดมินเห็นได้ในหน้าตั้งค่า
        if (typeof startPresenceHeartbeat === 'function') startPresenceHeartbeat(currentUser, currentUserData);

        // ถ้าเป็นแอดมิน เริ่มติดตามรายชื่อผู้สมัครทั้งหมด + แจ้งเตือนผู้สมัครใหม่แบบเรียลไทม์
        if (isCurrentUserAdmin() && typeof startAdminUsersListener === 'function') {
            startAdminUsersListener();
        }
    } else {
        currentUserData = null;
        cart = [];
        orderHistory = [];
        orderHistoryLoaded = false;
        clearUserCache();

        // ออกจากระบบแล้ว หยุดส่งสถานะออนไลน์ + หยุดติดตามรายชื่อผู้สมัคร
        if (typeof stopPresenceHeartbeat === 'function') stopPresenceHeartbeat();
        if (typeof stopAdminUsersListener === 'function') stopAdminUsersListener();
    }

    updateUserUI(currentUser, currentUserData);
    if (typeof updateCartCount === 'function') updateCartCount();
    if (typeof renderCartItems === 'function') renderCartItems();
    if (typeof renderOrderHistory === 'function') renderOrderHistory();

    // เรนเดอร์การ์ดสินค้าใหม่ทุกครั้งที่สถานะล็อกอิน/สิทธิ์ admin เปลี่ยน
    // เพื่อให้ปุ่มแก้ไข/ลบ แสดงเฉพาะ admin เท่านั้น (ไม่ค้างจากตอนยังไม่ได้ล็อกอิน)
    if (products.length > 0) {
        if (typeof renderProducts === 'function') {
            renderProducts(products, 'allProductsGrid');
        }
        if (typeof renderAllTypedSections === 'function') {
            renderAllTypedSections();
        }
        if (typeof renderGamingGearGrid === 'function') {
            renderGamingGearGrid();
        }
    }
});

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
            ? "w-8 h-3 rounded-full bg-[var(--theme-400)] transition-all duration-300"
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
            ? "w-6 h-2.5 rounded-full bg-[var(--theme-400)] transition-all duration-300 shadow-md"
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
// THEME COLOR SYSTEM (สลับโทนสีเว็บทั้งเว็บ รวมโลโก้ — ทำงานผ่าน CSS Variable)
// เว็บทั้งหมดใช้ text-[var(--theme-400)] / bg-[var(--theme-500)] ฯลฯ แทนสี cyan ตรงๆ
// ฟังก์ชันนี้แค่เปลี่ยนค่าตัวแปร CSS บน :root สีทั้งเว็บก็เปลี่ยนตามทันทีโดยไม่ต้อง reload
// ==========================================
const THEME_COLOR_KEY = 'compung_theme_color';

// ค่าสีอ้างอิงจาก Tailwind default palette (shade 400 / 500) ของแต่ละโทนสีที่แอดมินเลือกได้
const THEME_COLOR_PALETTE = {
    cyan:   { label: 'ฟ้า',     400: '#22d3ee', 500: '#06b6d4', rgb400: '34, 211, 238',  rgb500: '6, 182, 212' },
    green:  { label: 'เขียว',   400: '#4ade80', 500: '#22c55e', rgb400: '74, 222, 128',  rgb500: '34, 197, 94' },
    purple: { label: 'ม่วง',    400: '#c084fc', 500: '#a855f7', rgb400: '192, 132, 252', rgb500: '168, 85, 247' },
    red:    { label: 'แดง',     400: '#f87171', 500: '#ef4444', rgb400: '248, 113, 113', rgb500: '239, 68, 68' },
    orange: { label: 'ส้ม',     400: '#fb923c', 500: '#f97316', rgb400: '251, 146, 60',  rgb500: '249, 115, 22' },
    pink:   { label: 'ชมพู',    400: '#f472b6', 500: '#ec4899', rgb400: '244, 114, 182', rgb500: '236, 72, 153' },
    blue:   { label: 'น้ำเงิน', 400: '#60a5fa', 500: '#3b82f6', rgb400: '96, 165, 250',  rgb500: '59, 130, 246' }
};

// เปลี่ยนสีธีมทั้งเว็บ (colorKey = 'cyan' | 'green' | 'purple' | 'red' | 'orange' | 'pink' | 'blue')
function applyThemeColor(colorKey, persist = true) {
    const palette = THEME_COLOR_PALETTE[colorKey] || THEME_COLOR_PALETTE.cyan;
    const root = document.documentElement.style;
    root.setProperty('--theme-400', palette[400]);
    root.setProperty('--theme-500', palette[500]);
    root.setProperty('--theme-400-rgb', palette.rgb400);
    root.setProperty('--theme-500-rgb', palette.rgb500);

    if (persist) {
        try { localStorage.setItem(THEME_COLOR_KEY, colorKey); } catch (e) { /* localStorage ปิดอยู่ ข้ามได้ */ }
    }

    // อัปเดตวงกลมไหนถูกเลือกอยู่ในหน้าตั้งค่า (ถ้าเปิดโมดัลอยู่)
    document.querySelectorAll('.theme-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.colorKey === colorKey);
    });
}

// เรียกตอนโหลดหน้าเว็บทุกครั้ง เพื่อให้สีธีมที่แอดมินเคยเลือกไว้คงอยู่ (script.js โหลดหลัง inline script ใน <head> ไปแล้ว
// ฉะนั้น :root ถูกตั้งค่าล่วงหน้าไปแล้วรอบนึง อันนี้แค่ sync ให้ตรงกันอีกรอบเผื่อกรณี localStorage เปลี่ยนระหว่างทาง)
function initThemeColor() {
    let saved = 'cyan';
    try { saved = localStorage.getItem(THEME_COLOR_KEY) || 'cyan'; } catch (e) { /* ใช้ค่า default */ }
    applyThemeColor(saved, false);
}
document.addEventListener('DOMContentLoaded', initThemeColor);

// ==========================================
// ADMIN SETTINGS MODAL (รายการสินค้าทั้งหมด / ธีมสี / ผู้ใช้ออนไลน์)
// ==========================================
function openAdminSettingsModal() {
    if (!isCurrentUserAdmin()) {
        console.warn('บล็อก: ต้องเป็น admin เท่านั้นถึงจะเปิดหน้าตั้งค่านี้ได้');
        return;
    }
    const modal = document.getElementById('adminSettingsModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    switchAdminSettingsTab('products');
    startOnlineUsersListener();
    if (typeof renderAdminUsersList === 'function') renderAdminUsersList();
}

function closeAdminSettingsModal() {
    const modal = document.getElementById('adminSettingsModal');
    if (modal) modal.classList.add('hidden');
    stopOnlineUsersListener();
}

function switchAdminSettingsTab(tabName) {
    ['products', 'users', 'online'].forEach(name => {
        const panel = document.getElementById(`adminSettingsTab-${name}`);
        const btn = document.getElementById(`adminTabBtn-${name}`);
        if (panel) panel.classList.toggle('hidden', name !== tabName);
        if (btn) btn.classList.toggle('active', name === tabName);
    });

    if (tabName === 'products') renderAdminProductsList();
    if (tabName === 'users') {
        renderAdminUsersList();
        // แอดมินเปิดดูแท็บนี้แล้ว = ถือว่ารับทราบการแจ้งเตือนผู้สมัครใหม่แล้ว เคลียร์ badge ทิ้ง
        clearNewUserNotifications();
    }
}

// เรนเดอร์ตารางรายการสินค้าทั้งหมดในเว็บ (สำหรับแอดมินดูภาพรวม + กดแก้ไข/ลบได้ทันที)
function renderAdminProductsList() {
    const tbody = document.getElementById('adminProductsListBody');
    const emptyMsg = document.getElementById('adminProductsListEmpty');
    if (!tbody) return;

    // อัปเดตตัวเลข badge บนแท็บ = จำนวนสินค้าทั้งหมดในเว็บ (ไม่ขึ้นกับคำค้นหา)
    const countBadge = document.getElementById('adminProductsCountBadge');
    if (countBadge) countBadge.innerText = String(products.length);

    const searchInput = document.getElementById('adminProductSearchInput');
    const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const list = products.filter(p => {
        if (!keyword) return true;
        return (p.name || '').toLowerCase().includes(keyword) || (p.brand || '').toLowerCase().includes(keyword);
    });

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = list.map(p => `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
            <td class="py-2 pr-2">
                <div class="flex items-center gap-2">
                    <img src="${p.img || ''}" alt="" class="w-8 h-8 rounded object-cover bg-slate-800 shrink-0"
                        onerror="this.style.visibility='hidden'">
                    <div class="min-w-0">
                        <p class="text-white font-semibold truncate max-w-[160px]">${p.name || '-'}</p>
                        <p class="text-gray-500 text-[10px] truncate max-w-[160px]">${p.brand || ''}</p>
                    </div>
                </div>
            </td>
            <td class="py-2 pr-2 text-gray-300">${p.category || '-'}</td>
            <td class="py-2 pr-2 text-[var(--theme-400)] font-semibold">฿${Number(p.price || 0).toLocaleString()}</td>
            <td class="py-2 pr-2 text-right whitespace-nowrap">
                <button onclick="editProduct('${p.id}'); closeAdminSettingsModal();" class="text-gray-400 hover:text-[var(--theme-400)] px-1.5" title="แก้ไข">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deleteProduct('${p.id}')" class="text-gray-400 hover:text-red-400 px-1.5" title="ลบ">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// PRESENCE SYSTEM (ระบบเช็คบัญชีที่ออนไลน์อยู่ในเว็ป)
// ใช้ Firebase Realtime Database (rtdb) เพราะมี .info/connected + onDisconnect()
// ที่ฝั่งเซิร์ฟเวอร์ Firebase เป็นคนจัดการลบสถานะให้เองอัตโนมัติ ทันทีที่แท็บถูกปิด/เน็ตหลุด/แบตหมดกะทันหัน
// (แม่นยำกว่าวิธี heartbeat เดิมที่ใช้ Firestore มาก และไม่ต้องคอยเขียนทุก 25 วิให้เปลืองด้วย)
// ==========================================
let presenceConnectedRef = null;   // ref ของ .info/connected ที่กำลัง listen อยู่ (ไว้ off ตอน logout)
let presenceActiveUid = null;      // เก็บ uid ของคนที่กำลัง online ไว้แยกต่างหาก
// (เพราะตอน logout ตัวแปร currentUser ส่วนกลางจะถูกเซ็ตเป็น null ไปแล้วก่อนเรียก stopPresenceHeartbeat)
let onlineUsersUnsubscribe = null; // ฟังก์ชันยกเลิกการฟังรายชื่อผู้ใช้ออนไลน์ (สำหรับแอดมิน)

// เริ่มติดตามสถานะออนไลน์หลัง login (เรียกจาก auth.onAuthStateChanged)
function startPresenceHeartbeat(user, userData) {
    if (!user || typeof rtdb === 'undefined' || !rtdb) return;
    stopPresenceHeartbeat(); // กันเปิดซ้ำถ้าเรียกหลายรอบ

    presenceActiveUid = user.uid;
    const presenceRef = rtdb.ref('presence/' + user.uid);
    presenceConnectedRef = rtdb.ref('.info/connected');

    presenceConnectedRef.on('value', (snap) => {
        if (snap.val() !== true) return; // ยังไม่ได้เชื่อมต่อกับ Realtime Database ข้ามไปก่อน

        // ตั้งคำสั่งไว้ล่วงหน้ากับเซิร์ฟเวอร์ Firebase: ถ้าแท็บนี้หลุดการเชื่อมต่อไม่ว่าด้วยสาเหตุใด
        // (ปิดแท็บ, ปิดเบราว์เซอร์, เน็ตหลุด, แบตหมด) ให้ลบ presence/{uid} ทิ้งอัตโนมัติทันที
        // โดยไม่ต้องรอให้โค้ดฝั่งเราทำงาน (ซึ่งบางกรณีทำไม่ทันเพราะแท็บถูกปิดไปแล้ว)
        presenceRef.onDisconnect().remove().then(() => {
            presenceRef.set({
                name: (userData && (userData.firstName || userData.email)) || user.email || 'ผู้ใช้',
                email: (userData && userData.email) || user.email || '',
                role: (userData && userData.role) || 'user',
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
        });
    });
}

// หยุดติดตาม + ลบสถานะออนไลน์ทันที (เรียกตอน logout)
function stopPresenceHeartbeat() {
    if (presenceConnectedRef) {
        presenceConnectedRef.off();
        presenceConnectedRef = null;
    }
    if (presenceActiveUid && typeof rtdb !== 'undefined' && rtdb) {
        const presenceRef = rtdb.ref('presence/' + presenceActiveUid);
        presenceRef.onDisconnect().cancel(); // ยกเลิกคำสั่งลบอัตโนมัติที่ตั้งไว้ (เพราะเราลบเองตอนนี้แล้ว)
        presenceRef.remove();
    }
    presenceActiveUid = null;
}

// เริ่มฟังรายชื่อบัญชีออนไลน์แบบเรียลไทม์ (เรียกตอนเปิด Admin Settings Modal เท่านั้น เพื่อไม่เปลืองการเชื่อมต่อตลอดเวลา)
function startOnlineUsersListener() {
    if (!isCurrentUserAdmin() || typeof rtdb === 'undefined' || !rtdb) return;
    stopOnlineUsersListener(); // กันซ้อน

    const presenceListRef = rtdb.ref('presence');
    const handler = (snapshot) => {
        const data = snapshot.val() || {};
        const onlineList = Object.keys(data)
            .map(uid => ({ uid, ...data[uid] }))
            .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
        renderOnlineUsersList(onlineList);
    };
    presenceListRef.on('value', handler, (error) => {
        console.warn('ดึงรายชื่อผู้ใช้ออนไลน์ไม่สำเร็จ (เช็ค Realtime Database Security Rules ของ path "presence" ด้วย):', error);
    });
    onlineUsersUnsubscribe = () => presenceListRef.off('value', handler);
}

function stopOnlineUsersListener() {
    if (onlineUsersUnsubscribe) {
        onlineUsersUnsubscribe();
        onlineUsersUnsubscribe = null;
    }
}

function renderOnlineUsersList(onlineList) {
    const body = document.getElementById('onlineUsersListBody');
    const emptyMsg = document.getElementById('onlineUsersEmpty');
    const badge = document.getElementById('onlineUsersCountBadge');
    if (!body) return;

    if (badge) {
        badge.innerText = String(onlineList.length);
        badge.classList.toggle('hidden', onlineList.length === 0);
    }

    if (onlineList.length === 0) {
        body.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    body.innerHTML = onlineList.map(u => `
        <div class="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="w-2 h-2 rounded-full bg-green-400 shrink-0" title="ออนไลน์"></span>
                <div class="min-w-0">
                    <p class="text-white text-xs font-semibold truncate">${u.name || u.email || 'ผู้ใช้'}</p>
                    <p class="text-gray-500 text-[10px] truncate">${u.email || ''}</p>
                </div>
            </div>
            ${u.role === 'admin' ? '<span class="text-[10px] bg-[var(--theme-500)]/20 text-[var(--theme-400)] px-2 py-0.5 rounded-full shrink-0">Admin</span>' : ''}
        </div>
    `).join('');
}

// ==========================================
// ACCOUNTS MANAGEMENT SYSTEM (รายชื่อผู้สมัครทั้งหมด + ระงับ/แก้ไข/ดูรายละเอียดบัญชี)
// + แจ้งเตือนแอดมินแบบเรียลไทม์เมื่อมีผู้สมัครสมาชิกใหม่ล่าสุด
// ==========================================
const NEW_USER_NOTIFY_KEY = 'compung_new_user_notify_count';

let allUsersList = [];             // แคชรายชื่อผู้ใช้ทั้งหมดในเครื่อง (sync จาก Firestore แบบเรียลไทม์)
let adminUsersListenerUnsub = null;
let isInitialUsersSnapshot = true; // กันไม่ให้ตอนโหลดรอบแรกถูกนับเป็น "ผู้สมัครใหม่" ทั้งหมด

// เริ่มติดตามรายชื่อผู้สมัครสมาชิกทั้งหมดแบบเรียลไทม์ (เรียกทันทีที่ตรวจพบว่า login เป็น admin
// ไม่ใช่แค่ตอนเปิด modal เพื่อให้แจ้งเตือนผู้สมัครใหม่ได้แม้ modal จะปิดอยู่)
function startAdminUsersListener() {
    if (!isCurrentUserAdmin() || typeof db === 'undefined' || !db) return;
    stopAdminUsersListener(); // กันซ้อน
    isInitialUsersSnapshot = true;

    adminUsersListenerUnsub = db.collection('users').orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            allUsersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            // ข้ามการแจ้งเตือนสำหรับ snapshot ก้อนแรก (ข้อมูลเดิมที่มีอยู่แล้วในระบบ)
            // แจ้งเตือนเฉพาะรายการที่ถูกเพิ่มเข้ามาใหม่จริงๆ หลังจากนั้น
            if (!isInitialUsersSnapshot) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        notifyNewUserRegistration({ uid: change.doc.id, ...change.doc.data() });
                    }
                });
            }
            isInitialUsersSnapshot = false;

            renderAdminUsersList();
            updateNewUserNotifyBadge();
        }, (error) => {
            console.warn('ดึงรายชื่อผู้สมัครทั้งหมดไม่สำเร็จ (เช็ค Firestore Security Rules ของ collection "users"):', error);
        });
}

function stopAdminUsersListener() {
    if (adminUsersListenerUnsub) {
        adminUsersListenerUnsub();
        adminUsersListenerUnsub = null;
    }
}

// แจ้งเตือนแอดมินด้วย toast + เพิ่มตัวเลข badge ค้างไว้จนกว่าจะเปิดดูแท็บ "ผู้สมัครทั้งหมด"
function notifyNewUserRegistration(u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'ผู้ใช้ใหม่';

    if (typeof showPaymentToast === 'function') {
        showPaymentToast(`🔔 มีผู้สมัครสมาชิกใหม่: ${name}`, 'success');
    }

    let count = 0;
    try { count = parseInt(localStorage.getItem(NEW_USER_NOTIFY_KEY) || '0', 10) || 0; } catch (e) { /* localStorage ปิดอยู่ */ }
    count += 1;
    try { localStorage.setItem(NEW_USER_NOTIFY_KEY, String(count)); } catch (e) { /* ข้ามได้ */ }
    updateNewUserNotifyBadge();
}

// อัปเดตจุดแดง/ตัวเลขแจ้งเตือนบนปุ่ม "ตั้งค่า (Admin)" (มีได้หลายจุดในหน้าเว็บ เช่น desktop/mobile)
function updateNewUserNotifyBadge() {
    let count = 0;
    try { count = parseInt(localStorage.getItem(NEW_USER_NOTIFY_KEY) || '0', 10) || 0; } catch (e) { /* ใช้ 0 */ }

    document.querySelectorAll('.new-user-notify-badge').forEach(badge => {
        badge.innerText = count > 9 ? '9+' : String(count);
        badge.classList.toggle('hidden', count <= 0);
    });
}

function clearNewUserNotifications() {
    try { localStorage.setItem(NEW_USER_NOTIFY_KEY, '0'); } catch (e) { /* ข้ามได้ */ }
    updateNewUserNotifyBadge();
}

// แปลง Firestore Timestamp (หรือค่าอื่นๆ) เป็นวันที่อ่านง่ายสำหรับแสดงผล
function formatUserCreatedAt(ts) {
    try {
        if (!ts) return '-';
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return '-';
    }
}

// เรนเดอร์ตารางผู้สมัครทั้งหมด (ค้นหาได้ตามชื่อ/อีเมล/เบอร์โทร) พร้อมปุ่มดูรายละเอียด/แก้ไข/ระงับบัญชี
function renderAdminUsersList() {
    const tbody = document.getElementById('adminUsersListBody');
    const emptyMsg = document.getElementById('adminUsersListEmpty');
    if (!tbody) return;

    // ตัวเลขจำนวนผู้สมัครทั้งหมด (badge บนแท็บ + ตัวเลขสรุปด้านบนตาราง) ไม่ขึ้นกับคำค้นหา
    const countBadge = document.getElementById('adminUsersCountBadge');
    const totalCount = document.getElementById('adminUsersTotalCount');
    if (countBadge) countBadge.innerText = String(allUsersList.length);
    if (totalCount) totalCount.innerText = String(allUsersList.length);

    const searchInput = document.getElementById('adminUserSearchInput');
    const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const list = allUsersList.filter(u => {
        if (!keyword) return true;
        const hay = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
        return hay.includes(keyword);
    });

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = list.map(u => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '-';
        const isSuspended = u.suspended === true;
        return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
            <td class="py-2 pr-2">
                <div class="min-w-0">
                    <p class="text-white font-semibold truncate max-w-[140px]">${name}</p>
                    ${u.role === 'admin' ? '<span class="text-[9px] bg-[var(--theme-500)]/20 text-[var(--theme-400)] px-1.5 py-0.5 rounded-full">Admin</span>' : ''}
                </div>
            </td>
            <td class="py-2 pr-2 text-gray-300">
                <p class="truncate max-w-[160px]">${u.email || '-'}</p>
                <p class="text-gray-500 text-[10px]">${u.phone || '-'}</p>
            </td>
            <td class="py-2 pr-2 text-gray-400 text-[10px] whitespace-nowrap">${formatUserCreatedAt(u.createdAt)}</td>
            <td class="py-2 pr-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isSuspended ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">
                    ${isSuspended ? 'ถูกระงับ' : 'ปกติ'}
                </span>
            </td>
            <td class="py-2 pr-2 text-right whitespace-nowrap">
                <button onclick="openAccountModal('${u.uid}', 'view')" class="text-gray-400 hover:text-[var(--theme-400)] px-1.5" title="ดูรายละเอียดบัญชี">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button onclick="openAccountModal('${u.uid}', 'edit')" class="text-gray-400 hover:text-[var(--theme-400)] px-1.5" title="แก้ไขบัญชี">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="toggleSuspendUser('${u.uid}', ${!isSuspended})"
                    class="text-gray-400 ${isSuspended ? 'hover:text-emerald-400' : 'hover:text-red-400'} px-1.5"
                    title="${isSuspended ? 'เปิดใช้งานบัญชี' : 'ระงับบัญชี'}">
                    <i class="fa-solid ${isSuspended ? 'fa-lock-open' : 'fa-ban'}"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// เปิด modal บัญชีผู้ใช้ mode = 'view' (ดูอย่างเดียว) หรือ 'edit' (แก้ไขได้)
function openAccountModal(uid, mode) {
    const u = allUsersList.find(x => x.uid === uid);
    if (!u) return;

    document.getElementById('accountModalUid').value = uid;
    document.getElementById('accountModalFirstName').value = u.firstName || '';
    document.getElementById('accountModalLastName').value = u.lastName || '';
    document.getElementById('accountModalEmail').value = u.email || '';
    document.getElementById('accountModalPhone').value = u.phone || '';
    document.getElementById('accountModalAddress').value = u.address || '';
    document.getElementById('accountModalRole').value = u.role || 'user';
    document.getElementById('accountModalCreatedAt').innerText = formatUserCreatedAt(u.createdAt);

    const isSuspended = u.suspended === true;
    const statusBadge = document.getElementById('accountModalStatusBadge');
    if (statusBadge) {
        statusBadge.innerText = isSuspended ? 'ถูกระงับ' : 'ปกติ';
        statusBadge.className = `text-[11px] font-bold px-2 py-0.5 rounded-full ${isSuspended ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`;
    }

    const editable = mode === 'edit';
    ['accountModalFirstName', 'accountModalLastName', 'accountModalPhone', 'accountModalAddress', 'accountModalRole'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !editable;
    });
    const editActions = document.getElementById('accountModalEditActions');
    if (editActions) editActions.classList.toggle('hidden', !editable);

    const title = document.getElementById('accountModalTitle');
    if (title) title.innerText = editable ? 'แก้ไขบัญชีผู้ใช้' : 'รายละเอียดบัญชี';

    const modal = document.getElementById('accountModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) modal.classList.add('hidden');
}

// บันทึกการแก้ไขบัญชีผู้ใช้ (แอดมินเท่านั้น) — อีเมลแก้ไม่ได้เพราะผูกกับ Firebase Authentication โดยตรง
async function saveAccountEdits(e) {
    if (e) e.preventDefault();
    if (!isCurrentUserAdmin()) {
        alert('คุณไม่มีสิทธิ์ทำรายการนี้');
        return;
    }

    const uid = document.getElementById('accountModalUid').value;
    if (!uid) return;

    const updatedData = {
        firstName: document.getElementById('accountModalFirstName').value.trim(),
        lastName: document.getElementById('accountModalLastName').value.trim(),
        phone: document.getElementById('accountModalPhone').value.trim(),
        address: document.getElementById('accountModalAddress').value.trim(),
        role: document.getElementById('accountModalRole').value
    };

    try {
        await db.collection('users').doc(uid).update(updatedData);
        if (typeof showPaymentToast === 'function') showPaymentToast('บันทึกข้อมูลบัญชีเรียบร้อยแล้ว', 'success');
        closeAccountModal();
    } catch (error) {
        console.error('แก้ไขบัญชีผู้ใช้ไม่สำเร็จ:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
}

// ระงับ/เปิดใช้งานบัญชีผู้ใช้ (แอดมินเท่านั้น) — บัญชีที่ถูกระงับจะถูกบังคับออกจากระบบอัตโนมัติ
// ทันทีที่ auth.onAuthStateChanged ตรวจพบ field suspended === true (ดูจุดตรวจใน onAuthStateChanged ด้านล่าง)
async function toggleSuspendUser(uid, suspend) {
    if (!isCurrentUserAdmin()) {
        alert('คุณไม่มีสิทธิ์ทำรายการนี้');
        return;
    }

    const u = allUsersList.find(x => x.uid === uid);
    const name = u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || uid) : uid;

    const confirmMsg = suspend
        ? `ยืนยันระงับบัญชีของ "${name}" ใช่ไหม? ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานอีกครั้ง`
        : `ยืนยันเปิดใช้งานบัญชีของ "${name}" อีกครั้งใช่ไหม?`;
    if (!confirm(confirmMsg)) return;

    try {
        await db.collection('users').doc(uid).update({ suspended: suspend });
        if (typeof showPaymentToast === 'function') {
            showPaymentToast(suspend ? `ระงับบัญชี "${name}" แล้ว` : `เปิดใช้งานบัญชี "${name}" แล้ว`, suspend ? 'error' : 'success');
        }
    } catch (error) {
        console.error('อัปเดตสถานะบัญชีไม่สำเร็จ:', error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
}

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

    if (!isCurrentUserAdmin()) {
        console.warn('บล็อก: ต้องเป็น admin เท่านั้นถึงจะบันทึก/เพิ่มสินค้าได้');
        alert('คุณไม่มีสิทธิ์ทำรายการนี้');
        return;
    }

    // ดึงค่า Document ID เดิมจาก input ซ่อน (ถูกเซ็ตไว้ตอนกด "แก้ไข" ในฟังก์ชัน editProduct)
    // ถ้าเป็นการเพิ่มสินค้าใหม่ ค่านี้จะเป็นสตริงว่าง ""
    const editId = document.getElementById('editProductId').value;

    // ใช้ editId เป็น Document ID เดิมตอนแก้ไข (editId คือ Firestore Document ID ที่เป็นสตริงอยู่แล้ว)
    // ถ้าเป็นการเพิ่มสินค้าใหม่ ให้ Firestore เป็นคนสุ่ม Document ID ให้เอง (.doc() ไม่ใส่ argument)
    // วิธีนี้การันตีว่า ID จะไม่มีทางชนกัน แม้แอดมินหลายคนจะกด "บันทึก" พร้อมกันในเวลาเดียวกัน
    // (ต่างจากระบบเดิมที่หาค่า ID ตัวเลขสูงสุดแล้ว +1 เอง ซึ่งถ้าอ่านค่าพร้อมกันจะได้เลขซ้ำ และเขียนทับกันได้)
    const docRef = editId
        ? db.collection("products").doc(editId)
        : db.collection("products").doc();

    const existingProduct = editId ? products.find(p => String(p.id) === String(editId)) : null;
    const soldCount = existingProduct ? (existingProduct.sold || 0) : 0;

    const productData = {
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
        await docRef.set(productData, { merge: true });

        // อัปเดตเวอร์ชันสินค้า ให้ลูกค้าที่ใช้แคชอยู่รู้ว่าต้องดึงข้อมูลใหม่รอบถัดไป
        await db.collection('meta').doc('products').set({
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("บันทึกข้อมูลสินค้าสำเร็จ!");
        if (typeof closeAdminModal === 'function') closeAdminModal();

        // อัปเดตแค่สินค้าชิ้นนี้ในหน่วยความจำ + แคช โดยไม่ต้องดึงสินค้าทั้ง collection ใหม่จาก Firestore
        // (เดิมใช้ fetchProductsFromFirebase(true) ซึ่งเสีย 1 read ต่อสินค้า 1 ชิ้นในร้าน ทุกครั้งที่กดบันทึก
        // พอแอดมินหลายคนทยอยเพิ่มสินค้าทีละมาก ๆ ทำให้ read พุ่งสูงมาก เพราะแต่ละ "บันทึก" ดึงสินค้าทั้งร้านใหม่หมด)
        const savedProduct = { ...productData, id: docRef.id, firestoreId: docRef.id };
        const existingIndex = products.findIndex(p => String(p.id) === String(docRef.id));
        if (existingIndex >= 0) {
            products[existingIndex] = savedProduct; // แก้ไขสินค้าเดิม
        } else {
            products.push(savedProduct); // เพิ่มสินค้าใหม่
        }
        writeProductsCache(products, String(Date.now())); // เก็บแคชใหม่ไว้ให้ตัวเองใช้ต่อทันที ไม่ต้องรอ meta
        renderAllProductViews();
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการบันทึกสินค้า:", error);
        alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }
}

function editProduct(id) {
    if (!isCurrentUserAdmin()) {
        console.warn('บล็อก: ต้องเป็น admin เท่านั้นถึงจะแก้ไขสินค้าได้');
        return;
    }

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
    if (!isCurrentUserAdmin()) {
        console.warn('บล็อก: ต้องเป็น admin เท่านั้นถึงจะลบสินค้าได้');
        return;
    }

    const confirmMsg = (typeof currentLang !== 'undefined' && currentLang === 'th')
        ? 'คุณต้องการลบสินค้านี้ใช่หรือไม่?'
        : 'Are you sure you want to delete this product?';

    if (confirm(confirmMsg)) {
        try {
            // id ตอนนี้คือ Firestore Document ID โดยตรงอยู่แล้ว (มาจาก doc.id ตอนดึงข้อมูล)
            await db.collection("products").doc(id).delete();

            // อัปเดตเวอร์ชันสินค้า ให้ลูกค้าที่ใช้แคชอยู่รู้ว่าต้องดึงข้อมูลใหม่รอบถัดไป
            await db.collection('meta').doc('products').set({
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            alert("ลบสินค้าเรียบร้อยแล้ว!");

            // เอาสินค้าชิ้นนี้ออกจากหน่วยความจำ + แคชในเครื่องเลย โดยไม่ต้องดึงสินค้าทั้ง collection ใหม่
            products = products.filter(p => String(p.id) !== String(id));
            writeProductsCache(products, String(Date.now()));
            renderAllProductViews();
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

firebase.initializeApp(firebaseConfig);
firebase.firestore().settings({}); // ถ้ามีอยู่แล้วข้ามได้
firebase.firestore.setLogLevel('debug');