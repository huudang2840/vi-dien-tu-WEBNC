const express = require("express");
const router = express.Router();
const Account = require("../../models/Account");
const Card = require("../../models/CardModel");
const Wallet = require("../../models/WalletModel");
const Otp = require("../../models/OTPModel");
const mailer = require("../../sendMail");
const checkNotUser = require("../../auth/CheckNotUser");
const checkLogin = require("../../auth/CheckLogin");
const checkFirstLogin = require("../../auth/CheckFirstLogin");

router.get("/", checkLogin, checkNotUser, checkFirstLogin, async function (req, res, next) {
  let username = req.session.username;
  let user = await Account.findOne({username:username}).exec();
  let wallet=await Wallet.findOne({ owner: username }).exec();

  let value;
  try {
    value = await user;
  } catch (err) {
    console.log(err);
  }
  
  res.render("wallet/wallet-home", { wallet: wallet, user: value, title: "Wallet" });
});

// Nạp tiền
router.get("/recharge", checkLogin, checkNotUser, checkFirstLogin, async function (req, res, next) {
  let username = req.session.username;
  let user = await Account.findOne({ username: username });
  let wallet = await Wallet.findOne({ owner: username });

  let type = req.flash("type");
  let error = req.flash("message");

  res.render("wallet/wallet-recharge", {
    wallet: wallet,
    user: user,
    title: "Nạp tiền",
    type: type,
    error: error,
  });
});

router.post(
  "/recharge",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let { number_card, CVV, add_money } = req.body;
    let username = req.session.username;
    let wallet = await Wallet.findOne({owner:username}).exec();
    let card = await Card.findOne({ number_card: number_card, CVV: CVV }).exec();

    if ((card && card.max_charge === undefined) || (card && card.max_charge >= add_money)) {
      if (card.card_balance < add_money || card.card_balance === 0) {
        req.flash("type", "danger");
        req.flash("message", "Số dư không đủ");
        return res.redirect("/wallet/recharge");
      }
      let balance_after = Number(wallet.account_balance) + Number(add_money);
      let wallet_history = wallet.history;
      let history = makeHistory(
        "recharge",
        number_card,
        wallet.owner,
        add_money,
        0,
        0,
        balance_after,
        "Nap tien",
        "done"
      );
      wallet_history.push(history);
      await Wallet.findOneAndUpdate(
        { owner: username },
        { account_balance: Number(balance_after), history: wallet_history, update_at: Date.now() }
      );
      await Card.findOneAndUpdate(
        { number_card: number_card, CVV: CVV },
        { card_balance: Number(card.card_balance) - Number(add_money), update_at: Date.now() }
      );
      req.flash("type", "success");
      req.flash("message", "Nạp tiền thành công");
      return res.redirect("/wallet/recharge");
    } else if (card && card.max_charge < add_money) {
      req.flash("type", "danger");
      req.flash("message", "Vượt quá hạn mức");
      return res.redirect("/wallet/recharge");
    } else {
      req.flash("type", "danger");
      req.flash("message", "Thẻ không hợp lệ");
      return res.redirect("/wallet/recharge");
    }
  }
);

// Rút tiền
router.get("/withdraw", checkLogin, checkNotUser, checkFirstLogin, async function (req, res, next) {
  let username = req.session.username;
  let user = await Account.findOne({ username: username });
  let wallet = await Wallet.findOne({ owner: username });

  let type = req.flash("type");
  let error = req.flash("message");

  res.render("wallet/wallet-withdraw", {
    wallet: wallet,
    user: user,
    title: "Rut tiền",
    error: error,
    type: type,
  });
});

