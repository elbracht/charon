# Charon

Authentication middleware for Node.js

## Install

```
$ npm install charon-auth
```

## Test

```
$ node test/server.js
```

## Usage

```js
var express      = require('express');
var app          = express();

var Charon       = require('charon-auth');
var charonUser   = require('./model.js');    // See user model
var charonConfig = require('./config.json'); // See configuration
var auth         = new Charon(charonUser, charonConfig);

// Optional parameter
auth.set('environment', 'productive');
auth.set('notifications', true);
auth.set('flash', true);

app.post('/signin', auth.signin({
  successRedirect: '/',
  failureRedirect: '/signin'
}));
```

#### User model

```js
var mongoose       = require('mongoose');
var mongooseUnique = require('mongoose-unique-validator');

var userSchema = mongoose.Schema({
    username:    { type: String, required: true, unique: true },
    email:       { type: String, required: true, unique: true },
    password:    { type: String, required: true },
    resetToken:  { type: String },
    resetExpire: { type: Date }
});

userSchema.plugin(mongooseUnique);

module.exports = mongoose.model('User', userSchema);
```

#### Configuration

```js
{
  "server": {
    "url": "http://localhost:3000"
  },
  "database": {
    "url": "mongodb://localhost/charon"
  },
  "mail": {
    "sender": "noreply@charon.com",
    "smtp": {
      "host": "localhost",
      "port": 25,
      "auth": {
        "user": "username",
        "pass": "password"
      }
    }
  }
}
```

## Functions

|                             |      Function      |                 Parameter                  |
| --------------------------- | ------------------ | ------------------------------------------ |
| **Sign in**                 | `signin(options)`  | username; password                         |
| **Sign out**                | `signout(options)` |                                            |
| **Sign up**                 | `signup(options)`  | username; email; password; passwordConfirm |
| **Send reset instructions** | `forgot(options)`  | email                                      |
| **Reset password**          | `reset(options)`   | resetToken; password; passwordConfirm;     |

#### Options

Set options as JSON Array

```
{
  successRedirect: '/'
  failureRedirect: '/'
}
```

#### Example

```js
app.post('/signin', auth.signin({
  successRedirect: '/',
  failureRedirect: '/signin'
}));
```

```html
<form action="/signin" method="POST">
  <input type="text" name="username" placeholder="Username" required="" autofocus="">
  <input type="password" name="password" placeholder="Password" required="">
  <button type="submit">Sign in</button>
</form>
```