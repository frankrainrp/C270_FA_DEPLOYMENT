const express = require('express'); const multer = require('multer'); const router = express.Router();
const upload = multer({ dest: 'uploads/' });
router.post('/extract-ddl', upload.single('document'), (req, res) => {
    res.json({ success: true, ddl: 'CREATE TABLE PrintingLogs (ID int, CostPerPrint decimal);' });
});
module.exports = router;