router.post(
  "/withdraw",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let { number_card, CVV, date, sub_money, notes } = req.body;
    let username = req.session.username;
    let wallet =  await Wallet.findOne({owner:username}).exec();

    let card = await Card.findOne({ number_card: number_card, CVV: CVV, date: date }).exec();
    if (wallet.account_balance < sub_money) {
      req.flash("type", "danger");
      req.flash("message", "Số dư không đủ");
      return res.redirect("/wallet/withdraw");
    }
    if (sub_money % 50000 !== 0) {
      req.flash("type", "danger");
      req.flash("message", "Số tiền rút phải là bội số của 50,0000VND");
      return res.redirect("/wallet/withdraw");
    }

    let history = await Wallet.find();
    console.log(history);
    if (!card) {
      req.flash("type", "danger");
      req.flash("message", "Thông tin thẻ không hợp lệ!!");
      return res.redirect("/wallet/withdraw");
    } else {
      if (wallet.account_balance < sub_money) {
        req.flash("type", "danger");
        req.flash("message", "Số dư ví không đủ");
        return res.redirect("/wallet/withdraw");
      } else {
        let wallet_history = wallet.history;
        let fee = (sub_money * 5) / 100;
        let balance_after = Number(wallet.account_balance) - Number(sub_money) - Number(fee);

        if (sub_money >= 5000000) {
          wallet_history.push(
            makeHistory(
              "withdraw",
              wallet.owner,
              number_card,
              0,
              sub_money,
              fee,
              wallet.account_balance,
              notes,
              "waiting"
            )
          );
          await Wallet.findOneAndUpdate(
            { owner: username },
            { history: wallet_history, update_at: Date.now() }
          );
          req.flash("type", "success");
          req.flash("message", "Chờ duyệt rút tiền");
          return res.redirect("/wallet/withdraw");
        }
        wallet_history.push(
          makeHistory(
            "withdraw",
            wallet.owner,
            number_card,
            0,
            sub_money,
            fee,
            balance_after,
            notes,
            "done"
          )
        );
        await Wallet.findOneAndUpdate(
          { owner: username },
          { account_balance: Number(balance_after), history: wallet_history, update_at: Date.now() }
        );
        await Card.findOneAndUpdate(
          { number_card: number_card, CVV: CVV, date: date },
          { card_balance: Number(card.card_balance) + Number(sub_money), update_at: Date.now() }
        );
        req.flash("type", "success");
        req.flash("message", "Rút tiền thành công");
        return res.redirect("/wallet/withdraw");
      }
      //Rút tiền từ ví về card
    }
  }
);

// Chuyển tiền
router.get("/transfer", checkLogin, checkNotUser, checkFirstLogin, async function (req, res, next) {
  let username = req.session.username;
  let user = await Account.findOne({ username: username });
  let wallet = await Wallet.findOne({ owner: username });

  let type = req.flash("type");
  let error = req.flash("message");

  res.render("wallet/wallet-transfer", {
    wallet: wallet,
    user: user,
    title: "Chuyển tiền",
    type: type,
    error: error,
  });
});

router.post(
  "/transfer",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let { phone, money_transfer, notes } = req.body;
    let userReceive = await Account.findOne({ phone: phone }).exec();
    let walletUserCurrent = await Wallet.findOne({ owner: req.session.username }).exec();
    let fee = (Number(money_transfer) * 5) / 100;

    if (!phone || !money_transfer) {
      req.flash("type", "danger");
      req.flash("message", "Vui lòng nhập thông tin");
      return res.redirect("/wallet/transfer");
    }

    if (userReceive.username === walletUserCurrent.owner) {
      req.flash("type", "danger");
      req.flash("message", "Không tự gửi cho chính mình");
      return res.redirect("/wallet/transfer");
    }
    if (!userReceive) {
      req.flash("type", "danger");
      req.flash("message", "Thông tin người nhận không tồn tại");
      return res.redirect("/wallet/transfer");
    } else if (walletUserCurrent.account_balance < money_transfer) {
      req.flash("type", "danger");
      req.flash("message", "Số dư không đủ");
      return res.redirect("/wallet/transfer");
    } else {
      // let walletReceive = await Wallet.findOne({ owner: userReceive.username }).exec();

      return res.render("wallet/wallet-transfer-cofirm", {
        userReceive,
        money_transfer,
        notes,
        fee,
        user: userReceive,
        wallet: walletUserCurrent,
      });
    }
  }
);

