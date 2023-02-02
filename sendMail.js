const mailer = require("nodemailer");

//Nếu không sử dụng được mail trường có thể sử dụng mail này
// let mailSend = "testprojectck@gmail.com";
// let password = "Daonhattan123";

let mailSend = "huudang28420@gmail.com";
let password = "vevwxxhnbgbnarbc";

let transporter = mailer.createTransport({
  service: "gmail",
  auth: {
    user: mailSend,
    pass: password,
  },
});

// send mail with defined transport object
module.exports.sendResetMail = async (email, token) => {
  var url = "http://localhost:9090/user/reset/" + token;
  await transporter.sendMail({
    from: mailSend, // sender address
    to: email, // list of receivers
    subject: "Yêu cầu lấy lại mật khẩu", // Subject line
    text: "Hello", // plain text body
    html: `<h3> 
            Click vào đây để khôi phục mật khẩu: ${url} </h3>`,
  });
};

module.exports.sendOTP = async (email, OTP) => {
  await transporter.sendMail({
    from: mailSend, // sender address
    to: email, // list of receivers
    subject: "OTP chuyển tiền", // Subject line
    text: "Hello", // plain text body
    html: `<h3> Đây là OTP chuyển tiền Vui lòng không gửi cho bất kì ai, hết hạn trong 60s
            <p>Mã OTP: ${OTP}</p>
            </h3>`,
  });
};

module.exports.sendInfo = async (email, username, password) => {
  await transporter.sendMail({
    from: mailSend, // sender address
    to: email, // list of receivers
    subject: "Chào mừng bạn đến với ví điên tử của chúng tôi", // Subject line
    text: "Hello", // plain text body
    html: `<h3> Đây là tài khoản và mật khẩu của bạn
            <p>username: ${username}</p>
            <p>password: ${password}</p>
            </h3>`,
  });
};

module.exports.sendBillTransfer = async (email, bill) => {
  console.log(bill);
  let date = new Date(bill.create_at);
  await transporter.sendMail({
    from: mailSend, // sender address
    to: email, // list of receivers
    subject: "Thông Tin giao dịch chuyển tiền", // Subject line
    text: "Hello", // plain text body
    html: `<h3> Chuyển tiền thành công </h3>
           <h3> Thông tin giao dịch </h3>
           <p>Người gửi: ${bill.from}</p>
            <p>Người nhận: ${bill.to}</p>
            <p>Số tiền được chuyển: + ${bill.receive}</p>
            <p>Phí: ${bill.fee}</p>
            <p>Số dư: ${bill.balance}</p>
            <p>Nội dung: ${bill.note}</p>
            <p>Ngày tạo: ${date}</p>

    `,
  });
};
