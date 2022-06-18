var express = require("express");
var router = express.Router();
const Account = require("../../models/Account");
const Wallet = require("../../models/WalletModel");
const Card = require("../../models/CardModel");
const crypto = require("crypto");
const multer = require("multer");
const checkLogin = require("../../auth/CheckLogin");
const isAdmin = require("../../auth/isAdmin");
const checkAdmin = require("../../auth/CheckAdmin");

// Hiển thị danh sách tài khoản đang đơi xác minh
router.get("/", checkLogin, checkAdmin, async (req, res, next) => {
  let userUnactive = await Account.find({ verifyAccount: "waiting", lockAccount: false }).exec();
  return res.render("admin/waiting", { userUnactive: userUnactive });
});


// Hiển thị danh sách tài khoản đang đơi xác minh
router.get("/waiting", checkLogin, checkAdmin, async (req, res, next) => {
    let userUnactive = await Account.find({ verifyAccount: "waiting", lockAccount: false }).exec();
    return res.render("admin/waiting", { userUnactive: userUnactive });
  });

// Hiển thị danh sách tài khoản đang đơi cập nhật

router.get("/updating", checkLogin, checkAdmin, async (req, res, next) => {
  let userUpdating = await Account.find({ verifyAccount: "updating", lockAccount: false }).exec();
  let userSort = userUpdating.sort((dateA, dateB) => dateB.update_at - dateA.update_at);
  return res.render("admin/updating", { userSort: userSort });
});
//Hiển thị danh sách tài khoản đã xác minh
router.get("/active", checkLogin, checkAdmin, async (req, res, next) => {
  let userActive = await Account.find({ verifyAccount: "done" }).exec();
  let userSort = userActive.sort((dateA, dateB) => dateB.update_at - dateA.update_at);
  return res.render("admin/active", { userSort: userSort });
});

// Hiển thị danh sách tài khoản bị vô hiệu hóa
router.get("/disable", checkLogin, checkAdmin, async (req, res, next) => {
  let userDisable = await Account.find({ verifyAccount: "disable", lockAccount: false }).exec();
  let userSort = userDisable.sort((dateA, dateB) => dateB.update_at - dateA.update_at);
  return res.render("admin/disable", { userSort: userSort });
});

// Hiển thị danh sách tài khoản  bị khóa vô thời hạn
router.get("/block", checkLogin, checkAdmin, async (req, res, next) => {
  let userBlock = await Account.find({ lockAccount: true }).exec();
  let userSort = userBlock.sort((dateA, dateB) => dateB.update_at - dateA.update_at);
  return res.render("admin/block", { userSort: userSort });
});

// Xem thông tin chi tiết của một user
router.get("/infoUser/:username", checkLogin, checkAdmin, async (req, res) => {
  let username = req.params.username;
  let history, state;
  let block = false;
  let user = await Account.findOne({ username: username }).exec();
  if (user) {
    let userWallet = await Wallet.findOne({ owner: username }).exec();
    // Xem trạng thái của user
    if (user.lockAccount == true) {
      block = true;
      state = "Tài khoản bị khóa vĩnh viễn";
    } else if (user.verifyAccount == "disable") {
      state = "Tài khoản bị vô hiệu hóa do chưa cập nhật CMND";
    } else if (user.verifyAccount == "waiting") {
      state = "Đang chờ xác minh";
    } else if (user.verifyAccount == "done") {
      state = "Đã xác minh";
    } else if (user.verifyAccount == "updating") {
      state = "Đang chờ cập nhật";
    }
    return res.render("admin/infoUser", {
      user: user,
      balance: userWallet.account_balance,
      state: state,
      block: block,
      history: userWallet.history,
    });
  } else {
    return res.send("Không tìm thấy user");
  }
});

// Mở khóa tài khoản bị khóa vĩnh viễn
router.get("/unblock/:username", checkLogin, checkAdmin, async (req, res) => {
  let username = req.params.username;
  let user = await Account.findOne({ username: username, lockAccount: true }).exec();
  if (user) {
    await Account.findOneAndUpdate(
      { username: username },
      { lockAccount: false, safeAccount: true, countLogin: 0 }
    );
    return res.redirect("/admin/infoUser/" + username);
  } else {
    return res.send("Username không hợp lệ");
  }
});