// Xác thực OTP
router.post(
  "/transfer-OTP",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let { money_transfer, phone, notes, fee, person_pay, otp } = req.body;
    console.log(money_transfer, phone, notes, fee, person_pay, otp);
    let userCurrent = await Account.findOne({ username: req.session.username }).exec();
    let walletCurrent = await Wallet.findOne({ owner: userCurrent.username }).exec();

    let userReceive = await Account.findOne({ phone: phone }).exec();
    let walletReceive = await Wallet.findOne({ owner: userReceive.username }).exec();

    let balance_after_current;
    let balance_after_receive;

    let wallet_history_current = walletCurrent.history;
    let wallet_history_receive = walletReceive.history;
    let getOTP = await Otp.findOne({ email: userCurrent.email }).exec();

    if (!getOTP) {
      req.flash("type", "danger");
      req.flash("message", "Mã OTP hết hạn");
      return res.redirect("/wallet/transfer");
    } else if (Number(getOTP.OTP) === Number(otp)) {
      // Xóa OTP sau khi nhập đúng
      await Otp.findOneAndDelete({ email: userCurrent.email });
      // Chuyển dưới 5tr
      if (money_transfer < 5000000) {
        if (person_pay === "me") {
          // Cập nhật ví của người chuyển
          balance_after_current =
            Number(walletCurrent.account_balance) - Number(fee) - Number(money_transfer);
          wallet_history_current.push(
            makeHistory(
              "transfer",
              userCurrent.username,
              userReceive.username,
              0,
              Number(money_transfer),
              fee,
              balance_after_current,
              notes,
              "done"
            )
          );

          await Wallet.findOneAndUpdate(
            { owner: userCurrent.username },
            {
              account_balance: Number(balance_after_current),
              history: wallet_history_current,
              update_at: Date.now(),
            }
          );

          // Cập nhật ví của người nhận
          balance_after_receive = Number(walletReceive.account_balance) + Number(money_transfer);
          wallet_history_receive.push(
            makeHistory(
              "transfer",
              userCurrent.username,
              userReceive.username,
              Number(money_transfer),
              0,
              0,
              balance_after_receive,
              notes,
              "done"
            )
          );
          await Wallet.findOneAndUpdate(
            { owner: userReceive.username },
            {
              account_balance: Number(balance_after_receive),
              history: wallet_history_receive,
              update_at: Date.now(),
            }
          );

          // Gủi mail thông tin chuyển tiền
          sendMailBillTransfer(
            userReceive.email,
            userCurrent.username,
            userReceive.username,
            Number(money_transfer),
            0,
            balance_after_receive,
            notes
          );

          req.flash("type", "success");
          req.flash("message", "Chuyển tiền thành công, người gửi trả phí");
          return res.redirect("/wallet/transfer");
        } else if (person_pay === "userReceive") {
          balance_after_current = Number(walletCurrent.account_balance) - Number(money_transfer);
          wallet_history_current.push(
            makeHistory(
              "transfer",
              userCurrent.username,
              userReceive.username,
              0,
              Number(money_transfer),
              0,
              balance_after_current,
              notes,
              "done"
            )
          );

          await Wallet.findOneAndUpdate(
            { owner: userCurrent.username },
            {
              account_balance: Number(balance_after_current),
              history: wallet_history_current,
              update_at: Date.now(),
            }
          );

          // Cập nhật ví của người nhận
          balance_after_receive =
            Number(walletReceive.account_balance) + Number(money_transfer) - Number(fee);
          wallet_history_receive.push(
            makeHistory(
              "transfer",
              userCurrent.username,
              userReceive.username,
              Number(money_transfer),
              0,
              fee,
              balance_after_receive,
              notes,
              "done"
            )
          );
          await Wallet.findOneAndUpdate(
            { owner: userReceive.username },
            {
              account_balance: Number(balance_after_receive),
              history: wallet_history_receive,
              update_at: Date.now(),
            }
          );
          // Gủi mail thông tin chuyển tiền
          sendMailBillTransfer(
            userReceive.email,
            userCurrent.username,
            userReceive.username,
            Number(money_transfer),
            0,
            balance_after_receive,
            notes
          );

          req.flash("type", "success");
          req.flash("message", "Chuyển tiền thành công, người nhận trả phí");
          return res.redirect("/wallet/transfer");
        } else {
          req.flash("type", "danger");
          req.flash("message", "Lỗi giao dịch! Vui lòng thử lại");
          return res.redirect("/wallet/transfer");
        }
      }
      // Xử lý chuyển trên 5tr
      else {
        if (person_pay === "me") {
          // Cập nhật ví của người chuyển
          balance_after_current =
            Number(walletCurrent.account_balance) - Number(fee) - Number(money_transfer);
          wallet_history_current.push(
            makeHistory(
              "transfer",
              userCurrent.username,
              userReceive.username,
              0,
              Number(money_transfer),
              fee,
              balance_after_current,
              notes,
              "waiting"
            )
          );

          await Wallet.findOneAndUpdate(
            { owner: userCurrent.username },
            { history: wallet_history_current, update_at: Date.now() }
          );

          req.flash("type", "success");
          req.flash("message", "Chờ duyệt chuyển tiền");
          return res.redirect("/wallet/transfer");
        } else if (person_pay === "userReceive") {
          balance_after_current = Number(walletCurrent.account_balance) - Number(money_transfer);
          wallet_history_current.push(
            makeHistory(
              "transfer",
              userCurrent.username,
              userReceive.username,
              0,
              Number(money_transfer),
              0,
              balance_after_current,
              notes,
              "waiting"
            )
          );

          await Wallet.findOneAndUpdate(
            { owner: userCurrent.username },
            { history: wallet_history_current, update_at: Date.now() }
          );

          req.flash("type", "success");
          req.flash("message", "Chờ duyệt chuyển tiền");
          return res.redirect("/wallet/transfer");
        } else {
          req.flash("type", "danger");
          req.flash("message", "Lỗi giao dịch");
          return res.redirect("/wallet/transfer");
        }
      }
    } else {
      req.flash("type", "danger");
      req.flash("message", "Sai mã OTP giao dịch thất bại");
      return res.redirect("/wallet/transfer");
    }
  }
);

