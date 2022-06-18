var express = require("express");
var router = express.Router();
const { validationResult } = require("express-validator");
const mailer = require("../../sendMail");
const bcrypt = require("bcrypt");
const Account = require("../../models/Account");
const Wallet = require("../../models/WalletModel");
const ResetToken = require("../../models/ResetTokenModel");
const validatorLogin = require("../../validator/validatorLogin");
const crypto = require("crypto");
// const jwt = require("jsonwebtoken");
const multer = require("multer");
const checkLogin = require("../../auth/CheckLogin");
const isAdmin = require("../../auth/isAdmin");

// Upload file ảnh
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/cmnd");
  },
  filename: function (req, file, cb) {
    cb(null, req.body.email + "-" + file.fieldname + "-" + Date.now() + "-" + file.originalname);
  },
});
var upload = multer({ storage: storage });

var uploadMultiple = upload.fields([
  { name: "front_IDcard", maxCount: 10 },
  { name: "back_IDcard", maxCount: 10 },
]);

router.get("/", checkLogin, function (req, res, next) {
  let username = req.session.username;
  Account.findOne({ username: username }, (err, user) => {
    if (!err) {
      if (!user.firstLogin) {
        return res.redirect("/wallet");
      } else if (user.firstLogin) {
        return res.redirect("/user/firstlogin");
      }
    } else {
      console.log("err");
    }
  });
});

//Đổi mật khẩu
router.get("/changepassword", checkLogin, (req, res) => {
  let type = req.flash("type");
  let error = req.flash("message");
  res.render("user/changepassword", { type: type, error: error });
});

router.post("/changepassword", checkLogin, async (req, res) => {
  let username = req.session.username;
  let { pass_old, pass_new, confirm_pass } = req.body;
  let acc = undefined;
  Account.findOne({ username: username })
    .then((account) => {
      acc = account.email;
      return bcrypt.compare(pass_old, account.password);
    })
    .then(async (matchPasswords) => {
      if (!matchPasswords) {
        req.flash("type", "danger");
        req.flash("message", "Mật khẩu cũ không chính xác");
        return res.redirect("/user/changepassword");
      } else if (pass_new !== confirm_pass) {
        req.flash("type", "danger");
        req.flash("message", "Mật khẩu không trùng khớp");
        return res.redirect("/user/changepassword");
      } else {
        let passwordHashed = (await bcrypt.hash(pass_new, 10)).toString();

        console.log(passwordHashed);
        await Account.findOneAndUpdate(
          { username: username },
          { $set: { password: passwordHashed, firstLogin: false, update_at: Date.now() } }
        );
        return res.redirect("/wallet");
      }
    });
});

// Đăng nhập
router.get("/login", function (req, res, next) {
  let type = req.flash("type");
  let error = req.flash("message");

  res.render("user/login", { type: type, error: error });
});

router.post("/login", isAdmin, validatorLogin, function (req, res) {
  let result = validationResult(req);
  if (result.errors.length === 0) {
    let { username, password } = req.body;
    let acc = undefined;
    Account.findOne({ username: username })
      .then((account) => {
        if (!account) {
          throw new Error("Tài khoản chưa được đăng ký");
        }
        acc = account;
        return bcrypt.compare(password, account.password);
      })
      .then((passwordMatch) => {
        if (!passwordMatch) {
          if (acc.countLogin === 3 && acc.safeAccount === true) {
            console.log("Bị khóa 1 phút");

            // Khóa tài khoản và thay đổi trạng thái tk bất thường
            lockAccount(acc);
            unSafeAccount(acc);
            //Mở khóa tài khoản sau 1 phút
            setTimeout(() => {
              unlockAccount(acc);
            }, 30 * 1000);
            req.flash("type", "danger");
            req.flash("message", "Tài khoản hiện đang bị tạm khóa, vui lòng thử lại sau 1 phút");
            return res.redirect("/user/login");
          } else if (acc.countLogin >= 3 && acc.safeAccount === false) {
            console.log("Khóa tk");

            updateLogin(acc);
            lockAccount(acc);
            req.flash("type", "danger");
            req.flash(
              "message",
              "Tài khoản đã bị khóa do nhập sai mật khẩu nhiều lần, vui lòng liên hệ quản trị viên để được hỗ trợ."
            );
            return res.redirect("/user/login");
          }
          // Tạm khóa tài khoản sau 1 phút
          else {
            if (acc.lockAccount === true) {
              req.flash("type", "danger");
              req.flash(
                "message",
                "Tài khoản đã bị khóa do nhập sai mật khẩu nhiều lần, vui lòng liên hệ quản trị viên để được hỗ trợ."
              );
              return res.redirect("/user/login");
            } else {
              updateLogin(acc);
              req.flash("type", "danger");
              req.flash("message", "Sai mật khẩu");
              return res.redirect("/user/login");
            }
          }
        } else {
          if (acc.verifyAccount === "disable") {
            req.flash("type", "danger");
            req.flash(
              "message",
              "Tài khoản này đã bị vô hiệu hóa, vui lòng liên hệ tổng đài 18001008”."
            );
            return res.redirect("/user/login");
          }
          if (acc.lockAccount === true) {
            req.flash("type", "danger");
            req.flash(
              "message",
              "Tài khoản đã bị khóa do nhập sai mật khẩu nhiều lần, vui lòng liên hệ quản trị viên để được hỗ trợ."
            );
            return res.redirect("/user/login");
          } else {
            safeAccount(acc);
            // const { JWT_SECRET } = process.env;
            // let auth = jwt.sign(
            //   {
            //     username: acc.username,
            //   },
            //   JWT_SECRET,
            //   { expiresIn: "1h" }
            // );

            var sessData = req.session;
            sessData.username = acc.username;

            return res.redirect("/user");
          }
        }
      })
      .catch((err) => {
        req.flash("type", "danger");
        req.flash("message", err.message);
        return res.redirect("/user/login");
      });
  } else {
    let messages = result.mapped();
    let message = "";
    for (m in messages) {
      message = messages[m];
      break;
    }
    req.flash("type", "danger");
    req.flash("message", message.msg);
    res.redirect("/user/login");
  }
});

