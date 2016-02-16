var express      = require('express');
var session      = require('express-session');
var flash        = require('express-flash');
var bodyParser   = require('body-parser');
var app          = express();
 
var Charon       = require('../index.js');
var charonUser   = require('./model.js');
var charonConfig = require('./config.json'); 
var auth         = new Charon(charonUser, charonConfig);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({secret: 'aw5rDw27f9cDCa201bvD', resave: false, saveUninitialized: false }));
app.use(flash());

app.post('/signin', auth.signin({
  successRedirect: '/',
  failureRedirect: '/signin'
}));

app.post('/signup', auth.signup({
  successRedirect: '/',
  failureRedirect: '/signup'
}));

app.post('/signout', auth.signout({
  successRedirect: '/signin'
}));

app.listen(3000, function () {
  console.log('listening on *:3000');
});