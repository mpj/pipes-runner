var Q = require('q')
Q.longStackSupport = true;
var find = require('mout/array/find')
var filter = require('mout/array/filter')
var reject = require('mout/array/reject')
var pluck = require('mout/array/pluck')
var partial = require('mout/function/partial')
var nodeDeepEqual = require('deep-equal')
var teaMerge = require('tea-merge');
var deepClone = require('mout/lang/deepClone')
var difference = require('mout/array/difference')

function findTransformByName(module, transformName) {
  return find(module.transforms, function(t) {
    return t.name === transformName
  })
}

function sendUntilDone(module, expectations, channel, message, context) {

  context = context || { events: [], deliveries: [] }

  context.deliveries.push({
    channel: channel,
    message: message
  })

  // Create expect transforms for expectations on this channel
  // and add them to the receivers
  var receivers = filter(expectations, function(expectation) {
    return expectation.channel === channel &&
           nodeDeepEqual(expectation.message, message)
  }).map(function(expectation) {
    return function expect(work) {
      if (expectation.send)
        work.done(expectation.send.channel, expectation.send.message)
      else
        work.done('ok', true)
    }
  })

  // Implicitly route messages sent to channels with the exact
  // same name as a transform.
  var implicitTransform = findTransformByName(module, channel)
  if (implicitTransform)
    receivers.push(implicitTransform)

  // Finally, add the explicitly routed transforms for execution.
  var routesOnChannel =
  filter(module.routes, { channel: channel }).forEach(function(route) {
    var transform = findTransformByName(module, route.transform)
    if (!transform) {
      context.events.push({
        received: {
          channel: channel,
          message: message
        },
        transform: {
          name: route.transform
        },
        error: {
          notFound: true
        }
      })
    } else {
      receivers.push(transform)
    }
  })

  var transformPromises = []
  receivers.forEach(function(transform) {

    var transformComplete = Q.defer()
    transformPromises.push(transformComplete.promise)

    // Disallow transforms to execute for more than 2000ms
    var timeoutHandle;
    var timedOut = false
    timeoutHandle = setTimeout(function() {
      timedOut = true
      context.events.push({
        received: {
          channel: channel,
          message: message
        },
        transform: {
          name: transform.name
        },
        error: {
          timedOut: true
        }
      })
      transformComplete.resolve(context.events)
    }, 2000)

    // Create the work object that we're going to send into
    // the transform.
    var work = {
      message: message,
      done: function(sendChannel, sendMessage) {
        if(timedOut) {
          // Transform has already timed out, don't
          // create an event from whatever comes back.
          return;
        }
        // Okay, we got a before timed out, cancel the timeout.
        clearTimeout(timeoutHandle)

        context.events.push({
          received: {
            channel: channel,
            message: message
          },
          transform: {
            name: transform.name
          },
          sent: {
            channel: sendChannel,
            message: sendMessage
          }
        })
        sendUntilDone(module, expectations, sendChannel, sendMessage, context)
          .then(transformComplete.resolve)
      }
    }

    transform(work)
  })
  return Q.all(transformPromises).then(function() { return context })


}

function runWorld(module, world) {
  return sendUntilDone(module, world.expectations, 'start', true).then(function(context) {


    var handledDeliveries = pluck(context.events, 'received')

    // FIXME: This is a bit primitive and will probably be messed up
    // if we start having multiple expectations on same channel + message,
    // i.e like expecting first and second and so forth.
    var unmetExpectations = reject(world.expectations, function(expectation) {
      return !!find(handledDeliveries, function(handled) {
        return nodeDeepEqual(handled, {
          channel: expectation.channel,
          message: expectation.message
        })
      })
    })

    var unHandledDeliveries = reject(context.deliveries, function(sent) {
      return !!find(handledDeliveries, function(handled) {
        return nodeDeepEqual(handled, sent)
      })
    })

    return {
      world: { name: world.name },
      events: context.events,
      unmet: unmetExpectations,
      unhandled: unHandledDeliveries
    }
  })
}

function moduleRunner(module) {
  return { runWorld: partial(runWorld, module) }
}

// Extend a base module with more properties.
// Will return a copy of the original module
// TODO: move this into pipes?
var extendModule = function(module, extensions) {
  return teaMerge(deepClone(module), extensions)
}

module.exports = {
  module: moduleRunner,
  extend: extendModule
}