// Xác minh tài khoản
router.get("/active/:username", checkLogin, checkAdmin, async (req, res) => {
  let username = req.params.username;
  let user = await Account.findOne({ username: username }).exec();
  if (user) {
    await Account.findOneAndUpdate({ username: username }, { verifyAccount: "done" });
    return res.redirect("/admin/infoUser/" + username);
  } else {
    return res.send("Username không hợp lệ");
  }
});

// Hủy => Vô hiệu hóa
router.get("/disable/:username", checkLogin, checkAdmin, async (req, res) => {
  let username = req.params.username;
  let user = await Account.findOne({ username: username }).exec();
  if (user) {
    await Account.findOneAndUpdate({ username: username }, { verifyAccount: "disable" });
    return res.redirect("/admin/infoUser/" + username);
  } else {
    return res.send("Username không hợp lệ");
  }
});

//yêu cầu cập nhật CMND => Chờ cập nhật
router.get("/updating/:username", checkLogin, checkAdmin, async (req, res) => {
  let username = req.params.username;
  let user = await Account.findOne({ username: username }).exec();
  if (user) {
    await Account.findOneAndUpdate({ username: username }, { verifyAccount: "updating" });
    return res.redirect("/admin/infoUser/" + username);
  } else {
    return res.send("Username không hợp lệ");
  }
});

// Xem danh sách các giao dịch cần phê duyệt
router.get("/approveTransaction", checkLogin, checkAdmin, async (req, res) => {
  let waitingTransaction = [];
  let transaction = await Wallet.find().exec();
  transaction.forEach((e) => {
    e.history.forEach((i) => {
      if (i.status === "waiting") {
        waitingTransaction.push(i);
      }
    });
  });
  let sortTransactionByMonth = sortByMonth(waitingTransaction)
  let finalSort = sortTransactionByMonth.sort((dateA, dateB) => dateB.create_at - dateA.create_at);
  res.render("admin/approveTransaction", { waitingTransaction: finalSort });
});

//Chi tiết của giao dịch
router.get("/detailTransaction/:id", checkLogin, checkAdmin, async (req, res) => {
  let id = req.params.id;
  let transaction = await Wallet.find().exec();
  let a;
  transaction.forEach((e) => {
    e.history.forEach((i) => {
      if (i.id === id) {
        a = i;
        return a;
      }
    });
  });
  res.render("admin/detailTransaction", { detail: a });
});

