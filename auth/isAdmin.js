const bcrypt = require("bcrypt");

module.exports = async function (req, res, next) {
  let { username, password } = req.body;

  let checkPass = await bcrypt.compare(
    password,
    "$2b$10$fAH8neqtqI6X5pL5LE6wvunv9r3ZMAQxLFrnofHcITu8L7ax9NESe"
  );
  if (username === "admin" && checkPass == true) {
    var sessData = req.session;
    sessData.username = "admin";
    return res.redirect("/admin");
  }
  next();
};
