// ==========================================================
// Cloud Function: verifyPaymentSlip
// ตรวจสอบสลิปการโอนเงินจริงผ่าน SlipOK API ก่อนยืนยันการชำระเงิน
// ตรวจ 4 จุด: ยอดเงิน / บัญชีปลายทาง / วันเวลาที่โอน / สลิปซ้ำ
// ==========================================================
//
// วิธีติดตั้ง:
// 1) ในโฟลเดอร์ functions ของโปรเจกต์ Firebase รันคำสั่ง:
//      npm install axios form-data
// 2) นำไฟล์นี้ไปวางไว้ที่ functions/verifyPaymentSlip.js
// 3) ใน functions/index.js เพิ่มบรรทัด:
//      exports.verifyPaymentSlip = require('./verifyPaymentSlip').verifyPaymentSlip;
// 4) ตั้งค่า API Key และ Branch ID จาก SlipOK (https://slipok.com):
//      firebase functions:config:set slipok.apikey="ใส่ API Key ของคุณ" slipok.branchid="ใส่ Branch ID ของคุณ"
// 5) แก้ค่า STORE_ACCOUNT_NUMBER ด้านล่างให้เป็นเลขบัญชี/พร้อมเพย์ปลายทางจริงของร้าน
// 6) Deploy:
//      firebase deploy --only functions:verifyPaymentSlip
//
// ฝั่งหน้าเว็บ (index.html) ต้องเพิ่ม SDK ให้ตรงกับเวอร์ชัน firebase ที่ใช้อยู่ เช่น:
//      <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"></script>
// (ใส่ต่อจาก firebase-app / firebase-firestore / firebase-auth ที่มีอยู่แล้ว)
// ==========================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// อ่านค่า config ที่ตั้งไว้ด้วย firebase functions:config:set
const SLIPOK_API_KEY = functions.config().slipok?.apikey;
const SLIPOK_BRANCH_ID = functions.config().slipok?.branchid;

// เลขบัญชี/พร้อมเพย์ปลายทางของร้าน (ใส่เฉพาะตัวเลข ตัด - หรือช่องว่างออก)
// ใช้เทียบกับบัญชีผู้รับเงินที่อ่านได้จากสลิป เพื่อกันลูกค้าแนบสลิปที่โอนไปบัญชีอื่น
const STORE_ACCOUNT_NUMBER = "0000000000"; // TODO: แก้เป็นเลขบัญชีจริงของร้าน

// สลิปต้องมีเวลาการโอนไม่เก่ากว่ากี่นาที (กันเอาสลิปเก่ามาใช้ซ้ำ)
const MAX_SLIP_AGE_MINUTES = 30;

