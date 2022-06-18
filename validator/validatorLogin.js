const { check } = require("express-validator");

module.exports = [
  check("username")
    .exists()
    .withMessage("Vui lòng nhập username")
    .notEmpty()
    .withMessage("Không được để trống username"),

  check("password")
    .exists()
    .withMessage("Vui lòng nhập password")
    .notEmpty()
    .withMessage("Không được để trống password"),
];
