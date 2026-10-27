const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose'); // MongoDB ለመጠቀም የተጨመረ
const app = express();
const PORT = process.env.PORT || 5000; // Render የራሱን ፖርት እንዲሰጠው የተደረገ

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("❌ ስህተት: MONGO_URI በ Render Settings ውስጥ አልተገኘም!");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 MongoDB Atlas ዳታቤዝ በተሳካ ሁኔታ ተገናኝቷል!"))
    .catch(err => console.error("❌ MongoDB መገናኘት አልቻለም:", err));
const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0.00 }
});
const User = mongoose.model('User', userSchema);

const depositSchema = new mongoose.Schema({
    id: String,
    userPhone: String,
    amount: Number,
    senderPhone: String,
    method: String,
    screenshot: String,
    status: { type: String, default: 'PENDING' },
    date: String
});
const Deposit = mongoose.model('Deposit', depositSchema);

const withdrawalSchema = new mongoose.Schema({
    id: String,
    userPhone: String,
    amount: Number,
    accountNumber: String,
    fullName: String,
    method: String,
    status: { type: String, default: 'PENDING' },
    date: String
});
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

const historySchema = new mongoose.Schema({
    roundNumber: Number,
    results: Array,
    timestamp: { type: String, default: () => new Date().toISOString() }
});
const History = mongoose.model('History', historySchema);
async function seedInitialUser() {
    try {
        const adminUser = await User.findOne({ phone: "0943918532" });
        if (!adminUser) {
            await User.create({ phone: "0943918532", password: "1234", balance: 1803.00 });
            console.log("✅ የመጀመሪያው አድሚን ተጠቃሚ በዳታቤዙ ውስጥ ተፈጥሯል!");
        }
    } catch (err) {
        console.error("Initial user seeding error:", err);
    }
}
seedInitialUser();
const playerFilePath = path.join(__dirname, 'Dashbet3.html.html');

app.get('/', (req, res) => { res.sendFile(playerFilePath); });
app.get('/admin-panel', (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });
app.post('/login', async (req, res) => {
    let { phone, password } = req.body;
    if (!phone || !password) return res.json({ success: false, message: "⚠️ እባክዎ ስልክ ቁጥር እና የይለፍ ቃል ያስገቡ!" });
    phone = phone.trim();
    
    try {
        const user = await User.findOne({ phone: phone });
        if (user && user.password === password) {
            return res.json({ success: true, user: { phone: user.phone, balance: user.balance } });
        }
        return res.json({ success: false, message: "⚠️ ስልክ ቁጥር ወይም የይለፍ ቃል የተሳሳተ ነው!" });
    } catch (e) {
        return res.json({ success: false, message: "⚠️ የሰርቨር ስህተት አጋጥሟል!" });
    }
});

