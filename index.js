/**
 * Diese Klassen stellt Middleware zur Authentifizierung von Benutzern da.
 * Hierbei werden Funktionen zum anmelden, abmelden, registrieren zur Verfügung
 * gestellt. Außerdem besteht die Möglichkeit ein vergessenes Passwort zurückzusetzen.
 * 
 * @author Alexander Elbracht
 */
var mongoose         = require('mongoose');                   // Database       
var bcrypt           = require('bcrypt-nodejs');              // Encryption
var nodemailer       = require('nodemailer');                 // E-Mail
var transportStub    = require('nodemailer-stub-transport');  // E-Mail Transporter Stub
var transportSmtp    = require('nodemailer-smtp-transport');  // E-Mail Transporter SMTP

var parameters = { 'environment': 'development', 'notifications': true, 'flash': false };

function Charon(userModel, config) {
  /**
   * Verbindung mit der Datenbank herstellen
   */
  mongoose.connect(config.database.url, function(err) {
    if (err) { 
      if (parameters.notifications) { log('Could not open database connection'); }
    }
  });

  /**
   * Hinzufügen bzw. ändern von Parametern.
   * @param  {String} parameter Der zu verändernde Parameter.
   * @param  {Object} value     Der Wert der an den Parameter übergeben werden soll.
   */
  Charon.prototype.set = function(parameter, value) {
    parameters[parameter] = value;
  };

  /**
   * Funktion zur Anmeldung eines Benutzers.
   * @param  {Object}   options Hier können Optionen an die Middleware übergeben werden.
   * @return {function}         Gibt die Middleware-Funktion zur Anmeldung zurück.
   */
  Charon.prototype.signin = function(options) {
    return function signin(req, res, next) {
      var successRedirect = typeof options.successRedirect !== "undefined" ? options.successRedirect : req.path;
      var failureRedirect = typeof options.failureRedirect !== "undefined" ? options.failureRedirect : req.path;
      var successMessage  = 'Signin success';
      var failureMessage  = 'Signin failure';
      var username        = validateUsername(req.body.username);
      var password        = req.body.password;

      userModel.findOne({ username: username },
        function(err, user) {
          if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
          if (!user) { return failure(req, res, failureRedirect, failureMessage, null); }

          bcrypt.compare(password, user.password, function(err, ret) {
            if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
            if (!ret) { return failure(req, res, failureRedirect, failureMessage, null); }

            req.session.user = user;
            return success(req, res, successRedirect, successMessage);
          });      
      });
    };
  };

  /**
   * Funktion zur Abmeldung eines Benutzers.
   * @param  {Object}   options Hier können Optionen an die Middleware übergeben werden.
   * @return {function}         Gibt die Middleware-Funktion zur Abmeldung zurück.
   */
  Charon.prototype.signout = function(options) {
    return function signout(req, res, next) {
      var successRedirect = typeof options.successRedirect !== "undefined" ? options.successRedirect : req.path;
      var successMessage  = 'Signout success';

      req.session.destroy();
      if (parameters.notifications) { log(successMessage); }
      return res.redirect(successRedirect);
    };
  };

  /**
   * Funktion zur Registrierung eines Benutzers.
   * @param  {Object}   options Hier können Optionen an die Middleware übergeben werden.
   * @return {function}         Gibt die Middleware-Funktion zur Registrierung zurück.
   */
  Charon.prototype.signup = function(options) {
    return function signup(req, res, next) {
      var successRedirect = typeof options.successRedirect !== "undefined" ? options.successRedirect : req.path;
      var failureRedirect = typeof options.failureRedirect !== "undefined" ? options.failureRedirect : req.path;
      var successMessage  = 'Signup success';
      var failureMessage  = 'Signup failure';
      var username        = validateUsername(req.body.username);
      var email           = validateEmail(req.body.email);
      var password        = validatePassword(req.body.password, req.body.passwordConfirm);
      
      bcrypt.hash(password, null, null, function(err, hash) {
        if (err) { return failure(req, res, failureRedirect, failureMessage, err); }

        var user = {
          username: username,
          email: email,
          password: hash
        };

        userModel.create(user, function(err, user) {
          if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
          if (!user) { return failure(req, res, failureRedirect, failureMessage, null); }
          
          req.session.user = user;
          return success(req, res, successRedirect, successMessage);
        });
      });
    };
  };

  /**
   * Funktion um Anweisungen zu erhalten, wie das Passwort zurückgesetzt wird.
   * @param  {Object}   options Hier können Optionen an die Middleware übergeben werden.
   * @return {function}         Gibt die Middleware-Funktion bei vergessenem Passwort zurück.
   */
  Charon.prototype.forgot = function(options) {
    return function forgot(req, res, next) {
      var successRedirect = typeof options.successRedirect !== "undefined" ? options.successRedirect : req.path;
      var failureRedirect = typeof options.failureRedirect !== "undefined" ? options.failureRedirect : req.path;
      var successMessage  = 'Passwort request success';
      var failureMessage  = 'Passwort request failure';
      var url             = config.server.url;
      var ipAddress       = req.connection.remoteAddress;
      var resetToken      = randomString(24);
      var email           = validateEmail(req.body.email);
      var from            = config.mail.sender;
      var subject         = 'Divisio - Reset password instructions';
      var text            = formatString('You have requested a password reset from the IP address %s.\n\nIf this was a mistake, just ignore this email and nothing will happen.\n\nTo reset your password, visit the following address. This link will expire in 24 hours.\n\n%s/reset/%s', ipAddress, url, resetToken);

      userModel.findOneAndUpdate(
        { email: email },
        { resetToken: resetToken, resetExpire: new Date().addHours(24) },
        function(err, user) {
          if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
          if (!user) { return failure(req, res, failureRedirect, failureMessage, null); }

          var transport = nodemailer.createTransport(transportStub());
          if (parameters.environment === 'production') { transport = nodemailer.createTransport(transportSmtp(config.mail.smtp)); }

          transport.sendMail({ from: from, to: email, subject: subject, text: text }, 
            function(err, info) {
              if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
              if (parameters.notifications) { log('\n' + info.response.toString()); }
              return success(req, res, successRedirect, successMessage);
            }
          );
        }
      );
    };
  };

  /**
   * Funktion zum zurücksetzen des Passworts.
   * @param  {Object}   options Hier können Optionen an die Middleware übergeben werden.
   * @return {function}         Gibt die Middleware-Funktion zum zurücksetzen des Passworts zurück.
   */
  Charon.prototype.reset = function(options) {
    return function reset(req, res, next) {
      var successRedirect = typeof options.successRedirect !== "undefined" ? options.successRedirect : req.path;
      var failureRedirect = typeof options.failureRedirect !== "undefined" ? options.failureRedirect : req.path;
      var successMessage  = 'Password reset success';
      var failureMessage  = 'Password reset failure';
      var password        = validatePassword(req.body.password, req.body.passwordConfirm);

      userModel.findOne({ resetToken: req.body.resetToken },
        function(err, user) {
          if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
          if (!user) { return failure(req, res, failureRedirect, failureMessage, null); }
          if (new Date() > user.resetExpire) { return failure(req, res, failureRedirect, failureMessage, null); }

          bcrypt.hash(password, null, null, function(err, hash) {
            if (err) { return failure(req, res, failureRedirect, failureMessage, err); }

            user.resetToken = undefined;
            user.resetExpire = undefined;
            user.password = hash;
            user.save(function(err) {
              if (err) { return failure(req, res, failureRedirect, failureMessage, err); }
            });

            return success(req, res, successRedirect, successMessage);
          });
        }
      );
    };
  };

  function success(req, res, successRedirect, successMessage) {
    if (parameters.notifications) { log(successMessage); }
    if (parameters.flash) { req.flash('info', successMessage); }
    return res.redirect(successRedirect);
  }

  function failure(req, res, failureRedirect, failureMessage, err) {
    if (err) { if (parameters.notifications) { log(err.message); } }
    if (parameters.notifications) { log(failureMessage); }
    if (parameters.flash) { req.flash('error', failureMessage); }
    return res.redirect(failureRedirect);
  }

  /**
   * Überprüft ob ein Benutzername übergeben wird und ob dieser mit dem Muster 
   * der RegEx übereinstimmt.
   * @param  {String} username Name der geprüft werden soll.
   * @return {String}          Gibt den übergebenen Namen zurück, wenn dieser valide ist.
   */
  function validateUsername(username) {
    var valUsername = [ '^[a-z0-9]+$', 'i' ];

    if (username.length > 0) {
      var regExp = new RegExp(valUsername[0], valUsername[1]);
      if (username.match(regExp)) { return username; }
    }
    return null;
  }

  /**
   * Überprüft ob eine E-Mail übergeben wird und ob diese mit dem Muster 
   * der RegEx übereinstimmt.
   * @param  {String} email E-Mail die geprüft werden soll.
   * @return {String}       Gibt die übergebene E-Mail zurück, wenn diese valide ist.
   */
  function validateEmail(email) {
    var valEmail = [ '^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?$', 'i' ];

    if (email.length > 0) {
      var regExp = new RegExp(valEmail[0], valEmail[1]);
      if (email.match(regExp)) { return email; }
    }
    return null;
  }

  /**
   * Überprüft ob zwei Passwörter übergeben wurden und ob diese identisch sind.
   * @param  {String} password        Passwort 1 das geprüft werden soll.
   * @param  {String} passwordConfirm Passwort 2 das geprüft werden soll.
   * @return {String}                 Gibt das übergebene Passwort zurück, wenn dieses valide ist.
   */
  function validatePassword(password, passwordConfirm) {
    if (password.length > 0) {
      if (password === passwordConfirm) { return password; }
    }
    return null;
  }

  /** Helper */

  /**
   * Rechnet eine übergebene Zeit auf ein Date Objekt.
   * @param  {Number} hours Stunden die auf das Datum addiert werden sollen.
   */
  Date.prototype.addHours = function(hours){
    this.setHours(this.getHours() + hours);
    return this;
  };

  /**
   * Ersetzt in einem String %s durch Variablen.
   * @param  {String} value Nicht formatierter String.
   * @return {String}       Formatierter String.
   */
  function formatString(value) {
    var args = [].slice.call(arguments, 1);
    var i = 0;

    return value.replace(/%s/g, function() {
      return args[i++];
    });
  }

  /**
   * Erstellt einen zufälligen alphanumerischen String.
   * @param  {Number} length Länge des Strings.
   * @return {String}        Zufälliger alphanumerischer String.
   */
  function randomString(length) {
    var random = '';

    for (var i = 0; i < length; i++) {
      var upper = String.fromCharCode(Math.floor(Math.random() * (91 - 65) + 65));
      var lower = String.fromCharCode(Math.floor(Math.random() * (123 - 97) + 97));
      var number = String.fromCharCode(Math.floor(Math.random() * (58 - 48) + 48));
      var choice = Math.floor(Math.random() * (4 - 1) + 1);

      if (choice === 1) { random += upper; }
      else if (choice === 2) { random += lower; }
      else if (choice === 3) { random += number; }
    }

    return random;
  }

  /**
   * Gibt eine Nachricht in der Console aus.
   * @param  {String} message Nachricht die ausgegeben wird.
   */
  function log(message) {
    console.log('[\x1b[36mCharon\x1b[0m]', message);
  }
}

exports = module.exports = Charon;