//Chấp nhận giao dịch
router.get("/acceptTransaction/:owner/:id", checkLogin, checkAdmin, async (req, res) => {
  let id = req.params.id;
  let owner = req.params.owner;
  let a; //Dùng để lưu lại giao dịch và chỉnh sửa trạng thái
  let historyReceiver;
  let wallet = await Wallet.findOne({ owner: owner }).exec();


  let history = wallet.history; //Tất cả lịch sử giao dich của người thực hiện

  //Vòng lặp để tìm giao dịch đang cần duyệt
  for (let i = 0; i < history.length; i++) {
    if (history[i].id === id) {
      let j = history[i];
      a = {
        id: j.id,
        type: j.type,
        from: j.from,
        to: j.to,
        add_money: j.add_money,
        sub_money: j.sub_money,
        fee: j.fee,
        wallet_balance: j.wallet_balance,
        contents: j.contents,
        status: "done",
        create_at: j.create_at,
        update_at: Date.now(),
      };
      
      history[i] = a;
    }
  }
  console.log("history")
  console.log(history)
 

  let userSender_wallet = await Wallet.findOne({ username: a.from }).exec(); //Tìm thông tin ví của người gửi
  let current_balance_sender = userSender_wallet.account_balance; // Lấy số dư hiện tại của người gửi


  let userReceiver_wallet = await Wallet.findOne({ username: a.to }).exec(); //Tìm thông tin ví của người nhận
  let current_balance_receiver = userReceiver_wallet.account_balance; // Lấy số dư hiện tại của người nhận
  historyReceiver = userReceiver_wallet.history //Lưu lịch sử giao dịch của người nhận dạng Array


  // Trường hợp loại giao dịch là chuyển tiền
  if (a.type === "transfer") {

    if (Number(a.fee) === 0) {
    //Trường hợp người nhận trả tiền phí
    //Cập nhật số dư sau khi chuyển tiền và thêm vào lịch sử giao dịch của người thực hiện giao dịch
    let balance_sender_after = Number(current_balance_sender) - Number(a.sub_money) // Số dư sau khi giao dịch
      let userSender_balance_after = await Wallet.findOneAndUpdate(
        { owner: a.from },
        {
          account_balance: balance_sender_after,
          history: history,
        }
      ).exec();

      balance_receiver_after = Number(current_balance_receiver) + (Number(a.sub_money) - ((Number(a.sub_money) * 5) / 100));

      historyReceiver.push( 
        makeHistory(
          "transfer",
          a.from,
          a.to,
          Number(a.sub_money),
          0,
          ((Number(a.sub_money) * 5) / 100),
          balance_receiver_after,
          a.contents,
          "done"
        )
      );
      let userReceiver_balance_after = await Wallet.findOneAndUpdate(
        { owner: a.to },
        { account_balance: balance_receiver_after, history: historyReceiver }
      );

    } else if (Number(a.fee) !== 0){
      //Trường hợp người gửi trả tiền phí
      //Cập nhật ví của người gửi
      let userSender_balance_after = await Wallet.findOneAndUpdate(
        { owner: a.from },
        {
          account_balance: Number(current_balance_sender) - Number(a.sub_money) - Number(a.fee),
          history: history,
        }
      ).exec();

      historyReceiver.push(
        makeHistory(
          "transfer",
          a.from,
          a.to,
          Number(a.sub_money),
          0,
          0,
          Number(current_balance_receiver) + Number(a.sub_money),
          a.contents,
          "done"
        )
      );
    }
    //Cập nhật số dư và lịch sử giao dịch cho người nhận
    let userReceiver_balance_after = await Wallet.findOneAndUpdate(
      { owner: a.to },
      {
        account_balance:Number(current_balance_receiver) + Number(a.sub_money),
        history: historyReceiver,
      }
    ).exec();

  } 
  else if (a.type === "withdraw") {
    let card = await Card.findOne({ number_card: a.to }).exec();
    let card_current_balance = card.card_balance;
    let card_update_balance = await Card.findOneAndUpdate(
      { number_card: a.to },
      { card_balance: Number(card_current_balance) + Number(a.sub_money) }
    );
    let update_history_user_withdraw = await Wallet.findOneAndUpdate(
      { owner: a.from },
      {
        account_balance:
          Number(current_balance_sender) - Number(a.sub_money) - Number(a.fee),
        history: history,
      }
    ).exec();

  }

  res.redirect("/admin/approveTransaction");
});

//Không chấp nhận giao dịch
router.get("/deniedTransaction/:owner/:id", checkLogin, checkAdmin, async (req, res) => {
  let owner = req.params.owner
  let id = req.params.id
  let wallet = await Wallet.findOne({ owner: owner }).exec();
 
  let history = wallet.history;
  for (let i = 0; i < history.length; i++) {
    if (history[i].id === id) {
      let j = history[i];
      a = {
        id: j.id,
        type: j.type,
        from: j.from,
        to: j.to,
        add_money: j.add_money,
        sub_money: j.sub_money,
        fee: j.fee,
        wallet_balance: j.wallet_balance,
        contents: j.contents,
        status: "deny",
        create_at: j.create_at,
        update_at: Date.now(),
        _id:j._id
      };
      history[i] = a;
    }
  }
  let userReceiver_balance_after = await Wallet.findOneAndUpdate({ owner: owner },{history: history}).exec();
  res.redirect("/admin/approveTransaction");
});


router.get("/logout", (req, res) => {
    req.session.destroy();
    return res.redirect("/user/login");
  });

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
    update_at: Date.now(),
  };
}




function randomHistory() {
  return Math.floor(Date.now() + 100000 + Math.random() * 900000);
}

module.exports = router;



function sortByMonth(list){
  let transactionByMonth=[]
  let today = new Date();
  let current_month =  today.getMonth();
  list.forEach(e => {
      if(e.create_at.getMonth() === current_month)
      transactionByMonth.push(e)

  })

  return transactionByMonth
}