/**
 * Created by dman on 16/06/2017.
 */

const Logger = require('./../').logger
const Errors = require('quantal-errors')
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')
const Bluebird = require('bluebird')
const cls = require('continuation-local-storage')
const appModuleRoot = require('app-root-path')
const packageJson = appModuleRoot.require('/package.json')
let logger = null
let spy = null
let loggingFramework = null

describe('Logger Tests ', () => {
  beforeEach(() => {
    logger = new Logger()
    loggingFramework = logger.getLoggingFramework()
  })

  afterEach(() => {
    if (spy) { spy.restore() }
    cls.destroyNamespace(packageJson.name)
    loggingFramework = null

    logger = null
  })

  it('should create Logger', () => {
    expect(Logger).to.be.not.null()
  })

  it('should throw InvalidArgumentError given ', () => {
    expect(Logger).to.be.not.null()
  })

  it('should expect logger.getLoggingFramework to be a function', () => {
    expect(logger.getLoggingFramework).to.be.a.function()
  })

  it('should expect logger.trace to be a function', () => {
    expect(logger.trace).to.be.a.function()
  })

  it('should expect logger framework "trace" method to be called', () => {
    spy = sinon.spy(loggingFramework, 'trace')
    logger.trace('trace message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger framework "debug" method to be called', () => {
    spy = sinon.spy(loggingFramework, 'debug')
    logger.debug('debug message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger.info to be a function', () => {
    expect(logger.info).to.be.a.function()
  })

  it('should expect logger framework "info" method to be called', () => {
    spy = sinon.spy(loggingFramework, 'info')
    logger.info('info message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger.warn to be a function', () => {
    expect(logger.warn).to.be.a.function()
  })

  it('should expect logger framework "warn" method to be called', () => {
    spy = sinon.spy(loggingFramework, 'warn')
    logger.warn('warn message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger.error to be a function', () => {
    expect(logger.error).to.be.a.function()
  })

  it('should expect logger framework "error" method to be called', () => {
    spy = sinon.spy(loggingFramework, 'error')
    logger.error('error message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger.fatal to be a function', () => {
    expect(logger.fatal).to.be.a.function()
  })

  it('should expect logger framework "fatal" method to be called', () => {
    spy = sinon.spy(loggingFramework, 'fatal')
    logger.fatal('fatal message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger.throwing to be a function', () => {
    expect(logger.throwing).to.be.a.function()
  })

  it('should expect logger.throwing to throw TypeError', () => {
    const msg = 'invalid type'
    const throwing = () => {
      const typeErr = new TypeError(msg)
      logger.throwing(typeErr)
    }
    expect(throwing).to.throw(TypeError, msg)
  })

  it('should expect logger.getMdc to be a function', () => {
    expect(logger.getMdc).to.be.a.function()
    expect(logger.getMdc()).to.be.not.null()
  })

  describe('MDC / Continuation Local Storage Tests', () => {
    beforeEach(() => {
      logger = null
      loggingFramework = null
    })

    it('should use the same trace id in different async calls', (done) => {
      let traceIdDebug, traceIdWarn, traceIdFatal

      const doDebugLog = () => {
        logger.debug('debug message')
        traceIdDebug = logger.getMdc().get('traceId')
        return Promise.resolve(traceIdDebug)
      }
      const doWarnLog = () => {
        logger.warn('warn message')
        traceIdWarn = logger.getMdc().get('traceId')
        return Promise.resolve(traceIdWarn)
      }

      const doFatalLog = () => {
        logger.fatal('fatal message')
        traceIdFatal = logger.getMdc().get('traceId')
        return Promise.resolve(traceIdDebug)
      }
      const doTest = () => {
        doDebugLog()
              .then(doWarnLog)
              .then(doFatalLog)
              .then(() => {
                expect(traceIdDebug).to.be.not.undefined().and.to.be.not.null()
                expect(traceIdWarn).to.be.not.undefined().and.to.be.not.null()
                expect(traceIdFatal).to.be.not.undefined().and.to.be.not.null()
                expect(traceIdDebug).to.be.equal(traceIdWarn).and.to.be.equal(traceIdFatal)
              })
              .then(done)
              .catch(done)
      }
      cls.destroyNamespace(packageJson.name)

      loggingFramework = null
      logger = null
      logger = new Logger({mainMethod: doTest})
    })

    it('should set the MDC  / Continuation Local Storage to new supplied mdc', () => {
      logger = new Logger()
      let newMdc = cls.createNamespace('new_mdc')
      logger.setMdc(newMdc)
      const _newLoggerMdc = logger.getMdc()
      expect(_newLoggerMdc).to.not.be.null().and.to.be.instanceOf(newMdc.constructor)
    })

    it('should throw IllegalArgumentError if new  the MDC  / Continuation Local Storage is not an instance of  Continuation Local Storag Namespace', () => {
      logger = new Logger()
      let newMdc = {}
      const throws = function () {
        logger.setMdc(newMdc)
      }
      expect(throws).to.be.throw(Errors.IllegalArgumentError)
    })

    it('should disable the MDC  / Continuation of the logger', () => {
      logger = new Logger()
      logger.disableMdc()
      expect(logger.getMdc()).to.be.null()
    })

    it('should enable the MDC  / Continuation of the logger', () => {
      logger = new Logger()
      let mdc = logger.getMdc()
      logger.disableMdc()
      expect(logger.getMdc()).to.be.null()
      logger.enableMdc()
      expect(logger.getMdc()).to.equal(mdc)
    })

    it('isMdcEnabled should return false if  the MDC  / Continuation of the logger is disabled', () => {
      logger = new Logger()
      logger.disableMdc()
      expect(logger.isMdcEnabled()).to.be.false()
    })

    it('isMdcEnabled should return true if  the MDC  / Continuation of the logger is enabled', () => {
      logger = new Logger()
      logger.enableMdc()
      expect(logger.isMdcEnabled()).to.be.true()
    })
  })
})
