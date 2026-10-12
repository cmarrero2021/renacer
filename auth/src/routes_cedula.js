const express = require("express");
const router = express.Router();
const { readCedula } = require("./controllers_cedula");

router.get("/read-cedula", readCedula);

module.exports = router;