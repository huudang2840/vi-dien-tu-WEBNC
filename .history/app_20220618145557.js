// require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const credentials = require("./credentials");
const mongoose = require("mongoose");
const checkLogin = require("./auth/CheckLogin");
const checkNotUser = require("./auth/CheckNotUser");

const indexRouter = require("./routes/index");
const userRouter = require("./routes/Users/userRouter");
const walletRouter = require("./routes/Wallet/walletRouter");
const adminRouter = require("./routes/Admin/adminRouter");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
const expressSession = require("express-session");
const flash = require("express-flash");
app.use(cookieParser("dnt0706"));
app.use(expressSession({ cookie: { maxAge: 600000 } }));
app.use(flash());

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const opts = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.Promise = global.Promise;
// switch (app.get('env')) {
//     case 'development':
mongoose.connect(credentials.mongo.development.connectionString, opts).then(
  () => {
    console.log("Kết nối thành công");
  },
  (err) => {
    console.log(err);
  }
);

app.use("/", indexRouter);

app.use("/user", checkNotUser, userRouter);
app.use("/wallet", walletRouter);
app.use("/admin", adminRouter);

// catch 404 and forward to error handler
app.get("/", (req, res, next) => {
  res.json({ code: 0, message: "REST API" });
});

app.use(function (req, res, next) {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// error handler
app.use(function (req, res, next) {
  next(createError(404));
});
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("Listening on http://localhost:" + port);
});

module.exports = app;
