// IMPORTING RELEVANT MODULES
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const MongoStore = require("connect-mongo");

const dotenv = require("dotenv");
dotenv.config();
const dbURI = process.env.dbURI || "mongodb://localhost:27017/noCap";
const AppError = require("./utils/appError");
const modules = require("./routes/modules");
const user = require("./routes/user");
const User = require("./models/user");

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const app = express();
let PORT = process.env.PORT || 3000;

// CONFIGURATIONS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true })); // parsing req.body
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "static"))); // serving static files
app.use(mongoSanitize()); // prevent mongo injections
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
); // security

const secret = process.env.secret || "secret";

const sessionConfig = {
  name: "session",
  secret: secret, // add to dotenv
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: dbURI,
    touchAfter: 24 * 3600, // time period in seconds
  }),
  proxy: true,
  cookie: {
    secure: true, // for production
    expires: Date.now() + 1000 * 60 * 60 * 24, // One Day
    maxAge: 1000 * 60 * 60 * 24,
  },
};
app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// ROUTING
app.use("/modules", modules);
app.use("/user", user);

app.get("/", (req, res) => {
  delete req.session.returnTo;
  res.render("index");
});

app.all("*", (req, res, next) => {
  next(new AppError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something Went Wrong!";
  res.render("error", { err });
});

// BINDS AND LISTENS FOR CONNECTION
app.listen(PORT, () => {
  console.log(`Serving on port ${PORT}`);
});

module.exports = app;
