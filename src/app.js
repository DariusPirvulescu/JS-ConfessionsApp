require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose"); 
const session = require("express-session");
const passport = require("passport");
const passportMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Local DB
mongoose.connect("mongodb://" + process.env.DB_HOST + "/confessionsUserDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Remote DB
// mongoose.connect(
//   "mongodb+srv://dario-admin:" +
//     process.env.DB_PASS +
//     "@cluster0-bhjc9.mongodb.net/confessionsDB",
//   {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   }
// );

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  confession: String,
});

userSchema.plugin(passportMongoose, { usernameUnique: false });
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        "https://confessions-app.herokuapp.com/auth/google/confessions",
      // callbackURL: "http://localhost:3000/auth/google/confessions",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      //log profile
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:
        "https://confessions-app.herokuapp.com/auth/facebook/confessions",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ facebookId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("home", { currentUser: req.user });
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/confessions",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/confessions");
  }
);

app.get("/auth/facebook", passport.authenticate("facebook"));

app.get(
  "/auth/facebook/confessions",
  passport.authenticate("facebook", {
    successRedirect: "/confessions",
    failureRedirect: "/login",
  })
);

app.get("/register", (req, res) => {
  res.render("register", { currentUser: req.user });
});

app.get("/login", (req, res) => {
  res.render("login", { currentUser: req.user });
});

app.get("/confessions", (req, res) => {
  if (req.isAuthenticated()) {
    User.find(
      { confession: { $exists: true, $ne: null } },
      (err, resultUsers) => {
        res.render("confessions", {
          currentUser: req.user,
          usersArr: resultUsers,
        });
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit", { currentUser: req.user });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/confessions");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {
  passport.authenticate("local", function (err, user, info) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    }

    if (!user) {
      console.log(info);
      res.redirect("/login");
    }

    req.logIn(user, function (err) {
      if (err) {
        console.log(err);
        return err;
      }
      return res.redirect("/confessions");
    });
  })(req, res);
});

app.post("/submit", (req, res) => {
  const inputConfession = req.body.confession;
  console.log(req.user);

  User.findById(req.user.id, (err, resultedUser) => {
    if (err) {
      console.log(err);
    } else {
      if (resultedUser) {
        resultedUser.confession = inputConfession;
        resultedUser.save(() => {
          res.redirect("/confessions");
        });
      }
    }
  });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function () {
  console.log("server at port 3000");
});