// Đăng ký
router.get("/register/?", (req, res) => {
  let { phone, name, email, address, birth } = req.query;
  let type = req.flash("type");
  let error = req.flash("message");
  res.render("user/register", { type: type, error: error, phone, name, email, address, birth });
});

// POST Đăng ký
router.post("/register", uploadMultiple, async (req, res) => {
  let error = validatorRegister(req);

  let { phone, name, email, address, birth } = req.body;
  let { back_IDcard, front_IDcard } = req.files;
  front_IDcard = front_IDcard[0].path.replace("/\\/g", "/").split("public").join("");
  back_IDcard = back_IDcard[0].path.replace("/\\/g", "/").split("public").join("");

  var userPhone = await Account.findOne({ phone: phone });
  var userEmail = await Account.findOne({ email: email });

  // Email hoặc số điện thoại đã được đăng ký
  if (userPhone || userEmail) {
    req.flash("type", "danger");
    req.flash("message", "Số điện thoại hoặc email đã được đăng ký");
    res.redirect(
      "/user/register/?phone=" +
        phone +
        "&name=" +
        name +
        "&email=" +
        email +
        "&address=" +
        address +
        "&birth=" +
        birth
    );
  } else {
    if (!error) {
      let password = crypto.randomBytes(3).toString("hex");
      let username = randomUsername();
      let passwordHashed = (await bcrypt.hash(password, 10)).toString();
      console.log("Thông tin tài khoản:", username + " " + password);
      let user = new Account({
        phone: phone,
        name: name,
        email: email,
        address: address,
        birth: birth,
        front_IDcard: front_IDcard,
        back_IDcard: back_IDcard,
        username: username,
        password: passwordHashed,
      });

      user.save().then(() => {
        mailer.sendInfo(email, username, password);
        // Sau khi tạo tài khoản sẽ tạo ví cho user
        let wallet = new Wallet({
          history: { id: randomHistory() },
          owner: username,
        });
        wallet.save();
        req.flash("type", "success");
        req.flash("message", "Đăng ký thành công");
        return res.redirect("/user/login");
      });
    } else {
      req.flash("type", "danger");
      req.flash("message", error);
      res.redirect(
        "/user/register/form?phone=" +
          phone +
          "name=" +
          name +
          "&email=" +
          email +
          "&address=" +
          address +
          "&birth=" +
          birth
      );
    }
  }
});

// Update CMND
router.get("/update", checkLogin, async function (req, res, next) {
  let username = req.session.username;
  let user = await Account.findOne({ username: username });
  let wallet = await Wallet.findOne({ owner: username });

  res.render("wallet/update_profile", { wallet: wallet, user: user, title: "Rut tiền" });
});

router.post("/update", uploadMultiple, async (req, res) => {
  let { back_IDcard, front_IDcard } = req.files;
  front_IDcard = front_IDcard[0].path.replace("/\\/g", "/").split("public").join("");
  back_IDcard = back_IDcard[0].path.replace("/\\/g", "/").split("public").join("");

  let username = req.session.username;
  await Account.findOneAndUpdate(
    { username: username },
    {
      front_IDcard: front_IDcard,
      back_IDcard: back_IDcard,
      verifyAccount: "waiting",
      update_at: Date.now(),
    }
  );
  return res.redirect("/user/profile");
});

// Quên mật khẩu
// Đăng nhập rồi k vô dc
router.get("/forgot", (req, res) => {
  let type = req.flash("type");
  let error = req.flash("message");
  res.render("user/forgot-password", { error: error, type: type });
});

