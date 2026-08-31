

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

const SLIPOK_API_KEY = functions.config().slipok?.apikey;
const SLIPOK_BRANCH_ID = functions.config().slipok?.branchid;

const STORE_ACCOUNT_NUMBER = "0000000000"; 


const MAX_SLIP_AGE_MINUTES = 30;

exports.verifyPaymentSlip = functions.region('asia-southeast1').https.onCall(async (data, context) => {

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

    const base64Data = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    let slipData;
    try {
        const form = new FormData();
        form.append('files', buffer, { filename: 'slip.jpg', contentType: 'image/jpeg' });
        form.append('amount', expectedAmount);

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
       
        if (err.response?.data?.message) {
            return { valid: false, reason: err.response.data.message };
        }
        return { valid: false, reason: 'ไม่สามารถตรวจสอบสลิปได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' };
    }

    const slipAmount = Number(slipData.amount);
    if (!slipAmount || slipAmount !== Number(expectedAmount)) {
        return {
            valid: false,
            reason: `ยอดเงินในสลิป (฿${slipAmount || 0}) ไม่ตรงกับยอดที่ต้องชำระ (฿${expectedAmount})`
        };
    }

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


    return { valid: true, slipData };
});