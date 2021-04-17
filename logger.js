const logz = require('simple-node-logger').createSimpleFileLogger('logger.log');

let debug = true

const log = function(level, msg, email) {
  if(!debug) return;

  logz.warn(`<${email}> ` + level + ": " + msg)
}

const logArray = function(level, array, email) {
  if(!debug) return;

  for(let i = 0; i < array.length; i++) {
    logz.info(`<${email}> ` + level + ": " + array[i])
  }
}

module.exports.logger = {
  info: function(msg, email) {
    log('INFO', msg, email)
  },
  error: function(msg, email) {
    log('ERROR', msg, email)
  },
  server: function(msg, email) {
    logArray('SERVER', msg.split("\n"), email)
  },
  client: function(msg, email) {
    logArray('CLIENT', msg.split("\n"), email)
  }
}

module.exports.loggerOptions = {
  enable: function() {
    debug = true
  },
  disable: function() {
    debug = false
  }
}