router.post(
  "/transfer-confirm",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let { money_transfer, phone, notes, fee, person_pay } = req.body;
    let userCurrent = await Account.findOne({ username: req.session.username }).exec();
    let walletCurrent = await Wallet.findOne({ owner: req.session.username }).exec();

    if (
      person_pay === "me" &&
      Number(money_transfer) + Number(fee) > Number(userCurrent.account_balance)
    ) {
      req.flash("type", "danger");
      req.flash("message", "Số dư không đủ");
      return res.redirect("/wallet/transfer");
    } else if (Number(money_transfer) > Number(userCurrent.account_balance)) {
      req.flash("type", "danger");
      req.flash("message", "Số dư không đủ");
      return res.redirect("/wallet/transfer");
    } else {
      let getOTP = randomOTP();
      let otp = new Otp({
        email: userCurrent.email,
        OTP: getOTP,
      });
      otp.save();
      mailer.sendOTP(userCurrent.email, getOTP);

      return res.render("wallet/wallet-transfer-OTP", {
        money_transfer,
        phone,
        notes,
        fee,
        person_pay,
        user: userCurrent,
        wallet: walletCurrent,
        title: "Xác nhận OTP",
      });
    }
  }
);
// Chuyển tiền

// Mua thẻ cào
router.get(
  "/phonecard",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let username = req.session.username;
    let user = await Account.findOne({ username: username });
    let wallet = await Wallet.findOne({ owner: username });

    let type = req.flash("type");
    let error = req.flash("message");

    res.render("wallet/wallet-phonecard", {
      wallet: wallet,
      user: user,
      title: "Thẻ điện thoại",
      type: type,
      error: error,
    });
  }
);

