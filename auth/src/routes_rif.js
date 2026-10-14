const express = require("express");
const router = express.Router();
const { readRIF, readRifFromUpload } = require("./controllers_rif");

router.get("/read-rif", readRIF);                        // legado: lee de rif/

module.exports = router;