app.post('/register', async (req, res) => {
    let { phone, password } = req.body;
    if (!phone || !password) return res.json({ success: false, message: "⚠️ እባክዎ ሁሉንም ፎርም በትክክል ይሙሉ!" });
    phone = phone.trim();
    
    try {
        const existingUser = await User.findOne({ phone: phone });
        if (existingUser) return res.json({ success: false, message: "❌ ይህ ስልክ ቁጥር ቀድሞ የተመዘገበ ነው!" });
        
        await User.create({ phone: phone, password: password, balance: 0.00 });
        res.json({ success: true, message: "✅ ምዝገባዎ በቋሚነት ተጠናቋል! አሁን መግባት ይችላሉ።" });
    } catch (e) {
        res.json({ success: false, message: "❌ ምዝገባው አልተሳካም!" });
    }
});
app.post('/api/place-bet', async (req, res) => {
    let { userPhone, betAmount } = req.body;
    try {
        const user = await User.findOne({ phone: userPhone.trim() });
        if (!user || user.balance < parseFloat(betAmount)) return res.json({ success: false });
        
        user.balance -= parseFloat(betAmount);
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (e) {
        res.json({ success: false });
    }
});

app.post('/api/claim-win', async (req, res) => {
    let { userPhone, winAmount } = req.body;
    try {
        const user = await User.findOne({ phone: userPhone.trim() });
        if (!user) return res.json({ success: false });
        
        user.balance += parseFloat(winAmount);
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (e) {
        res.json({ success: false });
    }
});

app.post('/api/save-draw', async (req, res) => {
    const { roundNumber, results } = req.body;
    try {
        await History.create({ roundNumber, results });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

app.get('/api/draw-history', async (req, res) => {
    try {
        const history = await History.find({}).sort({ _id: -1 }).limit(50);
        res.json(history);
    } catch (e) {
        res.json([]);
    }
});
app.post('/api/deposit', async (req, res) => {
    let { userPhone, amount, senderPhone, method, screenshot } = req.body;
    try {
        await Deposit.create({
            id: 'DEP-' + Date.now(),
            userPhone: userPhone.trim(),
            amount: parseFloat(amount),
            senderPhone,
            method,
            screenshot: screenshot || "",
            date: new Date().toLocaleString('am-ET')
        });
        res.json({ success: true, message: "✅ የዲፖዚት ጥያቄዎ ለአድሚን ደርሷል!" });
    } catch (e) {
        res.json({ success: false, message: "❌ ጥያቄውን መላክ አልተቻለም!" });
    }
});

app.post('/api/withdraw', async (req, res) => {
    let { userPhone, amount, accountNumber, fullName, method } = req.body;
    const cleanPhone = userPhone.trim();
    const reqAmount = parseFloat(amount);
    
    if (reqAmount < 80) return res.json({ success: false, message: "❌ ማውጣት የሚቻለው አነስተኛ መጠን 80 ETB ነው!" });

    try {
        const user = await User.findOne({ phone: cleanPhone });
        if (!user) return res.json({ success: false, message: "❌ ተጠቃሚው አልተገኘም!" });

        const pendingWithdraws = await Withdrawal.find({ userPhone: cleanPhone, status: 'PENDING' });
        const pendingWithdrawAmount = pendingWithdraws.reduce((sum, w) => sum + w.amount, 0);

        const availableToWithdraw = user.balance - pendingWithdrawAmount;

        if (reqAmount > availableToWithdraw) {
            return res.json({ success: false, message: `❌ በቂ ቀሪ ሂሳብ የሎትም! ማውጣት የሚችሉት ከፍተኛ መጠን፦ ${Math.max(0, availableToWithdraw).toFixed(2)} ETB` });
        }

        if (reqAmount > 10000) {
            const maxAllowedByPercent = user.balance * 0.65;
            if (reqAmount > maxAllowedByPercent) {
                return res.json({ success: false, message: `❌ ከ 10,000 ETB በላይ ማውጣት የሚቻለው ከአጠቃላይ ቀሪ ሂሳብዎ 65% ብቻ ነው! አሁን ማውጣት የሚችሉት ከፍተኛ መጠን፦ ${maxAllowedByPercent.toFixed(2)} ETB` });
            }
        }
        
        await Withdrawal.create({
            id: 'WITH-' + Date.now(),
            userPhone: cleanPhone,
            amount: reqAmount,
            accountNumber,
            fullName,
            method,
            date: new Date().toLocaleString('am-ET')
        });
        res.json({ success: true, message: "✅ የዊዝድሮው ጥያቄዎ በተሳካ ሁኔታ ለአድሚን ተልኳል!" });
    } catch (e) {
        res.json({ success: false, message: "❌ የሰርቨር ችግር አጋጥሟል!" });
    }
});
app.post('/admin/process-deposit', async (req, res) => {
    const { id, action } = req.body;
    try {
        const dep = await Deposit.findOne({ id: id });
        if (!dep || dep.status !== 'PENDING') return res.json({ success: false });
        
        if (action === 'APPROVE') {
            dep.status = 'APPROVED';
            const user = await User.findOne({ phone: dep.userPhone });
            if (user) {
                user.balance += dep.amount;
                await user.save();
            }
        } else {
            dep.status = 'REJECTED';
        }
        await dep.save();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

app.post('/admin/process-withdrawal', async (req, res) => {
    const { id, action } = req.body;
    try {
        const withReq = await Withdrawal.findOne({ id: id });
        if (!withReq || withReq.status !== 'PENDING') return res.json({ success: false });
        
        const targetUserPhone = withReq.userPhone;
        const withdrawAmount = withReq.amount;
        
        if (action === 'APPROVE') {
            const user = await User.findOne({ phone: targetUserPhone });
            if (user && user.balance >= withdrawAmount) {
                withReq.status = 'APPROVED';
                user.balance -= withdrawAmount;
                await user.save();
            } else {
                return res.json({ success: false, message: "❌ በቂ ቀሪ ሂሳብ የለም!" });
            }
        } else {
            withReq.status = 'REJECTED';
        }
        await withReq.save();
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

app.get('/admin/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({});
        const pendingDeposits = await Deposit.countDocuments({ status: 'PENDING' });
        const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'PENDING' });
        
        const allUsers = await User.find({});
        let totalCapital = allUsers.reduce((sum, u) => sum + u.balance, 0);
        
        res.json({ totalUsers, pendingDeposits, pendingWithdrawals, totalCapital });
    } catch (e) {
        res.json({ totalUsers: 0, pendingDeposits: 0, pendingWithdrawals: 0, totalCapital: 0 });
    }
});

app.get('/admin/deposits', async (req, res) => { 
    try { res.json(await Deposit.find({})); } catch(e) { res.json([]); } 
});
app.get('/admin/withdrawals', async (req, res) => { 
    try { res.json(await Withdrawal.find({})); } catch(e) { res.json([]); } 
});
app.get('/admin/users', async (req, res) => { 
    try { res.json(await User.find({})); } catch(e) { res.json([]); } 
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Dashbet ሰርቨር በኦንላይን ለመስራት በፖርት ${PORT} ላይ ተነስቷል!`);
});

