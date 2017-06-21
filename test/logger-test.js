/**
 * Created by dman on 16/06/2017.
 */

const Logger = require('./../').logger
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')
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
    logger.fatal('trace message')
    sinon.assert.calledOnce(spy)
  })

  it('should expect logger.throwing to be a function', () => {
    expect(logger.throwing).to.be.a.function()
  })

  it('should expect logger.getMdc to be a function', () => {
    expect(logger.getMdc).to.be.a.function()
    expect(logger.getMdc()).to.be.not.null()
  })
})