router.post("/forgot", async (req, res) => {
  let email = req.body.email;
  let token = crypto.randomBytes(32).toString("hex");

  //Kiểm tra email có tồn tại trong database không
  var checkEmail = await Account.findOne({ email: email });
  if (checkEmail) {
    //Trường hợp email có trong hệ thống thì sẽ gửi yêu cầu cấp link reset mk cùng với token qua mail
    // và lưu vào database, link này có hạn là 10p kể từ lúc gửi đi
    await ResetToken({ token: token, email: email })
      .save()
      .then(() => {
        req.flash("message", "Gửi yêu cầu thành công vui lòng kiểm tra email");
        req.flash("type", "success");
        mailer.sendResetMail(email, token);
        res.redirect("/user/forgot");
      })
      .catch((err) => {
        req.flash("message", err.message);
        req.flash("type", "danger");
        res.redirect("/user/forgot");
      });
  } else {
    //Trường hợp email không tồn tại trong database
    req.flash("message", "Email không tồn tại");
    req.flash("type", "danger");
    res.redirect("/user/forgot");
  }
});

// Khôi phục mật khẩu
router.get("/reset/:token", async (req, res) => {
  let token = req.params.token;
  let check = await ResetToken.findOne({ token: token });
  if (!check) {
    res.send("Token không hợp lệ hoặc đã hết hạn");
  } else {
    let type = req.flash("type");
    let error = req.flash("message");
    res.render("user/resetpassword", { type, error });
  }
});

router.post("/reset/:token", async (req, res) => {
  let token = req.params.token;
  let { pass, confirm_pass } = req.body;
  let email = "";
  if (pass !== confirm_pass) {
    req.flash("type", "danger");
    req.flash("message", "Mật khẩu không trùng khớp");
    return res.redirect("/user/reset/" + token);
  }
  ResetToken.findOne({ token: token }, (err, user) => {
    if (!err) {
      email = user.email;
    } else {
      console.log(err);
    }
  });
  let passwordHashed = (await bcrypt.hash(pass, 10)).toString();

  await Account.findOneAndUpdate(
    { email: email },
    { $set: { password: passwordHashed, countLogin: 0, update_at: Date.now() } }
  );
  await ResetToken.findOneAndDelete({ token: token });
  return res.redirect("/user/login");
});

// Thông tin của người dùng
router.get("/profile", checkLogin, async (req, res) => {
  let username = req.session.username;
  let user = await Account.findOne({ username: username });
  let wallet = await Wallet.findOne({ owner: username });
  res.render("wallet/profile", { wallet: wallet, user: user, title: "Thông tin cá nhân" });
});

router.get("/firstlogin", checkLogin, (req, res) => {
  res.render("user/firstlogin");
});

// Đăng xuất
router.post("/logout", (req, res) => {
  req.session.destroy();
  return res.redirect("/user/login");
});

function randomUsername() {
  let str = "";
  for (let i = 0; i <= 9; i++) {
    str += Math.floor(Math.random() * 10).toString();
  }
  return str;
}

function validatorRegister(req) {
  let msg = undefined;
  let { phone, name, email, address, birth } = req.body;
  if (!name || name === "") {
    return (msg = "Họ tên người dùng không được để trống");
  } else if (name.length <= 6) {
    return (msg = "Họ tên người dùng có ít nhất 6 kí tự");
  } else if (!email || email === "") {
    return (msg = "Email không được để trống");
  } else if (!phone || phone === "") {
    return (msg = "Số điện thoại không được để trống");
  } else if (!Number.isInteger(parseInt(phone))) {
    return (msg = "Số điện thoại phải là số");
  } else if (phone.length < 10 || phone.length > 15) {
    return (msg = "Độ dài số điện thoại không phù hợp");
  } else if (!address || address === "") {
    return (msg = "Địa chỉ không được để trống");
  } else if (!birth || address === "") {
    return (msg = "Ngày sinh không được để trống");
  }

  return msg;
}
function updateLogin(user) {
  Account.findOneAndUpdate(
    { _id: user._id },
    { countLogin: user.countLogin + 1, update_at: Date.now() },
    (err, user) => {}
  );
}

function lockAccount(user) {
  Account.findOneAndUpdate(
    { _id: user._id },
    {
      lockAccount: true,
      update_at: Date.now(),
    },
    (err, user) => {
      if (!err) {
      } else {
        console.log(err);
      }
    }
  );
}

function unlockAccount(user) {
  Account.findOneAndUpdate(
    { _id: user._id },
    {
      lockAccount: false,
      countLogin: 0,
      update_at: Date.now(),
    },
    (err, user) => {
      if (!err) {
      } else {
        console.log(err);
      }
    }
  );
}

function safeAccount(user) {
  Account.findOneAndUpdate(
    { username: user.username },
    {
      countLogin: 0,
      lockAccount: false,
      safeAccount: true,
      update_at: Date.now(),
    }
  ).then((a) => {
    // console.log(a);
  });
}
function unSafeAccount(user) {
  Account.findOneAndUpdate(
    { _id: user._id },
    {
      safeAccount: false,
      update_at: Date.now(),
    },
    (err, user) => {
      if (!err) {
      } else {
        console.log(err);
      }
    }
  );
}

function randomHistory() {
  return Math.floor(100000 + Math.random() * 900000);
}
module.exports = router;

// Sai khi chuyển tiền
