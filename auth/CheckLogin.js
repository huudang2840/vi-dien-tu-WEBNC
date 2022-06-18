const Account = require("../models/Account");

module.exports = async function (req, res, next) {
  let username = req.session.username;

  console.log("user" + username);
  if (!username) {
    return res.redirect("/user/login");
  }

  next();
};
