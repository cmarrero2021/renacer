const express = require("express");
const router = express.Router();
const { readRIF } = require("./controllers_rif");

router.get("/read-rif", readRIF);

module.exports = router;