exports.verifyPaymentSlip = functions.region('asia-southeast1').https.onCall(async (data, context) => {
    // ต้อง login ก่อนเท่านั้นถึงจะเรียกใช้ฟังก์ชันนี้ได้
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
    }

    const { imageBase64, orderRef, expectedAmount } = data;
    if (!imageBase64 || !orderRef || !expectedAmount) {
        throw new functions.https.HttpsError('invalid-argument', 'ข้อมูลที่ส่งมาไม่ครบถ้วน');
    }

    if (!SLIPOK_API_KEY || !SLIPOK_BRANCH_ID) {
        console.error('ยังไม่ได้ตั้งค่า SlipOK API Key / Branch ID');
        return { valid: false, reason: 'ระบบตรวจสอบสลิปยังไม่พร้อมใช้งาน กรุณาติดต่อแอดมิน' };
    }

    // แปลงรูปจาก base64 (data URL) เป็น Buffer
    const base64Data = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // ---------- ส่งรูปสลิปไปตรวจสอบกับ SlipOK ----------
    let slipData;
    try {
        const form = new FormData();
        form.append('files', buffer, { filename: 'slip.jpg', contentType: 'image/jpeg' });
        form.append('amount', expectedAmount); // ให้ SlipOK ช่วยเช็คยอดเงินเบื้องต้นด้วย

        const res = await axios.post(
            `https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'x-authorization': SLIPOK_API_KEY
                },
                timeout: 15000
            }
        );

        if (!res.data || res.data.success === false) {
            return {
                valid: false,
                reason: res.data?.message || 'ไม่สามารถอ่านข้อมูลจากสลิปได้ กรุณาแนบรูปที่ชัดเจนกว่านี้'
            };
        }
        slipData = res.data.data;
    } catch (err) {
        console.error('SlipOK error:', err.response?.data || err.message);
        // กรณี SlipOK แจ้งว่ายอดเงินไม่ตรง (บาง error code จะส่งกลับมาทาง response.data)
        if (err.response?.data?.message) {
            return { valid: false, reason: err.response.data.message };
        }
        return { valid: false, reason: 'ไม่สามารถตรวจสอบสลิปได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' };
    }

    // ---------- 1) ตรวจสอบยอดเงินให้ตรงกับราคาสินค้า ----------
    const slipAmount = Number(slipData.amount);
    if (!slipAmount || slipAmount !== Number(expectedAmount)) {
        return {
            valid: false,
            reason: `ยอดเงินในสลิป (฿${slipAmount || 0}) ไม่ตรงกับยอดที่ต้องชำระ (฿${expectedAmount})`
        };
    }

    // ---------- 2) ตรวจสอบบัญชีปลายทางให้ตรงกับบัญชีร้าน ----------
    const rawReceivedAccount =
        slipData.receiver?.account?.value ||
        slipData.receiver?.account?.bank?.account ||
        slipData.receivingAccountNumber ||
        '';
    const receivedAccount = String(rawReceivedAccount).replace(/[^0-9]/g, '');
    const storeAccount = STORE_ACCOUNT_NUMBER.replace(/[^0-9]/g, '');

    if (storeAccount && receivedAccount && !receivedAccount.endsWith(storeAccount.slice(-6))) {
        return { valid: false, reason: 'บัญชีปลายทางในสลิปไม่ตรงกับบัญชีของร้านค้า' };
    }

    // ---------- 3) ตรวจสอบวันเวลาที่โอน ต้องไม่เก่าเกินไป ----------
    let transDateTime = null;
    if (slipData.transTimestamp) {
        transDateTime = new Date(slipData.transTimestamp);
    } else if (slipData.transDate && slipData.transTime) {
        transDateTime = new Date(`${slipData.transDate}T${slipData.transTime}`);
    }

    if (!transDateTime || isNaN(transDateTime.getTime())) {
        return { valid: false, reason: 'ไม่สามารถอ่านวันเวลาการโอนเงินจากสลิปได้' };
    }

    const ageMinutes = (Date.now() - transDateTime.getTime()) / 60000;
    if (ageMinutes > MAX_SLIP_AGE_MINUTES) {
        return {
            valid: false,
            reason: `สลิปนี้โอนเมื่อประมาณ ${Math.round(ageMinutes)} นาทีที่แล้ว เก่าเกินไป กรุณาใช้สลิปที่โอนล่าสุด`
        };
    }
    if (ageMinutes < -2) {
        return { valid: false, reason: 'วันเวลาบนสลิปไม่ถูกต้อง (เป็นเวลาในอนาคต)' };
    }

    // ---------- 4) กันสลิปซ้ำ ไม่ให้นำสลิปเดิมมายืนยันซ้ำหลายออเดอร์ ----------
    const slipRefId = String(
        slipData.transRef || slipData.ref || `${slipAmount}-${transDateTime.getTime()}`
    ).replace(/[\/\s]/g, '_');

    const usedSlipRef = db.collection('usedSlips').doc(slipRefId);
    const usedSlipDoc = await usedSlipRef.get();
    if (usedSlipDoc.exists) {
        return { valid: false, reason: 'สลิปนี้เคยถูกใช้ยืนยันการชำระเงินไปแล้ว ไม่สามารถใช้ซ้ำได้' };
    }

    await usedSlipRef.set({
        usedBy: context.auth.uid,
        orderRef,
        amount: slipAmount,
        transDateTime: admin.firestore.Timestamp.fromDate(transDateTime),
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ผ่านการตรวจสอบครบทุกจุด
    return { valid: true, slipData };
});