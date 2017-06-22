'use strict'
/**
 * Created by dman on 16/06/2017.
 */

const cls = require('continuation-local-storage')
const Errors = require('quantal-errors')
const _ = require('lodash')
const appModuleRoot = require('app-root-path')
const packageJson = appModuleRoot.require('/package.json')
const uuidv4 = require('uuid/v4')
const Bluebird = require('bluebird')
const clsBluebird = require('cls-bluebird')
const EventEmitter = require('events').EventEmitter

let mainMethodCalled = false
let _mainMethod = null
const _keyTraceId = 'traceId'

// Private methods
const createLogData = (mdc, customData) => ({traceId: mdc.get(_keyTraceId), data: customData})
const checkAndSetTraceId = (mdc) => {
  if (mainMethodCalled && mdc && !mdc.get(_keyTraceId)) {
    const traceId = uuidv4()
    mdc.set('traceId', traceId)
  }
}

class Logger extends EventEmitter {
  constructor (options) {
    super()
    require('lugg').init(options)

    let opts = _.omit(options, ['name', 'mdcNamespace'])
    const appName = (options && options.name) ? options.name : packageJson.name
    const _logger = require('lugg')(appName, opts)
    const mdcNamespace = (options && options.mdcNamespace) ? options.mdcNamespace : packageJson.name

    if (!mdcNamespace) {
      const illegalArgError = new Errors.IllegalArgumentError('options.mdcNamespace is required')
      _logger.error(illegalArgError)
      throw illegalArgError
    }

    this._logger = _logger
    const _mdc = cls.createNamespace(mdcNamespace)
    this.mdc = _mdc

    clsBluebird(this.mdc)
    _mainMethod = options ? options.mainMethod : null

    this.on('LOGGER_INITIALISED', () => {
      process.nextTick(() => {
        return _mdc.runAndReturn(() => {
          if (!mainMethodCalled) {
                      // initialised = true
                      // mainMethodCalled = true
            if (_mainMethod instanceof Function) {
              mainMethodCalled = true

              return _mainMethod()
            } else {
              _logger.warn('The \'main\' method (entry point) of the application using this logger has not been specified in the logger configuration. ' +
                  'If you are using the express middleware, you can ignore this warning, otherwise, please supply ' +
                  'your application\'s main method (entry point) if you want to use the continuation local storage i.e. MDC')
            }
          }
        })
      })
    })

    this.emit('LOGGER_INITIALISED')
  }

  throwing (err) {
    if (err instanceof Error) {
      this._logger.error(err)
      throw err
    }
  }

  trace (msg, ...args) {
    checkAndSetTraceId(this.getMdc())
    const logData = createLogData(this.getMdc(), args)
    this._logger.trace(logData, msg)
  }

  debug (msg, ...args) {
    checkAndSetTraceId(this.getMdc())
    const logData = createLogData(this.getMdc(), args)
    this._logger.debug(logData, msg)
  }

  info (msg, ...args) {
    checkAndSetTraceId(this.getMdc())
    const logData = createLogData(this.getMdc(), args)
    this._logger.info(logData, msg)
  }

  warn (msg, ...args) {
    checkAndSetTraceId(this.getMdc())
    const logData = createLogData(this.getMdc(), args)
    this._logger.warn(logData, msg)
  }

  error (msg, ...args) {
    checkAndSetTraceId(this.getMdc())
    const logData = createLogData(this.getMdc(), args)
    this._logger.error(logData, msg)
  }

  fatal (msg, ...args) {
    checkAndSetTraceId(this.getMdc())
    const logData = createLogData(this.getMdc(), args)
    this._logger.fatal(logData, msg)
  }

  getMdc () {
    return this.mdc
  }

    /**
     * Returns the instance of the under;ying log framework
     * @returns {*}
     */
  getLoggingFramework () {
    return this._logger
  }
}
module.exports = Logger
