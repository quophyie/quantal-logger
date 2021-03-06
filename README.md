# Quant Beat Logger

**`Quant Beat`** is a simple logger that wraps around [lugg](https://github.com/aexmachina/lugg "lugg") which is in itself, a simple wrapper
around [bunyan](https://github.com/trentm/node-bunyan "bunyan") (a powerful logging framework). **`Quant Beat`**  adds additional super powers to [lugg](https://github.com/aexmachina/lugg "lugg")
and in effect [bunyan](https://github.com/trentm/node-bunyan "bunyan") by providing Mapper Diagnostic Context (MDC) features
using [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage").

According to the documentation of [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage"), 
_"Continuation-local storage works like thread-local storage in threaded programming, but is based on chains of Node-style callbacks instead of threads.
The standard Node convention of functions calling functions is very similar to 
something called ["continuation-passing style"](http://en.wikipedia.org/wiki/Continuation-passing_style) in functional programming, and the name comes from the
way this module allows you to set and get values that are scoped to the lifetime of these chains of
function calls"_. 

In simple terms, the [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage") provides a 
storage area (i.e. a map) that allows asynchronous calls to store data in the map and to retrieve that data at some later point in another asynchronous
call as though the data was added in the local context of the retrieving the asynchronous call. As an example, anything that could
be put on the **`req`** object so that it can be retrieved later can and should be put in the [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage")
to stop the **`req`** object being passed around unnecessarily or being passed to every method that needs the data
that was put on the **`req`** object

The [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage") allows
us to do some very powerful things in logging in an asynchronous system like  node. 
In **`quant-beat`**, [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage") is
used for among other things, storing a **`traceId`** that is added to the response headers (as **`X-TraceId`** header) if you are 
using the **`quant-beat express middleware`**. The  **`traceId`** can  be used to trace requests through
distributed systems such as microservices which perform distributed logging

# Install

**`npm install quant-beat`**

# Usage

###  Usage

####  Normal Usage

####  Note

**`quant beat`** depends on [lugg](https://github.com/aexmachina/lugg "lugg") which takes inspiration from [debug](https://www.npmjs.com/package/debug)
but is not dependent on  [debug](https://www.npmjs.com/package/debug) hence if you want to see logs at **`debug`** or **`trace `** level, you must set the **`DEBUG`** environment
variable to the name of your application e.g. **`DEBUG=MYAPP`**

In the example usage below of the **`quant-beat`** logger, **`traceId`** will be automatically added to all log lines

```javascript
'use strict'
const Logger = require('quant-beat').logger
// Notethe we specify the mainMethod option in the options object as we are not using the express middleware
const logger = new Logger({mainMethod: myMainMethod})

// this will automatically add traceId to the log entry if it does not exist already exits
// If traceId exists, it will be used in subseguent log entries as though the traceId was created 
// in the subsequent async call

const logPoint1 = () => {
  // traceId will be created here and added to the log line if does not exist  
  logger.info('some debug message at log point 1') 
   return Promise.resolve("some logging at log point 1")
}

const logPoint2 = () => {
  // traceId will be created here and added to the log line if does not exist  
  logger.info('some debug message at log point 2') 
   return Promise.resolve("some logging at log point 2")
}

const myMainMethod = () => {
    // traceId will be created here and added to the log line if does not exist
    logPoint1()
    // The traceId created at log point 1 will be used here automatically and added to the log line
    .then(logPoint2)
}
```

####  Throwing and logging exception

One of the most annoying things (for me at least) about logging is dealing with throwing 
and logging exception. In most cases, when exceptions are thrown, the exception should be logged before 
throwing. In most cases, developers do something like below


```javascript
'use strict'
const Logger = require('quant-beat').logger
const logger = new Logger()

// this will automatically add traceId to the log entry if it does not exist already

const log  = () => {
  try {
      const err = new TypeError("dude!! this is the wrong  type")
      logger.error(err)
      throw err
  } catch (e) {
    // ...
   }
}
```

With **`quant-beat`**, the boiler plate has been made simpler. The code below will log and throw the
the error passed to it.
**`traceId`** will also be automatically added to all log lines

```javascript
'use strict'
const Logger = require('quant-beat').logger
const logger = new Logger({mainMethod: log})

// this will automatically add traceId to the log entry if it does not exist already

const log  = () => {
      const err = new TypeError("dude!! this is the wrong  type")
      // traceId will also be automatically added to all log lines
      logger.throwing(err)
}
```

### Express Usage

To use the express middleware, simply use **`loggerExpress`** middleware of **`quant-beat`** as described below
The **`X-TraceId`** header will be automatically added to the response header. 
**`traceId`** will also be automatically added to all log lines


```javascript
//service-1.js
const logPoint1 = () => {
  logger.info('some debug message at log point 1') 
   return Promise.resolve("some logging at log point 1")
}

module.exports = logPoint1

```

```javascript
//service-2.js

const logPoint2 = () => {
  logger.info('some info message at log point 1') 
   return Promise.resolve("some logging at log point 1")
}

module.exports = logPoint2

```

```javascript
// controller.js
'use strict'
const express = require('express')
const router = express()
const middleware = require('quant-beat').loggerExpress
const Logger = require('quant-beat').logger
const service1 = require('./service-1')
const service2 = require('./service-2')

const logger = new Logger({useUuidAsTraceId: true}) // Will set the Java Spring Cloud Sleuth headers`X-B3-TraceId` 

router.use(middleware(logger))

router.get('/hello', function (req, res) {
    
  // traceId will be created here and added to the log line if does not exist  
  service1.logPoint1()
  
  // The traceId created at log point 1 will be used in log point 2 automatically and added to the log line
    .then(service2.logPoint2)
    .then(() => {
      
    // The traceId created at log point 1 will be used here automatically  and to the log line  
      logger.info('logging finished')
      
    // The traceId created at log point 1 will be automatically added to the response headers as
    // 'X-TraceId' when the 'finish', 'close' or 'end' events are called on res (response) object
      res.send('world')
    })
  
})

module.exports = router
```

## Quant Beat API

#### constructor([options])

- **`options.mainMethod`** - This is **`main`** method / entry point method of an application. This is required **if you want to use the MDC / [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage")**
 in a an application / module that does not use the express middleware (i.e this is optional even in a non-express context because the logger can still be used without the MDC but the **`traceId`** will not be automatically propagated). In such applications / modules,  
 **`quant-beat`** uses the **`main`** method specified by **`options.mainMethod`**  to determine the root of the [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage")
 context. 
 **This mainMethod option should not be set if you are using the express middleware**

- **`options.mdcNamespace`** - The namespce name that is used when the [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage")
 is created
 
- **`options.name`** - The name that is passed to [lugg](https://github.com/aexmachina/lugg "lugg") 
 and in effect [bunyan](https://github.com/trentm/node-bunyan "bunyan")
 
- **`{boolean} options.useBunyanFormat`** - if true, uses [bunyan-format module](https://github.com/thlorenz/bunyan-format) to format the output

- **`options.bunyanFormatOpts`** - The options that are passed to [bunyan-format module](https://github.com/thlorenz/bunyan-format) if **`{boolean} options.useBunyanFormat`** is true

- **`options.useUuid4AsTraceId`** - if true UUIDV4 will be used as the traceId else otherweise a hexadecimal of length 19 will be generated and used if using the mdc
 
 
 See [bunyan](https://github.com/trentm/node-bunyan "bunyan") and [lugg](https://github.com/aexmachina/lugg "lugg")
  for more information about options


#### throwing(Error)

Logs and throws the supplied exception / error

#### getMdc

Returns the MDC (i.e. [continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage")) associated
with the current call chain. Users can add their own data to this MDC i.e ([continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage")) 

For example

```javascript
'use strict'
const Logger = require('quant-beat').logger
const logger = new Logger({mainMethod: myMainMethod})

// this will automatically add traceId to the log entry if it does not exist already

const myMainMethod  = () => {
      const mdc = logger.getMdc()
      mdc.set('someKey', 'someValue')
      someMethodThatEventuallyCallsTestMethod()
}

const testMethod = () => {
  const someKeyValue =  logger.getMdc().get('someKey') 
  logger.info('someKey: %s', someKeyValue) 
  return Promise.resolve("retrieved someKeyValue from mdc")
}

const someMethodThatEventuallyCallsTestMethod = () => {
    // Doing lots of processing...
    // This method or one of the methods that someMethodThatEventuallyCallsTestMethod calls can retrieve the value of someKey in from the cls / mdc
    
    return testMethod()
    
}

```


#### getLoggingFramework

Returns the underlying logging framework ([bunyan](https://github.com/trentm/node-bunyan "bunyan") in this case). 
The underlying framework may change in the future but that should not affect the **`quant-beat`** interface


#### Methods trace, debug, info, warn, error, fatal

Calling any of the [Level](https://github.com/trentm/node-bunyan#levels) [methods](https://github.com/trentm/node-bunyan#log-method-api) will
add **`traceId`** to the MDC i.e ([continuation local storage](https://github.com/othiym23/node-continuation-local-storage "continuation local storage"))
associated with logger in the current call chain

See [bunyan](https://github.com/trentm/node-bunyan "bunyan") and [lugg](https://github.com/aexmachina/lugg "lugg") for more information

### Express Middleware API

**`options.setSpringCloudSleuthHeaders`** - if true, the Java [spring cloud sleuth headers](http://cloud.spring.io/spring-cloud-sleuth/) **`X-B3-TraceId`** will be set