router.post(
  "/phonecard",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let { code_card, money_card, number_card } = req.body;
    let walletCurrent = await Wallet.findOne({ owner: req.session.username }).exec();
    let walletHistory = walletCurrent.history;
    let nameCard;

    switch (code_card) {
      case "11111":
        nameCard = "Viettel";
        break;
      case "22222":
        nameCard = "Mobifone";
        break;
      case "33333":
        nameCard = "Vinafone";
        break;
      default:
        req.flash("type", "danger");
        req.flash("message", "Thẻ không hợp lệ");
        return res.redirect("/wallet/phonecard");
    }

    let seriCard = [];
    for (let i = 0; i < Number(number_card); i++) {
      seriCard.push(String(code_card) + String(randomPhoneCard()));
    }
    let totalBill = Number(money_card) * Number(number_card);
    if (totalBill > walletCurrent.account_balance) {
      req.flash("type", "danger");
      req.flash("message", "Số dư không đủ");
      return res.redirect("/wallet/phonecard");
    } else if (number_card > 5) {
      req.flash("type", "danger");
      req.flash("message", "Vượt quá số lượng mua");
      return res.redirect("/wallet/phonecard");
    } else {
      walletHistory.push({
        id: randomHistory(),
        type: "phonecard",
        sub_money: totalBill,
        fee: 0,
        wallet_balance: Number(walletCurrent.account_balance) - Number(totalBill),
        phone_card: {
          name: nameCard,
          seri: seriCard,
          money: money_card,
        },
        status: { type: String, default: "done" },
        create_at: { type: Date, default: Date.now() },
      });
      await Wallet.findOneAndUpdate(
        { owner: req.session.username },
        {
          account_balance: Number(walletCurrent.account_balance) - Number(totalBill),
          history: walletHistory,
          update_at: Date.now(),
        }
      );
      console.log(nameCard, seriCard, totalBill);
      req.flash("type", "success");
      req.flash("message", "Mua thẻ điện thoại thành công");
      return res.redirect("/wallet/phonecard");
    }
  }
);
// Mua thẻ cào

// Xem lịch sử giao dịch
router.get("/history", checkLogin, checkNotUser, checkFirstLogin, async function (req, res, next) {
  let walletCurrent = await Wallet.findOne({ owner: req.session.username }).exec();
  let user = await Account.findOne({ username: req.session.username });
  let history = walletCurrent.history;
  let historySort = history.sort((dateA, dateB) => dateB.create_at - dateA.create_at);

  let type = req.flash("type");
  let error = req.flash("message");

  res.render("wallet/wallet-history", {
    history: historySort,
    user: user,
    wallet: walletCurrent,
    title: "Lịch sử giao dịch",
    type: type,
    error: error,
  });
});

router.get(
  "/history/:id",
  checkLogin,
  checkNotUser,
  checkFirstLogin,
  async function (req, res, next) {
    let user = await Account.findOne({ username: req.session.username });
    let id = req.params.id;
    let walletCurrent = await Wallet.findOne({
      owner: req.session.username,
    }).exec();
    let history = walletCurrent.history;
    let historyDetail = history.find((item) => item.id === id);
    let phone_card = historyDetail.phone_card;

    res.render("wallet/wallet-history-detail", {
      history: historyDetail,
      phone_card: phone_card,
      user: user,
      wallet: walletCurrent,
      title: "Chi tiết lịch sử giao dịch",
    });
  }
);


function makeHistory(type, from, to, add_money, sub_money, fee, wallet_balance, contents, status) {
  return {
    id: randomHistory(),
    type: type,
    from: from,
    to: to,
    add_money: add_money,
    sub_money: sub_money,
    fee: fee,
    wallet_balance: wallet_balance,
    contents: contents,
    status: status,
    create_at: Date.now(),
  };
}
function randomOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

function randomPhoneCard() {
  return Math.floor(Math.random() * 90000) + 10000;
}

function randomHistory() {
  return Math.floor(100000 + Math.random() * 900000);
}

function sendMailBillTransfer(email, from, to, receive, fee, balance, note) {
  let billTransfer = {
    from: from,
    to: to,
    receive: receive,
    fee: fee,
    balance: balance,
    note: note,
    create_at: Date.now(),
  };
  mailer.sendBillTransfer(email, billTransfer);
}
module.exports = router;
